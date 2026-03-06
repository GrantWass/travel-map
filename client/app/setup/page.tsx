"use client";

import { ChangeEvent, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, GraduationCap, UserRound, Globe, ArrowRight, ArrowLeft } from "lucide-react";

import { buildSignupHref } from "@/lib/auth-navigation";
import { createProfileSetup, uploadImage } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

type AccountType = "student" | "traveler";
type WizardStep = { type: "photo" } | { type: "bio" } | { type: "college" };

const TRANSITION_MS = 260;

export default function SetupPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#fdf8f0]" />}>
            <SetupContent />
        </Suspense>
    );
}

function SetupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const status = useAuthStore((state) => state.status);
    const user = useAuthStore((state) => state.user);
    const refreshSession = useAuthStore((state) => state.refreshSession);

    const accountTypeParam = searchParams.get("accountType");
    const nextPath = sanitizeNextPath(searchParams.get("next"));
    const accountType: AccountType = accountTypeParam === "student" ? "student" : "traveler";

    // Profile data
    const [bio, setBio] = useState("");
    const [college, setCollege] = useState("");
    const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
    const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<string | null>(null);

    // College autocomplete
    const [isCollegeMenuOpen, setIsCollegeMenuOpen] = useState(false);
    const [filteredUniversities, setFilteredUniversities] = useState<string[]>([]);
    const [collegeSearchError, setCollegeSearchError] = useState("");
    const [isSearchingColleges, setIsSearchingColleges] = useState(false);

    // Wizard state
    const [stepIndex, setStepIndex] = useState(0);
    const [stepPhase, setStepPhase] = useState<"in" | "out">("in");
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Save state
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    const steps = useMemo<WizardStep[]>(
        () =>
            accountType === "student"
                ? [{ type: "photo" }, { type: "bio" }, { type: "college" }]
                : [{ type: "photo" }, { type: "bio" }],
        [accountType],
    );

    const activeStep = steps[stepIndex];
    const isLastStep = stepIndex === steps.length - 1;

    // Populate auth state from the server token set during signup.
    useEffect(() => {
        void refreshSession();
    }, [refreshSession]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace(buildSignupHref({ nextPath }));
        }
    }, [nextPath, router, status]);

    useEffect(() => {
        if (college.trim().length < 2) {
            setFilteredUniversities([]);
            setCollegeSearchError("");
            setIsSearchingColleges(false);
            return;
        }

        const fetchColleges = async () => {
            try {
                setIsSearchingColleges(true);
                setCollegeSearchError("");
                const response = await fetch(`/api/universities?name=${encodeURIComponent(college)}`);
                const data = await response.json();
                if (!response.ok) throw new Error(data?.error || "Could not fetch universities");
                setFilteredUniversities(Array.isArray(data.universities) ? data.universities : []);
            } catch {
                setFilteredUniversities([]);
                setCollegeSearchError("Could not fetch universities right now.");
            } finally {
                setIsSearchingColleges(false);
            }
        };

        const id = setTimeout(fetchColleges, 300);
        return () => clearTimeout(id);
    }, [college]);

    useEffect(() => {
        return () => {
            if (profileImagePreviewUrl) URL.revokeObjectURL(profileImagePreviewUrl);
        };
    }, [profileImagePreviewUrl]);

    function handleProfileImageChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0] ?? null;
        setProfileImageFile(file);
        if (profileImagePreviewUrl) URL.revokeObjectURL(profileImagePreviewUrl);
        setProfileImagePreviewUrl(file ? URL.createObjectURL(file) : null);
    }

    function transitionToStep(nextIndex: number) {
        if (isTransitioning || nextIndex < 0 || nextIndex >= steps.length || nextIndex === stepIndex) return;
        setIsTransitioning(true);
        setStepPhase("out");
        window.setTimeout(() => {
            setStepIndex(nextIndex);
            setStepPhase("in");
            setIsTransitioning(false);
        }, TRANSITION_MS);
    }

    async function handleFinish() {
        if (!user) return;
        setSaveError("");
        setIsSaving(true);
        try {
            const profileImageUrl = profileImageFile ? await uploadImage(profileImageFile, "profiles") : null;
            await createProfileSetup({
                account_type: accountType,
                bio: bio.trim() || undefined,
                college: college.trim() || undefined,
                profile_image_url: profileImageUrl ?? undefined,
            });
            await refreshSession();
            router.push(nextPath);
        } catch {
            setSaveError("Could not save your setup. Please try again.");
        } finally {
            setIsSaving(false);
        }
    }

    if (status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#fdf8f0]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
        );
    }

    const headingText =
        accountType === "student" ? "Set up your student profile" : "Set up your traveler profile";

    return (
        <div className="min-h-screen bg-[#fdf8f0] px-6 py-12 text-stone-800">
            <div className="mx-auto flex w-full max-w-xl flex-col rounded-2xl border border-stone-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm md:p-8">
                {/* Header */}
                <div className="mb-7">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                        {accountType === "student" ? (
                            <>
                                <GraduationCap className="h-3.5 w-3.5" />
                                Student account
                            </>
                        ) : (
                            <>
                                <Globe className="h-3.5 w-3.5" />
                                Traveler account
                            </>
                        )}
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900 md:text-3xl">
                        {headingText}
                    </h1>
                    <p className="mt-2 text-sm text-stone-500">
                        Add a few details so your profile is ready before you jump in.
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-200 ${
                                    i === stepIndex ? "w-8 bg-amber-500" : "w-3 bg-stone-200"
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Step content */}
                <div
                    className={`transition-all ease-out ${stepPhase === "in" ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
                    style={{ transitionDuration: `${TRANSITION_MS}ms` }}
                >
                    {activeStep.type === "photo" && (
                        <div className="flex flex-col gap-5">
                            <div>
                                <p className="text-lg font-medium text-stone-900">Add a profile picture</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    A friendly photo helps people recognize your posts.
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-stone-100">
                                    {profileImagePreviewUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={profileImagePreviewUrl}
                                            alt="Profile preview"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <UserRound className="h-9 w-9 text-stone-400" />
                                    )}
                                </div>
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50">
                                    <Camera className="h-4 w-4 text-amber-600" />
                                    Upload photo
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleProfileImageChange}
                                        className="sr-only"
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {activeStep.type === "bio" && (
                        <div className="flex flex-col gap-5">
                            <div>
                                <p className="text-lg font-medium text-stone-900">Write a short bio</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    {accountType === "student"
                                        ? "Tell people what you study and where you like to explore."
                                        : "Tell people what kind of trips and experiences you enjoy."}
                                </p>
                            </div>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                rows={5}
                                placeholder={
                                    accountType === "student"
                                        ? "Example: Journalism major who spends weekends finding underrated food spots."
                                        : "Example: I travel for hiking, architecture, and great local coffee."
                                }
                                className="w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-300"
                            />
                        </div>
                    )}

                    {activeStep.type === "college" && (
                        <div className="flex flex-col gap-5">
                            <div>
                                <p className="text-lg font-medium text-stone-900">Where do you attend college?</p>
                                <p className="mt-1 text-sm text-stone-500">
                                    This helps us tailor student-focused suggestions.
                                </p>
                            </div>
                            <input
                                type="text"
                                value={college}
                                onChange={(e) => {
                                    setCollege(e.target.value);
                                    setIsCollegeMenuOpen(true);
                                }}
                                onFocus={() => setIsCollegeMenuOpen(true)}
                                onBlur={() => window.setTimeout(() => setIsCollegeMenuOpen(false), 120)}
                                placeholder="e.g. University of California, Berkeley"
                                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-300"
                            />
                            {isCollegeMenuOpen && (
                                <div className="max-h-56 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
                                    {isSearchingColleges ? (
                                        <p className="px-3 py-2 text-sm text-stone-500">Searching universities...</p>
                                    ) : collegeSearchError ? (
                                        <p className="px-3 py-2 text-sm text-red-500">{collegeSearchError}</p>
                                    ) : filteredUniversities.length > 0 ? (
                                        filteredUniversities.map((school) => (
                                            <button
                                                key={school}
                                                type="button"
                                                onClick={() => {
                                                    setCollege(school);
                                                    setIsCollegeMenuOpen(false);
                                                }}
                                                className="w-full rounded-lg px-3 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-stone-100"
                                            >
                                                {school}
                                            </button>
                                        ))
                                    ) : (
                                        <p className="px-3 py-2 text-sm text-stone-500">No matching universities</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation — all fields optional; Skip available on non-last steps */}
                <div className="mt-8 flex items-center gap-3">
                    {!isLastStep && (
                        <button
                            type="button"
                            onClick={() => transitionToStep(stepIndex + 1)}
                            disabled={isSaving || isTransitioning}
                            className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-700 disabled:opacity-60"
                        >
                            Skip for now
                        </button>
                    )}

                    {stepIndex > 0 && (
                        <button
                            type="button"
                            onClick={() => transitionToStep(stepIndex - 1)}
                            disabled={isSaving || isTransitioning}
                            className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-60"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={isLastStep ? () => void handleFinish() : () => transitionToStep(stepIndex + 1)}
                        disabled={isSaving || isTransitioning}
                        className="ml-auto inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                        {isLastStep ? (isSaving ? "Setting up..." : "Go to map") : "Next"}
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>

                {saveError && <p className="mt-3 text-sm text-red-500">{saveError}</p>}
            </div>
        </div>
    );
}

function sanitizeNextPath(rawPath: string | null): string {
    if (!rawPath) {
        return "/";
    }

    if (!rawPath.startsWith("/") || rawPath.startsWith("//")) {
        return "/";
    }

    return rawPath;
}
