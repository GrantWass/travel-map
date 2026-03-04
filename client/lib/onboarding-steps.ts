import { createElement } from "react";
import type { ReactNode } from "react";
import { MapPin, Plus, UserRound, Compass, Sparkles, Notebook, type LucideIcon } from "lucide-react";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  /** CSS selector for the element to spotlight. null = centered modal, no cutout. */
  targetSelector: string | null;
  Icon: LucideIcon;
  /**
   * Optional override for the SVG mask cutout.
   * Return an SVG element (e.g. <rect>, <ellipse>) with fill="black" to punch the hole.
   * If omitted the default padded rect derived from targetRect is used.
   */
  cutout?: (targetRect: DOMRect | null, sw: number, sh: number) => ReactNode;
}

/** Steps shown to every user. */
export const SHARED_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to Travela!",
    description:
      "Your personal travel journal — log your trips and discover what others have been up to!",
    targetSelector: null,
    Icon: Sparkles,
  },
  {
    id: "map",
    title: "Explore the map",
    description:
      "Every pin is a trip. Tap any pin to browse photos, activities, lodging, and stories from that adventure.",
    targetSelector: '[data-spotlight="map"]',
    Icon: MapPin,
    // Spotlight only the usable map area — below the control bar, right of the onboarding card.
    cutout: (rect) => {
      if (!rect) return null;
      // Card sits at 48px from the left, width 304px, with a 16px gap before the cutout starts.
      // Right inset also 48px so the combined block (card + cutout) is centered on screen.
      const cardRight = 48 + 304 + 16; // 368px
      const x = Math.max(rect.left + 16, cardRight);
      // Below the top control bar: top-3 (12px) + h-12 (48px) + 8px breathing room = 68px.
      const y = rect.top + 68;
      const w = rect.right - x - 48; // 48px right margin matches left offset
      // Above the bottom attribution bar (~28px) with a small buffer.
      const h = rect.bottom - y - 40;
      if (w <= 0 || h <= 0) return null;
      return createElement("rect", { x, y, width: w, height: h, rx: 12, fill: "black" });
    },
  },
  {
    id: "explore",
    title: "Search & explore",
    description:
      "Search for trips by location, activity, or username. Filter by tags and cost to find something specific.",
    targetSelector: '[data-spotlight="explore"]',
    Icon: Compass,
  },
  {
    id: "plans",
    title: "Your plans",
    description:
      "Save lodging and activities from other trips to your personal plan. Build your next adventure piece by piece.",
    targetSelector: '[data-spotlight="plans"]',
    Icon: Notebook,
  },
  {
    id: "profile",
    title: "Your profile",
    description:
      "Your profile shows all your trips and stats. Update your bio, photo, and account settings anytime.",
    targetSelector: '[data-spotlight="profile"]',
    Icon: UserRound,
  },
];

/** Extra steps for students only. */
export const STUDENT_STEPS: OnboardingStep[] = [
  {
    id: "add-trip",
    title: "Log a trip",
    description:
      "Hit + to create a trip. Add photos, dates, activities, and choose who can see it — just you, friends, or everyone.",
    targetSelector: '[data-spotlight="add-trip"]',
    Icon: Plus,
  },
];

export function getStepsForUser(isStudent: boolean): OnboardingStep[] {
  return isStudent ? [...SHARED_STEPS, ...STUDENT_STEPS] : SHARED_STEPS;
}
