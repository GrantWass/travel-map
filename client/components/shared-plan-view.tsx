"use client";

import Image from "next/image";
import Link from "next/link";
import { BedDouble, CalendarRange, ExternalLink, MapPin, Notebook } from "lucide-react";

import type { SharedPlan, SharedPlanGroup } from "@/lib/api-client";
import { DEFAULT_FALLBACK_IMAGE } from "@/lib/trip-constants";

function WebsiteChip({ url }: { url: string }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50"
        >
            <ExternalLink className="h-3 w-3" />
            Website
        </a>
    );
}

function formatCost(cost: number | string | null | undefined): string | null {
    if (cost == null || cost === "") return null;
    const value = typeof cost === "number" ? cost : Number(cost);
    if (Number.isNaN(value)) return String(cost);
    if (value <= 0) return "Free";
    return value % 1 === 0 ? `$${value}/person` : `$${value.toFixed(2)}/person`;
}

export default function SharedPlanView({ plan }: { plan: SharedPlan }) {
    return (
        <main className="min-h-screen bg-[linear-gradient(180deg,#f7efe2_0%,#f4f4ef_55%,#eef3f6_100%)] px-4 py-10 md:px-8">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
                <header className="flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
                        <Notebook className="h-4 w-4" />
                        Made with Travela
                    </Link>
                </header>

                <div className="rounded-3xl border border-stone-200/80 bg-white/90 p-6 shadow-xl shadow-stone-200/30 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Shared travel plans</p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
                        {plan.scope ? plan.scope : "Travel plans"}
                    </h1>
                    <p className="mt-1 text-sm text-stone-500">
                        {plan.owner_name ? `Put together by ${plan.owner_name}` : "Put together by a fellow traveler"}
                    </p>

                    <div className="mt-6 flex flex-col gap-6">
                        {plan.groups.length === 0 && (
                            <p className="text-sm text-stone-500">This plan is empty.</p>
                        )}

                        {plan.groups.map((group) => (
                            <section key={group.name} className="flex flex-col gap-3">
                                <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500">{group.name}</h2>

                                {group.activities.map((item, index) => (
                                    <article key={`a-${index}`} className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3">
                                        <Image
                                            src={item.thumbnail_url || DEFAULT_FALLBACK_IMAGE}
                                            alt=""
                                            width={48}
                                            height={48}
                                            className="h-12 w-12 rounded-md border border-stone-200 object-cover"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-stone-800">{item.title || "Untitled activity"}</p>
                                            {item.address && (
                                                <p className="mt-0.5 flex items-start gap-1 text-xs text-stone-500">
                                                    <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                                    <span>{item.address}</span>
                                                </p>
                                            )}
                                            {item.description && <p className="mt-1 text-xs leading-relaxed text-stone-600">{item.description}</p>}
                                            {item.link_url && (
                                                <span className="mt-1"><WebsiteChip url={item.link_url} /></span>
                                            )}
                                        </div>
                                        <CostLabel cost={item.cost} />
                                    </article>
                                ))}

                                {group.lodgings.map((item, index) => (
                                    <article key={`l-${index}`} className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3">
                                        <Image
                                            src={item.thumbnail_url || DEFAULT_FALLBACK_IMAGE}
                                            alt=""
                                            width={48}
                                            height={48}
                                            className="h-12 w-12 rounded-md border border-stone-200 object-cover"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-stone-800">{item.title || "Untitled lodging"}</p>
                                            {item.address && (
                                                <p className="mt-0.5 flex items-start gap-1 text-xs text-stone-500">
                                                    <BedDouble className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                                    <span>{item.address}</span>
                                                </p>
                                            )}
                                            {item.description && <p className="mt-1 text-xs leading-relaxed text-stone-600">{item.description}</p>}
                                            {item.link_url && (
                                                <span className="mt-1"><WebsiteChip url={item.link_url} /></span>
                                            )}
                                        </div>
                                        <CostLabel cost={item.cost} />
                                    </article>
                                ))}
                            
                            </section>
                        ))}
                    </div>
                </div>

                <p className="flex items-center justify-center gap-1.5 text-xs text-stone-400">
                    <CalendarRange className="h-3 w-3" />
                    Plans are a live snapshot of saved places.
                </p>
            </div>
        </main>
    );
}

function CostLabel({ cost }: { cost: number | string | null }) {
    const label = formatCost(cost);
    if (!label) return null;
    return (
        <span className="flex-shrink-0 rounded-full bg-stone-900/5 px-2 py-0.5 text-xs font-medium text-stone-600">
            {label}
        </span>
    );
}
