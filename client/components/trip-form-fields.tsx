"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Plus, Trash2 } from "lucide-react";

import PlacePicker from "@/components/place-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PlaceOption } from "@/lib/client-types";
import { AVAILABLE_TAGS } from "@/lib/trip-constants";
import type { TripVisibility } from "@/lib/api-types";
import { unfurlLink, looksLikeLink } from "@/lib/link-unfurl";
import { hasStopContent, type StopDraft } from "@/app/trips/stop-draft";

export const READABLE_INPUT_CLASS = "bg-white text-foreground placeholder:text-muted-foreground";
export const READABLE_TEXTAREA_CLASS = "bg-white text-foreground placeholder:text-muted-foreground";

const STOP_KIND_CONFIG = {
  lodging: {
    noun: "Stay",
    titlePlaceholder: "Name this stay",
    notesPlaceholder: "What made this place good (or bad)?",
    emptyMessage: "Add hotels, campgrounds, or anywhere you stayed.",
    emptyPreviewMessage: "No stays added.",
    untitledLabel: "Untitled stay",
    noNotesLabel: "No stay notes yet.",
  },
  activity: {
    noun: "Activity",
    titlePlaceholder: "Name this activity",
    notesPlaceholder: "What should people know before going?",
    emptyMessage: "Add museums, hikes, restaurants, or events.",
    emptyPreviewMessage: "No activities added.",
    untitledLabel: "Untitled activity",
    noNotesLabel: "No activity notes yet.",
  },
} as const;

export type StopKind = keyof typeof STOP_KIND_CONFIG;

export function VisibilitySelect({
  value,
  onChange,
}: {
  value: TripVisibility;
  onChange: (value: TripVisibility) => void;
}) {
  return (
    <select
      className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-foreground"
      value={value}
      onChange={(event) => onChange(event.target.value as TripVisibility)}
    >
      <option value="public">public</option>
      <option value="private">private</option>
      <option value="friends">friends</option>
    </select>
  );
}

