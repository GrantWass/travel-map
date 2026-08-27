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
    fallbackIconWrapClass: string;
    expandedBorderClass: string;
    expandedShadowClass: string;
    noImageBorderClass: string;
    addressPillClass: string;
    collapsedPhotoBorderClass: string;
}

export const LODGING_CARD_CONFIG: StopCardConfig = {
    label: "Lodging",
    icon: null,
    fallbackIcon: <BedDouble className="h-5 w-5 text-emerald-600" />,
    fallbackIconWrapClass: "bg-gradient-to-br from-emerald-100 to-emerald-50",
    expandedBorderClass: "border-emerald-400/50 bg-emerald-50/30 shadow-md shadow-emerald-400/5",
    expandedShadowClass: "shadow-emerald-400/5",
    noImageBorderClass: "border-border bg-emerald-50/30",
    addressPillClass: "w-fit bg-secondary text-muted-foreground",
    collapsedPhotoBorderClass: "border-l-3 border-l-emerald-400",
};

export const ACTIVITY_CARD_CONFIG: StopCardConfig = {
    label: "Activity",
    icon: null,
    fallbackIcon: <MapPin className="h-5 w-5 text-violet-600" />,
    fallbackIconWrapClass: "bg-gradient-to-br from-violet-100 to-violet-50",
    expandedBorderClass: "border-violet-400/50 bg-violet-50/30 shadow-md shadow-violet-400/5",
    expandedShadowClass: "shadow-violet-400/5",
    noImageBorderClass: "border-border bg-violet-50/30",
    addressPillClass: "w-fit bg-secondary text-muted-foreground",
    collapsedPhotoBorderClass: "border-l-3 border-l-violet-400",
};

/** Shared "Places Stayed" / "Activities" section: heading + cards or hidden if empty. */
export function StopSection({
    title,
    children,
}: {
    title: ReactNode;
    emptyMessage?: string;
    children?: ReactNode;
}) {
    const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
    if (!hasItems) return null;
    return (
        <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {title}
            </h3>
            {children}
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
                    <div className={cn("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full", config.fallbackIconWrapClass)}>
                        {config.fallbackIcon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-words">{item.title}</p>
                        {addressLabel && (
                            <span className={cn("mt-0.5 flex items-start gap-1 rounded-full px-2 py-0.5 text-xs", config.addressPillClass)}>
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
                "w-full cursor-pointer rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                isExpanded
                    ? config.expandedBorderClass
                    : cn("border-border hover:shadow-sm hover:-translate-y-px", config.noImageBorderClass, hasImage && config.collapsedPhotoBorderClass),
            )}
        >
            {isExpanded ? (
                <div className="flex flex-col gap-3 p-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </div>
                    {hasImage && (
                        <div className="group relative h-56 overflow-hidden rounded-lg bg-muted">
                            <Image
                                src={thumbnailUrl!}
                                alt={item.title || config.label}
                                fill
                                sizes="350px"
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            {costLabel && (
                                <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-gradient-to-r from-black/60 to-black/45 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm shadow-lg">
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
                                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm shadow-lg transition-all duration-200 hover:bg-black/70 hover:scale-105"
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
                            <span className={cn("inline-flex max-w-[60%] flex-shrink-0 items-start gap-1 rounded-full px-2 py-0.5 text-xs break-words whitespace-normal", config.addressPillClass)}>
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
                            <span className={cn("mt-0.5 flex items-start gap-1 rounded-full px-2 py-0.5 text-xs", config.addressPillClass)}>
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
