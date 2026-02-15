"use client";

import { useState } from "react";
import { isApiError } from "@/lib/auth-context";
import { createBooking } from "@/lib/api";
import { invalidateBookings, invalidateResources } from "@/lib/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CalendarDays, Clock, MapPin, AlertCircle } from "lucide-react";
import type { Resource } from "@/lib/types";

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: Resource | null;
  date: Date;
  hour: number;
  userId: string;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour === 12) return "12:00 PM";
  if (hour > 12) return `${hour - 12}:00 PM`;
  return `${hour}:00 AM`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Build a UTC ISO string for a given date + hour.
 * Treats the displayed hour as UTC (consistent with the grid).
 */
function toUtcIso(date: Date, hour: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:00:00Z`;
}

export function BookingDialog({
  open,
  onOpenChange,
  resource,
  date,
  hour,
  userId,
}: BookingDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!resource) return;
    setError("");
    setIsSubmitting(true);

    const startUtc = toUtcIso(date, hour);
    const endUtc = toUtcIso(date, hour + 1);

    console.log("[v0] Creating booking:", { resourceId: resource.id, userId, startUtc, endUtc });

    try {
      const result = await createBooking(resource.id, userId, startUtc, endUtc);
      console.log("[v0] Booking created:", result);
      toast.success("Booking confirmed!", {
        description: `${resource.name} - ${formatHour(hour)} to ${formatHour(hour + 1)}`,
      });
      invalidateBookings();
      // Refresh resource lists/counts/availability so UI reflects the new booking
      invalidateResources(resource.type);
      onOpenChange(false);
    } catch (err) {
      console.log("[v0] Booking error:", err);
      if (isApiError(err)) {
        setError(err.detail || err.title);
      } else {
        setError("Failed to create booking. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // Reset error when dialog opens/closes
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setError("");
    onOpenChange(nextOpen);
  }

  if (!resource) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Booking</DialogTitle>
          <DialogDescription>
            Review the details below and confirm your reservation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{resource.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {resource.location}
                    {resource.capacity > 1 ? ` - Capacity: ${resource.capacity}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{formatDate(date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatHour(hour)} - {formatHour(hour + 1)}
                  </p>
                  <p className="text-xs text-muted-foreground">1 hour slot (UTC)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Booking...
              </>
            ) : (
              "Confirm Booking"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
