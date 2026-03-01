import { create } from "zustand";

import type { SessionUser, UserProfileResponse } from "@/lib/api-types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthStoreState {
    status: AuthStatus;
    user: SessionUser | null;
    myProfile: UserProfileResponse | null;
    isHydratedFromCache: boolean;
    hydrateFromCache: (
        cachedUser: SessionUser | null,
        cachedProfile: UserProfileResponse | null,
    ) => void;
    setStatus: (status: AuthStatus) => void;
    setMyProfile: (profile: UserProfileResponse | null) => void;
    setAuthenticatedUser: (user: SessionUser) => void;
    clearAuthState: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
    status: "loading",
    user: null,
    myProfile: null,
    isHydratedFromCache: false,
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
    setMyProfile: (myProfile) => set({ myProfile }),
    setAuthenticatedUser: (user) => set({ user, status: "authenticated" }),
    clearAuthState: () => set({ user: null, status: "unauthenticated", myProfile: null }),
}));
