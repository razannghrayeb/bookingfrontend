"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateNavigatorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

function formatDateHeader(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isBookableDate(date: Date): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  // Bookable when date is within the next 3 days (inclusive)
  return diff >= 0 && diff <= 3;
}

export function DateNavigator({ selectedDate, onDateChange }: DateNavigatorProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const canGoPrev = selectedDate > today;

  // Generate 5 days for the mini picker
  const startDay = addDays(selectedDate, -2);
  const days = Array.from({ length: 5 }, (_, i) => addDays(startDay, i));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <CalendarDays className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-base sm:text-lg font-semibold text-foreground">
          {formatDateHeader(selectedDate)}
        </h2>
        {isBookableDate(selectedDate) && (
          <span className="rounded-full bg-slot-available/15 px-2 py-0.5 text-[11px] font-medium text-slot-available">
            Bookable
          </span>
        )}
        {!isBookableDate(selectedDate) && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            View Only
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDateChange(today)}
          className={cn(
            "text-xs",
            isSameDay(selectedDate, today) && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          )}
        >
          Today
        </Button>
      

        <div className="flex items-center rounded-lg border bg-card">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDateChange(addDays(selectedDate, -1))}
            disabled={!canGoPrev}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Mini day picker */}
          <div className="hidden items-center gap-0.5 px-1 sm:flex">
            {days.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const isPast = day < today && !isToday;
              const within3 = isBookableDate(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => !isPast && onDateChange(day)}
                  disabled={isPast}
                  className={cn(
                    "flex flex-col items-center rounded-md px-2 py-1 text-xs transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isPast
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : within3
                      ? "text-foreground hover:bg-accent"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span className="text-[10px] font-medium uppercase">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <span className={cn("text-sm font-semibold", isToday && !isSelected && "text-primary")}>
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDateChange(addDays(selectedDate, 1))}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
