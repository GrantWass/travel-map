"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCopy,
  FolderOpen,
  ImagePlus,
  Link2,
  MapPin,
  Notebook,
  Pencil,
  Plane,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import ConfirmDialog from "@/components/confirm-dialog";
import PlacePicker from "@/components/place-picker";
import StopItemCard, {
  ACTIVITY_CARD_CONFIG,
  LODGING_CARD_CONFIG,
  StopSection,
} from "@/components/stop-item-card";
import WebsiteChip from "@/components/website-chip";
import { INPUT_CLASS, TEXTAREA_CLASS } from "@/lib/ui-constants";
import { createPlanShare, uploadImage, type CustomPlanItem, type FlightLeg, type PlanFlight } from "@/lib/api-client";
import { looksLikeLink, unfurlLink } from "@/lib/link-unfurl";
import { parseFlightLink } from "@/lib/flight-link";
import { formatFlightPrice, shareOrCopyUrl } from "@/lib/utils";
import type { PlaceOption } from "@/lib/client-types";
import type { SavedActivityEntry, SavedLodgingEntry } from "@/lib/client-types";
import { ALL_PLANS_COLLECTION_SCOPE } from "@/stores/trip-map-store";

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

export interface FlightPayload {
  airline?: string;
  flight_number?: string;
  origin_code?: string;
  destination_code?: string;
  departure_date?: string;
  outbound_date?: string;
  return_date?: string;
  outbound_legs?: FlightLeg[];
  return_legs?: FlightLeg[];
  departure_time?: string;
  price?: string;
  price_minor?: number;
  currency?: string;
  link_url?: string;
  notes?: string;
}

interface PlansSidebarPanelProps {
  error?: string | null;
  savedActivities: SavedActivityEntry[];
  savedLodgings: SavedLodgingEntry[];
  customItems: CustomPlanItem[];
  flights: PlanFlight[];
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
  onAddFlight: (payload: FlightPayload & { collection_name?: string | null }) => void;
  onUpdateFlight: (flightId: number, patch: FlightPayload) => void;
  onDeleteFlight: (flightId: number) => void;
  onMoveFlight: (flightId: number, collectionName: string | null) => void;
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
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-all duration-200 hover:bg-secondary hover:shadow-xs"
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
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnail_url || "");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");

  async function handleImageUpload(file?: File) {
    if (!file) {
      setThumbnailUrl("");
      setImageError("");
      return;
    }
    setIsUploadingImage(true);
    setImageError("");
    try {
      const url = await uploadImage(file, itemType === "lodging" ? "plans/lodging" : "plans/activity");
      setThumbnailUrl(url);
    } catch {
      setImageError("Could not upload this image. Please try again.");
    } finally {
      setIsUploadingImage(false);
    }
  }

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
      thumbnail_url: thumbnailUrl || null,
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
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
              itemType === type ? "bg-background text-foreground shadow-sm ring-1 ring-black/5" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {type === "activity" ? <MapPin className="h-3.5 w-3.5" /> : <BedDouble className="h-3.5 w-3.5" />}
            {type === "activity" ? "Activity" : "Stay"}
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
        className={`${INPUT_CLASS} w-full`}
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
          className={`${INPUT_CLASS} min-w-0 flex-1 border-dashed`}
        />
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="Cost / person"
          className={`${INPUT_CLASS} w-28 flex-shrink-0`}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="inline-flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <ImagePlus className="h-3.5 w-3.5" />
          {thumbnailUrl ? "Change photo" : "Photo"}
          <input
            type="file"
            accept="image/*"
            disabled={isUploadingImage}
            className="sr-only"
            onChange={(e) => void handleImageUpload(e.target.files?.[0])}
          />
        </label>
        {isUploadingImage ? (
          <p className="text-xs text-muted-foreground">Uploading...</p>
        ) : imageError ? (
          <p className="text-xs text-destructive">{imageError}</p>
        ) : thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt=""
            width={32}
            height={32}
            sizes="32px"
            className="h-8 w-8 rounded-md border border-border object-cover"
          />
        ) : null}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes (optional)"
        className={`${TEXTAREA_CLASS} w-full`}
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
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onSave: (patch: CustomItemPayload) => void;
  onDelete: () => void;
  onMove: (collectionName: string | null) => void;
}

