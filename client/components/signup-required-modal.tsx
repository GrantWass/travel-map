"use client";

import { UserRoundPlus, X } from "lucide-react";

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
  if (!open) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[2100] bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[2200] w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <UserRoundPlus className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/60 text-foreground transition-colors hover:bg-secondary"
            aria-label="Close signup prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Not now
          </Button>
          <Button type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
