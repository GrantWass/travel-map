"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ApiError, getSession, getUserProfile, logoutSession, setAuthToken } from "@/lib/api-client";
import type { SessionUser, UserProfileResponse } from "@/lib/api-types";
import { useAuthStore, type AuthStatus } from "@/stores/auth-store";

interface AuthContextValue {
    status: AuthStatus;
    user: SessionUser | null;
    userId: number | null;
    isAuthenticated: boolean;
    isStudent: boolean;
    myProfile: UserProfileResponse | null;
    setAuthenticatedUser: (nextUser: SessionUser) => void;
    refreshSession: () => Promise<SessionUser | null>;
    refreshMyProfile: (userIdOverride?: number) => Promise<UserProfileResponse | null>;
    signOut: () => Promise<void>;
}

const SESSION_CACHE_KEY = "travel-map.session-user.v1";
const PROFILE_CACHE_KEY = "travel-map.my-profile.v1";
const PUBLIC_ROUTES = new Set(["/signup"]);
const STUDENT_ONLY_ROUTES = new Set(["/trips"]);

const AuthContext = createContext<AuthContextValue | null>(null);

function readCachedJson<T>(key: string): T | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) {
            return null; 
        }
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

function writeCachedJson<T>(key: string, value: T | null) {
    if (typeof window === "undefined") {
        return;
    }

    if (value === null) {
        window.sessionStorage.removeItem(key);
        return;
    }

    window.sessionStorage.setItem(key, JSON.stringify(value));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const status = useAuthStore((state) => state.status);
    const user = useAuthStore((state) => state.user);
    const myProfile = useAuthStore((state) => state.myProfile);
    const isHydratedFromCache = useAuthStore((state) => state.isHydratedFromCache);
    const hydrateFromCache = useAuthStore((state) => state.hydrateFromCache);
    const setStoreMyProfile = useAuthStore((state) => state.setMyProfile);
    const setStoreAuthenticatedUser = useAuthStore((state) => state.setAuthenticatedUser);
    const clearStoreAuthState = useAuthStore((state) => state.clearAuthState);

    useEffect(() => {
        const cachedUser = readCachedJson<SessionUser>(SESSION_CACHE_KEY);
        const cachedProfile = readCachedJson<UserProfileResponse>(PROFILE_CACHE_KEY);

        hydrateFromCache(cachedUser, cachedProfile);
    }, [hydrateFromCache]);

    const clearAuthState = useCallback(() => {
        clearStoreAuthState();
        setAuthToken(null);
        writeCachedJson(SESSION_CACHE_KEY, null);
        writeCachedJson(PROFILE_CACHE_KEY, null);
    }, [clearStoreAuthState]);

    const setAuthenticatedUser = useCallback((nextUser: SessionUser) => {
        setStoreAuthenticatedUser(nextUser);
        writeCachedJson(SESSION_CACHE_KEY, nextUser);
    }, [setStoreAuthenticatedUser]);

    const refreshSession = useCallback(async () => {
        try {
            const response = await getSession();
            if (response.authenticated && response.user) {
                setAuthenticatedUser(response.user);
                return response.user;
            }

            clearAuthState();
            return null;
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                clearAuthState();
                return null;
            }

            clearAuthState();
            return null;
        }
    }, [clearAuthState, setAuthenticatedUser]);

    const refreshMyProfile = useCallback(
        async (userIdOverride?: number) => {
            const targetUserId = userIdOverride ?? user?.user_id;
            if (!targetUserId) {
                setStoreMyProfile(null);
                writeCachedJson(PROFILE_CACHE_KEY, null);
                return null;
            }

            try {
                const profile = await getUserProfile(targetUserId);
                if (profile.user.user_id !== targetUserId) {
                    return null;
                }

                setStoreMyProfile(profile);
                writeCachedJson(PROFILE_CACHE_KEY, profile);
                return profile;
            } catch {
                return myProfile;
            }
        },
        [myProfile, setStoreMyProfile, user?.user_id],
    );

    const signOut = useCallback(async () => {
        try {
            await logoutSession();
        } catch {
            // Continue clearing client auth state even if network logout fails.
        }

        clearAuthState();

        if (typeof window !== "undefined") {
            window.location.replace("/signup");
        }
    }, [clearAuthState]);

    useEffect(() => {
        if (!isHydratedFromCache) {
            return;
        }

        void refreshSession();
    }, [isHydratedFromCache, refreshSession]);

    useEffect(() => {
        if (!isHydratedFromCache) {
            return;
        }

        const isPublicRoute = PUBLIC_ROUTES.has(pathname);
        const isStudentOnlyRoute = STUDENT_ONLY_ROUTES.has(pathname);

        if (status === "loading") {
            return;
        }

        if (status === "unauthenticated" && !isPublicRoute) {
            router.replace("/signup");
            return;
        }

        if (status === "authenticated" && isPublicRoute) {
            router.replace("/");
            return;
        }

        if (status === "authenticated" && isStudentOnlyRoute && !Boolean(user?.verified)) {
            router.replace("/");
        }
    }, [isHydratedFromCache, pathname, router, status, user?.verified]);

    useEffect(() => {
        if (status !== "authenticated" || !user?.user_id) {
            setStoreMyProfile(null);
            writeCachedJson(PROFILE_CACHE_KEY, null);
            return;
        }

        if (myProfile?.user?.user_id === user.user_id) {
            return;
        }

        void refreshMyProfile(user.user_id);
    }, [myProfile?.user?.user_id, refreshMyProfile, setStoreMyProfile, status, user?.user_id]);

    const value = useMemo<AuthContextValue>(() => {
        const userId = user?.user_id ?? null;
        return {
            status,
            user,
            userId,
            isAuthenticated: status === "authenticated" && userId !== null,
            isStudent: Boolean(user?.verified),
            myProfile,
            setAuthenticatedUser,
            refreshSession,
            refreshMyProfile,
            signOut,
        };
    }, [status, user, myProfile, setAuthenticatedUser, refreshSession, refreshMyProfile, signOut]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }
    return context;
}
