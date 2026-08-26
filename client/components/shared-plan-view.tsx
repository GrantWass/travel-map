"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BedDouble, CalendarRange, ExternalLink, MapPin, Notebook, Plane } from "lucide-react";

import type { SharedPlan, SharedPlanGroup } from "@/lib/api-client";
import { formatStopCost } from "@/components/stop-item-card";

// Leaflet touches window at import time, so only load the map client-side.
const SharedPlanMap = dynamic(() => import("@/components/shared-plan-map"), { ssr: false });

function WebsiteChip({ url }: { url: string }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
            <ExternalLink className="h-3 w-3" />
            Website
        </a>
    );
}

/** Thumbnail when a photo exists; otherwise a kind-appropriate icon tile. */
function StopThumb({ src, alt, kind }: { src?: string | null; alt: string; kind: "activity" | "lodging" }) {
    if (src) {
        return (
            <Image
                src={src}
                alt={alt}
                width={48}
                height={48}
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
                                    <article key={`a-${index}`} className="flex items-start gap-3 rounded-xl border border-border bg-secondary/50 p-3">
                                        <StopThumb src={item.thumbnail_url} alt={item.title || "Activity"} kind="activity" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-foreground">{item.title || "Untitled activity"}</p>
                                            {item.address && (
                                                <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                                                    <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                                    <span>{item.address}</span>
                                                </p>
                                            )}
                                            {item.description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>}
                                            {item.link_url && (
                                                <span className="mt-1"><WebsiteChip url={item.link_url} /></span>
                                            )}
                                        </div>
                                        <CostLabel cost={item.cost} />
                                    </article>
                                ))}

                                {group.lodgings.map((item, index) => (
                                    <article key={`l-${index}`} className="flex items-start gap-3 rounded-xl border border-border bg-secondary/50 p-3">
                                        <StopThumb src={item.thumbnail_url} alt={item.title || "Lodging"} kind="lodging" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-foreground">{item.title || "Untitled lodging"}</p>
                                            {item.address && (
                                                <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                                                    <BedDouble className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                                    <span>{item.address}</span>
                                                </p>
                                            )}
                                            {item.description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>}
                                            {item.link_url && (
                                                <span className="mt-1"><WebsiteChip url={item.link_url} /></span>
                                            )}
                                        </div>
                                        <CostLabel cost={item.cost} />
                                    </article>
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
                                                <span className="flex-shrink-0 rounded-full bg-stone-900/5 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                    {flight.price}
                                                </span>
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
            </div>
        </main>
    );
}

function CostLabel({ cost }: { cost: number | string | null }) {
    const label = formatStopCost(cost);
    if (!label) return null;
    return (
        <span className="flex-shrink-0 rounded-full bg-stone-900/5 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {label}
        </span>
    );
}
