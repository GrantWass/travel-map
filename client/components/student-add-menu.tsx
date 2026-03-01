"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Plane, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentAddMenuProps {
    visible: boolean;
    onAddTrip?: () => void;
    onAddPopUp?: () => void;
}

export default function StudentAddMenu({ visible, onAddTrip, onAddPopUp }: StudentAddMenuProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        function handlePointerDown(e: PointerEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [open]);

    if (!visible) return null;

    return (
        <div ref={containerRef} className="absolute bottom-4 left-4 z-[1000] flex flex-col items-start">
            <div className="mb-3 flex flex-col items-start gap-2">
                <button
                    onClick={() => {
                        onAddTrip?.();
                        setOpen(false);
                    }}
                    className={cn(
                        "flex h-10 items-center gap-2 rounded-full border border-border bg-card/95 px-4 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-all duration-[250ms] ease-out",
                        open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-2 scale-95 opacity-0",
                    )}
                    style={{ transitionDelay: open ? "0ms" : "80ms" }}
                    aria-hidden={!open}
                    tabIndex={open ? 0 : -1}
                >
                    <Plane className="h-4 w-4 text-primary" />
                    Add Trip
                </button>
                <button
                    onClick={() => {
                        onAddPopUp?.();
                        setOpen(false);
                    }}
                    className={cn(
                        "flex h-10 items-center gap-2 rounded-full border border-border bg-card/95 px-4 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-all duration-[250ms] ease-out",
                        open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-2 scale-95 opacity-0",
                    )}
                    style={{ transitionDelay: open ? "40ms" : "40ms" }}
                    aria-hidden={!open}
                    tabIndex={open ? 0 : -1}
                >
                    <Timer className="h-4 w-4 text-primary" />
                    Add Pop-Up
                </button>
            </div>

            <button
                onClick={() => setOpen((prev) => !prev)}
                className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-[250ms] ease-out hover:scale-[1.03] hover:bg-primary/90",
                    open && "rotate-45",
                )}
                aria-label={open ? "Close quick add menu" : "Open quick add menu"}
                aria-expanded={open}
            >
                <Plus className="h-7 w-7" />
            </button>
        </div>
    );
}