export function TagEditor({
  selectedTags,
  onToggle,
  customTagInput,
  onCustomTagInputChange,
  onAddCustomTag,
}: {
  selectedTags: string[];
  onToggle: (tag: string) => void;
  customTagInput: string;
  onCustomTagInputChange: (value: string) => void;
  onAddCustomTag: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {AVAILABLE_TAGS.map((tag) => {
        const selected = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
              selected
                ? "border-primary bg-primary text-white"
                : "border-input bg-white text-foreground/80 hover:border-stone-400"
            }`}
          >
            {tag}
          </button>
        );
      })}
      {selectedTags
        .filter((tag) => !(AVAILABLE_TAGS as readonly string[]).includes(tag))
        .map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className="flex items-center gap-1 rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-amber-700"
          >
            {tag}
            <span className="text-white/70">×</span>
          </button>
        ))}
      <div className="flex items-center gap-1">
        <input
          value={customTagInput}
          onChange={(event) => onCustomTagInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddCustomTag();
            }
          }}
          placeholder="Other..."
          className="w-24 rounded-full border border-input bg-white px-3 py-1.5 text-xs font-semibold text-foreground/80 outline-none focus:border-primary"
        />
        {customTagInput.trim() && (
          <button
            type="button"
            onClick={onAddCustomTag}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-primary text-white hover:bg-amber-700"
            aria-label="Add custom tag"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function StopEditorCard({
    kind,
    stop,
    index,
    cityContext,
    onUpdate,
    onRemove,
    onImageUpload,
}: {
    kind: StopKind;
    stop: StopDraft;
    index: number;
    cityContext: PlaceOption | null;
    onUpdate: (patch: Partial<StopDraft>) => void;
    onRemove: () => void;
    onImageUpload: (file?: File) => void;
}) {
    const config = STOP_KIND_CONFIG[kind];
    const [isResolvingLink, setIsResolvingLink] = useState(false);
    const [autoFilled, setAutoFilled] = useState(false);
    const unfurlSequenceRef = useRef(0);

    async function handleLinkChange(value: string) {
        onUpdate({ linkUrl: value });

        // Magic fill: pasting a link auto-populates empty fields from the page.
        const trimmed = value.trim();
        if (!looksLikeLink(trimmed)) return;

        const sequence = ++unfurlSequenceRef.current;
        setIsResolvingLink(true);
        const preview = await unfurlLink(trimmed);
        if (sequence !== unfurlSequenceRef.current) return;
        setIsResolvingLink(false);

        if (!preview) return;

        const patch: Partial<StopDraft> = {};
        if (preview.title && !stop.title.trim()) patch.title = preview.title;
        if (preview.description && !stop.notes.trim()) patch.notes = preview.description;
        if (preview.image && !stop.imageUrl) {
            patch.imageUrl = preview.image;
            patch.imageName = "From link";
            patch.imageError = "";
        }
        if (Object.keys(patch).length > 0) {
            onUpdate(patch);
            setAutoFilled(true);
        }
    }

    return (
        <div id={`stop-${kind}-${stop.id}`} className="rounded-xl border border-border bg-secondary/50 p-4">
            <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground/80">
                    {config.noun} #{index + 1}
                </p>
                <button
                    type="button"
                    onClick={onRemove}
                    className="rounded-full p-1 text-muted-foreground/70 transition-colors hover:bg-white hover:text-foreground/80"
                    aria-label={`Remove ${kind === "lodging" ? "stay" : "activity"}`}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            <div className="grid gap-3">
                <div>
                    <Input
                        value={stop.linkUrl}
                        onChange={(event) => void handleLinkChange(event.target.value)}
                        placeholder="Paste a link — we'll fill in the details"
                        className={`${READABLE_INPUT_CLASS} border-dashed`}
                    />
                    {isResolvingLink ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Reading the page...
                        </p>
                    ) : autoFilled ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-success">
                            <Link2 className="h-3 w-3" />
                            Auto-filled from link
                        </p>
                    ) : null}
                </div>

                <Input
                    value={stop.title}
                    onChange={(event) => onUpdate({ title: event.target.value })}
                    placeholder={config.titlePlaceholder}
                    className={READABLE_INPUT_CLASS}
                />

        <PlacePicker
          label="Location"
          placeholder="Search an address"
          value={stop.location}
          onChange={(location) => onUpdate({ location })}
          mode="address"
          cityContext={cityContext}
          allowMapPin
        />

        <Textarea
          value={stop.notes}
          rows={3}
          onChange={(event) => onUpdate({ notes: event.target.value })}
          placeholder={config.notesPlaceholder}
          className={`resize-none ${READABLE_TEXTAREA_CLASS}`}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="text"
            inputMode="numeric"
            value={stop.cost}
            onChange={(event) => onUpdate({ cost: event.target.value.replace(/\D/g, "") })}
            placeholder="Cost per person (optional)"
            className={READABLE_INPUT_CLASS}
          />
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary">
            <ImagePlus className="h-4 w-4 text-primary" />
            {stop.imageUrl ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/*"
              disabled={stop.isProcessingImage}
              className="sr-only"
              onChange={(event) => onImageUpload(event.target.files?.[0])}
            />
          </label>
        </div>
        {stop.isProcessingImage ? (
          <p className="text-xs text-muted-foreground">Uploading image...</p>
        ) : stop.imageUrl ? (
          <p className="text-xs text-success">Photo uploaded.</p>
        ) : (
          <p className="text-xs text-muted-foreground">No photo selected.</p>
        )}
        {stop.imageError ? <p className="text-xs font-medium text-destructive">{stop.imageError}</p> : null}
        {stop.imageUrl ? (
          <div className="rounded-lg border border-border bg-white p-2">
            <div className="flex items-center gap-3">
              <Image
                src={stop.imageUrl}
                alt={stop.title ? `${stop.title} preview` : `${config.noun} photo preview`}
                width={80}
                height={80}
                className="h-20 w-20 rounded-md border border-border object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground/80">
                  {stop.imageName || "Selected image"}
                </p>
                <p className="text-xs text-muted-foreground">Preview shown as it will appear in this post.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  onUpdate({
                    imageUrl: "",
                    imageName: "",
                    imageError: "",
                    isProcessingImage: false,
                  })
                }
              >
                Remove
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StopEditorSection({
  kind,
  heading,
  addLabel,
  stops,
  cityContext,
  onAdd,
  onUpdate,
  onRemove,
  onImageUpload,
}: {
  kind: StopKind;
  heading: string;
  addLabel: string;
  stops: StopDraft[];
  cityContext: PlaceOption | null;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<StopDraft>) => void;
  onRemove: (id: string) => void;
  onImageUpload: (id: string, file?: File) => void;
}) {
  const config = STOP_KIND_CONFIG[kind];

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
        <Button type="button" variant="outline" className="rounded-full" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      {stops.length === 0 ? <p className="text-sm text-muted-foreground">{config.emptyMessage}</p> : null}

      <div className="space-y-4">
        {stops.map((stop, index) => (
          <StopEditorCard
            key={stop.id}
            kind={kind}
            stop={stop}
            index={index}
            cityContext={cityContext}
            onUpdate={(patch) => onUpdate(stop.id, patch)}
            onRemove={() => onRemove(stop.id)}
            onImageUpload={(file) => onImageUpload(stop.id, file)}
          />
        ))}
      </div>
    </div>
  );
}

export function StopPreviewList({
  kind,
  stops,
}: {
  kind: StopKind;
  stops: StopDraft[];
}) {
  const config = STOP_KIND_CONFIG[kind];
  const previewStops = stops.filter(hasStopContent);

  return (
    <div>
      <p className="font-semibold text-foreground">
        {config.noun}s ({previewStops.length})
      </p>
      {previewStops.length > 0 ? (
        <div className="mt-2 space-y-2">
          {previewStops.map((stop) => (
            <article key={stop.id} className="rounded-xl border border-border bg-white p-2">
              <div className="flex items-start gap-3">
                <Image
                  src={stop.imageUrl || "/placeholder-trip.svg"}
                  alt={stop.title ? `${stop.title} preview` : `${config.noun} preview`}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-md border border-border object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {stop.title || config.untitledLabel}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {stop.location?.label || stop.location?.address || "Location not set"}
                  </p>
                  <p className="max-h-10 overflow-hidden text-xs leading-relaxed text-muted-foreground">
                    {stop.notes || config.noNotesLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">{stop.cost ? `Cost/person: $${stop.cost}` : "No cost added"}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-muted-foreground">{config.emptyPreviewMessage}</p>
      )}
    </div>
  );
}
