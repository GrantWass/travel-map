"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { X, Mail, GraduationCap, Trash2, Plus, Settings, Upload, Loader2, Pencil, Timer } from "lucide-react";
import { ApiError, updateProfileSettings, uploadImage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { User } from "@/lib/api-types";
import { formatTripDate, formatTripDuration, initialsFromName } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { DEFAULT_FALLBACK_IMAGE, DEFAULT_PROFILE_BIO } from "@/lib/trip-constants";

// ─── Component ────────────────────────────────────────────────────────────────

interface UserProfileModalProps {
    profile: User;
    onClose: () => void;
    onSelectTrip?: (tripId: number) => void;
    onAddTrip?: () => void;
    onEditTrip?: (tripId: number) => void;
    canManageTrips?: boolean;
    canEditProfile?: boolean;
    deletingTripId?: number | null;
    onDeleteTrip?: (tripId: number) => void;
    expandFrom?: "top-right" | "left";
}

export default function UserProfileModal({
    profile,
    onClose,
    onSelectTrip,
    onAddTrip,
    onEditTrip,
    canManageTrips = false,
    canEditProfile = false,
    deletingTripId = null,
    onDeleteTrip,
    expandFrom = "top-right",
}: UserProfileModalProps) {
    const signOut = useAuthStore((state) => state.signOut);
    const refreshMyProfile = useAuthStore((state) => state.refreshMyProfile);
    const refreshSession = useAuthStore((state) => state.refreshSession);
    const animClass = expandFrom === "left" ? "modal-expand-left" : "modal-expand";

    const [displayState, setDisplayState] = useState(() => ({
        name: profile.name || "Traveler",
        university: profile.college || "—",
        bio: profile.bio || DEFAULT_PROFILE_BIO,
        imageUrl: profile.profile_image_url,
    }));
    const [formState, setFormState] = useState(() => ({
        nameInput: profile.name || "",
        bioInput: profile.bio || "",
        collegeInput: "",
        profileImageFile: null as File | null,
        profileImagePreviewUrl: null as string | null,
    }));
    const [saveState, setSaveState] = useState({
        isSaving: false,
        error: "",
        success: "",
    });
    const [collegeLookupState, setCollegeLookupState] = useState({
        results: [] as string[],
        isOpen: false,
        isLoading: false,
        error: "",
    });
    const [profileImageFailed, setProfileImageFailed] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    useEffect(() => {
        setDisplayState({
            name: profile.name || "Traveler",
            university: profile.college || "—",
            bio: profile.bio || DEFAULT_PROFILE_BIO,
            imageUrl: profile.profile_image_url,
        });
        setFormState((current) => {
            if (current.profileImagePreviewUrl) {
                URL.revokeObjectURL(current.profileImagePreviewUrl);
            }

            return {
                nameInput: profile.name || "",
                bioInput: profile.bio || "",
                collegeInput: "",
                profileImageFile: null,
                profileImagePreviewUrl: null,
            };
        });
        setCollegeLookupState({
            results: [],
            isOpen: false,
            isLoading: false,
            error: "",
        });
        setProfileImageFailed(false);
        setSaveState({ isSaving: false, error: "", success: "" });
        setSettingsOpen(false);
    }, [profile.bio, profile.profile_image_url, profile.name, profile.college]);

    useEffect(() => {
        return () => {
            if (formState.profileImagePreviewUrl) {
                URL.revokeObjectURL(formState.profileImagePreviewUrl);
            }
        };
    }, [formState.profileImagePreviewUrl]);

    const normalizedUniversity = displayState.university.trim();
    const hasSchool = normalizedUniversity !== "" && normalizedUniversity !== "—";
    const profileImageUrl = (displayState.imageUrl || DEFAULT_FALLBACK_IMAGE).trim();
    const showProfileImage = Boolean(profileImageUrl) && !profileImageFailed;
    const displayInitials = useMemo(
        () => initialsFromName(displayState.name.trim() || profile.name || profile.initials),
        [displayState.name, profile.initials, profile.name],
    );

    useEffect(() => {
        if (!settingsOpen || hasSchool || formState.collegeInput.trim().length < 2) {
            setCollegeLookupState((current) => ({
                ...current,
                results: [],
                error: "",
                isLoading: false,
            }));
            return;
        }

        const fetchColleges = async () => {
            try {
                setCollegeLookupState((current) => ({
                    ...current,
                    isLoading: true,
                    error: "",
                }));
                const response = await fetch(`/api/universities?name=${encodeURIComponent(formState.collegeInput)}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error || "Could not fetch universities");
                }

                setCollegeLookupState((current) => ({
                    ...current,
                    results: Array.isArray(data.universities) ? data.universities : [],
                }));
            } catch (error) {
                console.error("Error fetching universities:", error);
                setCollegeLookupState((current) => ({
                    ...current,
                    results: [],
                    error: "Could not fetch universities right now.",
                }));
            } finally {
                setCollegeLookupState((current) => ({
                    ...current,
                    isLoading: false,
                }));
            }
        };

        const timeoutId = setTimeout(fetchColleges, 300);
        return () => clearTimeout(timeoutId);
    }, [formState.collegeInput, hasSchool, settingsOpen]);

    function handleProfileImageChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0] ?? null;
        setSaveState((current) => ({ ...current, success: "", error: "" }));
        setFormState((current) => {
            if (current.profileImagePreviewUrl) {
                URL.revokeObjectURL(current.profileImagePreviewUrl);
            }

            return {
                ...current,
                profileImageFile: file,
                profileImagePreviewUrl: file ? URL.createObjectURL(file) : null,
            };
        });
        setProfileImageFailed(false);
    }

    async function handleSaveSettings() {
        setSaveState({ isSaving: true, error: "", success: "" });

        try {
            const trimmedName = formState.nameInput.trim();
            if (!trimmedName) {
                setSaveState({ isSaving: false, error: "Username is required.", success: "" });
                return;
            }

            const payload: {
                name?: string;
                bio?: string;
                college?: string;
                profile_image_url?: string;
            } = {};

            if (trimmedName !== displayState.name.trim()) {
                payload.name = trimmedName;
            }

            const trimmedBio = formState.bioInput.trim();
            if (trimmedBio !== (displayState.bio || "").trim()) {
                payload.bio = trimmedBio;
            }

            if (!hasSchool) {
                const trimmedCollege = formState.collegeInput.trim();
                if (trimmedCollege) {
                    payload.college = trimmedCollege;
                }
            }

            if (formState.profileImageFile) {
                const uploadedUrl = await uploadImage(formState.profileImageFile, "profiles");
                payload.profile_image_url = uploadedUrl;
            }

            if (!payload.name && payload.bio === undefined && !payload.college && !payload.profile_image_url) {
                setSaveState({ isSaving: false, error: "", success: "No changes to save." });
                return;
            }

            const response = await updateProfileSettings(payload);
            const updatedUser = response.user;

            const nextName = updatedUser.name || displayState.name;
            const nextUniversity = updatedUser.college || displayState.university;
            const nextBio = (updatedUser.bio ?? "").trim();
            const nextImageUrl = updatedUser.profile_image_url || displayState.imageUrl;

            setDisplayState({
                name: nextName,
                university: nextUniversity,
                bio: nextBio,
                imageUrl: nextImageUrl,
            });

            setFormState((current) => {
                if (current.profileImagePreviewUrl) {
                    URL.revokeObjectURL(current.profileImagePreviewUrl);
                }

                return {
                    nameInput: nextName,
                    bioInput: nextBio,
                    collegeInput: "",
                    profileImageFile: null,
                    profileImagePreviewUrl: null,
                };
            });

            setCollegeLookupState((current) => ({
                ...current,
                results: [],
                isOpen: false,
            }));
            setProfileImageFailed(false);

            await refreshSession();
            await refreshMyProfile(profile.user_id);
            setSaveState((current) => ({ ...current, success: "Profile updated.", error: "" }));
        } catch (error) {
            if (error instanceof ApiError) {
                setSaveState((current) => ({ ...current, error: error.message, success: "" }));
            } else {
                setSaveState((current) => ({ ...current, error: "Could not update profile right now.", success: "" }));
            }
        } finally {
            setSaveState((current) => ({ ...current, isSaving: false }));
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
                                setSaveState((current) => ({ ...current, error: "", success: "" }));
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

                {/* Sticky profile header */}
                <div className="flex-shrink-0 border-b border-border px-5 sm:px-10 pt-5 sm:pt-10 pb-6">
                    <div className="flex items-start gap-4 sm:gap-6">
                        <div className="relative flex h-14 w-14 sm:h-20 sm:w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl sm:text-2xl font-bold text-primary-foreground">
                            {showProfileImage ? (
                                <Image
                                    src={profileImageUrl}
                                    alt={`${displayState.name} profile photo`}
                                    fill
                                    sizes="80px"
                                    className="object-cover"
                                    onError={() => setProfileImageFailed(true)}
                                />
                            ) : (
                                displayInitials
                            )}
                        </div>
                        <div className="flex flex-col gap-1 pt-1">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                {displayState.name}
                            </h1>
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                {profile.email}
                            </p>
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <GraduationCap className="h-3.5 w-3.5 flex-shrink-0" />
                                {displayState.university}
                            </p>
                        </div>
                    </div>
                    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/75">
                        {(displayState.bio || "").trim() || DEFAULT_PROFILE_BIO}
                    </p>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-5 sm:px-10 py-6">
                    {canEditProfile && settingsOpen ? (
                        <div className="mb-6 rounded-xl border border-border bg-background/80 p-4 sm:p-5">
                            <h2 className="text-sm font-semibold text-foreground">Profile Settings</h2>
                            <div className="mt-4 grid gap-4">
                                <label className="grid gap-2">
                                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Username
                                    </span>
                                    <input
                                        value={formState.nameInput}
                                        onChange={(event) => setFormState((current) => ({ ...current, nameInput: event.target.value }))}
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                                        placeholder="Your name"
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Bio
                                    </span>
                                    <textarea
                                        value={formState.bioInput}
                                        onChange={(event) => setFormState((current) => ({ ...current, bioInput: event.target.value }))}
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
                                        {formState.profileImageFile ? (
                                            <span className="truncate text-xs text-muted-foreground">
                                                {formState.profileImageFile.name}
                                            </span>
                                        ) : null}
                                    </div>
                                    {formState.profileImagePreviewUrl ? (
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={formState.profileImagePreviewUrl}
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
                                                value={formState.collegeInput}
                                                onChange={(event) => {
                                                    setFormState((current) => ({ ...current, collegeInput: event.target.value }));
                                                    setCollegeLookupState((current) => ({ ...current, isOpen: true }));
                                                }}
                                                onFocus={() => setCollegeLookupState((current) => ({ ...current, isOpen: true }))}
                                                onBlur={() => {
                                                    window.setTimeout(() => {
                                                        setCollegeLookupState((current) => ({ ...current, isOpen: false }));
                                                    }, 120);
                                                }}
                                                placeholder="Search your school"
                                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                                            />
                                            {collegeLookupState.isOpen && (
                                                <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                                                    {collegeLookupState.isLoading ? (
                                                        <p className="px-3 py-2 text-sm text-muted-foreground">
                                                            Searching schools...
                                                        </p>
                                                    ) : collegeLookupState.error ? (
                                                        <p className="px-3 py-2 text-sm text-red-600">
                                                            {collegeLookupState.error}
                                                        </p>
                                                    ) : collegeLookupState.results.length > 0 ? (
                                                        collegeLookupState.results.map((school) => (
                                                            <button
                                                                key={school}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormState((current) => ({ ...current, collegeInput: school }));
                                                                    setCollegeLookupState((current) => ({ ...current, isOpen: false }));
                                                                }}
                                                                className="w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/70"
                                                            >
                                                                {school}
                                                            </button>
                                                        ))
                                                    ) : formState.collegeInput.trim().length >= 2 ? (
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
                                        School is already set to <span className="font-medium text-foreground">{displayState.university}</span>.
                                    </p>
                                )}

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void handleSaveSettings()}
                                        disabled={saveState.isSaving}
                                    >
                                        {saveState.isSaving ? (
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
                                {saveState.error ? (
                                    <p className="text-xs font-medium text-red-600">{saveState.error}</p>
                                ) : null}
                                {saveState.success ? (
                                    <p className="text-xs font-medium text-emerald-700">{saveState.success}</p>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    {/* Trips */}
                    {(canManageTrips || (profile.trips || []).length > 0) && (
                        <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            Trips
                        </h2>
                    )}
                    {canManageTrips || (profile.trips || []).length > 0 ? (
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
                            {profile.trips?.map((trip) => (
                                <div
                                    key={trip.trip_id}
                                    className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background hover:border-primary/30 transition-colors"
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSelectTrip?.(trip.trip_id);
                                            onClose();
                                        }}
                                        className="text-left"
                                    >
                                        <div className="relative aspect-video overflow-hidden">
                                            <Image
                                                src={trip.thumbnail_url || DEFAULT_FALLBACK_IMAGE}
                                                alt={trip.title}
                                                fill
                                                sizes="(max-width: 640px) 100vw, 260px"
                                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                        </div>
                                        <div className="px-3 py-2.5">
                                            <p className="text-sm font-semibold text-foreground truncate">
                                                {trip.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {formatTripDate(trip.date || "")}
                                            </p>
                                            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                <Timer className="h-3 w-3" />
                                                {formatTripDuration(trip.duration)}
                                            </p>
                                        </div>
                                    </button>
                                    {canManageTrips ? (
                                        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onClose();
                                                    onEditTrip?.(trip.trip_id);
                                                }}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
                                                aria-label={`Edit ${trip.title}`}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onDeleteTrip?.(trip.trip_id);
                                                }}
                                                disabled={deletingTripId === trip.trip_id}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-70"
                                                aria-label={`Delete ${trip.title}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No trips posted yet.</p>
                    )}
                </div>
            </div>
        </>
    );
}
