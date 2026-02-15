"use client";

import { useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Resource, Booking } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Monitor, DoorOpen, Car, MapPin, Users, Info } from "lucide-react";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7);
const SLOT_WIDTH = 72;

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
}

function getResourceIcon(type: string) {
  switch (type) {
    case "Room":
      return DoorOpen;
    case "Desk":
      return Monitor;
    case "ParkingSpot":
      return Car;
    default:
      return Info;
  }
}

// ============================================
// Slot status calculation
// ============================================

type SlotStatus = "available" | "yours" | "unavailable" | "past" | "disabled";

interface SlotInfo {
  status: SlotStatus;
  bookingId?: string;
}

function getSlotStatus(
  resourceId: string,
  hour: number,
  selectedDate: Date,
  userBookings: Booking[],
  availableSet: Set<string>,
  isBookable: boolean
): SlotInfo {
  const now = new Date();

  const y = selectedDate.getFullYear();
  const m = selectedDate.getMonth();
  const d = selectedDate.getDate();
  const slotStart = new Date(Date.UTC(y, m, d, hour, 0, 0));
  const slotEnd = new Date(Date.UTC(y, m, d, hour + 1, 0, 0));

  if (slotEnd <= now) {
    return { status: "past" };
  }

  if (!isBookable) {
    return { status: "disabled" };
  }

  for (const booking of userBookings) {
    if (booking.resourceId === resourceId && booking.status === "Active") {
      const bStart = new Date(booking.startUtc);
      const bEnd = new Date(booking.endUtc);
      if (slotStart < bEnd && slotEnd > bStart) {
        return { status: "yours", bookingId: booking.id };
      }
    }
  }

  const key = `${resourceId}_${hour}`;
  if (availableSet.has(key)) {
    return { status: "available" };
  }

  return { status: "unavailable" };
}

// ============================================
// Props
// ============================================

interface TimeSlotGridProps {
  resources: Resource[];
  userBookings: Booking[];
  availabilityMap: Map<string, Set<string>>; // hour -> Set<resourceId>
  selectedDate: Date;
  isBookable: boolean;
  currentUserId: string | null;
  isLoading: boolean;
  onSlotClick: (resourceId: string, hour: number) => void;
}

// ============================================
// Component
// ============================================

export function TimeSlotGrid({
  resources,
  userBookings,
  availabilityMap,
  selectedDate,
  isBookable,
  currentUserId,
  isLoading,
  onSlotClick,
}: TimeSlotGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build a lookup set: "resourceId_hour" for available resources
  const availableSet = useMemo(() => {
    const set = new Set<string>();
    for (const [hourKey, resourceIds] of availabilityMap.entries()) {
      for (const rid of resourceIds) {
        set.add(`${rid}_${hourKey}`);
      }
    }
    return set;
  }, [availabilityMap]);

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getUTCHours();
      const scrollIndex = Math.max(0, currentHour - 7);
      const slotWidthStr = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--slot-width") : null;
      const slotWidth = slotWidthStr ? parseInt(slotWidthStr, 10) : SLOT_WIDTH;
      scrollRef.current.scrollLeft = scrollIndex * slotWidth;
    }
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex">
          <div className="shrink-0 border-r bg-card z-10">
            <div className="flex h-12 items-center border-b px-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resource
              </span>
            </div>
            {resources.map((resource) => {
              const Icon = getResourceIcon(resource.type);
              return (
                <div
                  key={resource.id}
                  className="flex h-14 items-center gap-3 border-b px-4 last:border-b-0 min-w-[180px] sm:min-w-[240px]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {resource.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {resource.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {resource.location}
                        </span>
                      )}
                      {resource.capacity > 1 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 shrink-0" />
                          {resource.capacity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex-1 overflow-x-auto time-grid-scroll" ref={scrollRef}>
            <div className="flex h-12 border-b">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="flex shrink-0 items-center justify-center border-r last:border-r-0"
                  style={{ width: 'var(--slot-width, 72px)' }}
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatHour(hour)}
                  </span>
                </div>
              ))}
            </div>

            {resources.map((resource) => (
              <div key={resource.id} className="flex h-14 border-b last:border-b-0">
                {HOURS.map((hour) => {
                  const slotInfo = getSlotStatus(
                    resource.id,
                    hour,
                    selectedDate,
                    userBookings,
                    availableSet,
                    isBookable
                  );

                  const isClickable = slotInfo.status === "available" && !isLoading;

                  return (
                    <Tooltip key={hour}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={!isClickable}
                          onClick={() => {
                            if (isClickable) {
                              onSlotClick(resource.id, hour);
                            }
                          }}
                          className={cn(
                            "shrink-0 border-r last:border-r-0 transition-all duration-150 relative group",
                            slotInfo.status === "available" &&
                              "bg-slot-available/15 hover:bg-slot-available/30 cursor-pointer",
                            slotInfo.status === "yours" &&
                              "bg-slot-yours/30 cursor-default",
                            slotInfo.status === "unavailable" &&
                              "bg-slot-unavailable/50 cursor-not-allowed",
                            slotInfo.status === "past" &&
                              "bg-slot-past cursor-not-allowed",
                            slotInfo.status === "disabled" &&
                              "bg-muted/30 cursor-not-allowed",
                            isLoading && slotInfo.status !== "past" && slotInfo.status !== "disabled" && "animate-pulse"
                          )}
                          style={{ width: 'var(--slot-width, 72px)', height: "100%" }}
                          aria-label={`${resource.name} at ${formatHour(hour)} - ${slotInfo.status}`}
                        >
                          <div
                            className={cn(
                              "absolute inset-1 rounded-md transition-all",
                              slotInfo.status === "available" &&
                                "bg-slot-available/20 group-hover:bg-slot-available/40",
                              slotInfo.status === "yours" && "bg-slot-yours/50",
                              slotInfo.status === "unavailable" && "bg-slot-unavailable/30",
                              slotInfo.status === "past" && "bg-transparent",
                              slotInfo.status === "disabled" && "bg-transparent"
                            )}
                          />
                          {slotInfo.status === "yours" && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-slot-yours" />
                            </div>
                          )}
                          {slotInfo.status === "unavailable" && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-1 w-4 rounded-full bg-slot-unavailable" />
                            </div>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-medium">{resource.name}</p>
                        <p>
                          {formatHour(hour)} - {formatHour(hour + 1)}
                        </p>
                        <p className="capitalize">
                          {slotInfo.status === "yours"
                            ? "Your Booking"
                            : slotInfo.status === "disabled"
                            ? "Not bookable (outside allowed window)"
                            : slotInfo.status}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}

            {resources.length === 0 && !isLoading && (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No resources found for this category.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-t bg-muted/30 px-4 py-2.5">
          <LegendItem color="bg-slot-available/30" label="Available" />
          <LegendItem color="bg-slot-yours/50" label="Your Booking" />
          
          <LegendItem color="bg-muted/50" label="Unavailable" />
        </div>
      </div>
    </TooltipProvider>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-3 w-6 rounded-sm", color)} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
