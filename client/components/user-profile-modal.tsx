"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Mail, GraduationCap, Trash2, Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ────────────────────────────────────────────────────────────────────
// Swap MOCK_PROFILE in travel-map.tsx with real data from your DB/auth context.

export interface TripEntry {
    id: number;
    title: string;
    thumbnail: string;
    date: string;
}

export interface UserProfile {
    userId: number;
    name: string;
    initials: string;
    email: string;
    university: string;
    bio: string;
    image_url: string | null;
    trips: TripEntry[];
}

// ─── Component ────────────────────────────────────────────────────────────────

interface UserProfileModalProps {
    profile: UserProfile;
    onClose: () => void;
    onSelectTrip?: (tripId: number) => void;
    onAddTrip?: () => void;
    canManageTrips?: boolean;
    deletingTripId?: number | null;
    onDeleteTrip?: (tripId: number) => void;
    expandFrom?: "top-right" | "left";
}

function formatTripDate(value: string): string {
    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(trimmed);
    if (!match) {
        return value;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || month < 1 || month > 12) {
        return value;
    }

    const date = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

export default function UserProfileModal({
    profile,
    onClose,
    onSelectTrip,
    onAddTrip,
    canManageTrips = false,
    deletingTripId = null,
    onDeleteTrip,
    expandFrom = "top-right",
}: UserProfileModalProps) {
    const { signOut } = useAuth();
    const animClass = expandFrom === "left" ? "modal-expand-left" : "modal-expand";
    const [profileImageFailed, setProfileImageFailed] = useState(false);
    const profileImageUrl = profile.image_url?.trim() || "";
    
    const showProfileImage = Boolean(profileImageUrl) && !profileImageFailed;

    return (
        <>
            {/* Backdrop */}
            <div className="backdrop-fade fixed inset-0 z-[1500] bg-foreground/10 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className={`${animClass} fixed inset-3 sm:inset-6 z-[1600] flex max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden`}>
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-secondary hover:bg-border transition-colors"
                    aria-label="Close profile"
                >
                    <X className="h-4 w-4 text-muted-foreground" />
                </button>

                <ScrollArea className="h-full flex-1">
                    <div className="p-5 sm:p-10">
                        {/* User header */}
                        <div className="flex items-start gap-4 sm:gap-6 mb-6">
                            <div className="relative flex h-14 w-14 sm:h-20 sm:w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl sm:text-2xl font-bold text-primary-foreground">
                                {showProfileImage ? (
                                    <img
                                        src={profileImageUrl}
                                        alt={`${profile.name} profile photo`}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                        onError={() => setProfileImageFailed(true)}
                                    />
                                ) : (
                                    profile.initials
                                )}
                            </div>
                            <div className="flex flex-col gap-1 pt-1">
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                    {profile.name}
                                </h1>
                                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                    {profile.email}
                                </p>
                                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <GraduationCap className="h-3.5 w-3.5 flex-shrink-0" />
                                    {profile.university}
                                </p>
                                <div className="pt-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
                                        Logout
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Bio */}
                        <p className="max-w-2xl text-sm leading-relaxed text-foreground/75 mb-8">{profile.bio}</p>

                        <div className="h-px bg-border mb-8" />

                        {/* Trips */}
                        {(canManageTrips || profile.trips.length > 0) && (
                            <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                Trips
                            </h2>
                        )}
                        {canManageTrips || profile.trips.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                                {canManageTrips && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onAddTrip?.();
                                        }}
                                        className="group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                                    >
                                        <Plus className="h-6 w-6" />
                                        <span className="text-sm font-medium">Add Trip</span>
                                    </button>
                                )}
                                {profile.trips.map((trip) => (
                                    <div
                                        key={trip.id}
                                        className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background hover:border-primary/30 transition-colors"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSelectTrip?.(trip.id);
                                                onClose();
                                            }}
                                            className="text-left"
                                        >
                                            <div className="relative aspect-video overflow-hidden">
                                                <Image
                                                    src={trip.thumbnail}
                                                    alt={trip.title}
                                                    fill
                                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                            </div>
                                            <div className="px-3 py-2.5">
                                                <p className="text-sm font-semibold text-foreground truncate">
                                                    {trip.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{trip.date}</p>
                                            </div>
                                        </button>
                                        {canManageTrips ? (
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onDeleteTrip?.(trip.id);
                                                }}
                                                disabled={deletingTripId === trip.id}
                                                className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-70"
                                                aria-label={`Delete ${trip.title}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No trips posted yet.</p>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </>
    );
}
