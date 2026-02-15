"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { TimeSlotGrid } from "@/components/time-slot-grid";
import { DateNavigator } from "@/components/date-navigator";
import { ResourceTypeTabs } from "@/components/resource-type-tabs";
import { BookingDialog } from "@/components/booking-dialog";
import { useResources, useUserBookings, useAvailability } from "@/lib/hooks";
import { getResourcesAvailability } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/auth-context";
import { AlertCircle } from "lucide-react";
import type { ResourceType, Resource, Booking } from "@/lib/types";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7);

function isBookableDate(date: Date): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  // Bookable when date is within the next 3 days (inclusive) and not in the past
  return diff >= 0 && diff <= 3;
}

function toUtcIso(date: Date, hour: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:00:00Z`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [selectedType, setSelectedType] = useState<ResourceType>("Room");
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogResource, setDialogResource] = useState<Resource | null>(null);
  const [dialogHour, setDialogHour] = useState(9);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const { data: roomsData, error: roomsError } = useResources("Room");
  const { data: desksData, error: desksError } = useResources("Desk");
  const { data: parkingData, error: parkingError } = useResources("ParkingSpot");

  const resources400Error =
    (roomsError && isApiError(roomsError) && roomsError.status === 400) ||
    (desksError && isApiError(desksError) && desksError.status === 400) ||
    (parkingError && isApiError(parkingError) && parkingError.status === 400);

  const resourcesData =
    selectedType === "Room"
      ? roomsData
      : selectedType === "Desk"
      ? desksData
      : parkingData;

  const resources = resourcesData?.items || [];
  const resourcesLoading = !resourcesData;

  // Resource counts
  const counts = useMemo<Record<ResourceType, number>>(
    () => ({
      Room: roomsData?.totalCount ?? 0,
      Desk: desksData?.totalCount ?? 0,
      ParkingSpot: parkingData?.totalCount ?? 0,
    }),
    [roomsData, desksData, parkingData]
  );

  // Fetch user bookings
  const { data: bookingsData } = useUserBookings(user?.userId || null, 1, 100);
  const userBookings: Booking[] = bookingsData?.items || [];

  const bookable = isBookableDate(selectedDate);

  const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(
    selectedDate.getDate()
  ).padStart(2, "0")}`;

  const {
    data: availabilityData,
    mutate: mutateAvailability,
    isLoading: availabilityLoading,
  } = useAvailability(selectedType, dateStr);

  const availabilityMap = availabilityData ?? new Map();

  const { data: resourcesRefreshSignal } = useSWR("resources-refresh-signal", () => null, { revalidateOnFocus: false });

  useEffect(() => {
    mutateAvailability?.();
  }, [mutateAvailability, resourcesRefreshSignal]);

  const [sseConnected, setSseConnected] = useState(false);

  useEffect(() => {
    if (!bookable || resources.length === 0) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/notifications/resources`);

      es.onopen = () => {
        setSseConnected(true);
      };

      es.onmessage = () => {
        mutateAvailability?.();
      };

      es.onerror = (err) => {
        console.info("[v0] SSE connection error, falling back to polling", err);
        setSseConnected(false);
        if (es) {
          try {
            es.close();
          } catch {}
        }
      };
    } catch (err) {
      setSseConnected(false);
    }

    return () => {
      if (es) {
        try {
          es.close();
        } catch {}
      }
      setSseConnected(false);
    };
  }, [bookable, resources.length, mutateAvailability]);

  useEffect(() => {
    if (!bookable || resources.length === 0 || sseConnected) return;

    const POLL_INTERVAL = 30_000; // 30 seconds
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      mutateAvailability?.();
    };

    const id = setInterval(tick, POLL_INTERVAL);
    tick();

    return () => clearInterval(id);
  }, [mutateAvailability, bookable, resources.length, sseConnected]);

  // Re-fetch availability after booking changes (with debounce to avoid loops)
  const prevBookingsCountRef = useRef<number | null>(null);
  useEffect(() => {
    const count = bookingsData?.items?.length ?? null;
    if (prevBookingsCountRef.current !== null && count !== prevBookingsCountRef.current) {
      mutateAvailability?.();
    }
    prevBookingsCountRef.current = count;
  }, [bookingsData?.items?.length, mutateAvailability]);

  function handleSlotClick(resourceId: string, hour: number) {
    const resource = resources.find((r) => r.id === resourceId);
    if (resource) {
      setDialogResource(resource);
      setDialogHour(hour);
      setDialogOpen(true);
    }
  }

  const isLoading = resourcesLoading || availabilityLoading;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground text-balance">Book a Resource</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a time slot to make a reservation. Bookings are allowed for dates within the next 3 days.
          </p>
        </div>

        <ResourceTypeTabs
          selected={selectedType}
          onChange={setSelectedType}
          counts={counts}
        />

        <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />

        
        {resourcesLoading && resources.length === 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : resources400Error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">Failed to show resources</p>
          </div>
        ) : (
          <TimeSlotGrid
            resources={resources}
            userBookings={userBookings}
            availabilityMap={availabilityMap}
            selectedDate={selectedDate}
            isBookable={bookable}
            currentUserId={user.userId}
            isLoading={availabilityLoading}
            onSlotClick={handleSlotClick}
          />
        )}
      </div>

      <BookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource={dialogResource}
        date={selectedDate}
        hour={dialogHour}
        userId={user.userId}
      />
    </AppShell>
  );
}
