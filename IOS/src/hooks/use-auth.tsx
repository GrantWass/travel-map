import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from "react";

import {
  ApiError,
  getSession,
  getUserProfile,
  logoutSession,
} from "@/src/api/client";
import { setAuthToken } from "@/src/api/auth-token";
import {
  PROFILE_CACHE_KEY,
  SESSION_USER_KEY,
} from "@/src/constants/storage";
import { useAuthStore, type AuthStatus } from "@/src/stores/auth-store";
import type { SessionUser, UserProfileResponse } from "@/src/types/api";

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  userId: number | null;
  isAuthenticated: boolean;
  isStudent: boolean;
  myProfile: UserProfileResponse | null;
  setAuthenticatedUser: (user: SessionUser) => Promise<void>;
  refreshSession: () => Promise<SessionUser | null>;
  refreshMyProfile: (userIdOverride?: number) => Promise<UserProfileResponse | null>;
  signOut: () => Promise<void>;
}

const PUBLIC_ROUTES = new Set(["sign-in"]);
const STUDENT_ONLY_ROUTES = new Set(["trip-compose"]);

const AuthContext = createContext<AuthContextValue | null>(null);

function readCachedJson<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const segments = useSegments();

  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const myProfile = useAuthStore((state) => state.myProfile);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const setStatus = useAuthStore((state) => state.setStatus);
  const setStoreMyProfile = useAuthStore((state) => state.setMyProfile);
  const setStoreAuthenticatedUser = useAuthStore((state) => state.setAuthenticatedUser);
  const clearStoreAuthState = useAuthStore((state) => state.clearAuthState);

  const clearAuthState = useCallback(async () => {
    clearStoreAuthState();
    await Promise.all([
      setAuthToken(null),
      AsyncStorage.removeItem(SESSION_USER_KEY),
      AsyncStorage.removeItem(PROFILE_CACHE_KEY),
    ]);
  }, [clearStoreAuthState]);

  const setAuthenticatedUser = useCallback(async (nextUser: SessionUser) => {
    setStoreAuthenticatedUser(nextUser);
    await AsyncStorage.setItem(SESSION_USER_KEY, JSON.stringify(nextUser));
  }, [setStoreAuthenticatedUser]);

  const refreshSession = useCallback(async () => {
    try {
      const response = await getSession();
      if (response.authenticated && response.user) {
        await setAuthenticatedUser(response.user);
        return response.user;
      }

      await clearAuthState();
      return null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearAuthState();
        return null;
      }

      await clearAuthState();
      return null;
    }
  }, [clearAuthState, setAuthenticatedUser]);

  const refreshMyProfile = useCallback(
    async (userIdOverride?: number) => {
      const targetUserId = userIdOverride ?? user?.user_id;
      if (!targetUserId) {
        setStoreMyProfile(null);
        await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
        return null;
      }

      try {
        const profile = await getUserProfile(targetUserId);
        if (profile.user.user_id !== targetUserId) {
          return null;
        }

        setStoreMyProfile(profile);
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
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
      // Continue clearing local state when logout request fails.
    }

    await clearAuthState();
    router.replace("/sign-in");
  }, [clearAuthState, router]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const [cachedUserRaw, cachedProfileRaw] = await Promise.all([
          AsyncStorage.getItem(SESSION_USER_KEY),
          AsyncStorage.getItem(PROFILE_CACHE_KEY),
        ]);

        if (cancelled) {
          return;
        }

        const cachedUser = readCachedJson<SessionUser>(cachedUserRaw);
        const cachedProfile = readCachedJson<UserProfileResponse>(cachedProfileRaw);

        if (cachedUser?.user_id) {
          setStoreAuthenticatedUser(cachedUser);
          setStatus("authenticated");
        } else {
          setStatus("loading");
        }

        if (cachedProfile?.user?.user_id === cachedUser?.user_id) {
          setStoreMyProfile(cachedProfile);
        } else {
          setStoreMyProfile(null);
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [setHydrated, setStatus, setStoreAuthenticatedUser, setStoreMyProfile]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    void refreshSession();
  }, [hasHydrated, refreshSession]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const currentRoute = segments[segments.length - 1] ?? "";
    const isPublicRoute = PUBLIC_ROUTES.has(currentRoute);
    const isStudentOnlyRoute = STUDENT_ONLY_ROUTES.has(currentRoute);

    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated" && !isPublicRoute) {
      router.replace("/sign-in");
      return;
    }

    if (status === "authenticated" && isPublicRoute) {
      router.replace("/map");
      return;
    }

    if (status === "authenticated" && isStudentOnlyRoute && !Boolean(user?.verified)) {
      router.replace("/map");
    }
  }, [hasHydrated, router, segments, status, user?.verified]);

  useEffect(() => {
    if (status !== "authenticated" || !user?.user_id) {
      setStoreMyProfile(null);
      void AsyncStorage.removeItem(PROFILE_CACHE_KEY);
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
  }, [
    status,
    user,
    myProfile,
    setAuthenticatedUser,
    refreshSession,
    refreshMyProfile,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
