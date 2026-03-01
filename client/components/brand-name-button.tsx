"use client";

import { useEffect, useState } from "react";
import { APP_NAME, APP_NAME_DESCRIPTION } from "@/lib/branding";
import { cn } from "@/lib/utils";

interface BrandNameButtonProps {
    className?: string;
    popupClassName?: string;
    popupPlacement?: "top" | "bottom";
}

export default function BrandNameButton({
    className,
    popupClassName,
    popupPlacement = "bottom",
}: BrandNameButtonProps) {
    const [isPopupOpen, setPopupOpen] = useState(false);
    const [isPressed, setPressed] = useState(false);

    useEffect(() => {
        if (!isPopupOpen) {
            return;
        }

        const timeout = window.setTimeout(() => setPopupOpen(false), 2600);
        return () => window.clearTimeout(timeout);
    }, [isPopupOpen]);

    function handleClick() {
        setPopupOpen((current) => !current);
        setPressed(true);
        window.setTimeout(() => setPressed(false), 140);
    }

    const placementClasses =
        popupPlacement === "top"
            ? "bottom-full mb-2"
            : "top-full mt-2";

    return (
        <div className="relative inline-flex items-center">
            <button
                type="button"
                onClick={handleClick}
                className={cn(
                    "font-brand rounded-sm transition-all duration-150 ease-out hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                    isPressed ? "scale-[1.03]" : "scale-100",
                    className,
                )}
                aria-label={`About ${APP_NAME}`}
            >
                {APP_NAME}
            </button>
            <div
                className={cn(
                    "pointer-events-none absolute left-1/2 z-[1500] w-64 -translate-x-1/2 rounded-md border border-border bg-card/95 px-3 py-2 text-center text-xs leading-relaxed text-foreground shadow-lg backdrop-blur-sm transition-all duration-200",
                    placementClasses,
                    isPopupOpen ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                    popupClassName,
                )}
                role="status"
                aria-live="polite"
            >
                {APP_NAME_DESCRIPTION}
            </div>
        </div>
    );
}
