"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, BedDouble, CalendarRange, MapPin, Notebook, Plane } from "lucide-react";

import type { SharedPlan } from "@/lib/api-client";
import WebsiteChip from "@/components/website-chip";
import CostBadge from "@/components/cost-badge";
import { formatAddress, formatFlightPrice } from "@/lib/utils";

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
                className="h-12 w-12 rounded-full object-cover"
            />
        );
    }
    const Icon = kind === "activity" ? MapPin : BedDouble;
    const wrapClass = kind === "activity"
        ? "bg-gradient-to-br from-violet-100 to-violet-50 text-violet-600"
        : "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600";
    return (
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${wrapClass}`}>
            <Icon className="h-5 w-5" />
        </div>
    );
}

function StopArticle({
    id,
    title,
    address,
    addressIcon: AddressIcon,
    description,
    linkUrl,
    cost,
    thumbnail,
    kind,
}: {
    id?: string;
    title: string;
    address?: string | null;
    addressIcon?: React.ReactNode;
    description?: string | null;
    linkUrl?: string | null;
    cost?: number | string | null | undefined;
    thumbnail?: string | null;
    kind: "activity" | "lodging";
}) {
    const displayAddress = formatAddress(address);
    return (
        <article id={id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 p-3 scroll-mt-20 transition-all duration-200 hover:shadow-md hover:-translate-y-px">
            <StopThumb src={thumbnail} alt={title || kind} kind={kind} />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{title || `Untitled ${kind}`}</p>
                {displayAddress && (
                    <p className="mt-0.5 flex w-fit items-start gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {AddressIcon}
                        <span>{displayAddress}</span>
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

function CategoryHeading({
    icon,
    label,
    className,
}: {
    icon: React.ReactNode;
    label: string;
    className: string;
}) {
    return (
        <h3 className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest ${className}`}>
            {icon}
            {label}
        </h3>
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

                        {plan.groups.map((group, gi) => (
                            <section key={group.name} className="flex flex-col gap-5">
                                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.name}</h2>

                                {(group.flights ?? []).length > 0 && (
                                    <div className="flex flex-col gap-3">
                                        <CategoryHeading icon={<Plane className="h-3.5 w-3.5" />} label="Flights" className="text-sky-600" />
                                        {(group.flights ?? []).map((flight, index) => {
                                            const route = flight.origin_code && flight.destination_code
                                                ? `${flight.origin_code} → ${flight.destination_code}`
                                                : flight.airline || "Flight";
                                            const details = [
                                                flight.airline && route !== flight.airline ? flight.airline : null,
                                                flight.flight_number ? `#${flight.flight_number}` : null,
                                                [flight.outbound_date || flight.departure_date, flight.departure_time].filter(Boolean).join(" "),
                                                flight.return_date ? `Return ${flight.return_date}` : null,
                                                flight.notes,
                                            ].filter(Boolean);
                                            return (
                                                <article key={`f-${index}`} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 p-3 transition-all duration-200 hover:-translate-y-px hover:shadow-md">
                                                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600"><Plane className="h-5 w-5" /></div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-foreground">{route}</p>
                                                        {details.length > 0 && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{details.join(" · ")}</p>}
                                                        {flight.link_url && <span className="mt-1"><WebsiteChip url={flight.link_url} /></span>}
                                                    </div>
                                                    {flight.price && <span className="flex-shrink-0 rounded-full bg-stone-900/5 px-2 py-0.5 text-xs font-medium text-muted-foreground">{formatFlightPrice(flight.price)}</span>}
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}

                                {group.lodgings.length > 0 && (
                                    <div className="flex flex-col gap-3">
                                        <CategoryHeading icon={<BedDouble className="h-3.5 w-3.5" />} label="Places" className="text-emerald-600" />
                                        {group.lodgings.map((item, li) => (
                                            <StopArticle key={`l-${gi}-${li}`} id={`shared-stop-${gi}-lodging-${li}`} title={item.title || ""} address={item.address} addressIcon={<BedDouble className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />} description={item.description} linkUrl={item.link_url} cost={item.cost} thumbnail={item.thumbnail_url} kind="lodging" />
                                        ))}
                                    </div>
                                )}

                                {group.activities.length > 0 && (
                                    <div className="flex flex-col gap-3">
                                        <CategoryHeading icon={<MapPin className="h-3.5 w-3.5" />} label="Activities" className="text-violet-600" />
                                        {group.activities.map((item, ai) => (
                                            <StopArticle key={`a-${gi}-${ai}`} id={`shared-stop-${gi}-activity-${ai}`} title={item.title || ""} address={item.address} addressIcon={<MapPin className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />} description={item.description} linkUrl={item.link_url} cost={item.cost} thumbnail={item.thumbnail_url} kind="activity" />
                                        ))}
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                </div>

                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
                    <CalendarRange className="h-3 w-3" />
                    Plans are a live snapshot of saved places.
                </p>

                <div className="mt-6 flex justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                    >
                        Want to plan your own trips? Start planning
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </div>
        </main>
    );
}