/** Trip-style card for a user-authored plan item, expandable with edit/move/delete actions. */
function CustomStopCard({ item, collections, isExpanded, onToggleExpanded, onSave, onDelete, onMove }: CustomStopCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-secondary/40 p-3">
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
    <>
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
      onSelect={onToggleExpanded}
      config={config}
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
              onClick={() => setConfirmDelete(true)}
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
    <ConfirmDialog
      open={confirmDelete}
      title="Delete this item?"
      description={`"${item.title}" will be removed from your plans.`}
      onConfirm={() => { onDelete(); setConfirmDelete(false); }}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  );
}

interface SavedStopActionsProps {
  entry: { tripTitle: string };
  collections: string[];
  currentCollection: string | null;
  onOpenTrip: () => void;
  onRemove: () => void;
  onMove: (collectionName: string | null) => void;
}

const flightInputClass = INPUT_CLASS;

/** Add/edit form for a plan flight. Pasting a Google Flights link pre-fills what it can. */
function FlightForm({
  initial,
  targetCollectionLabel,
  onSubmit,
  onCancel,
}: {
  initial?: PlanFlight | null;
  targetCollectionLabel: string | null;
  onSubmit: (payload: FlightPayload) => void;
  onCancel: () => void;
}) {
  const [linkUrl, setLinkUrl] = useState(initial?.link_url || "");
  const [airline, setAirline] = useState(initial?.airline || "");
  const [flightNumber, setFlightNumber] = useState(initial?.flight_number || "");
  const [origin, setOrigin] = useState(initial?.origin_code || "");
  const [destination, setDestination] = useState(initial?.destination_code || "");
  const [departureDate, setDepartureDate] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(initial?.outbound_date ?? initial?.departure_date ?? "")
      ? (initial?.outbound_date ?? initial?.departure_date ?? "") : "",
  );
  const [returnDate, setReturnDate] = useState(initial?.return_date || "");
  const [outboundLegs, setOutboundLegs] = useState<FlightLeg[]>(initial?.outbound_legs ?? []);
  const [returnLegs, setReturnLegs] = useState<FlightLeg[]>(initial?.return_legs ?? []);
  const [departureTime, setDepartureTime] = useState(initial?.departure_time || "");
  const [price, setPrice] = useState(initial?.price || "");
  const [currency, setCurrency] = useState(initial?.currency || "USD");
  const [notes, setNotes] = useState(initial?.notes || "");

  async function handleLinkChange(value: string) {
    setLinkUrl(value);
    const trimmed = value.trim();
    if (!looksLikeLink(trimmed)) return;

    // Parse what the URL itself encodes first (Google Flights has no OG tags).
    const parsed = parseFlightLink(trimmed);
    if (!origin.trim() && parsed.origin_code) setOrigin(parsed.origin_code);
    if (!destination.trim() && parsed.destination_code) setDestination(parsed.destination_code);
    if (!departureDate && parsed.departure_date) setDepartureDate(parsed.departure_date);
    if (!returnDate && parsed.return_date) setReturnDate(parsed.return_date);
    if (parsed.outbound_legs?.length) setOutboundLegs(parsed.outbound_legs);
    if (parsed.return_legs?.length) setReturnLegs(parsed.return_legs);
    if (!airline.trim() && parsed.airline) setAirline(parsed.airline);
    if (!flightNumber.trim() && parsed.flight_number) setFlightNumber(parsed.flight_number);
    if (!price.trim() && parsed.price) setPrice(parsed.price);
    if (parsed.currency) setCurrency(parsed.currency);
    if (!notes.trim() && parsed.notes) setNotes(parsed.notes);

    const preview = await unfurlLink(trimmed);
    if (!preview) return;
    if (!airline.trim() && preview.title) setAirline(preview.title.split(/[|(·—-]/)[0].trim());
    if (!notes.trim()) setNotes(preview.description ?? "");
  }

  function submit() {
    const hasDetails =
      airline.trim() ||
      flightNumber.trim() ||
      origin.trim() ||
      destination.trim() ||
      departureDate ||
      departureTime.trim() ||
      price.trim();
    if (!hasDetails && !linkUrl.trim()) return;
    onSubmit({
      airline: airline.trim() || undefined,
      flight_number: flightNumber.trim() || undefined,
      origin_code: origin.trim().toUpperCase() || undefined,
      destination_code: destination.trim().toUpperCase() || undefined,
      departure_date: departureDate || undefined,
      outbound_date: departureDate || undefined,
      return_date: returnDate || undefined,
      outbound_legs: outboundLegs,
      return_legs: returnLegs,
      departure_time: departureTime.trim() || undefined,
      price: price.trim() || undefined,
      price_minor: price.trim() && Number.isFinite(Number(price)) ? Math.round(Number(price) * 100) : undefined,
      currency: price.trim() ? currency : undefined,
      link_url: normalizeLink(linkUrl),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus
        value={linkUrl}
        onChange={(e) => void handleLinkChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Paste a Google Flights link — we'll fill in details"
        type="url"
        className="w-full rounded-md border border-dashed border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
      />
      <div className="flex gap-2">
        <input
          value={origin}
          onChange={(e) => setOrigin(e.target.value.toUpperCase().slice(0, 3))}
          placeholder="From"
          className={`${flightInputClass} w-20 flex-shrink-0 uppercase`}
        />
        <Plane className="mt-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value.toUpperCase().slice(0, 3))}
          placeholder="To"
          className={`${flightInputClass} w-20 flex-shrink-0 uppercase`}
        />
        <input
          value={departureDate}
          onChange={(e) => setDepartureDate(e.target.value)}
          placeholder="Outbound"
          type="date"
          className={`${flightInputClass} min-w-0 flex-1`}
        />
        <input
          value={returnDate}
          onChange={(e) => setReturnDate(e.target.value)}
          aria-label="Return date"
          type="date"
          className={`${flightInputClass} min-w-0 flex-1`}
        />
      </div>
      <div className="flex gap-2">
        <input
          value={airline}
          onChange={(e) => setAirline(e.target.value)}
          placeholder="Airline"
          className={`${flightInputClass} min-w-0 flex-1`}
        />
        <input
          value={flightNumber}
          onChange={(e) => setFlightNumber(e.target.value)}
          placeholder="Flight #"
          className={`${flightInputClass} w-24 flex-shrink-0`}
        />
        <input
          value={departureTime}
          onChange={(e) => setDepartureTime(e.target.value)}
          placeholder="Time"
          className={`${flightInputClass} w-20 flex-shrink-0`}
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={`Price (${currency})`}
          className={`${flightInputClass} w-24 flex-shrink-0`}
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes (optional)"
        className={`${TEXTAREA_CLASS} w-full`}
      />
      <div className="flex items-center justify-between">
        {targetCollectionLabel ? (
          <p className="text-xs text-muted-foreground">Saving to &ldquo;{targetCollectionLabel}&rdquo;</p>
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
            disabled={!linkUrl.trim() && !(origin.trim() && destination.trim())}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {initial ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FlightCardProps {
  flight: PlanFlight;
  collections: string[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onSave: (patch: FlightPayload) => void;
  onDelete: () => void;
  onMove: (collectionName: string | null) => void;
}

function flightLegSummary(legs: FlightLeg[], fallbackFlightNumber?: string | null): string | null {
  if (legs.length > 0) {
    return legs.map((leg) => [leg.flight_number, `${leg.origin_code}→${leg.destination_code}`].filter(Boolean).join(" ")).join(" · ");
  }
  return fallbackFlightNumber || null;
}

/** Card showing a saved flight, expandable with edit/move/delete actions. */
function FlightCard({ flight, collections, isExpanded, onToggleExpanded, onSave, onDelete, onMove }: FlightCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-sky-300/40 bg-sky-50/50 p-3">
        <FlightForm
          initial={flight}
          targetCollectionLabel={flight.collection_name}
          onSubmit={(payload) => {
            onSave(payload);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  const route =
    flight.origin_code && flight.destination_code
      ? `${flight.origin_code} → ${flight.destination_code}`
      : flight.airline || "Flight";
  const metaParts = [
    flight.airline && flight.origin_code ? flight.airline : null,
    flight.departure_time,
  ].filter(Boolean);
  const outboundDate = flight.outbound_date || flight.departure_date;
  const outboundSummary = flightLegSummary(flight.outbound_legs, flight.flight_number);
  const returnSummary = flightLegSummary(flight.return_legs);

  return (
    <>
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleExpanded}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleExpanded();
        }
      }}
      className={`w-full cursor-pointer rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/35 ${
        isExpanded
          ? "border-sky-400/50 bg-sky-50/40 shadow-md shadow-sky-400/5"
          : "border-border hover:shadow-sm hover:-translate-y-px bg-card"
      }`}
    >
      {isExpanded ? (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <Plane className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-foreground">{route}</p>
            </div>
            <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </div>
          {metaParts.length > 0 && (
            <p className="text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
          )}
          {(outboundDate || outboundSummary) && (
            <div className="rounded-lg bg-sky-50 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">Departure{outboundDate ? ` · ${outboundDate}` : ""}</p>
              {outboundSummary && <p className="mt-0.5 text-xs text-foreground">{outboundSummary}</p>}
            </div>
          )}
          {(flight.return_date || returnSummary) && (
            <div className="rounded-lg bg-sky-50 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">Return{flight.return_date ? ` · ${flight.return_date}` : ""}</p>
              {returnSummary && <p className="mt-0.5 text-xs text-foreground">{returnSummary}</p>}
            </div>
          )}
          {flight.notes && <p className="whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground">{flight.notes}</p>}
          {flight.link_url && (
            <div onClick={(e) => e.stopPropagation()}>
              <WebsiteChip url={flight.link_url} />
            </div>
          )}
          <div
            className="flex items-center gap-1 border-t border-border/40 pt-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-all duration-200 hover:bg-secondary hover:shadow-xs hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <div className="ml-auto flex items-center gap-1">
              <MoveMenu collections={collections} currentCollection={flight.collection_name} onMove={onMove} />
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                aria-label="Delete flight"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600">
            <Plane className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="truncate text-sm font-medium text-foreground">{route}</p>
              {flight.price && (
                <span className="ml-auto flex-shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                  {formatFlightPrice(flight.price)}
                </span>
              )}
            </div>
            {metaParts.length > 0 && (
              <p className="truncate text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
            )}
            {(outboundDate || flight.return_date) && (
              <p className="truncate text-[11px] text-muted-foreground">
                {[
                  outboundDate ? `Departure ${outboundDate}` : null,
                  flight.return_date ? `Return ${flight.return_date}` : null,
                ].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground self-center" />
        </div>
      )}
    </div>
    <ConfirmDialog
      open={confirmDelete}
      title="Delete this flight?"
      description="This flight will be removed from your plans."
      onConfirm={() => { onDelete(); setConfirmDelete(false); }}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  );
}

function SavedStopActions({ entry, collections, currentCollection, onOpenTrip, onRemove, onMove }: SavedStopActionsProps) {
  return (
    <>
      <span className="truncate text-xs text-muted-foreground">From “{entry.tripTitle}”</span>
      <div className="ml-auto flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onOpenTrip}
          className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          View trip
          <ArrowRight className="h-3 w-3" />
        </button>
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
  flights,
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
  onAddFlight,
  onUpdateFlight,
  onDeleteFlight,
  onMoveFlight,
  onSelectCollection,
}: PlansSidebarPanelProps) {
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewCollectionInput, setShowNewCollectionInput] = useState(false);
  const [copiedItinerary, setCopiedItinerary] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  // Which collection the add-form targets (null = unsorted). Null means form closed.
  const [addFormTarget, setAddFormTarget] = useState<string | null | undefined>(undefined);
  const [addFormType, setAddFormType] = useState<StopType>("activity");
  const [addFlightFormTarget, setAddFlightFormTarget] = useState<string | null | undefined>(undefined);
  const [openCollection, setOpenCollection] = useState<string | null>(null);
  const [creationStatus, setCreationStatus] = useState<string | null>(null);
  const [expandedPlanItemKey, setExpandedPlanItemKey] = useState<string | null>(null);
  const [collapsedCollectionKeys, setCollapsedCollectionKeys] = useState<Set<string>>(() => new Set());
  const [confirmDeleteCollectionName, setConfirmDeleteCollectionName] = useState<string | null>(null);

  const totalCount = savedActivities.length + savedLodgings.length + customItems.length + flights.length;

  function openStopForm(target: string | null, type: StopType) {
    setAddFormType(type);
    setAddFormTarget(target);
    setAddFlightFormTarget(undefined);
    setShowNewCollectionInput(false);
  }

  function openFlightForm(target: string | null) {
    setAddFormTarget(undefined);
    setAddFlightFormTarget(target);
    setShowNewCollectionInput(false);
  }

  function openCollectionAndFocus(name: string) {
    setOpenCollection(name);
    onSelectCollection(name);
  }

  function handleCreateCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    onCreateCollection(name);
    setNewCollectionName("");
    setShowNewCollectionInput(false);
    setOpenCollection(name);
    onSelectCollection(name);
    setCreationStatus(`Created “${name}”.`);
    window.setTimeout(() => setCreationStatus(null), 2500);
  }

  const allCollectionNames = [
    ...new Set([
      ...collections,
      ...savedActivities.map((a) => a.collectionName).filter(Boolean) as string[],
      ...savedLodgings.map((l) => l.collectionName).filter(Boolean) as string[],
      ...customItems.map((item) => item.collection_name).filter(Boolean) as string[],
      ...flights.map((flight) => flight.collection_name).filter(Boolean) as string[],
    ]),
  ].sort();

  const unsortedActivities = savedActivities.filter((a) => !a.collectionName);
  const unsortedLodgings = savedLodgings.filter((l) => !l.collectionName);
  const unsortedCustomItems = customItems.filter((c) => !c.collection_name);
  const unsortedFlights = flights.filter((f) => !f.collection_name);
  const hasUnsorted =
    unsortedActivities.length > 0 ||
    unsortedLodgings.length > 0 ||
    unsortedCustomItems.length > 0 ||
    unsortedFlights.length > 0;

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

  function flightsFor(collection: string | null): PlanFlight[] {
    return collection === null
      ? unsortedFlights
      : flights.filter((f) => f.collection_name === collection);
  }

  async function handleShare(collectionName: string | null) {
    try {
      const { share_token } = await createPlanShare(collectionName);
      const url = `${window.location.origin}/shared-plan/${share_token}`;
      const result = await shareOrCopyUrl(
        url,
        collectionName ? `${collectionName} — travel plans` : "My travel plans",
      );
      if (result === "copied") {
        setCopiedShareLink(true);
        window.setTimeout(() => setCopiedShareLink(false), 2000);
      }
    } catch {
      // Share creation failed or clipboard unavailable — do nothing.
    }
  }

  async function handleCopyItinerary() {
    if (totalCount === 0) return;

    const sections: string[] = ["My Travel Plans", ""];

    for (const col of [...allCollectionNames, ...(hasUnsorted ? ["Unsorted"] : [])]) {
      const colActivities = activitiesFor(col === "Unsorted" ? null : col);
      const colLodgings = lodgingsFor(col === "Unsorted" ? null : col);
      const colCustomItems = customItemsFor(col === "Unsorted" ? null : col);
      const colFlights = flightsFor(col === "Unsorted" ? null : col);
      if (
        colActivities.length === 0 &&
        colLodgings.length === 0 &&
        colCustomItems.length === 0 &&
        colFlights.length === 0
      ) {
        continue;
      }

      sections.push(col);
      for (const flight of colFlights) {
        const route =
          flight.origin_code && flight.destination_code
            ? `${flight.origin_code} → ${flight.destination_code}`
            : flight.airline || "Flight";
        const details = [
          flight.airline && route !== flight.airline ? flight.airline : null,
          flight.flight_number ? `#${flight.flight_number}` : null,
          flight.departure_date,
        ]
          .filter(Boolean)
          .join(" · ");
        sections.push(`- Fly: ${route}${details ? ` (${details})` : ""}`);
      }
      for (const { activity } of colActivities) {
        sections.push(`- Do: ${activity.title || "Untitled activity"}${activity.address ? ` (${activity.address})` : ""}`);
      }
      for (const { lodging } of colLodgings) {
        sections.push(`- Stay: ${lodging.title || "Untitled stay"}${lodging.address ? ` (${lodging.address})` : ""}`);
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

  /** Trip-style card for a saved activity from a real trip. */
  function SavedActivityCard({ entry }: { entry: SavedActivityEntry }) {
    const itemKey = `activity-${entry.activity.activity_id}`;
    return (
      <StopItemCard
        item={entry.activity}
        thumbnailUrl={entry.activity.thumbnail_url || entry.tripThumbnail}
        isExpanded={expandedPlanItemKey === itemKey}
        onSelect={() => setExpandedPlanItemKey((current) => current === itemKey ? null : itemKey)}
        config={ACTIVITY_CARD_CONFIG}
        actions={
          <SavedStopActions
            entry={entry}
            collections={allCollectionNames}
            currentCollection={entry.collectionName}
            onOpenTrip={() => onOpenTrip(entry.tripId)}
            onRemove={() => onToggleSavedActivity(entry.activity.activity_id)}
            onMove={(collectionName) => onMoveActivity(entry.activity.activity_id, collectionName)}
          />
        }
      />
    );
  }

  /** Trip-style card for a saved lodging from a real trip. */
  function SavedLodgingCard({ entry }: { entry: SavedLodgingEntry }) {
    const itemKey = `stay-${entry.lodging.lodge_id}`;
    return (
      <StopItemCard
        item={entry.lodging}
        thumbnailUrl={entry.lodging.thumbnail_url || entry.tripThumbnail}
        isExpanded={expandedPlanItemKey === itemKey}
        onSelect={() => setExpandedPlanItemKey((current) => current === itemKey ? null : itemKey)}
        config={LODGING_CARD_CONFIG}
        actions={
          <SavedStopActions
            entry={entry}
            collections={allCollectionNames}
            currentCollection={entry.collectionName}
            onOpenTrip={() => onOpenTrip(entry.tripId)}
            onRemove={() => onToggleSavedLodging(entry.lodging.lodge_id)}
            onMove={(collectionName) => onMoveLodging(entry.lodging.lodge_id, collectionName)}
          />
        }
      />
    );
  }

  function customRow(item: CustomPlanItem) {
    const itemKey = `custom-${item.custom_item_id}`;
    return (
      <CustomStopCard
        key={item.custom_item_id}
        item={item}
        collections={allCollectionNames}
        isExpanded={expandedPlanItemKey === itemKey}
        onToggleExpanded={() => setExpandedPlanItemKey((current) => current === itemKey ? null : itemKey)}
        onSave={(patch) => onUpdateCustomItem(item.custom_item_id, patch)}
        onDelete={() => onDeleteCustomItem(item.custom_item_id)}
        onMove={(col) => onMoveCustomItem(item.custom_item_id, col)}
      />
    );
  }

  function flightRow(flight: PlanFlight) {
    const itemKey = `flight-${flight.flight_id}`;
    return (
      <FlightCard
        key={flight.flight_id}
        flight={flight}
        collections={allCollectionNames}
        isExpanded={expandedPlanItemKey === itemKey}
        onToggleExpanded={() => setExpandedPlanItemKey((current) => current === itemKey ? null : itemKey)}
        onSave={(patch) => onUpdateFlight(flight.flight_id, patch)}
        onDelete={() => onDeleteFlight(flight.flight_id)}
        onMove={(col) => onMoveFlight(flight.flight_id, col)}
      />
    );
  }

  /** Trip-like detail view centered on lodging + activities for one collection. */
  function renderCollectionDetail(name: string) {
    const lodgingRows = [
      ...lodgingsFor(name).map((entry) => <SavedLodgingCard key={entry.lodging.lodge_id} entry={entry} />),
      ...customItemsFor(name)
        .filter((c) => c.item_type === "lodging")
        .map(customRow),
    ];
    const activityRows = [
      ...activitiesFor(name).map((entry) => <SavedActivityCard key={entry.activity.activity_id} entry={entry} />),
      ...customItemsFor(name)
        .filter((c) => (c.item_type ?? "activity") !== "lodging")
        .map(customRow),
    ];

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border/40 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => { setOpenCollection(null); onSelectCollection(ALL_PLANS_COLLECTION_SCOPE); }}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-secondary hover:shadow-sm hover:text-foreground"
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
              onClick={() => onSelectCollection(name)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-coral text-coral-foreground shadow-md shadow-coral/20 transition-all duration-200 hover:scale-105"
              aria-label="Center plan on map"
              title="Center plan on map"
            >
              <MapPin className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleShare(name)}
              className="flex h-8 items-center gap-1.5 rounded-full bg-secondary/60 px-3 text-xs font-medium text-foreground transition-all duration-200 hover:bg-secondary hover:shadow-sm"
              aria-label={`Share "${name}" via link`}
              title={`Share "${name}" via link`}
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteCollectionName(name)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
              aria-label={`Delete collection "${name}"`}
              title={`Delete collection`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ConfirmDialog
          open={confirmDeleteCollectionName === name}
          title="Delete collection?"
          description={`"${name}" will be deleted. Items inside won't be removed from your plans.`}
          onConfirm={() => { onDeleteCollection(name); setOpenCollection(null); onSelectCollection(ALL_PLANS_COLLECTION_SCOPE); setConfirmDeleteCollectionName(null); }}
          onCancel={() => setConfirmDeleteCollectionName(null)}
        />

        <div className="grid grid-cols-3 gap-2 border-b border-border/40 px-4 py-3">
          <button type="button" onClick={() => openStopForm(name, "activity")} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
            <MapPin className="h-4 w-4" /> Add activity
          </button>
          <button type="button" onClick={() => openStopForm(name, "lodging")} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-secondary">
            <BedDouble className="h-4 w-4" /> Add stay
          </button>
          <button type="button" onClick={() => openFlightForm(name)} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-secondary">
            <Plane className="h-4 w-4" /> Add flight
          </button>
        </div>

        {creationStatus && <div role="status" className="border-b border-success/20 bg-success/10 px-4 py-2 text-xs font-medium text-foreground">{creationStatus}</div>}
        {error && <div className="border-b border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">{error}</div>}

        {addFormTarget === name && (
          <div className="border-b border-border/40 bg-secondary/20 px-4 py-3">
            <StopForm
              key={`${name}-${addFormType}`}
              defaultType={addFormType}
              targetCollectionLabel={name}
              onSubmit={(payload) => {
                onAddCustomItem({ ...payload, collection_name: name });
                setAddFormTarget(undefined);
                setCreationStatus(`Added ${payload.title} as ${payload.item_type === "lodging" ? "a stay" : "an activity"}.`);
                window.setTimeout(() => setCreationStatus(null), 2500);
              }}
              onCancel={() => setAddFormTarget(undefined)}
            />
          </div>
        )}

        {addFlightFormTarget === name && (
          <div className="border-b border-border/40 bg-secondary/20 px-4 py-3">
            <FlightForm
              targetCollectionLabel={name}
              onSubmit={(payload) => {
                onAddFlight({ ...payload, collection_name: name });
                setAddFlightFormTarget(undefined);
                setCreationStatus("Added flight to your plan.");
                window.setTimeout(() => setCreationStatus(null), 2500);
              }}
              onCancel={() => setAddFlightFormTarget(undefined)}
            />
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-5">
            {/* Flights */}
            <StopSection title={<><Plane className="h-3.5 w-3.5 text-sky-500" /> <span className="text-sky-600">Flights</span></>} emptyMessage="No flights added yet.">
              {flightsFor(name).map(flightRow)}
            </StopSection>

            {lodgingRows.length > 0 && (
              <StopSection title={<><BedDouble className="h-3.5 w-3.5 text-emerald-500" /> <span className="text-emerald-600">Places</span></>} emptyMessage="">
                {lodgingRows}
              </StopSection>
            )}

            {activityRows.length > 0 && (
              <StopSection title={<><MapPin className="h-3.5 w-3.5 text-violet-500" /> <span className="text-violet-600">Activities</span></>} emptyMessage="">
                {activityRows}
              </StopSection>
            )}

          </div>
        </ScrollArea>
      </div>
    );
  }

  /** Collapsible list of one collection (overview mode). */
  function renderCollectionSection(name: string | null, onDelete?: () => void) {
    const colActivities = activitiesFor(name);
    const colLodgings = lodgingsFor(name);
    const colCustomItems = customItemsFor(name);
    const colCustomActivities = colCustomItems.filter((item) => item.item_type !== "lodging");
    const colCustomLodgings = colCustomItems.filter((item) => item.item_type === "lodging");
    const colFlights = flightsFor(name);
    const count =
      colActivities.length + colLodgings.length + colCustomItems.length + colFlights.length;
    const collectionKey = name ?? "";
    const collapsed = collapsedCollectionKeys.has(collectionKey);

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCollapsedCollectionKeys((current) => {
              const next = new Set(current);
              if (next.has(collectionKey)) next.delete(collectionKey);
              else next.add(collectionKey);
              return next;
            })}
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
              onClick={() => openCollectionAndFocus(name)}
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-all hover:border-primary/20 hover:bg-primary/5 hover:shadow-sm"
              title={`Open "${name}"`}
            >
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-coral transition-transform group-hover:scale-110" />
              <p className="truncate text-xs font-medium uppercase tracking-widest text-muted-foreground group-hover:text-foreground">
                {name} ({count})
              </p>
              <ChevronRight className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
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
                onClick={() => void handleShare(name)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-secondary hover:shadow-xs hover:text-foreground"
                title={`Share "${name}" via link`}
              >
                <Share2 className="h-3 w-3" />
              </button>
            </>
          )}
          {name && onDelete && (
            <button
              type="button"
              onClick={() => setConfirmDeleteCollectionName(name)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
              title={`Delete collection "${name}"`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        <ConfirmDialog
          open={confirmDeleteCollectionName === name && !!name}
          title="Delete collection?"
          description={`"${name}" will be deleted. Items inside won't be removed from your plans.`}
          onConfirm={() => { onDelete?.(); setConfirmDeleteCollectionName(null); }}
          onCancel={() => setConfirmDeleteCollectionName(null)}
        />

        {!collapsed && (
          <div className="flex flex-col gap-5 pt-2 pl-1">
            <StopSection title={<><Plane className="h-3.5 w-3.5 text-sky-500" /> <span className="text-sky-600">Flights</span></>} emptyMessage="No flights added yet.">
              {colFlights.map(flightRow)}
            </StopSection>
            {(colLodgings.length > 0 || colCustomLodgings.length > 0) && (
              <StopSection title={<><BedDouble className="h-3.5 w-3.5 text-emerald-500" /> <span className="text-emerald-600">Places</span></>} emptyMessage="">
                {colLodgings.map((entry) => (
                  <SavedLodgingCard key={entry.lodging.lodge_id} entry={entry} />
                ))}
                {colCustomLodgings.map(customRow)}
              </StopSection>
            )}
            {(colActivities.length > 0 || colCustomActivities.length > 0) && (
              <StopSection title={<><MapPin className="h-3.5 w-3.5 text-violet-500" /> <span className="text-violet-600">Activities</span></>} emptyMessage="">
                {colActivities.map((entry) => (
                  <SavedActivityCard key={entry.activity.activity_id} entry={entry} />
                ))}
                {colCustomActivities.map(customRow)}
              </StopSection>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col border-r border-border/50 bg-card">
      {openCollection !== null ? (
        renderCollectionDetail(openCollection)
      ) : (
        <>
          <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border/40 px-5">
            <div className="flex items-center gap-2">
              <Notebook className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Plans</h2>
              {totalCount > 0 && (
                <span className="rounded-full bg-coral/10 px-2 py-0.5 text-xs font-medium text-coral">
                  {totalCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleShare(null)}
                disabled={totalCount === 0 && collections.length === 0}
                className="flex h-9 items-center gap-1.5 rounded-full bg-secondary/60 px-3 text-xs font-medium text-foreground transition-all duration-200 hover:bg-secondary hover:shadow-sm disabled:opacity-50"
                aria-label="Share plans link"
                title="Share all plans via link"
              >
                <Share2 className="h-4 w-4" />
                {copiedShareLink ? "Link ready!" : "Share"}
              </button>
              {totalCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleCopyItinerary()}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-secondary/60 px-3 text-xs font-medium text-foreground transition-all duration-200 hover:bg-secondary hover:shadow-sm"
                  aria-label="Copy itinerary to clipboard"
                  title="Copy plans as text"
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {copiedItinerary ? "Copied!" : "Copy"}
                </button>
              )}
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/60 text-foreground transition-all duration-200 hover:bg-secondary hover:shadow-sm"
                aria-label="Close plans panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-border/40 px-4 py-3">
            <button type="button" onClick={() => { setAddFormTarget(undefined); setAddFlightFormTarget(undefined); setShowNewCollectionInput((v) => !v); }} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-secondary">
              <FolderOpen className="h-4 w-4" /> New plan
            </button>
          </div>

          {creationStatus && <div role="status" className="border-b border-success/20 bg-success/10 px-4 py-2 text-xs font-medium text-foreground">{creationStatus}</div>}

          {error && (
            <div className="border-b border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {showNewCollectionInput && (
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
              <input
                autoFocus
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateCollection();
                  if (e.key === "Escape") { setShowNewCollectionInput(false); setNewCollectionName(""); }
                }}
                placeholder="Collection name..."
                className={`${INPUT_CLASS} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim()}
                className="rounded-md bg-gradient-to-r from-primary to-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-200 hover:shadow-md disabled:opacity-50"
              >
                Create
              </button>
            </div>
          )}

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 p-5">
              {totalCount === 0 && collections.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-foreground">Nothing saved yet</p>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    Save an activity or stay from a trip, or add an activity, stay, or flight here.
                  </p>
                </div>
              ) : (
                <>
                  {/* Named collections — tap the name to open the trip-style view */}
                  {allCollectionNames.map((col) => (
                    <div key={col}>{renderCollectionSection(col, () => onDeleteCollection(col))}</div>
                  ))}

                  {/* Unsorted items */}
                  {hasUnsorted && renderCollectionSection(null)}
                </>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
