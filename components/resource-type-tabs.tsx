"use client";

import { cn } from "@/lib/utils";
import type { ResourceType } from "@/lib/types";
import { Monitor, DoorOpen, Car } from "lucide-react";

interface ResourceTypeTabsProps {
  selected: ResourceType;
  onChange: (type: ResourceType) => void;
  counts?: Record<ResourceType, number>;
}

const tabs: { type: ResourceType; label: string; icon: typeof Monitor }[] = [
  { type: "Room", label: "Meeting Rooms", icon: DoorOpen },
  { type: "Desk", label: "Desks", icon: Monitor },
  { type: "ParkingSpot", label: "Parking", icon: Car },
];

export function ResourceTypeTabs({ selected, onChange, counts }: ResourceTypeTabsProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl border bg-card p-1 overflow-x-auto whitespace-nowrap">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = selected === tab.type;
        const count = counts?.[tab.type];

        return (
          <button
            key={tab.type}
            type="button"
            onClick={() => onChange(tab.type)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="truncate">{tab.label}</span>
            {count !== undefined && (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
