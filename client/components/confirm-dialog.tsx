"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[1700] bg-black/45 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-[1800] w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border/60 bg-card p-5 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-3.5 py-2 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-secondary hover:shadow-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-gradient-to-r from-destructive to-destructive/90 px-3.5 py-2 text-xs font-medium text-destructive-foreground shadow-sm shadow-destructive/20 transition-all duration-200 hover:shadow-md hover:shadow-destructive/25 active:scale-[0.97]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
