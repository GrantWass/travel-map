"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { BedDouble, ChevronDown, ChevronUp, Expand, MapPin } from "lucide-react";

import WebsiteChip from "@/components/website-chip";
import { cn, formatAddress } from "@/lib/utils";

export function formatStopCost(cost: number | string | null | undefined): string | null {
    if (cost == null) return null;
    const numeric = typeof cost === "number" ? cost : Number(cost);
    if (!Number.isFinite(numeric)) return null;
    if (numeric <= 0) return "Free";
    return numeric % 1 === 0 ? `$${numeric}/person` : `$${numeric.toFixed(2)}/person`;
}

export const formatStopAddress = formatAddress;

export interface StopItem {
    title?: string | null;
    description?: string | null;
    address?: string | null;
    link_url?: string | null;
    cost?: number | string | null;
}

export interface StopCardConfig {
    label: string;
    icon: ReactNode;
    fallbackIcon: ReactNode;
    unexpandedHoverClass: string;
    noImageBorderClass: string;
}

export const LODGING_CARD_CONFIG: StopCardConfig = {
    label: "Lodging",
    icon: null,
    fallbackIcon: <BedDouble className="h-5 w-5 text-primary" />,
    unexpandedHoverClass: "bg-secondary/30 hover:bg-secondary/50",
    noImageBorderClass: "border-border bg-secondary/30",
};

export const ACTIVITY_CARD_CONFIG: StopCardConfig = {
    label: "Activity",
    icon: null,
    fallbackIcon: <MapPin className="h-5 w-5 text-primary" />,
    unexpandedHoverClass: "bg-secondary/40 hover:bg-secondary/70",
    noImageBorderClass: "border-border bg-secondary/40",
};

/** Shared "Places Stayed" / "Activities" section: heading + cards or empty state. */
export function StopSection({
    title,
    emptyMessage,
    children,
}: {
    title: ReactNode;
    emptyMessage: string;
    children?: ReactNode;
}) {
    const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
    return (
        <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {title}
            </h3>
            {hasItems ? children : <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
        </div>
    );
}

interface StopItemCardProps {
    item: StopItem;
    thumbnailUrl: string | null;
    isExpanded: boolean;
    onSelect: () => void;
    onExpandImage?: () => void;
    config: StopCardConfig;
    /** Optional row rendered at the bottom of the expanded card (edit/move/remove). */
    actions?: ReactNode;
}

export default function StopItemCard({
    item,
    thumbnailUrl,
    isExpanded,
    onSelect,
    onExpandImage,
    config,
    actions,
}: StopItemCardProps) {
    const hasImage = Boolean(thumbnailUrl);
    const costLabel = formatStopCost(item.cost);
    const addressLabel = formatStopAddress(item.address);

    const toggle = () => onSelect();

    if (!hasImage && !isExpanded) {
        return (
            <div
                role="button"
                tabIndex={0}
                onClick={toggle}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle();
                    }
                }}
                className={cn(
                    "w-full cursor-pointer rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                    config.noImageBorderClass,
                )}
            >
                <div className="flex items-center gap-3 p-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        {config.fallbackIcon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-words">{item.title}</p>
                        {addressLabel && (
                            <span className="mt-0.5 flex w-full items-start gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                                <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                <span className="min-w-0 break-words">{addressLabel}</span>
                            </span>
                        )}
                    </div>
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground self-center" />
                </div>
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={toggle}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                }
            }}
            className={cn(
                "w-full cursor-pointer rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                isExpanded
                    ? "border-primary bg-primary/8 shadow-sm shadow-primary/10"
                    : "border-border " + config.unexpandedHoverClass,
            )}
        >
            {isExpanded ? (
                <div className="flex flex-col gap-3 p-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </div>
                    {hasImage && (
                        <div className="group relative max-h-64 overflow-hidden rounded-lg bg-muted">
                            <Image
                                src={thumbnailUrl!}
                                alt={item.title || config.label}
                                fill
                                sizes="350px"
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            {costLabel && (
                                <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                                    {costLabel}
                                </span>
                            )}
                            {onExpandImage && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onExpandImage();
                                    }}
                                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                                    aria-label={`Expand ${item.title || config.label} image`}
                                >
                                    <Expand className="h-3 w-3" />
                                    Expand
                                </button>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                        {addressLabel && (
                            <span className="inline-flex max-w-[60%] flex-shrink-0 items-start gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground break-words whitespace-normal">
                                <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                <span className="min-w-0 break-words whitespace-normal">{addressLabel}</span>
                            </span>
                        )}
                        {costLabel && !hasImage && (
                            <p className="text-sm font-medium text-foreground/80">{costLabel}</p>
                        )}
                        {item.description && (
                            <p className="text-sm leading-relaxed text-foreground/70">{item.description}</p>
                        )}
                        {item.link_url && (
                            <span className="mt-1" onClick={(e) => e.stopPropagation()}>
                                <WebsiteChip url={item.link_url} />
                            </span>
                        )}
                    </div>
                    {actions && (
                        <div
                            className="flex items-center gap-1 border-t border-border pt-2"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                        >
                            {actions}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-3 p-3">
                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                        <Image src={thumbnailUrl!} alt={item.title || config.label} fill sizes="48px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-words">{item.title}</p>
                        {addressLabel && (
                            <span className="mt-0.5 flex w-full items-start gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                                <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                <span className="min-w-0 break-words">{addressLabel}</span>
                            </span>
                        )}
                    </div>
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground self-center" />
                </div>
            )}
        </div>
    );
}
