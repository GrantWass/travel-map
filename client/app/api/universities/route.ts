import { NextResponse } from "next/server";

interface HipolabsUniversity {
    name?: unknown;
}

const ENDPOINTS = [
    "https://universities.hipolabs.com/search",
    "http://universities.hipolabs.com/search",
];

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim() ?? "";

    if (name.length < 2) {
        return NextResponse.json({ universities: [] });
    }

    const query = new URLSearchParams({
        name,
        country: "United States",
    });

    for (const endpoint of ENDPOINTS) {
        try {
            const response = await fetch(`${endpoint}?${query.toString()}`, {
                cache: "no-store",
            });

            if (!response.ok) {
                continue;
            }

            const data = (await response.json()) as HipolabsUniversity[];
            const universities = data
                .map((school) => (typeof school.name === "string" ? school.name : null))
                .filter((nameValue): nameValue is string => Boolean(nameValue));

            const uniqueUniversities = Array.from(new Set(universities)).slice(0, 10);
            return NextResponse.json({ universities: uniqueUniversities });
        } catch {
            // Try next endpoint.
        }
    }

    return NextResponse.json(
        { error: "University lookup service is unavailable right now." },
        { status: 502 },
    );
}
