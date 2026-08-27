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
        <Suspense fallback={<div className="app-page" />}>
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
    3: "bg-coral",
};
const strengthTextColor: Record<number, string> = {
    1: "text-destructive",
    2: "text-primary",
    3: "text-coral",
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

    const inputBase = "app-field h-12 px-4";

    const collapseStyle = (open: boolean): React.CSSProperties => ({
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        opacity: open ? 1 : 0,
        transition: "grid-template-rows 280ms ease, opacity 280ms ease",
    });

    return (
        <div className="app-page relative h-screen overflow-y-auto overflow-x-hidden px-6 flex flex-col items-center py-12 md:grid md:grid-rows-2 md:py-0 md:items-stretch">

            {/* TOP HALF */}
            <div className="flex flex-col items-center w-full md:justify-end md:pb-8">
                <div className="mb-6 md:mb-10 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md shadow-primary/20">
                        <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <BrandNameButton className="text-2xl text-foreground" />
                </div>

                <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl text-center">
                    {isSignup ? (
                        <>
                            Your next{" "}
                            <span className="relative inline-block text-primary">
                                adventure
                                <span className="absolute -bottom-1 left-0 right-0 h-px bg-primary/40" />
                            </span>
                            .
                        </>
                    ) : (
                        "Welcome back."
                    )}
                </h1>

                <p className="mt-4 text-sm text-muted-foreground/70">
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
                            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                        </div>
                    </div>

                    {/* Reset success */}
                    <div style={{ ...collapseStyle(resetSent), marginBottom: resetSent ? "0.75rem" : "0", transition: "grid-template-rows 200ms ease, opacity 200ms ease, margin-bottom 200ms ease" }}>
                        <div style={{ overflow: "hidden" }}>
                            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">Reset link sent — check your email.</p>
                        </div>
                    </div>

                    <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary/90 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60">
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isLoading ? "Please wait…" : isSignup ? "Get started" : "Sign in"}
                    </button>

                    {/* Forgot password — only visible in signin mode */}
                    <div style={collapseStyle(!isSignup)} className="text-center">
                        <div style={{ overflow: "hidden", paddingTop: "10px" }}>
                            <button type="button" disabled={isSendingReset || isLoading} onClick={handleForgotPassword} className="text-xs text-muted-foreground/70 hover:text-primary transition-colors disabled:opacity-50">
                                {isSendingReset ? "Sending…" : "Forgot password?"}
                            </button>
                        </div>
                    </div>
                </form>

                <p className="mt-6 text-sm text-muted-foreground/70">
                    {isSignup ? (
                        <>
                            Already have an account?{" "}
                            <button type="button" onClick={() => { setMode("signin"); setError(""); setResetSent(false); }} className="text-primary hover:underline underline-offset-4">
                                Sign in
                            </button>
                        </>
                    ) : (
                        <>
                            New here?{" "}
                            <button type="button" onClick={() => { setMode("signup"); setError(""); setResetSent(false); }} className="text-primary hover:underline underline-offset-4">
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
