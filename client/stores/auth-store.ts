import { create } from "zustand";

import type { User, UserProfileResponse } from "@/lib/api-types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthStoreState {
    status: AuthStatus;
    user: User | null;
    myProfile: UserProfileResponse | null;
    isHydratedFromCache: boolean;
    hydrateFromCache: (
        cachedUser: User | null,
        cachedProfile: UserProfileResponse | null,
    ) => void;
    setStatus: (status: AuthStatus) => void;
    setMyProfile: (profile: UserProfileResponse | null) => void;
    setAuthenticatedUser: (user: User) => void;
    clearAuthState: () => void;
    toUserProfileFromApi: (profileResponse: UserProfileResponse) => User;
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
    toUserProfileFromApi(profileResponse: UserProfileResponse): User {
        const initials = profileResponse.user.name || ""
            .split(" ")
            .filter(Boolean)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
        const user = {
            user_id: profileResponse.user.user_id,
            name: profileResponse.user.name || "Traveler", 
            email: profileResponse.user.email,
            bio: profileResponse.user.bio || "Traveler sharing experiences from the road.",
            verified: profileResponse.user.verified,
            college: profileResponse.user.college || "—",
            profile_image_url: profileResponse.user.profile_image_url,
            trips: profileResponse.user.trips || null,
            initials: initials,
        }
        return user
    }
}));
