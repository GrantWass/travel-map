"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { X, Mail, GraduationCap, Trash2, Plus, Settings, Upload, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, updateProfileSettings, uploadImage } from "@/lib/api-client";
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
    canEditProfile?: boolean;
    deletingTripId?: number | null;
    onDeleteTrip?: (tripId: number) => void;
    expandFrom?: "top-right" | "left";
}

function initialsFromName(value: string): string {
    const initials = value
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("")
        .slice(0, 2);
    return initials || "TR";
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

const DEFAULT_PROFILE_BIO = "Traveler sharing experiences from the road.";

export default function UserProfileModal({
    profile,
    onClose,
    onSelectTrip,
    onAddTrip,
    canManageTrips = false,
    canEditProfile = false,
    deletingTripId = null,
    onDeleteTrip,
    expandFrom = "top-right",
}: UserProfileModalProps) {
    const { signOut, refreshMyProfile, refreshSession } = useAuth();
    const animClass = expandFrom === "left" ? "modal-expand-left" : "modal-expand";

    const [currentName, setCurrentName] = useState(profile.name);
    const [currentUniversity, setCurrentUniversity] = useState(profile.university);
    const [currentBio, setCurrentBio] = useState(profile.bio);
    const [currentImageUrl, setCurrentImageUrl] = useState(profile.image_url);
    const [profileImageFailed, setProfileImageFailed] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [nameInput, setNameInput] = useState(profile.name);
    const [bioInput, setBioInput] = useState(profile.bio);
    const [collegeInput, setCollegeInput] = useState("");
    const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
    const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<string | null>(null);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsError, setSettingsError] = useState("");
    const [settingsSuccess, setSettingsSuccess] = useState("");
    const [collegeResults, setCollegeResults] = useState<string[]>([]);
    const [isCollegeMenuOpen, setIsCollegeMenuOpen] = useState(false);
    const [isSearchingColleges, setIsSearchingColleges] = useState(false);
    const [collegeSearchError, setCollegeSearchError] = useState("");

    useEffect(() => {
        setCurrentName(profile.name);
        setCurrentUniversity(profile.university);
        setCurrentBio(profile.bio);
        setCurrentImageUrl(profile.image_url);
        setNameInput(profile.name);
        setBioInput(profile.bio);
        setCollegeInput("");
        setCollegeResults([]);
        setIsCollegeMenuOpen(false);
        setProfileImageFile(null);
        setProfileImagePreviewUrl(null);
        setProfileImageFailed(false);
        setSettingsError("");
        setSettingsSuccess("");
        setSettingsOpen(false);
    }, [profile.bio, profile.image_url, profile.name, profile.university]);

    useEffect(() => {
        return () => {
            if (profileImagePreviewUrl) {
                URL.revokeObjectURL(profileImagePreviewUrl);
            }
        };
    }, [profileImagePreviewUrl]);

    const normalizedUniversity = currentUniversity.trim();
    const hasSchool = normalizedUniversity !== "" && normalizedUniversity !== "—";
    const profileImageUrl = (currentImageUrl || "").trim();
    const showProfileImage = Boolean(profileImageUrl) && !profileImageFailed;
    const displayInitials = useMemo(
        () => initialsFromName(currentName.trim() || profile.name || profile.initials),
        [currentName, profile.initials, profile.name],
    );

    useEffect(() => {
        if (!settingsOpen || hasSchool || collegeInput.trim().length < 2) {
            setCollegeResults([]);
            setCollegeSearchError("");
            setIsSearchingColleges(false);
            return;
        }

        const fetchColleges = async () => {
            try {
                setIsSearchingColleges(true);
                setCollegeSearchError("");
                const response = await fetch(`/api/universities?name=${encodeURIComponent(collegeInput)}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error || "Could not fetch universities");
                }

                setCollegeResults(Array.isArray(data.universities) ? data.universities : []);
            } catch (error) {
                console.error("Error fetching universities:", error);
                setCollegeResults([]);
                setCollegeSearchError("Could not fetch universities right now.");
            } finally {
                setIsSearchingColleges(false);
            }
        };

        const timeoutId = setTimeout(fetchColleges, 300);
        return () => clearTimeout(timeoutId);
    }, [collegeInput, hasSchool, settingsOpen]);

    function handleProfileImageChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0] ?? null;
        setProfileImageFile(file);
        setSettingsSuccess("");
        setSettingsError("");

        if (profileImagePreviewUrl) {
            URL.revokeObjectURL(profileImagePreviewUrl);
        }
        setProfileImagePreviewUrl(file ? URL.createObjectURL(file) : null);
        setProfileImageFailed(false);
    }

    async function handleSaveSettings() {
        setSettingsError("");
        setSettingsSuccess("");
        setIsSavingSettings(true);

        try {
            const trimmedName = nameInput.trim();
            if (!trimmedName) {
                setSettingsError("Username is required.");
                return;
            }

            const payload: {
                name?: string;
                bio?: string;
                college?: string;
                profile_image_url?: string;
            } = {};

            if (trimmedName !== currentName.trim()) {
                payload.name = trimmedName;
            }

            const trimmedBio = bioInput.trim();
            if (trimmedBio !== currentBio.trim()) {
                payload.bio = trimmedBio;
            }

            if (!hasSchool) {
                const trimmedCollege = collegeInput.trim();
                if (trimmedCollege) {
                    payload.college = trimmedCollege;
                }
            }

            if (profileImageFile) {
                const uploadedUrl = await uploadImage(profileImageFile, "profiles");
                payload.profile_image_url = uploadedUrl;
            }

            if (!payload.name && payload.bio === undefined && !payload.college && !payload.profile_image_url) {
                setSettingsSuccess("No changes to save.");
                return;
            }

            const response = await updateProfileSettings(payload);
            const updatedUser = response.user;

            if (updatedUser.name) {
                setCurrentName(updatedUser.name);
                setNameInput(updatedUser.name);
            }

            if (updatedUser.college) {
                setCurrentUniversity(updatedUser.college);
                setCollegeInput("");
                setCollegeResults([]);
                setIsCollegeMenuOpen(false);
            }

            const nextBio = (updatedUser.bio ?? "").trim();
            setCurrentBio(nextBio);
            setBioInput(nextBio);

            if (updatedUser.profile_image_url) {
                setCurrentImageUrl(updatedUser.profile_image_url);
                setProfileImageFailed(false);
            }

            if (profileImagePreviewUrl) {
                URL.revokeObjectURL(profileImagePreviewUrl);
            }
            setProfileImagePreviewUrl(null);
            setProfileImageFile(null);

            await refreshSession();
            await refreshMyProfile(profile.userId);
            setSettingsSuccess("Profile updated.");
        } catch (error) {
            if (error instanceof ApiError) {
                setSettingsError(error.message);
            } else {
                setSettingsError("Could not update profile right now.");
            }
        } finally {
            setIsSavingSettings(false);
        }
    }

    return (
        <>
            {/* Backdrop */}
            <div className="backdrop-fade fixed inset-0 z-[1500] bg-foreground/10 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className={`${animClass} fixed inset-3 sm:inset-6 z-[1600] flex max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden`}>
                <div className="absolute right-5 top-5 z-10 flex items-center gap-2">
                    {canEditProfile ? (
                        <button
                            onClick={() => {
                                setSettingsOpen((current) => !current);
                                setSettingsError("");
                                setSettingsSuccess("");
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary hover:bg-border transition-colors"
                            aria-label="Open profile settings"
                        >
                            <Settings className="h-4 w-4 text-muted-foreground" />
                        </button>
                    ) : null}
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary hover:bg-border transition-colors"
                        aria-label="Close profile"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                <ScrollArea className="h-full flex-1">
                    <div className="p-5 sm:p-10">
                        {canEditProfile && settingsOpen ? (
                            <div className="mb-8 rounded-xl border border-border bg-background/80 p-4 sm:p-5">
                                <h2 className="text-sm font-semibold text-foreground">Profile Settings</h2>
                                <div className="mt-4 grid gap-4">
                                    <label className="grid gap-2">
                                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Username
                                        </span>
                                        <input
                                            value={nameInput}
                                            onChange={(event) => setNameInput(event.target.value)}
                                            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                                            placeholder="Your name"
                                        />
                                    </label>

                                    <label className="grid gap-2">
                                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Bio
                                        </span>
                                        <textarea
                                            value={bioInput}
                                            onChange={(event) => setBioInput(event.target.value)}
                                            rows={4}
                                            placeholder="Tell people what kind of trips and experiences you enjoy."
                                            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                                        />
                                    </label>

                                    <div className="grid gap-2">
                                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Profile Picture
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/50">
                                                <Upload className="h-4 w-4" />
                                                Change photo
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="sr-only"
                                                    onChange={handleProfileImageChange}
                                                />
                                            </label>
                                            {profileImageFile ? (
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {profileImageFile.name}
                                                </span>
                                            ) : null}
                                        </div>
                                        {profileImagePreviewUrl ? (
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={profileImagePreviewUrl}
                                                    alt="New profile preview"
                                                    className="h-12 w-12 rounded-full border border-border object-cover"
                                                />
                                                <span className="text-xs text-muted-foreground">
                                                    New photo selected. Save to apply.
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>

                                    {!hasSchool ? (
                                        <div className="grid gap-2">
                                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Add School
                                            </span>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={collegeInput}
                                                    onChange={(event) => {
                                                        setCollegeInput(event.target.value);
                                                        setIsCollegeMenuOpen(true);
                                                    }}
                                                    onFocus={() => setIsCollegeMenuOpen(true)}
                                                    onBlur={() => {
                                                        window.setTimeout(() => setIsCollegeMenuOpen(false), 120);
                                                    }}
                                                    placeholder="Search your school"
                                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                                                />
                                                {isCollegeMenuOpen && (
                                                    <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                                                        {isSearchingColleges ? (
                                                            <p className="px-3 py-2 text-sm text-muted-foreground">
                                                                Searching schools...
                                                            </p>
                                                        ) : collegeSearchError ? (
                                                            <p className="px-3 py-2 text-sm text-red-600">
                                                                {collegeSearchError}
                                                            </p>
                                                        ) : collegeResults.length > 0 ? (
                                                            collegeResults.map((school) => (
                                                                <button
                                                                    key={school}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCollegeInput(school);
                                                                        setIsCollegeMenuOpen(false);
                                                                    }}
                                                                    className="w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/70"
                                                                >
                                                                    {school}
                                                                </button>
                                                            ))
                                                        ) : collegeInput.trim().length >= 2 ? (
                                                            <p className="px-3 py-2 text-sm text-muted-foreground">
                                                                No schools found.
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            School is already set to <span className="font-medium text-foreground">{currentUniversity}</span>.
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => void handleSaveSettings()}
                                            disabled={isSavingSettings}
                                        >
                                            {isSavingSettings ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                "Save Changes"
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => void signOut()}
                                        >
                                            Logout
                                        </Button>
                                    </div>
                                    {settingsError ? (
                                        <p className="text-xs font-medium text-red-600">{settingsError}</p>
                                    ) : null}
                                    {settingsSuccess ? (
                                        <p className="text-xs font-medium text-emerald-700">{settingsSuccess}</p>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}

                        {/* User header */}
                        <div className="flex items-start gap-4 sm:gap-6 mb-6">
                            <div className="relative flex h-14 w-14 sm:h-20 sm:w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl sm:text-2xl font-bold text-primary-foreground">
                                {showProfileImage ? (
                                    <img
                                        src={profileImageUrl}
                                        alt={`${currentName} profile photo`}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                        onError={() => setProfileImageFailed(true)}
                                    />
                                ) : (
                                    displayInitials
                                )}
                            </div>
                            <div className="flex flex-col gap-1 pt-1">
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                    {currentName}
                                </h1>
                                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                    {profile.email}
                                </p>
                                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <GraduationCap className="h-3.5 w-3.5 flex-shrink-0" />
                                    {currentUniversity}
                                </p>
                            </div>
                        </div>

                        {/* Bio */}
                        <p className="max-w-2xl text-sm leading-relaxed text-foreground/75 mb-8">
                            {currentBio.trim() || DEFAULT_PROFILE_BIO}
                        </p>

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
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {formatTripDate(trip.date)}
                                                </p>
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
