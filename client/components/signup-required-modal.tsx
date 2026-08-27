"use client";

import { useEffect } from "react";
import { UserRoundPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SignupRequiredModalProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function SignupRequiredModal({
  open,
  title = "Create an account to continue",
  description = "Sign up or sign in to use this feature.",
  confirmLabel = "Sign up or sign in",
  onClose,
  onConfirm,
}: SignupRequiredModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[2100] bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[2200] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border/50 bg-card shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-coral/8 to-amber-100/40 px-6 pt-8 pb-6">
          {/* Decorative blobs */}
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-coral/12 blur-xl" />
          <div className="absolute right-8 bottom-2 h-10 w-10 rounded-full bg-amber-200/30 blur-lg" />

          <div className="relative flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
              <UserRoundPlus className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">{title}</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-5 py-4">
          <Button type="button" onClick={onConfirm} className="w-full shadow-md shadow-primary/20 active:scale-[0.98]">
            {confirmLabel}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-secondary/60 hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </>
  );
}
