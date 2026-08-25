"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowLeft,
  BedDouble,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  FolderOpen,
  Link2,
  MapPin,
  Notebook,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import PlacePicker from "@/components/place-picker";
import StopItemCard, {
  ACTIVITY_CARD_CONFIG,
  LODGING_CARD_CONFIG,
} from "@/components/stop-item-card";
import { createPlanShare, type CustomPlanItem } from "@/lib/api-client";
import { looksLikeLink, unfurlLink } from "@/lib/link-unfurl";
import type { PlaceOption } from "@/lib/client-types";
import type { SavedActivityEntry, SavedLodgingEntry } from "@/lib/client-types";

function normalizeLink(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export interface CustomItemPayload {
  title: string;
  notes?: string;
  address?: string;
  cost?: string;
  link_url?: string;
  collection_name?: string | null;
  item_type?: "activity" | "lodging";
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  thumbnail_url?: string | null;
}

interface PlansSidebarPanelProps {
  error?: string | null;
  savedActivities: SavedActivityEntry[];
  savedLodgings: SavedLodgingEntry[];
  customItems: CustomPlanItem[];
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
  onAddCustomItem: (payload: CustomItemPayload) => void;
  onUpdateCustomItem: (itemId: number, patch: CustomItemPayload) => void;
  onDeleteCustomItem: (itemId: number) => void;
  onMoveCustomItem: (itemId: number, collectionName: string | null) => void;
  onSelectCollection: (name: string | null) => void;
}

type StopType = "activity" | "lodging";

interface MoveMenuProps {
  collections: string[];
  currentCollection: string | null;
  onMove: (collectionName: string | null) => void;
}

function MoveMenu({ collections, currentCollection, onMove }: MoveMenuProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary"
        title="Move to collection"
      >
        <FolderOpen className="h-3.5 w-3.5" />
      </button>
      {showMenu && (
        <div className="absolute right-0 top-8 z-10 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg">
          <button
            type="button"
            onClick={() => { onMove(null); setShowMenu(false); }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary ${!currentCollection ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            No collection
          </button>
          {collections.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => { onMove(col); setShowMenu(false); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary ${currentCollection === col ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {col}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface StopFormProps {
  defaultType: StopType;
  initial?: CustomPlanItem | null;
  targetCollectionLabel: string | null;
  onSubmit: (payload: CustomItemPayload) => void;
  onCancel: () => void;
}

/** Add/edit form mirroring trip stop properties (title, place, cost, link, notes). */
function StopForm({ defaultType, initial, targetCollectionLabel, onSubmit, onCancel }: StopFormProps) {
  const [itemType, setItemType] = useState<StopType>((initial?.item_type as StopType) ?? defaultType);
  const [title, setTitle] = useState(initial?.title || "");
  const [place, setPlace] = useState<PlaceOption | null>(
    initial?.latitude != null && initial?.longitude != null && initial?.address
      ? { label: initial.address, address: initial.address, latitude: initial.latitude, longitude: initial.longitude }
      : null,
  );
  const [cost, setCost] = useState(initial?.cost || "");
  const [linkUrl, setLinkUrl] = useState(initial?.link_url || "");
  const [notes, setNotes] = useState(initial?.description || initial?.notes || "");

  async function handleLinkChange(value: string) {
    setLinkUrl(value);
    const trimmed = value.trim();
    if (!looksLikeLink(trimmed)) return;

    const preview = await unfurlLink(trimmed);
    if (!preview) return;
    if (!title.trim()) setTitle(preview.title ?? "");
    if (!notes.trim()) setNotes(preview.description ?? "");
  }

  function submit() {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      address: place?.address ?? undefined,
      cost: cost.trim() || undefined,
      notes: notes.trim() || undefined,
      link_url: normalizeLink(linkUrl),
      item_type: itemType,
      description: notes.trim() || undefined,
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary/60 p-1">
        {(["activity", "lodging"] as StopType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setItemType(type)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              itemType === type ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {type === "activity" ? <MapPin className="h-3.5 w-3.5" /> : <BedDouble className="h-3.5 w-3.5" />}
            {type === "activity" ? "Activity" : "Lodging"}
          </button>
        ))}
      </div>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={itemType === "activity" ? "What do you want to do?" : "Where do you want to stay?"}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
      />
      <PlacePicker
        label=""
        placeholder="Search for a place"
        value={place}
        onChange={setPlace}
        mode="address"
      />
      <div className="flex gap-2">
        <input
          value={linkUrl}
          onChange={(e) => void handleLinkChange(e.target.value)}
          placeholder="Paste a link — we'll fill in details"
          type="url"
          className="min-w-0 flex-1 rounded-md border border-dashed border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
        />
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="Cost"
          className="w-24 flex-shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes (optional)"
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between">
        {targetCollectionLabel ? (
          <p className="text-xs text-muted-foreground">Saving to “{targetCollectionLabel}”</p>
        ) : (
          <p className="text-xs text-muted-foreground">Not in any collection</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {initial ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CustomStopCardProps {
  item: CustomPlanItem;
  collections: string[];
  onSave: (patch: CustomItemPayload) => void;
  onDelete: () => void;
  onMove: (collectionName: string | null) => void;
}

/** Trip-style card for a user-authored plan item, expandable with edit/move/delete actions. */
function CustomStopCard({ item, collections, onSave, onDelete, onMove }: CustomStopCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="rounded-xl border border-primary/30 bg-secondary/40 p-3">
        <StopForm
          defaultType={(item.item_type as StopType) ?? "activity"}
          initial={item}
          targetCollectionLabel={item.collection_name}
          onSubmit={(payload) => {
            onSave({ ...payload, collection_name: item.collection_name });
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  const config = item.item_type === "lodging" ? LODGING_CARD_CONFIG : ACTIVITY_CARD_CONFIG;

  return (
    <StopItemCard
      item={{
        title: item.title,
        description: item.description || item.notes,
        address: item.address,
        link_url: item.link_url,
        cost: item.cost,
      }}
      thumbnailUrl={item.thumbnail_url ?? null}
      isExpanded={isExpanded}
      onSelect={() => setIsExpanded((v) => !v)}
      config={{ ...config, showAddressPill: Boolean(item.thumbnail_url) && config.showAddressPill }}
      actions={
        <>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <div className="ml-auto flex items-center gap-1">
            <MoveMenu collections={collections} currentCollection={item.collection_name} onMove={onMove} />
            <button
              type="button"
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete plan item"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      }
    />
  );
}

interface SavedStopActionsProps {
  entry: { tripTitle: string };
  collections: string[];
  currentCollection: string | null;
  onRemove: () => void;
  onMove: (collectionName: string | null) => void;
}

function SavedStopActions({ entry, collections, currentCollection, onRemove, onMove }: SavedStopActionsProps) {
  return (
    <>
      <span className="truncate text-xs text-muted-foreground">From “{entry.tripTitle}”</span>
      <div className="ml-auto flex flex-shrink-0 items-center gap-1">
        <MoveMenu collections={collections} currentCollection={currentCollection} onMove={onMove} />
        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove from plans"
          title="Remove from plans"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}

export default function PlansSidebarPanel({
  error,
  savedActivities,
  savedLodgings,
  customItems,
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
  onAddCustomItem,
  onUpdateCustomItem,
  onDeleteCustomItem,
  onMoveCustomItem,
  onSelectCollection,
}: PlansSidebarPanelProps) {
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewCollectionInput, setShowNewCollectionInput] = useState(false);
  const [copiedItinerary, setCopiedItinerary] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  // Which collection the add-form targets (null = unsorted). Null means form closed.
  const [addFormTarget, setAddFormTarget] = useState<string | null | undefined>(undefined);
  const [openCollection, setOpenCollection] = useState<string | null>(null);

  const totalCount = savedActivities.length + savedLodgings.length + customItems.length;

  function handleCreateCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    onCreateCollection(name);
    setNewCollectionName("");
    setShowNewCollectionInput(false);
  }

  const allCollectionNames = [
    ...new Set([
      ...collections,
      ...savedActivities.map((a) => a.collectionName).filter(Boolean) as string[],
      ...savedLodgings.map((l) => l.collectionName).filter(Boolean) as string[],
    ]),
  ].sort();

  const unsortedActivities = savedActivities.filter((a) => !a.collectionName);
  const unsortedLodgings = savedLodgings.filter((l) => !l.collectionName);
  const unsortedCustomItems = customItems.filter((c) => !c.collection_name);
  const hasUnsorted = unsortedActivities.length > 0 || unsortedLodgings.length > 0 || unsortedCustomItems.length > 0;

  function activitiesFor(collection: string | null): SavedActivityEntry[] {
    return collection === null
      ? unsortedActivities
      : savedActivities.filter((a) => a.collectionName === collection);
  }

  function lodgingsFor(collection: string | null): SavedLodgingEntry[] {
    return collection === null
      ? unsortedLodgings
      : savedLodgings.filter((l) => l.collectionName === collection);
  }

  function customItemsFor(collection: string | null): CustomPlanItem[] {
    return collection === null
      ? unsortedCustomItems
      : customItems.filter((c) => c.collection_name === collection);
  }

  async function handleShare(collectionName: string | null) {
    try {
      const { share_token } = await createPlanShare(collectionName);
      const url = `${window.location.origin}/shared-plan/${share_token}`;

      if (typeof navigator.share === "function") {
        await navigator.share({
          title: collectionName ? `${collectionName} — travel plans` : "My travel plans",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopiedShareLink(true);
      window.setTimeout(() => setCopiedShareLink(false), 2000);
    } catch {
      // Dismissed share sheet or clipboard unavailable — do nothing.
    }
  }

  async function handleCopyItinerary() {
    if (totalCount === 0) return;

    const sections: string[] = ["My Travel Plans", ""];

    for (const col of [...allCollectionNames, ...(hasUnsorted ? ["Unsorted"] : [])]) {
      const colActivities = activitiesFor(col === "Unsorted" ? null : col);
      const colLodgings = lodgingsFor(col === "Unsorted" ? null : col);
      const colCustomItems = customItemsFor(col === "Unsorted" ? null : col);
      if (colActivities.length === 0 && colLodgings.length === 0 && colCustomItems.length === 0) continue;

      sections.push(col);
      for (const { activity } of colActivities) {
        sections.push(`- Do: ${activity.title || "Untitled activity"}${activity.address ? ` (${activity.address})` : ""}`);
      }
      for (const { lodging } of colLodgings) {
        sections.push(`- Stay: ${lodging.title || "Untitled lodging"}${lodging.address ? ` (${lodging.address})` : ""}`);
      }
      for (const item of colCustomItems) {
        sections.push(`- ${item.item_type === "lodging" ? "Stay" : "Do"}: ${item.title}${item.address ? ` (${item.address})` : ""}`);
      }
      sections.push("");
    }

    try {
      await navigator.clipboard.writeText(sections.join("\n"));
      setCopiedItinerary(true);
      window.setTimeout(() => setCopiedItinerary(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. permissions) — do nothing.
    }
  }

  /** Trip-like detail view centered on lodging + activities for one collection. */
  function CollectionDetailView({ name }: { name: string }) {
    const colActivities = activitiesFor(name);
    const colLodgings = lodgingsFor(name);
    const colCustomItems = customItemsFor(name);
    const activityItems = [
      ...colCustomItems.filter((c) => (c.item_type ?? "activity") !== "lodging"),
    ];
    const lodgingItems = colCustomItems.filter((c) => c.item_type === "lodging");

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenCollection(null)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Back to all plans"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <FolderOpen className="h-4 w-4 flex-shrink-0 text-primary" />
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">{name}</h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectCollection(selectedCollection === name ? null : name)}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                selectedCollection === name
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-foreground hover:bg-secondary"
              }`}
              aria-label={selectedCollection === name ? "Hide from map" : "Show on map"}
              title={selectedCollection === name ? "Hide from map" : "Show on map"}
            >
              <MapPin className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setAddFormTarget(name)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
              aria-label="Add stop to this collection"
              title="Add activity or lodging"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleShare(name)}
              className="flex h-8 items-center gap-1.5 rounded-full bg-secondary/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              aria-label={`Share "${name}" via link`}
              title={`Share "${name}" via link`}
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button
              type="button"
              onClick={() => {
                onDeleteCollection(name);
                setOpenCollection(null);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
              aria-label={`Delete collection "${name}"`}
              title={`Delete collection`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-5">
            {/* Places Stayed — same layout as a trip */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Places Stayed</h3>
              {[...colLodgings.map((entry) => ({ kind: "saved" as const, entry })), ...lodgingItems.map((item) => ({ kind: "custom" as const, item }))].length > 0 ? (
                [...colLodgings.map((entry) => ({ kind: "saved" as const, entry })), ...lodgingItems.map((item) => ({ kind: "custom" as const, item }))].map((row) =>
                  row.kind === "saved" ? (
                    <StopItemCard
                      key={`sl-${row.entry.lodging.lodge_id}`}
                      item={row.entry.lodging}
                      thumbnailUrl={row.entry.lodging.thumbnail_url}
                      isExpanded={false}
                      onSelect={() => onOpenTrip(row.entry.tripId)}
                      config={LODGING_CARD_CONFIG}
                    />
                  ) : (
                    <CustomStopCard
                      key={`cl-${row.item.custom_item_id}`}
                      item={row.item}
                      collections={allCollectionNames}
                      onSave={(patch) => onUpdateCustomItem(row.item.custom_item_id, patch)}
                      onDelete={() => onDeleteCustomItem(row.item.custom_item_id)}
                      onMove={(col) => onMoveCustomItem(row.item.custom_item_id, col)}
                    />
                  ),
                )
              ) : (
                <p className="text-sm text-muted-foreground">No places stayed added yet.</p>
              )}
            </div>

            {/* Activities — same layout as a trip */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Activities</h3>
              {[...colActivities.map((entry) => ({ kind: "saved" as const, entry })), ...activityItems.map((item) => ({ kind: "custom" as const, item }))].length > 0 ? (
                [...colActivities.map((entry) => ({ kind: "saved" as const, entry })), ...activityItems.map((item) => ({ kind: "custom" as const, item }))].map((row) =>
                  row.kind === "saved" ? (
                    <StopItemCard
                      key={`sa-${row.entry.activity.activity_id}`}
                      item={row.entry.activity}
                      thumbnailUrl={row.entry.activity.thumbnail_url}
                      isExpanded={false}
                      onSelect={() => onOpenTrip(row.entry.tripId)}
                      config={ACTIVITY_CARD_CONFIG}
                    />
                  ) : (
                    <CustomStopCard
                      key={`ca-${row.item.custom_item_id}`}
                      item={row.item}
                      collections={allCollectionNames}
                      onSave={(patch) => onUpdateCustomItem(row.item.custom_item_id, patch)}
                      onDelete={() => onDeleteCustomItem(row.item.custom_item_id)}
                      onMove={(col) => onMoveCustomItem(row.item.custom_item_id, col)}
                    />
                  ),
                )
              ) : (
                <p className="text-sm text-muted-foreground">No activities added yet.</p>
              )}
            </div>

            {selectedCollection !== name && (
              <p className="text-xs text-muted-foreground">
                Tap the map pin above to highlight these stops on the map.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  /** Collapsible list of one collection (overview mode). */
  function CollectionSection({
    name,
    onDelete,
  }: {
    name: string | null;
    onDelete?: () => void;
  }) {
    const [collapsed, setCollapsed] = useState(false);
    const colActivities = activitiesFor(name);
    const colLodgings = lodgingsFor(name);
    const colCustomItems = customItemsFor(name);
    const count = colActivities.length + colLodgings.length + colCustomItems.length;
    const collectionKey = name ?? "";
    const isShowingOnMap = selectedCollection === collectionKey;

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center py-0.5 pl-0.5 text-left"
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            )}
          </button>
          {name ? (
            <button
              type="button"
              onClick={() => setOpenCollection(name)}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left"
              title={`Open "${name}"`}
            >
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
              <p className="truncate text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground">
                {name} ({count})
              </p>
            </button>
          ) : (
            <p className="min-w-0 flex-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Unsorted ({count})
            </p>
          )}
          {name && (
            <>
              <button
                type="button"
                onClick={() => setAddFormTarget(name)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title={`Add to "${name}"`}
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => void handleShare(name)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title={`Share "${name}" via link`}
              >
                <Share2 className="h-3 w-3" />
              </button>
            </>
          )}
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
          {name && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
              title={`Delete collection "${name}"`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="flex flex-col gap-2 pl-1">
            {colLodgings.map((entry) => (
              <StopItemCard
                key={entry.lodging.lodge_id}
                item={entry.lodging}
                thumbnailUrl={entry.lodging.thumbnail_url || entry.tripThumbnail}
                isExpanded={false}
                onSelect={() => onOpenTrip(entry.tripId)}
                config={LODGING_CARD_CONFIG}
              />
            ))}
            {colActivities.map((entry) => (
              <StopItemCard
                key={entry.activity.activity_id}
                item={entry.activity}
                thumbnailUrl={entry.activity.thumbnail_url || entry.tripThumbnail}
                isExpanded={false}
                onSelect={() => onOpenTrip(entry.tripId)}
                config={ACTIVITY_CARD_CONFIG}
              />
            ))}
            {colCustomItems.map((item) => (
              <CustomStopCard
                key={item.custom_item_id}
                item={item}
                collections={allCollectionNames}
                onSave={(patch) => onUpdateCustomItem(item.custom_item_id, patch)}
                onDelete={() => onDeleteCustomItem(item.custom_item_id)}
                onMove={(col) => onMoveCustomItem(item.custom_item_id, col)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const addFormOpen = addFormTarget !== undefined;

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-card">
      {openCollection !== null ? (
        <CollectionDetailView name={openCollection} />
      ) : (
        <>
          <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border px-5">
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
                onClick={() => setAddFormTarget(selectedCollection)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                aria-label="Add your own plan item"
                title="Add your own plan item"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleShare(selectedCollection)}
                disabled={totalCount === 0 && collections.length === 0}
                className="flex h-9 items-center gap-1.5 rounded-full bg-secondary/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                aria-label="Share plans link"
                title={selectedCollection ? `Share "${selectedCollection}" via link` : "Share all plans via link"}
              >
                <Share2 className="h-4 w-4" />
                {copiedShareLink ? "Link ready!" : "Share"}
              </button>
              {totalCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleCopyItinerary()}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-secondary/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  aria-label="Copy itinerary to clipboard"
                  title="Copy plans as text"
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {copiedItinerary ? "Copied!" : "Copy"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowNewCollectionInput((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/60 text-foreground transition-colors hover:bg-secondary"
                aria-label="New collection"
                title="New collection"
              >
                <FolderOpen className="h-4 w-4" />
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

          {error && (
            <div className="border-b border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {addFormOpen && (
            <div className="border-b border-border bg-secondary/20 px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  New stop{addFormTarget ? ` → ${addFormTarget}` : ""}
                </p>
                <button
                  type="button"
                  onClick={() => setAddFormTarget(undefined)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              <StopForm
                defaultType="activity"
                targetCollectionLabel={addFormTarget}
                onSubmit={(payload) => {
                  onAddCustomItem({ ...payload, collection_name: addFormTarget });
                  setAddFormTarget(undefined);
                }}
                onCancel={() => setAddFormTarget(undefined)}
              />
            </div>
          )}

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
                    Select an activity or lodging in a trip, then tap &quot;Save to Plans&quot;. Or add your own stops with +.
                  </p>
                </div>
              ) : (
                <>
                  {/* Named collections — tap the name to open the trip-style view */}
                  {allCollectionNames.map((col) => (
                    <CollectionSection key={col} name={col} onDelete={() => onDeleteCollection(col)} />
                  ))}

                  {/* Unsorted items */}
                  {hasUnsorted && <CollectionSection name={null} />}
                </>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
