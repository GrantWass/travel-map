"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BedDouble, CalendarDays, CalendarRange, Clock3, MapPin, Notebook, Plane, X } from "lucide-react";

import type { FlightLeg, PlanItinerary, PlanItineraryItem, SharedPlan } from "@/lib/api-client";
import WebsiteChip from "@/components/website-chip";
import CostBadge from "@/components/cost-badge";
import { formatAddress, formatFlightPrice } from "@/lib/utils";
import { parseFlightLink } from "@/lib/flight-link";
import { useDialogAccessibility } from "@/hooks/use-dialog-accessibility";

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

function FlightDirection({ label, date, legs, fallback }: { label: string; date?: string | null; legs?: FlightLeg[] | null; fallback?: string | null }) {
    const safeLegs = legs ?? [];
    const summary = safeLegs.length > 0
        ? safeLegs.map((leg) => [leg.flight_number, `${leg.origin_code}→${leg.destination_code}`].filter(Boolean).join(" ")).join(" · ")
        : fallback;
    if (!date && !summary) return null;
    return (
        <div className="rounded-lg bg-sky-50/80 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">{label}{date ? ` · ${date}` : ""}</p>
            {summary && <p className="mt-0.5 text-xs text-foreground">{summary}</p>}
        </div>
    );
}

function parseCalendarDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatCalendarDate(value: string, includeYear = true) {
    return parseCalendarDate(value).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        ...(includeYear ? { year: "numeric" as const } : {}),
    });
}

