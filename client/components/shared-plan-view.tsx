"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BedDouble, CalendarRange, MapPin, Notebook, Plane } from "lucide-react";

import type { SharedPlan } from "@/lib/api-client";
import WebsiteChip from "@/components/website-chip";
import CostBadge from "@/components/cost-badge";

// Leaflet touches window at import time, so only load the map client-side.
const SharedPlanMap = dynamic(() => import("@/components/shared-plan-map"), { ssr: false });

/** Thumbnail when a photo exists; otherwise a kind-appropriate icon tile. */
function StopThumb({ src, alt, kind }: { src?: string | null; alt: string; kind: "activity" | "lodging" }) {
    if (src) {
        return (
            <Image
                src={src}
                alt={alt}
                width={48}
                height={48}
                sizes="48px"
                className="h-12 w-12 rounded-md border border-border object-cover"
            />
        );
    }
    const Icon = kind === "activity" ? MapPin : BedDouble;
    return (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-border bg-white text-primary">
            <Icon className="h-5 w-5" />
        </div>
    );
}

function StopArticle({
    title,
    address,
    addressIcon: AddressIcon,
    description,
    linkUrl,
    cost,
    thumbnail,
    kind,
}: {
    title: string;
    address?: string | null;
    addressIcon?: React.ReactNode;
    description?: string | null;
    linkUrl?: string | null;
    cost?: number | string | null | undefined;
    thumbnail?: string | null;
    kind: "activity" | "lodging";
}) {
    return (
        <article className="flex items-start gap-3 rounded-xl border border-border bg-secondary/50 p-3">
            <StopThumb src={thumbnail} alt={title || kind} kind={kind} />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{title || `Untitled ${kind}`}</p>
                {address && (
                    <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                        {AddressIcon}
                        <span>{address}</span>
                    </p>
                )}
                {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
                {linkUrl && (
                    <span className="mt-1"><WebsiteChip url={linkUrl} /></span>
                )}
            </div>
            <CostBadge cost={cost} variant="light" />
        </article>
    );
}

export default function SharedPlanView({ plan }: { plan: SharedPlan }) {
    return (
        <main className="h-screen overflow-y-auto bg-[linear-gradient(180deg,#f7efe2_0%,#f4f4ef_55%,#eef3f6_100%)] px-4 py-10 md:px-8">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
                <header className="flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary">
                        <Notebook className="h-4 w-4" />
                        Made with Travela
                    </Link>
                </header>

                <div className="rounded-3xl border border-border/80 bg-card/90 p-6 shadow-xl shadow-black/10 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">Shared travel plans</p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                        {plan.scope ? plan.scope : "Travel plans"}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {plan.owner_name ? `Put together by ${plan.owner_name}` : "Put together by a fellow traveler"}
                    </p>

                    {(plan.groups.some((g) => (g.activities ?? []).length + (g.lodgings ?? []).length > 0)) && (
                        <div className="mt-5">
                            <SharedPlanMap plan={plan} />
                        </div>
                    )}

                    <div className="mt-6 flex flex-col gap-6">
                        {plan.groups.length === 0 && (
                            <p className="text-sm text-muted-foreground">This plan is empty.</p>
                        )}

                        {plan.groups.map((group) => (
                            <section key={group.name} className="flex flex-col gap-3">
                                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.name}</h2>

                                {group.activities.map((item, index) => (
                                    <StopArticle
                                        key={`a-${index}`}
                                        title={item.title || ""}
                                        address={item.address}
                                        addressIcon={<MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />}
                                        description={item.description}
                                        linkUrl={item.link_url}
                                        cost={item.cost}
                                        thumbnail={item.thumbnail_url}
                                        kind="activity"
                                    />
                                ))}

                                {group.lodgings.map((item, index) => (
                                    <StopArticle
                                        key={`l-${index}`}
                                        title={item.title || ""}
                                        address={item.address}
                                        addressIcon={<BedDouble className="mt-0.5 h-3 w-3 flex-shrink-0" />}
                                        description={item.description}
                                        linkUrl={item.link_url}
                                        cost={item.cost}
                                        thumbnail={item.thumbnail_url}
                                        kind="lodging"
                                    />
                                ))}

                                {(group.flights ?? []).map((flight, index) => {
                                    const route =
                                        flight.origin_code && flight.destination_code
                                            ? `${flight.origin_code} → ${flight.destination_code}`
                                            : flight.airline || "Flight";
                                    const details = [
                                        flight.airline && route !== flight.airline ? flight.airline : null,
                                        flight.flight_number ? `#${flight.flight_number}` : null,
                                        [flight.departure_date, flight.departure_time].filter(Boolean).join(" "),
                                        flight.notes,
                                    ].filter(Boolean);
                                    return (
                                        <article key={`f-${index}`} className="flex items-start gap-3 rounded-xl border border-border bg-secondary/50 p-3">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-white text-primary">
                                                <Plane className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-foreground">{route}</p>
                                                {details.length > 0 && (
                                                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{details.join(" · ")}</p>
                                                )}
                                                {flight.link_url && (
                                                    <span className="mt-1"><WebsiteChip url={flight.link_url} /></span>
                                                )}
                                            </div>
                                            {flight.price && (
                                                <CostBadge cost={flight.price} variant="light" />
                                            )}
                                        </article>
                                    );
                                })}
                            
                            </section>
                        ))}
                    </div>
                </div>

                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
                    <CalendarRange className="h-3 w-3" />
                    Plans are a live snapshot of saved places.
                </p>

                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-sm">
                    <p className="text-sm text-muted-foreground">Want to plan your own trips?</p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                    >
                        Explore Travela
                    </Link>
                </div>
            </div>
        </main>
    );
}
