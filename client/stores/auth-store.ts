import { create } from "zustand";

import { ApiError, getSession, getUserProfile, logoutSession, setAuthToken } from "@/lib/api-client";
import type { User, UserProfileResponse } from "@/lib/api-types";
import { useFriendsStore } from "@/stores/friends-store";
import { supabase } from "@/lib/supabase";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

const SESSION_CACHE_KEY = "travel-map.session-user.v1";
const PROFILE_CACHE_KEY = "travel-map.my-profile.v1";

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

interface AuthStoreState {
    status: AuthStatus;
    user: User | null;
    myProfile: UserProfileResponse | null;
    isHydratedFromCache: boolean;
    initializeFromCache: () => void;
    hydrateFromCache: (
        cachedUser: User | null,
        cachedProfile: UserProfileResponse | null,
    ) => void;
    setStatus: (status: AuthStatus) => void;
    setMyProfile: (profile: UserProfileResponse | null) => void;
    setAuthenticatedUser: (user: User) => void;
    clearAuthState: () => void;
    refreshSession: () => Promise<User | null>;
    refreshMyProfile: (userIdOverride?: number) => Promise<UserProfileResponse | null>;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
    status: "loading",
    user: null,
    myProfile: null,
    isHydratedFromCache: false,
    initializeFromCache: () => {
        const cachedUser = readCachedJson<User>(SESSION_CACHE_KEY);
        const cachedProfile = readCachedJson<UserProfileResponse>(PROFILE_CACHE_KEY);

        get().hydrateFromCache(cachedUser, cachedProfile);
    },
    hydrateFromCache: (cachedUser, cachedProfile) => {
        set(() => {
            const hasValidCachedUser =
                cachedUser !== null && typeof cachedUser.user_id === "number";
            const profileMatchesUser =
                cachedProfile !== null &&
                hasValidCachedUser &&
                cachedProfile.user?.user_id === cachedUser.user_id;

            return {
                status: hasValidCachedUser ? "authenticated" : "loading",
                user: hasValidCachedUser ? cachedUser : null,
                myProfile: profileMatchesUser ? cachedProfile : null,
                isHydratedFromCache: true,
            };
        });
    },
    setStatus: (status) => set({ status }),
    setMyProfile: (myProfile) => {
        set({ myProfile });
        writeCachedJson(PROFILE_CACHE_KEY, myProfile);
    },
    setAuthenticatedUser: (user) => {
        set({ user, status: "authenticated" });
        writeCachedJson(SESSION_CACHE_KEY, user);
    },
    clearAuthState: () => {
        set({ user: null, status: "unauthenticated", myProfile: null });
        setAuthToken(null);
        writeCachedJson(SESSION_CACHE_KEY, null);
        writeCachedJson(PROFILE_CACHE_KEY, null);
        useFriendsStore.getState().clear();
    },
    refreshSession: async () => {
        try {
            const response = await getSession();
            if (response.authenticated && response.user) {
                get().setAuthenticatedUser(response.user);
                return response.user;
            }

            get().clearAuthState();
            return null;
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                get().clearAuthState();
                return null;
            }

            get().clearAuthState();
            return null;
        }
    },
    refreshMyProfile: async (userIdOverride?: number) => {
        const targetUserId = userIdOverride ?? get().user?.user_id;
        if (!targetUserId) {
            get().setMyProfile(null);
            return null;
        }

        try {
            const profile = await getUserProfile(targetUserId);
            if (profile.user.user_id !== targetUserId) {
                return null;
            }

            get().setMyProfile(profile);
            return profile;
        } catch {
            return get().myProfile;
        }
    },
    signOut: async () => {
        try {
            await supabase.auth.signOut();
        } catch {
            // Continue regardless.
        }
        try {
            await logoutSession();
        } catch {
            // Continue clearing client auth state even if network logout fails.
        }

        get().clearAuthState();

        if (typeof window !== "undefined") {
            window.location.replace("/signup");
        }
    }
}));
