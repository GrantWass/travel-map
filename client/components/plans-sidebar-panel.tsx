"use client";

import Image from "next/image";
import { useState } from "react";
import { BedDouble, ChevronDown, ChevronRight, ClipboardCopy, ExternalLink, FolderOpen, Link2, MapPin, Notebook, NotebookPen, Pencil, Plus, Share2, Trash2, X } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { createPlanShare, type CustomPlanItem } from "@/lib/api-client";
import { looksLikeLink, unfurlLink } from "@/lib/link-unfurl";
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
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove from plans"
          title="Remove from plans"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}


interface CustomItemCardProps {
  item: CustomPlanItem;
  collections: string[];
  onSave: (patch: CustomItemPayload) => void;
  onRemove: () => void;
  onMove: (collectionName: string | null) => void;
}

function CustomItemCard({ item, collections, onSave, onRemove, onMove }: CustomItemCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [title, setTitle] = useState(item.title || "");
  const [address, setAddress] = useState(item.address || "");
  const [cost, setCost] = useState(item.cost || "");
  const [notes, setNotes] = useState(item.notes || "");
  const [linkUrl, setLinkUrl] = useState(item.link_url || "");

  function startEditing() {
    setTitle(item.title || "");
    setAddress(item.address || "");
    setCost(item.cost || "");
    setNotes(item.notes || "");
    setLinkUrl(item.link_url || "");
    setIsEditing(true);
  }

  function save() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      address: address.trim() || undefined,
      cost: cost.trim() || undefined,
      notes: notes.trim() || undefined,
      link_url: normalizeLink(linkUrl),
    });
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="rounded-lg border border-primary/30 bg-secondary/40 p-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is it? (required)"
          className="mb-2 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Where? (optional)"
          className="mb-2 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
        />
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="Link (optional) — e.g. booking page or website"
          type="url"
          className="mb-2 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
        />
        <div className="mb-2 flex gap-2">
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Cost (optional)"
            className="w-28 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!title.trim()}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-muted">
        <NotebookPen className="h-5 w-5 text-muted-foreground/60" />
      </div>
      <button
        type="button"
        onClick={startEditing}
        className="flex min-w-0 flex-1 flex-col text-left"
        title="Click to edit"
      >
        <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
        {item.address && <span className="truncate text-xs text-muted-foreground">{item.address}</span>}
        {(item.cost || item.notes) && (
          <span className="mt-0.5 truncate text-xs text-muted-foreground">
            {[item.cost, item.notes].filter(Boolean).join(" · ")}
          </span>
        )}
        {item.link_url && (
          <span className="mt-0.5 inline-flex items-center gap-1 truncate text-xs font-medium text-primary">
            <Link2 className="h-3 w-3 flex-shrink-0" />
            Website
          </span>
        )}
      </button>

      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={startEditing}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Edit plan item"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

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
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary ${!item.collection_name ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                No collection
              </button>
              {collections.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => { onMove(col); setShowMoveMenu(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary ${item.collection_name === col ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {col}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete plan item"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface CollectionSectionProps {
  name: string | null;
  activities: SavedActivityEntry[];
  lodgings: SavedLodgingEntry[];
  customItems: CustomPlanItem[];
  collections: string[];
  selectedCollection: string | null;
  onOpenTrip: (tripId: number) => void;
  onToggleSavedActivity: (activityId: number) => void;
  onToggleSavedLodging: (lodgingId: number) => void;
  onMoveActivity: (activityId: number, collectionName: string | null) => void;
  onMoveLodging: (lodgingId: number, collectionName: string | null) => void;
  onUpdateCustomItem: (itemId: number, patch: CustomItemPayload) => void;
  onDeleteCustomItem: (itemId: number) => void;
  onMoveCustomItem: (itemId: number, collectionName: string | null) => void;
  onDeleteCollection?: () => void;
  onSelectCollection: (name: string | null) => void;
}

function CollectionSection({
  name,
  activities,
  lodgings,
  customItems,
  collections,
  selectedCollection,
  onOpenTrip,
  onToggleSavedActivity,
  onToggleSavedLodging,
  onMoveActivity,
  onMoveLodging,
  onUpdateCustomItem,
  onDeleteCustomItem,
  onMoveCustomItem,
  onDeleteCollection,
  onSelectCollection,
}: CollectionSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const count = activities.length + lodgings.length + customItems.length;
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
          {customItems.map((item) => (
            <CustomItemCard
              key={item.custom_item_id}
              item={item}
              collections={collections}
              onSave={(patch) => onUpdateCustomItem(item.custom_item_id, patch)}
              onRemove={() => onDeleteCustomItem(item.custom_item_id)}
              onMove={(col) => onMoveCustomItem(item.custom_item_id, col)}
            />
          ))}
        </div>
      )}
    </div>
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
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [itemTitle, setItemTitle] = useState("");
  const [itemAddress, setItemAddress] = useState("");
  const [itemCost, setItemCost] = useState("");
  const [itemLink, setItemLink] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  const totalCount = savedActivities.length + savedLodgings.length + customItems.length;

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
  const unsortedCustomItems = customItems.filter((c) => !c.collection_name);
  const hasUnsorted = unsortedActivities.length > 0 || unsortedLodgings.length > 0 || unsortedCustomItems.length > 0;

  async function handleItemLinkChange(value: string) {
    setItemLink(value);
    const trimmed = value.trim();
    if (!looksLikeLink(trimmed)) return;

    const preview = await unfurlLink(trimmed);
    if (!preview) return;
    if (!itemTitle.trim()) setItemTitle(preview.title ?? "");
    if (!itemNotes.trim()) setItemNotes(preview.description ?? "");
  }

  function handleAddItem() {
    if (!itemTitle.trim()) return;
    onAddCustomItem({
      title: itemTitle.trim(),
      address: itemAddress.trim() || undefined,
      cost: itemCost.trim() || undefined,
      notes: itemNotes.trim() || undefined,
      link_url: normalizeLink(itemLink),
      collection_name: selectedCollection ?? null,
    });
    setItemTitle("");
    setItemAddress("");
    setItemCost("");
    setItemNotes("");
    setItemLink("");
    setShowAddItemForm(false);
  }

  async function handleSharePlan() {
    if (totalCount === 0 && collections.length === 0) return;
    try {
      const { share_token } = await createPlanShare(selectedCollection);
      const url = `${window.location.origin}/shared-plan/${share_token}`;

      if (typeof navigator.share === "function") {
        await navigator.share({ title: "My travel plans", url });
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

    for (const col of allCollectionNames) {
      const colActivities = savedActivities.filter((a) => a.collectionName === col);
      const colLodgings = savedLodgings.filter((l) => l.collectionName === col);
      const colCustomItems = customItems.filter((c) => c.collection_name === col);
      if (colActivities.length === 0 && colLodgings.length === 0 && colCustomItems.length === 0) continue;

      sections.push(col);
      for (const { activity } of colActivities) {
        sections.push(`- Do: ${activity.title || "Untitled activity"}${activity.address ? ` (${activity.address})` : ""}`);
      }
      for (const { lodging } of colLodgings) {
        sections.push(`- Stay: ${lodging.title || "Untitled lodging"}${lodging.address ? ` (${lodging.address})` : ""}`);
      }
      for (const item of colCustomItems) {
        sections.push(`- ${item.title}${item.address ? ` (${item.address})` : ""}`);
      }
      sections.push("");
    }

    if (hasUnsorted) {
      sections.push("Unsorted");
      for (const { activity } of unsortedActivities) {
        sections.push(`- Do: ${activity.title || "Untitled activity"}${activity.address ? ` (${activity.address})` : ""}`);
      }
      for (const { lodging } of unsortedLodgings) {
        sections.push(`- Stay: ${lodging.title || "Untitled lodging"}${lodging.address ? ` (${lodging.address})` : ""}`);
      }
      for (const item of unsortedCustomItems) {
        sections.push(`- ${item.title}${item.address ? ` (${item.address})` : ""}`);
      }
    }

    try {
      await navigator.clipboard.writeText(sections.join("\n"));
      setCopiedItinerary(true);
      window.setTimeout(() => setCopiedItinerary(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. permissions) — do nothing.
    }
  }

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
            onClick={() => setShowAddItemForm((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            aria-label="Add your own plan item"
            title="Add your own plan item"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void handleSharePlan()}
            disabled={totalCount === 0}
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

      {showAddItemForm && (
        <div className="border-b border-border bg-secondary/20 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              New plan item{selectedCollection ? ` → ${selectedCollection}` : ""}
            </p>
            <button
              type="button"
              onClick={() => setShowAddItemForm(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <input
            value={itemLink}
            onChange={(e) => void handleItemLinkChange(e.target.value)}
            placeholder="Paste a link — we'll fill in the details"
            className="mb-2 w-full rounded-md border border-dashed border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
          />
          <input
            autoFocus
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddItem();
              if (e.key === "Escape") setShowAddItemForm(false);
            }}
            placeholder="What is it? e.g. Rent bikes by the pier"
            className="mb-2 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
          />
          <div className="mb-2 flex gap-2">
            <input
              value={itemAddress}
              onChange={(e) => setItemAddress(e.target.value)}
              placeholder="Where? (optional)"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
            />
            <input
              value={itemCost}
              onChange={(e) => setItemCost(e.target.value)}
              placeholder="Cost"
              className="w-24 flex-shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddItem();
              }}
              placeholder="Notes (optional)"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!itemTitle.trim()}
              className="flex-shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Add
            </button>
          </div>
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
                Select an activity or lodging in a trip, then tap "Save to Plans".
              </p>
            </div>
          ) : (
            <>
              {/* Named collections */}
              {allCollectionNames.map((col) => {
                const colActivities = savedActivities.filter((a) => a.collectionName === col);
                const colLodgings = savedLodgings.filter((l) => l.collectionName === col);
                const savedCustomItems = customItems;
                return (
                  <CollectionSection
                    key={col}
                    name={col}
                    activities={colActivities}
                    lodgings={colLodgings}
                    customItems={savedCustomItems.filter((c) => c.collection_name === col)}
                    collections={allCollectionNames}
                    selectedCollection={selectedCollection}
                    onOpenTrip={onOpenTrip}
                    onToggleSavedActivity={onToggleSavedActivity}
                    onToggleSavedLodging={onToggleSavedLodging}
                    onMoveActivity={onMoveActivity}
                    onMoveLodging={onMoveLodging}
                    onUpdateCustomItem={onUpdateCustomItem}
                    onDeleteCustomItem={onDeleteCustomItem}
                    onMoveCustomItem={onMoveCustomItem}
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
                  customItems={unsortedCustomItems}
                  collections={allCollectionNames}
                  selectedCollection={selectedCollection}
                  onOpenTrip={onOpenTrip}
                  onToggleSavedActivity={onToggleSavedActivity}
                  onToggleSavedLodging={onToggleSavedLodging}
                  onMoveActivity={onMoveActivity}
                  onMoveLodging={onMoveLodging}
                  onUpdateCustomItem={onUpdateCustomItem}
                  onDeleteCustomItem={onDeleteCustomItem}
                  onMoveCustomItem={onMoveCustomItem}
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