function formatClockTime(value?: string | null) {
    if (!value) return null;
    const [hour, minute] = value.split(":").map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
    return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function itineraryTimeLabel(item: PlanItineraryItem) {
    if (item.schedule_type === "night") return "Overnight";
    const start = formatClockTime(item.start_time);
    const end = formatClockTime(item.end_time);
    if (item.end_day_date && item.day_date && item.end_day_date !== item.day_date) {
        const endDay = parseCalendarDate(item.end_day_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return [start, end ? `${endDay}, ${end}` : endDay].filter(Boolean).join(" – ");
    }
    return start && end ? `${start} – ${end}` : start || end || "Time not set";
}

function SharedItineraryItem({ item }: { item: PlanItineraryItem }) {
    const isFlight = item.source_type === "flight";
    const isStay = item.schedule_type === "night";
    const accentClass = isFlight
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : isStay
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-violet-200 bg-violet-50 text-violet-700";
    const Icon = isFlight ? Plane : isStay ? BedDouble : MapPin;

    return (
        <li className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
            <div className="pt-3 text-right text-[11px] font-medium leading-tight text-muted-foreground">
                {itineraryTimeLabel(item)}
            </div>
            <div className="relative border-l border-border/80 pb-3 pl-4 last:pb-0">
                <span className={`absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full border-2 bg-card ${isFlight ? "border-sky-500" : isStay ? "border-emerald-500" : "border-violet-500"}`} />
                <div className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 ${accentClass}`}>
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/75">
                        <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug text-foreground">{item.title || "Untitled itinerary item"}</p>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            {isFlight ? "Flight" : isStay ? "Stay" : item.source_type ? "Activity" : "Plan"}
                        </p>
                    </div>
                </div>
            </div>
        </li>
    );
}

function SharedItinerary({ collectionName, itinerary }: { collectionName: string; itinerary: PlanItinerary }) {
    const [open, setOpen] = useState(false);
    const closePanel = useCallback(() => setOpen(false), []);
    const dialogRef = useDialogAccessibility(open, closePanel);
    const scheduled = itinerary.items.filter((item) => item.day_date);
    const unscheduled = itinerary.items.filter((item) => !item.day_date);
    const days = [...new Set(scheduled.map((item) => item.day_date as string))].sort();
    const range = itinerary.start_date && itinerary.end_date
        ? itinerary.start_date === itinerary.end_date
            ? formatCalendarDate(itinerary.start_date)
            : `${formatCalendarDate(itinerary.start_date, false)} – ${formatCalendarDate(itinerary.end_date)}`
        : null;

    if (itinerary.items.length === 0 && !range) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-md"
                aria-label={`Open itinerary for ${collectionName}`}
            >
                <CalendarDays className="h-3.5 w-3.5" />
                Itinerary{scheduled.length ? ` · ${scheduled.length}` : ""}
            </button>

            {open && typeof document !== "undefined" && createPortal(
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-[1890] cursor-default bg-black/25 backdrop-blur-[1px] md:bg-black/10"
                        onClick={closePanel}
                        aria-label="Close itinerary"
                    />
                    <aside
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${collectionName} itinerary`}
                        className="fixed inset-2 z-[1900] flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:bottom-5 md:left-auto md:right-5 md:top-5 md:w-[min(680px,calc(100vw-2.5rem))]"
                    >
                        <div ref={dialogRef} className="contents">
                            <header className="flex flex-shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <CalendarDays className="h-4.5 w-4.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-sm font-semibold text-foreground">{collectionName}</h3>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {range || `${scheduled.length} scheduled ${scheduled.length === 1 ? "item" : "items"}`}
                                    </p>
                                </div>
                                <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Read only</span>
                                <button type="button" onClick={closePanel} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close itinerary panel">
                                    <X className="h-4 w-4" />
                                </button>
                            </header>

                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background/40 p-3 sm:p-4">
                                <div className="mx-auto overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                                    <div className="divide-y divide-border/70">
                                        {days.map((day) => {
                                            const dayItems = scheduled
                                                .filter((item) => item.day_date === day)
                                                .sort((left, right) => (left.start_time || "99:99").localeCompare(right.start_time || "99:99") || left.position - right.position);
                                            return (
                                                <section key={day} className="px-3 py-4 sm:px-4">
                                                    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
                                                        <CalendarRange className="h-3.5 w-3.5 text-primary" />
                                                        {formatCalendarDate(day)}
                                                    </h4>
                                                    <ol>{dayItems.map((item) => <SharedItineraryItem key={item.plan_itinerary_item_id} item={item} />)}</ol>
                                                </section>
                                            );
                                        })}

                                        {unscheduled.length > 0 && (
                                            <section className="px-3 py-4 sm:px-4">
                                                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                                    <Clock3 className="h-3.5 w-3.5" />
                                                    Not scheduled yet
                                                </h4>
                                                <ol>{unscheduled.map((item) => <SharedItineraryItem key={item.plan_itinerary_item_id} item={item} />)}</ol>
                                            </section>
                                        )}

                                        {itinerary.items.length === 0 && (
                                            <p className="px-4 py-5 text-sm text-muted-foreground">No stops have been scheduled yet.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </>,
                document.body,
            )}
        </>
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
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.name}</h2>
                                    {group.itinerary && <SharedItinerary collectionName={group.name} itinerary={group.itinerary} />}
                                </div>

                                {(group.flights ?? []).length > 0 && (
                                    <div className="flex flex-col gap-3">
                                        <CategoryHeading icon={<Plane className="h-3.5 w-3.5" />} label="Flights" className="text-sky-600" />
                                        {(group.flights ?? []).map((flight, index) => {
                                            const parsedLink = flight.link_url ? parseFlightLink(flight.link_url) : {};
                                            const route = flight.origin_code && flight.destination_code
                                                ? `${flight.origin_code} → ${flight.destination_code}`
                                                : flight.airline || "Flight";
                                            const details = [
                                                flight.airline && route !== flight.airline ? flight.airline : null,
                                                flight.departure_time,
                                            ].filter(Boolean);
                                            const outboundLegs = flight.outbound_legs?.length ? flight.outbound_legs : parsedLink.outbound_legs;
                                            const returnLegs = flight.return_legs?.length ? flight.return_legs : parsedLink.return_legs;
                                            const displayNotes = flight.notes && flight.notes !== parsedLink.notes ? flight.notes : null;
                                            return (
                                                <article key={`f-${index}`} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 p-3 transition-all duration-200 hover:-translate-y-px hover:shadow-md">
                                                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600"><Plane className="h-5 w-5" /></div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-foreground">{route}</p>
                                                        {details.length > 0 && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{details.join(" · ")}</p>}
                                                        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                                                            <FlightDirection label="Departure" date={flight.outbound_date || flight.departure_date || parsedLink.departure_date} legs={outboundLegs} fallback={flight.flight_number} />
                                                            <FlightDirection label="Return" date={flight.return_date || parsedLink.return_date} legs={returnLegs} fallback={parsedLink.return_flight_numbers} />
                                                        </div>
                                                        {displayNotes && <p className="mt-2 whitespace-pre-line border-l-2 border-border/70 pl-2 text-[10px] italic leading-relaxed text-muted-foreground/80">{displayNotes}</p>}
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
                    Plans and itinerary are a live snapshot.
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
