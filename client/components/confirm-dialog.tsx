"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="app-surface fixed left-1/2 top-1/2 z-[1800] w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 animate-in zoom-in-95 fade-in duration-200">
        <h3 id="confirm-dialog-title" className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={onCancel}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            variant="destructive"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
