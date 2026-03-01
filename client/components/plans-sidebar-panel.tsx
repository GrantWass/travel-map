"use client";

import Image from "next/image";
import { Notebook, X, MapPin, BedDouble } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { SavedActivityEntry, SavedLodgingEntry } from "@/lib/trip-models";

interface PlansSidebarPanelProps {
  savedActivities: SavedActivityEntry[];
  savedLodgings: SavedLodgingEntry[];
  onClose: () => void;
  onOpenTrip: (tripId: number) => void;
  onToggleSavedActivity: (activityId: number) => void;
  onToggleSavedLodging: (lodgingId: number) => void;
}

export default function PlansSidebarPanel({
  savedActivities,
  savedLodgings,
  onClose,
  onOpenTrip,
  onToggleSavedActivity,
  onToggleSavedLodging,
}: PlansSidebarPanelProps) {
  const totalCount = savedActivities.length + savedLodgings.length;

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-2">
          <Notebook className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Plans</h2>
          {totalCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {totalCount}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/60 text-foreground transition-colors hover:bg-secondary"
          aria-label="Close plans panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          {totalCount === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4">
              <p className="text-sm font-medium text-foreground">Nothing saved yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Select an activity or lodging in a trip, then tap "Save to Plans".
              </p>
            </div>
          ) : (
            <>
              {savedActivities.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Activities ({savedActivities.length})
                  </p>
                  {savedActivities.map((entry) => (
                    <div key={entry.activity.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                      <button
                        type="button"
                        onClick={() => onOpenTrip(entry.tripId)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                          <Image
                            src={entry.activity.image || entry.tripThumbnail}
                            alt={entry.activity.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{entry.activity.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{entry.tripTitle}</p>
                          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                            <span className="min-w-0 break-words whitespace-normal">{entry.activity.address}</span>
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleSavedActivity(entry.activity.id)}
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                        aria-label="Remove from plans"
                        title="Remove from plans"
                      >
                        <Notebook className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {savedLodgings.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Places Stayed ({savedLodgings.length})
                  </p>
                  {savedLodgings.map((entry) => (
                    <div key={entry.lodging.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                      <button
                        type="button"
                        onClick={() => onOpenTrip(entry.tripId)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                          <Image
                            src={entry.lodging.image || entry.tripThumbnail}
                            alt={entry.lodging.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{entry.lodging.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{entry.tripTitle}</p>
                          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                            <BedDouble className="h-3 w-3 flex-shrink-0 mt-0.5" />
                            <span className="min-w-0 break-words whitespace-normal">{entry.lodging.address}</span>
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleSavedLodging(entry.lodging.id)}
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                        aria-label="Remove from plans"
                        title="Remove from plans"
                      >
                        <Notebook className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
