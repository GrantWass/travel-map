"use client";

import Image from "next/image";
import { useState } from "react";
import { BedDouble, ChevronDown, ChevronRight, FolderOpen, MapPin, Notebook, Plus, Trash2, X } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { SavedActivityEntry, SavedLodgingEntry } from "@/lib/client-types";

interface PlansSidebarPanelProps {
  savedActivities: SavedActivityEntry[];
  savedLodgings: SavedLodgingEntry[];
  collections: string[];
  selectedCollection: string | null;
  onClose: () => void;
  onOpenTrip: (tripId: number) => void;
  onToggleSavedActivity: (activityId: number) => void;
  onToggleSavedLodging: (lodgingId: number) => void;
  onCreateCollection: (name: string) => void;
  onDeleteCollection: (name: string) => void;
  onMoveActivity: (activityId: number, collectionName: string | null) => void;
  onMoveLodging: (lodgingId: number, collectionName: string | null) => void;
  onSelectCollection: (name: string | null) => void;
}

interface ItemCardProps {
  thumbnail: string;
  title: string;
  subtitle: string;
  address: string;
  icon: React.ReactNode;
  collections: string[];
  currentCollection: string | null;
  onOpenTrip: () => void;
  onRemove: () => void;
  onMove: (collectionName: string | null) => void;
}

