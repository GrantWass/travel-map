"use client";

import { Globe, Users, User } from "lucide-react";
import { useCallback, useRef } from "react";

type OwnerFilter = "all" | "friends" | "you";

const OPTIONS: { value: OwnerFilter; icon: React.ElementType; label: string; activeClass: string }[] = [
    { value: "all", icon: Globe, label: "All", activeClass: "text-primary" },
    { value: "friends", icon: Users, label: "Friends", activeClass: "text-primary" },
    { value: "you", icon: User, label: "You", activeClass: "text-coral" },
];

interface OwnerFilterSliderProps {
    value: OwnerFilter;
    onChange: (value: OwnerFilter) => void;
}

export default function OwnerFilterSlider({ value, onChange }: OwnerFilterSliderProps) {
    const currentIndex = OPTIONS.findIndex((o) => o.value === value);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const resolveFromX = useCallback((clientX: number) => {
        const container = containerRef.current;
        if (!container) return;
        const { left, width } = container.getBoundingClientRect();
        const fraction = (clientX - left) / width;
        if (fraction < 1 / 3) onChange("all");
        else if (fraction < 2 / 3) onChange("friends");
        else onChange("you");
    }, [onChange]);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        isDragging.current = true;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        resolveFromX(e.clientX);
    }, [resolveFromX]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        resolveFromX(e.clientX);
    }, [resolveFromX]);

    const handlePointerUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative inline-flex select-none rounded-full border border-border bg-card/80 shadow-md cursor-pointer overflow-hidden max-w-[calc(100vw-2rem)] min-w-[280px] backdrop-blur-sm"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            {/* Thumb: 4px inset from left/right edges only; top/bottom use existing vertical gap */}
            <div
                className="absolute top-[4px] bottom-[4px] rounded-full bg-card shadow-md ring-1 ring-black/5 pointer-events-none"
                style={{
                    left: `calc(4px + ${currentIndex} * (100% / 3))`,
                    width: `calc(100% / 3 - 8px)`,
                    transition: "left 0.2s ease-out",
                }}
            />

            {OPTIONS.map(({ value: optValue, icon: Icon, label, activeClass }) => (
                <button
                    key={optValue}
                    type="button"
                    onClick={() => onChange(optValue)}
                    className={`relative z-10 flex items-center justify-center gap-1.5 h-11 flex-1 min-w-0 text-sm font-medium transition-colors duration-150 ${
                        value === optValue ? activeClass : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label={label}
                    title={label}
                >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{label}</span>
                </button>
            ))}
        </div>
    );
}
