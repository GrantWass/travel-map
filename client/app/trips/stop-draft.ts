import type { PlaceOption } from "@/lib/client-types";

export interface StopDraft {
  id: string;
  title: string;
  notes: string;
  cost: string;
  linkUrl: string;
  imageUrl: string;
  imageName: string;
  imageError: string;
  isProcessingImage: boolean;
  location: PlaceOption | null;
}

export function makeStopDraft(): StopDraft {
  return {
    id: crypto.randomUUID(),
    title: "",
    notes: "",
    cost: "",
    linkUrl: "",
    imageUrl: "",
    imageName: "",
    imageError: "",
    isProcessingImage: false,
    location: null,
  };
}

export function hasStopContent(stop: StopDraft): boolean {
  return Boolean(
    stop.title.trim() ||
      stop.notes.trim() ||
      stop.cost.trim() ||
      stop.linkUrl.trim() ||
      stop.imageUrl ||
      stop.location,
  );
}
