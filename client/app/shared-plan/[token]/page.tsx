import type { Metadata } from "next";

import SharedPlanView from "@/components/shared-plan-view";
import type { SharedPlan } from "@/lib/api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";

async function fetchSharedPlan(token: string): Promise<SharedPlan | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/plans/shared/${encodeURIComponent(token)}`, {
            cache: "no-store",
        });
        if (!response.ok) return null;
        return (await response.json()) as SharedPlan;
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
    const { token } = await params;
    const plan = await fetchSharedPlan(token);
    const title = plan ? `${plan.scope ?? "Travel plans"} — shared plans` : "Shared travel plans";
    return { title };
}

export default async function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const plan = await fetchSharedPlan(token);

    if (!plan) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f4f4ef] px-6">
                <div className="max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-lg">
                    <h1 className="text-xl font-semibold text-stone-900">This link doesn&apos;t work</h1>
                    <p className="mt-2 text-sm text-stone-500">
                        The share link may have been removed or mistyped. Ask your friend for a fresh link.
                    </p>
                </div>
            </main>
        );
    }

    return <SharedPlanView plan={plan} />;
}
