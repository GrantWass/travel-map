import { create } from "zustand";

import type { SessionUser, UserProfileResponse } from "@/src/types/api";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthStoreState {
  status: AuthStatus;
  user: SessionUser | null;
  myProfile: UserProfileResponse | null;
  hasHydrated: boolean;
  setHydrated: (value: boolean) => void;
  setAuthenticatedUser: (user: SessionUser) => void;
  setMyProfile: (profile: UserProfileResponse | null) => void;
  setStatus: (status: AuthStatus) => void;
  clearAuthState: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  status: "loading",
  user: null,
  myProfile: null,
  hasHydrated: false,
  setHydrated: (hasHydrated) => set({ hasHydrated }),
  setAuthenticatedUser: (user) => set({ user, status: "authenticated" }),
  setMyProfile: (myProfile) => set({ myProfile }),
  setStatus: (status) => set({ status }),
  clearAuthState: () => set({ user: null, status: "unauthenticated", myProfile: null }),
}));
