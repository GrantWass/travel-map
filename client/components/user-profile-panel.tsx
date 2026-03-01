"use client";

import { useRouter } from "next/navigation";
import { MapPin, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UserProfilePanelProps {
    expanded: boolean;
    onToggle: () => void;
}

// Placeholder data — swap with real auth context when wired up
const USER = {
    name: "Joey Shea",
    initials: "JS",
    role: "Traveler",
    places: 12,
    reviews: 3,
};

const SAVED_PLACES = [
    "Yosemite Valley",
    "Grand Canyon South Rim",
    "Glacier National Park",
    "Olympic National Park",
    "Zion National Park",
];

export default function UserProfilePanel({ expanded, onToggle }: UserProfilePanelProps) {
    const router = useRouter();

    return (
        <div className="relative flex h-full flex-col bg-card border-r border-border">
            {/* Collapsed view */}
            {!expanded && (
                <div className="flex h-full flex-col items-center gap-5 pt-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                        {USER.initials}
                    </div>
                    <button
                        onClick={onToggle}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary hover:bg-border transition-colors"
                        aria-label="Expand panel"
                    >
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                </div>
            )}

            {/* Expanded view */}
            {expanded && (
                <div className="flex h-full flex-col">
                    {/* Header */}
                    <div className="flex items-center gap-3 p-5 pb-4">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                            {USER.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{USER.name}</p>
                            <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                                {USER.role}
                            </span>
                        </div>
                        <button
                            onClick={onToggle}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary hover:bg-border transition-colors"
                            aria-label="Collapse panel"
                        >
                            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="mx-5 h-px bg-border" />

                    {/* Stats */}
                    <div className="flex gap-6 px-5 py-4">
                        <div>
                            <p className="text-xl font-bold text-foreground">{USER.places}</p>
                            <p className="text-xs text-muted-foreground">places</p>
                        </div>
                        <div>
                            <p className="text-xl font-bold text-foreground">{USER.reviews}</p>
                            <p className="text-xs text-muted-foreground">reviews</p>
                        </div>
                    </div>

                    <div className="mx-5 h-px bg-border" />

                    {/* Saved places */}
                    <ScrollArea className="flex-1 min-h-0">
                        <div className="p-5">
                            <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                Saved Places
                            </h3>
                            <div className="flex flex-col gap-0.5">
                                {SAVED_PLACES.map((place) => (
                                    <button
                                        key={place}
                                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground/80 hover:bg-secondary transition-colors text-left w-full"
                                    >
                                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                                        {place}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer */}
                    <div className="border-t border-border p-5">
                        <button
                            onClick={() => router.push("/signup")}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
