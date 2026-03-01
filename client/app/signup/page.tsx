"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, GraduationCap, Globe } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { API_BASE_URL } from "@/lib/api-client";

type AccountType = "traveler" | "student";
type Mode = "signup" | "signin";
type AnimPhase = "idle" | "out" | "in";

export default function SignUpPage() {
    const router = useRouter();
    const { refreshSession, refreshMyProfile } = useAuth();
    const [mode, setMode] = useState<Mode>("signup");
    const [accountType, setAccountType] = useState<AccountType>("traveler");
    const [displayedType, setDisplayedType] = useState<AccountType>("traveler");
    const [animPhase, setAnimPhase] = useState<AnimPhase>("idle");
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const isSignup = mode === "signup";
    const isStudent = isSignup && accountType === "student";

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    }

    async function loginWithCredentials(email: string, password: string): Promise<boolean> {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            setError(data.error || "Invalid email or password");
            return false;
        }
        return true;
    }

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            if (isSignup) {
                const response = await fetch(`${API_BASE_URL}/create-user`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
                });
                const data = await response.json();
                if (!response.ok) {
                    setError(data.error || "Could not create account");
                    return;
                }
                const didLogin = await loginWithCredentials(form.email, form.password);
                if (!didLogin) return;
                const authedUser = await refreshSession();
                if (authedUser?.user_id) {
                    await refreshMyProfile(authedUser.user_id);
                }
                router.push(`/profile-setup?accountType=${accountType}`);
                router.refresh();
                return;
            } else {
                const didLogin = await loginWithCredentials(form.email, form.password);
                if (!didLogin) return;
                const authedUser = await refreshSession();
                if (authedUser?.user_id) {
                    await refreshMyProfile(authedUser.user_id);
                }
            }

            router.push("/");
            router.refresh();
        } catch {
            setError("Could not reach server. Make sure the server is running.");
        } finally {
            setIsLoading(false);
        }
    }

    function selectAccountType(type: AccountType) {
        if (type === displayedType || animPhase !== "idle") return;
        setAccountType(type);
        setAnimPhase("out");
        setTimeout(() => {
            setDisplayedType(type);
            setAnimPhase("in");
        }, 180);
        setTimeout(() => setAnimPhase("idle"), 360);
    }

    function toggleWord() {
        selectAccountType(displayedType === "traveler" ? "student" : "traveler");
    }

    const wordClass = animPhase === "out" ? "flip-word-out" : animPhase === "in" ? "flip-word-in" : "";

    const inputBase =
        "w-full rounded-lg border border-stone-200 bg-white/60 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 outline-none transition-colors focus:border-amber-400 focus:ring-1 focus:ring-amber-300 disabled:opacity-50";

    // Smoothly collapses an element's layout height to zero without leaving
    // phantom space behind. The inner child must have overflow: hidden.
    const collapseStyle = (open: boolean): React.CSSProperties => ({
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        opacity: open ? 1 : 0,
        transition: "grid-template-rows 280ms ease, opacity 280ms ease",
    });

    return (
        /*
         * Mobile: single flex column, fully scrollable (overflow-x-hidden only
         * clips the decorative SVGs). md+: two-row CSS grid where the heading
         * is anchored to the midpoint and the form grows downward only.
         */
        <div className="relative h-screen overflow-y-auto overflow-x-hidden bg-[#fdf8f0] px-6 flex flex-col items-center py-12 md:grid md:grid-rows-2 md:py-0 md:items-stretch">
            {/* Decorative travel paths */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <svg className="absolute -left-8 top-8 opacity-[0.30]" width="280" height="200" fill="none">
                    <path
                        d="M10 180 Q80 80 200 120 Q240 135 270 100"
                        stroke="#b87a30"
                        strokeWidth="1.5"
                        strokeDasharray="7 10"
                        strokeLinecap="round"
                    />
                    <circle cx="200" cy="120" r="3.5" fill="#b87a30" />
                    <circle cx="270" cy="100" r="3.5" fill="#b87a30" />
                </svg>
                <svg className="absolute -right-8 bottom-8 opacity-[0.30]" width="280" height="200" fill="none">
                    <path
                        d="M270 20 Q190 80 140 60 Q80 40 20 100"
                        stroke="#b87a30"
                        strokeWidth="1.5"
                        strokeDasharray="7 10"
                        strokeLinecap="round"
                    />
                    <circle cx="140" cy="60" r="3.5" fill="#b87a30" />
                    <circle cx="20" cy="100" r="3.5" fill="#b87a30" />
                </svg>
                <svg className="absolute right-16 top-12 opacity-[0.20]" width="120" height="80" fill="none">
                    <path
                        d="M10 70 Q50 20 110 40"
                        stroke="#b87a30"
                        strokeWidth="1"
                        strokeDasharray="5 8"
                        strokeLinecap="round"
                    />
                </svg>
                <svg className="absolute bottom-12 left-16 opacity-[0.20]" width="120" height="80" fill="none">
                    <path
                        d="M110 10 Q70 60 10 40"
                        stroke="#b87a30"
                        strokeWidth="1"
                        strokeDasharray="5 8"
                        strokeLinecap="round"
                    />
                </svg>
            </div>

            {/* ── TOP HALF: logo · heading · toggle · subtitle ─────────────────
                On md+: justify-end pins content to the bottom of its grid row
                so the heading sits exactly at the page midpoint. On mobile:
                natural stack order, no special alignment needed. */}
            <div className="flex flex-col items-center w-full md:justify-end md:pb-8">
                {/* Logo */}
                <div className="mb-6 md:mb-10 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 shadow-sm">
                        <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-semibold tracking-tight text-stone-800">Travel Map</span>
                </div>

                {/* Hero heading — signup h1 is the layout anchor; signin h1
                    crossfades in as an absolute overlay so width/height stay fixed. */}
                <div className="relative w-full text-center">
                    <h1
                        className={`text-5xl font-bold tracking-tight text-stone-900 sm:text-6xl md:text-7xl transition-opacity duration-300 ease-in-out ${
                            isSignup ? "opacity-100" : "opacity-0 pointer-events-none select-none"
                        }`}
                    >
                        You are a{" "}
                        <span className="relative inline-block">
                            <button
                                type="button"
                                onClick={toggleWord}
                                disabled={!isSignup}
                                tabIndex={isSignup ? 0 : -1}
                                className="inline-block overflow-hidden text-amber-600 cursor-pointer hover:opacity-75 transition-opacity"
                                style={{ verticalAlign: "bottom" }}
                                aria-label="Toggle account type"
                            >
                                <span className={`inline-block ${wordClass}`}>{displayedType}</span>
                            </button>
                            <span className="absolute -bottom-1 left-0 right-0 h-px bg-amber-300/70" />
                        </span>
                        .
                    </h1>
                    <div
                        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ease-in-out ${
                            !isSignup ? "opacity-100" : "opacity-0 pointer-events-none"
                        }`}
                    >
                        <h1 className="text-5xl font-bold tracking-tight text-stone-900 sm:text-6xl md:text-7xl">
                            Welcome back.
                        </h1>
                    </div>
                </div>

                {/* Account type toggle — opacity-only so it always holds its
                    height, keeping the heading pinned even as mode changes. */}
                <div
                    className={`mt-6 flex gap-2 transition-opacity duration-300 ease-in-out ${
                        isSignup ? "opacity-100" : "opacity-0 pointer-events-none select-none"
                    }`}
                    aria-hidden={!isSignup}
                >
                    <button
                        type="button"
                        onClick={() => selectAccountType("traveler")}
                        tabIndex={isSignup ? 0 : -1}
                        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                            accountType === "traveler"
                                ? "bg-amber-500 text-white shadow-sm"
                                : "text-stone-400 hover:text-stone-600"
                        }`}
                    >
                        <Globe className="h-3.5 w-3.5" />
                        Traveler
                    </button>
                    <button
                        type="button"
                        onClick={() => selectAccountType("student")}
                        tabIndex={isSignup ? 0 : -1}
                        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                            accountType === "student"
                                ? "bg-amber-500 text-white shadow-sm"
                                : "text-stone-400 hover:text-stone-600"
                        }`}
                    >
                        <GraduationCap className="h-3.5 w-3.5" />
                        Student
                    </button>
                </div>

                <p className="mt-3 text-sm text-stone-400">
                    {mode === "signin"
                        ? "Enter your email and password to continue."
                        : accountType === "traveler"
                          ? "Explore destinations, trips, and activities."
                          : "Write reviews and plan your next adventure."}
                </p>
            </div>

            {/* ── BOTTOM HALF: form inputs ──────────────────────────────────────
                On md+: justify-start pins the form to the top of its grid row.
                On mobile: natural stack with top margin and bottom safe padding. */}
            <div className="flex flex-col items-center w-full mt-6 pb-8 md:mt-0 md:pb-0 md:justify-start md:pt-8">
                <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col">
                    {/* Name field — collapses height + margin when in signin */}
                    <div
                        style={{
                            ...collapseStyle(isSignup),
                            marginBottom: isSignup ? "1rem" : "0",
                            transition: "grid-template-rows 280ms ease, opacity 280ms ease, margin-bottom 280ms ease",
                        }}
                    >
                        <div style={{ overflow: "hidden" }}>
                            <input
                                name="name"
                                type="text"
                                autoComplete="name"
                                required={isSignup}
                                disabled={!isSignup || isLoading}
                                tabIndex={isSignup ? 0 : -1}
                                value={form.name}
                                onChange={handleChange}
                                placeholder="Full name"
                                className={inputBase}
                            />
                        </div>
                    </div>

                    {/* Email + .edu notice */}
                    <div className="mb-4 flex flex-col">
                        <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            disabled={isLoading}
                            value={form.email}
                            onChange={handleChange}
                            placeholder={isStudent ? "University email (.edu)" : "Email"}
                            className={inputBase}
                        />
                        {/* .edu notice — collapses when not student */}
                        <div style={collapseStyle(isStudent)}>
                            <div style={{ overflow: "hidden", paddingTop: "4px" }}>
                                <p className="flex items-center gap-1 px-1 text-xs text-amber-600">
                                    <GraduationCap className="h-3 w-3 shrink-0" />A .edu email address is required for
                                    student accounts.
                                </p>
                            </div>
                        </div>
                    </div>

                    <input
                        name="password"
                        type="password"
                        autoComplete={isSignup ? "new-password" : "current-password"}
                        required
                        disabled={isLoading}
                        value={form.password}
                        onChange={handleChange}
                        placeholder="Password"
                        className={`${inputBase} mb-4`}
                    />

                    {/* Error message — collapses when empty */}
                    <div
                        style={{
                            ...collapseStyle(!!error),
                            marginBottom: error ? "0.75rem" : "0",
                            transition: "grid-template-rows 200ms ease, opacity 200ms ease, margin-bottom 200ms ease",
                        }}
                    >
                        <div style={{ overflow: "hidden" }}>
                            <p className="px-1 text-xs text-red-500">{error}</p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                        {isLoading ? "Please wait…" : isSignup ? "Get started" : "Sign in"}
                    </button>
                </form>

                <p className="mt-6 text-sm text-stone-400">
                    {isSignup ? (
                        <>
                            Already have an account?{" "}
                            <button
                                type="button"
                                onClick={() => {
                                    setMode("signin");
                                    setError("");
                                }}
                                className="text-amber-600 hover:underline underline-offset-4"
                            >
                                Sign in
                            </button>
                        </>
                    ) : (
                        <>
                            New here?{" "}
                            <button
                                type="button"
                                onClick={() => {
                                    setMode("signup");
                                    setError("");
                                }}
                                className="text-amber-600 hover:underline underline-offset-4"
                            >
                                Create an account
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
