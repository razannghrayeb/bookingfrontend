"use client";

import { useState } from "react";
import { cancelBooking } from "@/lib/api";
import { invalidateBookings, invalidateResources } from "@/lib/hooks";
import { isApiError } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CalendarDays, Clock, X, Loader2 } from "lucide-react";
import type { Booking } from "@/lib/types";

interface BookingCardProps {
  booking: Booking;
  userId: string;
  resourceName?: string;
}

function formatDateTime(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

export function BookingCard({ booking, userId, resourceName }: BookingCardProps) {
  const [isCancelling, setIsCancelling] = useState(false);

  const start = formatDateTime(booking.startUtc);
  const end = formatDateTime(booking.endUtc);

  const isActive = booking.status === "Active";
  const isPast = new Date(booking.endUtc) < new Date();
  const canCancel = isActive && !isPast;

  async function handleCancel() {
    setIsCancelling(true);
    try {
      await cancelBooking(booking.id, userId);
      toast.success("Booking cancelled successfully.");
      invalidateBookings();
      // Also refresh resource lists/counts/availability
      invalidateResources();
    } catch (err) {
      if (isApiError(err)) {
        toast.error(err.detail || err.title);
      } else {
        toast.error("Failed to cancel booking.");
      }
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
        isActive && !isPast && "bg-card border-border",
        isActive && isPast && "bg-muted/30 border-border/60",
        !isActive && "bg-muted/20 border-border/40"
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            {resourceName || booking.resourceId.slice(0, 8)}
          </p>
          <Badge
            variant={
              isActive && !isPast
                ? "default"
                : isActive && isPast
                ? "secondary"
                : "outline"
            }
            className={cn(
              isActive && !isPast && "bg-slot-available text-card",
              !isActive && "text-muted-foreground"
            )}
          >
            {!isActive ? "Cancelled" : isPast ? "Completed" : "Active"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {start.date}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {start.time} - {end.time}
          </span>
        </div>

        {booking.cancelledAtUtc && (
          <p className="text-xs text-muted-foreground">
            Cancelled on {formatDateTime(booking.cancelledAtUtc).date}
          </p>
        )}
      </div>

      {canCancel && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive">
              {isCancelling ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="mr-2 h-3.5 w-3.5" />
              )}
              Cancel
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel your booking for{" "}
                <span className="font-medium text-foreground">
                  {start.date} at {start.time}
                </span>
                . This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Booking</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, Cancel Booking
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