function ItemCard({
  thumbnail,
  title,
  subtitle,
  address,
  icon,
  collections,
  currentCollection,
  onOpenTrip,
  onRemove,
  onMove,
}: ItemCardProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <div className="group relative flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
      <button
        type="button"
        onClick={onOpenTrip}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
          <Image src={thumbnail} alt={title} fill sizes="48px" className="object-cover" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
            {icon}
            <span className="min-w-0 break-words whitespace-normal">{address}</span>
          </p>
        </div>
      </button>

      <div className="flex flex-shrink-0 flex-col items-center gap-1">
        {/* Move to collection */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoveMenu((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary"
            title="Move to collection"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
          {showMoveMenu && (
            <div className="absolute right-0 top-8 z-10 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg">
              <button
                type="button"
                onClick={() => { onMove(null); setShowMoveMenu(false); }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary ${!currentCollection ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                No collection
              </button>
              {collections.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => { onMove(col); setShowMoveMenu(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary ${currentCollection === col ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {col}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
          aria-label="Remove from plans"
          title="Remove from plans"
        >
          <Notebook className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface CollectionSectionProps {
  name: string | null;
  activities: SavedActivityEntry[];
  lodgings: SavedLodgingEntry[];
  collections: string[];
  selectedCollection: string | null;
  onOpenTrip: (tripId: number) => void;
  onToggleSavedActivity: (activityId: number) => void;
  onToggleSavedLodging: (lodgingId: number) => void;
  onMoveActivity: (activityId: number, collectionName: string | null) => void;
  onMoveLodging: (lodgingId: number, collectionName: string | null) => void;
  onDeleteCollection?: () => void;
  onSelectCollection: (name: string | null) => void;
}

function CollectionSection({
  name,
  activities,
  lodgings,
  collections,
  selectedCollection,
  onOpenTrip,
  onToggleSavedActivity,
  onToggleSavedLodging,
  onMoveActivity,
  onMoveLodging,
  onDeleteCollection,
  onSelectCollection,
}: CollectionSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const count = activities.length + lodgings.length;
  const collectionKey = name ?? "";
  const isShowingOnMap = selectedCollection === collectionKey;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex flex-1 items-center gap-1.5 py-0.5 text-left"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          )}
          {name ? (
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
          ) : null}
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {name ?? "Unsorted"} ({count})
          </p>
        </button>
        <button
          type="button"
          onClick={() => onSelectCollection(isShowingOnMap ? null : collectionKey)}
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
            isShowingOnMap
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary"
          }`}
          title={isShowingOnMap ? "Hide from map" : "Show on map"}
        >
          <MapPin className="h-3 w-3" />
        </button>
        {name && onDeleteCollection && (
          <button
            type="button"
            onClick={onDeleteCollection}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
            title={`Delete collection "${name}"`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-2 pl-1">
          {activities.map((entry) => (
            <ItemCard
              key={entry.activity.activity_id}
              thumbnail={entry.activity.thumbnail_url || entry.tripThumbnail}
              title={entry.activity.title || "Untitled activity"}
              subtitle={entry.tripTitle}
              address={entry.activity.address || ""}
              icon={<MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />}
              collections={collections}
              currentCollection={entry.collectionName}
              onOpenTrip={() => onOpenTrip(entry.tripId)}
              onRemove={() => onToggleSavedActivity(entry.activity.activity_id)}
              onMove={(col) => onMoveActivity(entry.activity.activity_id, col)}
            />
          ))}
          {lodgings.map((entry) => (
            <ItemCard
              key={entry.lodging.lodge_id}
              thumbnail={entry.lodging.thumbnail_url || entry.tripThumbnail}
              title={entry.lodging.title || "Untitled lodging"}
              subtitle={entry.tripTitle}
              address={entry.lodging.address || ""}
              icon={<BedDouble className="h-3 w-3 flex-shrink-0 mt-0.5" />}
              collections={collections}
              currentCollection={entry.collectionName}
              onOpenTrip={() => onOpenTrip(entry.tripId)}
              onRemove={() => onToggleSavedLodging(entry.lodging.lodge_id)}
              onMove={(col) => onMoveLodging(entry.lodging.lodge_id, col)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlansSidebarPanel({
  savedActivities,
  savedLodgings,
  collections,
  selectedCollection,
  onClose,
  onOpenTrip,
  onToggleSavedActivity,
  onToggleSavedLodging,
  onCreateCollection,
  onDeleteCollection,
  onMoveActivity,
  onMoveLodging,
  onSelectCollection,
}: PlansSidebarPanelProps) {
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewCollectionInput, setShowNewCollectionInput] = useState(false);

  const totalCount = savedActivities.length + savedLodgings.length;

  function handleCreateCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    onCreateCollection(name);
    setNewCollectionName("");
    setShowNewCollectionInput(false);
  }

  // Group items by collection
  const allCollectionNames = [
    ...new Set([
      ...collections,
      ...savedActivities.map((a) => a.collectionName).filter(Boolean) as string[],
      ...savedLodgings.map((l) => l.collectionName).filter(Boolean) as string[],
    ]),
  ].sort();

  const unsortedActivities = savedActivities.filter((a) => !a.collectionName);
  const unsortedLodgings = savedLodgings.filter((l) => !l.collectionName);
  const hasUnsorted = unsortedActivities.length > 0 || unsortedLodgings.length > 0;

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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowNewCollectionInput((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/60 text-foreground transition-colors hover:bg-secondary"
            aria-label="New collection"
            title="New collection"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/60 text-foreground transition-colors hover:bg-secondary"
            aria-label="Close plans panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showNewCollectionInput && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <input
            autoFocus
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateCollection();
              if (e.key === "Escape") { setShowNewCollectionInput(false); setNewCollectionName(""); }
            }}
            placeholder="Collection name..."
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={handleCreateCollection}
            disabled={!newCollectionName.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-5">
          {totalCount === 0 && collections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4">
              <p className="text-sm font-medium text-foreground">Nothing saved yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Select an activity or lodging in a trip, then tap "Save to Plans".
              </p>
            </div>
          ) : (
            <>
              {/* Named collections */}
              {allCollectionNames.map((col) => {
                const colActivities = savedActivities.filter((a) => a.collectionName === col);
                const colLodgings = savedLodgings.filter((l) => l.collectionName === col);
                return (
                  <CollectionSection
                    key={col}
                    name={col}
                    activities={colActivities}
                    lodgings={colLodgings}
                    collections={allCollectionNames}
                    selectedCollection={selectedCollection}
                    onOpenTrip={onOpenTrip}
                    onToggleSavedActivity={onToggleSavedActivity}
                    onToggleSavedLodging={onToggleSavedLodging}
                    onMoveActivity={onMoveActivity}
                    onMoveLodging={onMoveLodging}
                    onDeleteCollection={() => onDeleteCollection(col)}
                    onSelectCollection={onSelectCollection}
                  />
                );
              })}

              {/* Unsorted items */}
              {hasUnsorted && (
                <CollectionSection
                  name={null}
                  activities={unsortedActivities}
                  lodgings={unsortedLodgings}
                  collections={allCollectionNames}
                  selectedCollection={selectedCollection}
                  onOpenTrip={onOpenTrip}
                  onToggleSavedActivity={onToggleSavedActivity}
                  onToggleSavedLodging={onToggleSavedLodging}
                  onMoveActivity={onMoveActivity}
                  onMoveLodging={onMoveLodging}
                  onSelectCollection={onSelectCollection}
                />
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
