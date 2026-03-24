"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Loader2 } from "lucide-react";
import BrandNameButton from "@/components/brand-name-button";
import { getStoredInviteToken, persistInviteToken } from "@/lib/auth-navigation";
import { API_BASE_URL, setAuthToken, claimSmsInvite } from "@/lib/api-client";
import type { User } from "@/lib/api-types";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";

type Mode = "signup" | "signin";

export default function SignUpPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#fdf8f0]" />}>
            <SignUpContent />
        </Suspense>
    );
}

// --- Password strength ---

interface PasswordStrength {
    score: 1 | 2 | 3;
    label: "Weak" | "Fair" | "Strong";
}

function getPasswordStrength(password: string): PasswordStrength | null {
    if (!password) return null;
    const hasLength = password.length >= 8;
    const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
    const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    const score = (hasLength ? 1 : 0) + (hasMixedCase ? 1 : 0) + (hasNumberOrSymbol ? 1 : 0);
    if (score <= 1) return { score: 1, label: "Weak" };
    if (score === 2) return { score: 2, label: "Fair" };
    return { score: 3, label: "Strong" };
}

const strengthBarColor: Record<number, string> = {
    1: "bg-red-400",
    2: "bg-amber-400",
    3: "bg-green-500",
};
const strengthTextColor: Record<number, string> = {
    1: "text-red-500",
    2: "text-amber-600",
    3: "text-green-600",
};

function SignUpContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const setAuthenticatedUser = useAuthStore((state) => state.setAuthenticatedUser);
    const refreshMyProfile = useAuthStore((state) => state.refreshMyProfile);
    const setStatus = useAuthStore((state) => state.setStatus);
    const [mode, setMode] = useState<Mode>("signup");
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [isSendingReset, setIsSendingReset] = useState(false);

    const isSignup = mode === "signup";
    const inviteTokenFromQuery = searchParams.get("invite");
    const nextPath = sanitizeNextPath(searchParams.get("next"));
    const inviteToken = (inviteTokenFromQuery || getStoredInviteToken())?.trim() || null;

    const passwordStrength = isSignup ? getPasswordStrength(form.password) : null;

    useEffect(() => {
        if (inviteTokenFromQuery) {
            persistInviteToken(inviteTokenFromQuery);
        }
    }, [inviteTokenFromQuery]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    }

    async function handleForgotPassword() {
        setError("");
        setResetSent(false);
        if (!form.email.trim()) {
            setError("Enter your email address above, then click Forgot password.");
            return;
        }
        setIsSendingReset(true);
        try {
            await supabase.auth.resetPasswordForEmail(form.email.trim(), {
                redirectTo: `${window.location.origin}/`,
            });
            setResetSent(true);
        } catch {
            setError("Could not send reset email. Please try again.");
        } finally {
            setIsSendingReset(false);
        }
    }

    async function loginWithCredentials(email: string, password: string): Promise<User | null> {
        // Try Supabase auth first
        const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({ email, password });
        if (!sbError && sbData.session) {
            const meResp = await fetch(`${API_BASE_URL}/me`, {
                headers: { "Authorization": `Bearer ${sbData.session.access_token}` },
                credentials: "include",
            });
            const meData = await meResp.json();
            if (meResp.ok && meData.user && typeof meData.user.user_id === "number") {
                return meData.user as User;
            }
        }

        // Fall back to legacy login (for users not yet migrated to Supabase)
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            setError(data.error || "Invalid email or password");
            return null;
        }
        if (typeof data?.auth_token === "string" && data.auth_token.trim()) {
            setAuthToken(data.auth_token);
        }
        if (!data?.user || typeof data.user.user_id !== "number") {
            setError("Login succeeded but user session data is missing.");
            return null;
        }
        return data.user as User;
    }

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const token = inviteToken;

            if (isSignup) {
                // 1. Create Supabase auth user
                const { data: sbSignUp, error: sbSignUpError } = await supabase.auth.signUp({
                    email: form.email,
                    password: form.password,
                });
                if (sbSignUpError || !sbSignUp.session) {
                    setError(sbSignUpError?.message || "Could not create account");
                    return;
                }

                // 2. Create travelers profile row in our backend
                const response = await fetch(`${API_BASE_URL}/create-user`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${sbSignUp.session.access_token}`,
                    },
                    credentials: "include",
                    body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
                });
                const data = await response.json();
                if (!response.ok) {
                    // Clean up the Supabase auth user since our DB insert failed
                    await supabase.auth.signOut();
                    setError(data.error || "Could not create account");
                    return;
                }

                // Do NOT hydrate the Zustand store yet — /setup will call refreshSession.
                const loggedInUser = await loginWithCredentials(form.email, form.password);
                if (!loggedInUser) return;
                if (token) {
                    try {
                        await claimSmsInvite(token);
                        persistInviteToken(null);
                    } catch {
                        // Ignore claim failures — user created successfully regardless.
                    }
                }
                // Set to "loading" so AuthBootstrap doesn't redirect while /setup
                // initializes its own refreshSession call.
                setStatus("loading");
                // Always pass accountType=student so all users get verified access.
                const setupParams = new URLSearchParams({ accountType: "student", next: nextPath });
                router.push(`/setup?${setupParams.toString()}`);
                return;
            } else {
                const loggedInUser = await loginWithCredentials(form.email, form.password);
                if (!loggedInUser) return;
                if (token) {
                    try {
                        await claimSmsInvite(token);
                        persistInviteToken(null);
                    } catch {
                        // ignore
                    }
                }
                setAuthenticatedUser(loggedInUser);
                await refreshMyProfile(loggedInUser.user_id);
            }

            router.push(nextPath);
            router.refresh();
        } catch {
            setError("Could not reach server. Make sure the server is running.");
        } finally {
            setIsLoading(false);
        }
    }

    const inputBase =
        "w-full rounded-lg border border-stone-200 bg-white/60 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 outline-none transition-colors focus:border-amber-400 focus:ring-1 focus:ring-amber-300 disabled:opacity-50";

    const collapseStyle = (open: boolean): React.CSSProperties => ({
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        opacity: open ? 1 : 0,
        transition: "grid-template-rows 280ms ease, opacity 280ms ease",
    });

    return (
        <div className="relative h-screen overflow-y-auto overflow-x-hidden bg-[#fdf8f0] px-6 flex flex-col items-center py-12 md:grid md:grid-rows-2 md:py-0 md:items-stretch">
            {/* Decorative travel paths */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <svg className="absolute -left-8 top-8 opacity-[0.30]" width="280" height="200" fill="none">
                    <path d="M10 180 Q80 80 200 120 Q240 135 270 100" stroke="#b87a30" strokeWidth="1.5" strokeDasharray="7 10" strokeLinecap="round" />
                    <circle cx="200" cy="120" r="3.5" fill="#b87a30" />
                    <circle cx="270" cy="100" r="3.5" fill="#b87a30" />
                </svg>
                <svg className="absolute -right-8 bottom-8 opacity-[0.30]" width="280" height="200" fill="none">
                    <path d="M270 20 Q190 80 140 60 Q80 40 20 100" stroke="#b87a30" strokeWidth="1.5" strokeDasharray="7 10" strokeLinecap="round" />
                    <circle cx="140" cy="60" r="3.5" fill="#b87a30" />
                    <circle cx="20" cy="100" r="3.5" fill="#b87a30" />
                </svg>
                <svg className="absolute right-16 top-12 opacity-[0.20]" width="120" height="80" fill="none">
                    <path d="M10 70 Q50 20 110 40" stroke="#b87a30" strokeWidth="1" strokeDasharray="5 8" strokeLinecap="round" />
                </svg>
                <svg className="absolute bottom-12 left-16 opacity-[0.20]" width="120" height="80" fill="none">
                    <path d="M110 10 Q70 60 10 40" stroke="#b87a30" strokeWidth="1" strokeDasharray="5 8" strokeLinecap="round" />
                </svg>
            </div>

            {/* TOP HALF */}
            <div className="flex flex-col items-center w-full md:justify-end md:pb-8">
                <div className="mb-6 md:mb-10 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 shadow-sm">
                        <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <BrandNameButton className="text-2xl text-stone-800" />
                </div>

                <h1 className="text-5xl font-bold tracking-tight text-stone-900 sm:text-6xl md:text-7xl text-center">
                    {isSignup ? (
                        <>
                            Your next{" "}
                            <span className="relative inline-block text-amber-600">
                                adventure
                                <span className="absolute -bottom-1 left-0 right-0 h-px bg-amber-300/70" />
                            </span>
                            .
                        </>
                    ) : (
                        "Welcome back."
                    )}
                </h1>

                <p className="mt-4 text-sm text-stone-400">
                    {mode === "signin"
                        ? "Enter your email and password to continue."
                        : "Explore trips, stays, and activities."}
                </p>
            </div>

            {/* BOTTOM HALF */}
            <div className="flex flex-col items-center w-full mt-6 pb-8 md:mt-0 md:pb-0 md:justify-start md:pt-8">
                <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col">
                    {/* Name field */}
                    <div style={{ ...collapseStyle(isSignup), marginBottom: isSignup ? "1rem" : "0", transition: "grid-template-rows 280ms ease, opacity 280ms ease, margin-bottom 280ms ease" }}>
                        <div style={{ overflow: "hidden" }}>
                            <input name="name" type="text" autoComplete="name" required={isSignup} disabled={!isSignup || isLoading} tabIndex={isSignup ? 0 : -1} value={form.name} onChange={handleChange} placeholder="Full name" className={inputBase} />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="mb-4">
                        <input name="email" type="email" autoComplete="email" required disabled={isLoading} value={form.email} onChange={handleChange} placeholder="Email" className={inputBase} />
                    </div>

                    {/* Password + strength indicator */}
                    <div className="mb-4 flex flex-col gap-1.5">
                        <input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} required disabled={isLoading} value={form.password} onChange={handleChange} placeholder="Password" className={inputBase} />
                        <div style={collapseStyle(isSignup && !!passwordStrength)}>
                            <div style={{ overflow: "hidden", paddingTop: "2px" }}>
                                {passwordStrength && (
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="flex flex-1 gap-1">
                                            {([1, 2, 3] as const).map((level) => (
                                                <div key={level} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${passwordStrength.score >= level ? strengthBarColor[passwordStrength.score] : "bg-stone-200"}`} />
                                            ))}
                                        </div>
                                        <span className={`text-xs font-medium ${strengthTextColor[passwordStrength.score]}`}>{passwordStrength.label}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Error — prominent banner */}
                    <div style={{ ...collapseStyle(!!error), marginBottom: error ? "0.75rem" : "0", transition: "grid-template-rows 200ms ease, opacity 200ms ease, margin-bottom 200ms ease" }}>
                        <div style={{ overflow: "hidden" }}>
                            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                        </div>
                    </div>

                    {/* Reset success */}
                    <div style={{ ...collapseStyle(resetSent), marginBottom: resetSent ? "0.75rem" : "0", transition: "grid-template-rows 200ms ease, opacity 200ms ease, margin-bottom 200ms ease" }}>
                        <div style={{ overflow: "hidden" }}>
                            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">Reset link sent — check your email.</p>
                        </div>
                    </div>

                    <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60">
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isLoading ? "Please wait…" : isSignup ? "Get started" : "Sign in"}
                    </button>

                    {/* Forgot password — only visible in signin mode */}
                    <div style={collapseStyle(!isSignup)} className="text-center">
                        <div style={{ overflow: "hidden", paddingTop: "10px" }}>
                            <button type="button" disabled={isSendingReset || isLoading} onClick={handleForgotPassword} className="text-xs text-stone-400 hover:text-amber-600 transition-colors disabled:opacity-50">
                                {isSendingReset ? "Sending…" : "Forgot password?"}
                            </button>
                        </div>
                    </div>
                </form>

                <p className="mt-6 text-sm text-stone-400">
                    {isSignup ? (
                        <>
                            Already have an account?{" "}
                            <button type="button" onClick={() => { setMode("signin"); setError(""); setResetSent(false); }} className="text-amber-600 hover:underline underline-offset-4">
                                Sign in
                            </button>
                        </>
                    ) : (
                        <>
                            New here?{" "}
                            <button type="button" onClick={() => { setMode("signup"); setError(""); setResetSent(false); }} className="text-amber-600 hover:underline underline-offset-4">
                                Create an account
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}

function sanitizeNextPath(rawPath: string | null): string {
    if (!rawPath) return "/";
    if (!rawPath.startsWith("/") || rawPath.startsWith("//")) return "/";
    return rawPath;
}
