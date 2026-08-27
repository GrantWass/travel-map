"use client";

import { AlertCircle, Loader2 } from "lucide-react";

interface StatusToastProps {
  message: string;
  tone?: "loading" | "error" | "success";
}

export default function StatusToast({ message, tone = "loading" }: StatusToastProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className="app-surface pointer-events-none flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium text-foreground"
    >
      {tone === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : null}
      {tone === "error" ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> : null}
      {message}
    </div>
  );
}
