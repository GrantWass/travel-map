"use client";

import { useLayoutEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { markOnboardingComplete } from "@/lib/api-client";
import type { OnboardingStep } from "@/lib/onboarding-steps";

interface OnboardingTourProps {
  steps: OnboardingStep[];
  onComplete: () => void;
}

const CARD_W = 304;
const SPOTLIGHT_PAD = 10;
const SCREEN_PAD = 12;
const CARD_H_EST = 220;

function useTargetRect(selector: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  // useLayoutEffect fires before paint so the spotlight updates in the same frame as the step
  // change — prevents the previous step's cutout from flashing when navigating back.
  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    function measure() {
      const el = document.querySelector(selector!);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selector]);

  return rect;
}

export default function OnboardingTour({ steps, onComplete }: OnboardingTourProps) {
  const [index, setIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const step = steps[index];

  // Hook must be called unconditionally (rules of hooks).
  const targetRect = useTargetRect(step?.targetSelector ?? null);

  // Guard after all hooks: handles brief re-render as parent unmounts this component.
  if (!step) return null;

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const Icon = step.Icon;

  async function finish() {
    setIsFinishing(true);
    try {
      await markOnboardingComplete(steps.map((s) => s.id));
    } catch {
      // Ignore — tour closes regardless; re-shows on next login if server didn't confirm.
    }
    onComplete();
  }

  // ── Fixed card position: centered vertically, ~1/3 from left ─────────────
  const sw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const sh = typeof window !== "undefined" ? window.innerHeight : 900;

  const cardTop = Math.round(sh / 2 - CARD_H_EST / 2);
  // 48px left margin gives a symmetric right margin on the cutout → combined block is centered.
  const cardLeft = Math.max(SCREEN_PAD, Math.min(sw - CARD_W - SCREEN_PAD, 48));

  // Per-step mask ID prevents browsers from serving a stale cached mask when the cutout
  // content changes (e.g. navigating back to "welcome" which has no cutout element).
  const maskId = `tm-spotlight-mask-${index}`;

  return (
    <>
      {/* Invisible click-blocker — prevents interacting with anything below the overlay */}
      <div className="fixed inset-0" style={{ zIndex: 2999 }} />

      {/* Full-screen overlay with spotlight cutout */}
      <svg
        className="pointer-events-none fixed inset-0"
        style={{ zIndex: 3000 }}
        width="100%"
        height="100%"
      >
        <defs>
          <mask key={maskId} id={maskId} maskUnits="userSpaceOnUse">
            <rect x={0} y={0} width={sw} height={sh} fill="white" />
            {step.cutout
              ? step.cutout(targetRect, sw, sh)
              : targetRect && (
                  <rect
                    x={targetRect.left - SPOTLIGHT_PAD}
                    y={targetRect.top - SPOTLIGHT_PAD}
                    width={targetRect.width + SPOTLIGHT_PAD * 2}
                    height={targetRect.height + SPOTLIGHT_PAD * 2}
                    rx={10}
                    fill="black"
                  />
                )}
          </mask>
        </defs>
        <rect
          x={0}
          y={0}
          width={sw}
          height={sh}
          fill="rgba(0,0,0,0.58)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* Tooltip card — fixed position, never moves between steps */}
      <div
        className="fixed rounded-2xl border border-stone-200 bg-white shadow-2xl"
        style={{ zIndex: 3001, top: cardTop, left: cardLeft, width: CARD_W }}
      >
        <div className="p-5">
          {/* Icon */}
          <div className="mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Icon className="h-5 w-5 text-amber-600" />
            </div>
          </div>

          <h3 className="mb-1.5 text-base font-semibold text-stone-900">{step.title}</h3>
          <p className="text-sm leading-relaxed text-stone-500">{step.description}</p>

          {/* Progress dots */}
          <div className="my-4 flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === index ? "w-5 bg-amber-500" : "w-1.5 bg-stone-200"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                disabled={isFinishing}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            )}
            <div className="ml-auto">
              {isLast ? (
                <button
                  type="button"
                  onClick={() => void finish()}
                  disabled={isFinishing}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isFinishing ? "Done…" : "Get started"}
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIndex(index + 1)}
                  disabled={isFinishing}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Next
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
