"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { BookingCard } from "@/components/booking-card";
import { useUserBookings, useResources } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/auth-context";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, ChevronLeft, ChevronRight, Filter } from "lucide-react";

type FilterStatus = "all" | "active" | "cancelled" | "past";

export default function MyBookingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const { data: bookingsData, isLoading: bookingsLoading } = useUserBookings(
    user?.userId || null,
    page,
    50
  );

  // Fetch all resource types to build a name lookup map
  const { data: roomsData, error: roomsError } = useResources("Room");
  const { data: desksData, error: desksError } = useResources("Desk");
  const { data: parkingData, error: parkingError } = useResources("ParkingSpot");

  const resources400Error =
    (roomsError && isApiError(roomsError) && roomsError.status === 400) ||
    (desksError && isApiError(desksError) && desksError.status === 400) ||
    (parkingError && isApiError(parkingError) && parkingError.status === 400);

  const resourceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of roomsData?.items || []) map.set(r.id, r.name);
    for (const r of desksData?.items || []) map.set(r.id, r.name);
    for (const r of parkingData?.items || []) map.set(r.id, r.name);
    return map;
  }, [roomsData, desksData, parkingData]);

  const allBookings = bookingsData?.items || [];

  const filteredBookings = useMemo(() => {
    const now = new Date();
    return allBookings.filter((b) => {
      if (filter === "all") return true;
      if (filter === "active") return b.status === "Active" && new Date(b.endUtc) >= now;
      if (filter === "cancelled") return b.status === "Cancelled";
      if (filter === "past") return b.status === "Active" && new Date(b.endUtc) < now;
      return true;
    });
  }, [allBookings, filter]);

  const totalPages = bookingsData?.totalPages || 1;
  const hasNext = bookingsData?.hasNextPage || false;
  const hasPrev = bookingsData?.hasPreviousPage || false;

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
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground text-balance">My Bookings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage all your reservations.
            </p>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterStatus)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bookings</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bookings list */}
        {bookingsLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : resources400Error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">Failed to show resources</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No bookings found</p>
            <p className="text-xs text-muted-foreground">
              {filter !== "all"
                ? "Try changing the filter to see more bookings."
                : "Head to the booking page to make your first reservation."}
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
              Book a resource
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                userId={user.userId}
                resourceName={resourceMap.get(booking.resourceId)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrev}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
