"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";

const AUTH_ROUTES = new Set(["/signup"]);
const STUDENT_ONLY_ROUTES = new Set(["/trips"]);

export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const status = useAuthStore((state) => state.status);
    const user = useAuthStore((state) => state.user);
    const myProfile = useAuthStore((state) => state.myProfile);
    const isHydratedFromCache = useAuthStore((state) => state.isHydratedFromCache);
    const initializeFromCache = useAuthStore((state) => state.initializeFromCache);
    const setMyProfile = useAuthStore((state) => state.setMyProfile);
    const refreshSession = useAuthStore((state) => state.refreshSession);
    const refreshMyProfile = useAuthStore((state) => state.refreshMyProfile);

    useEffect(() => {
        initializeFromCache();
    }, [initializeFromCache]);

    useEffect(() => {
        if (!isHydratedFromCache) {
            return;
        }

        void refreshSession();
    }, [isHydratedFromCache, refreshSession]);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT" && !session) {
                useAuthStore.getState().clearAuthState();
                return;
            }
            if (session?.access_token && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
                void useAuthStore.getState().refreshSession();
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!isHydratedFromCache) {
            return;
        }

        const isAuthRoute = AUTH_ROUTES.has(pathname);
        const isStudentOnlyRoute = STUDENT_ONLY_ROUTES.has(pathname);

        if (status === "loading") {
            return;
        }

        if (status === "authenticated" && isAuthRoute) {
            router.replace("/");
            return;
        }

        if (status === "authenticated" && isStudentOnlyRoute && !Boolean(user?.verified)) {
            router.replace("/");
        }
    }, [isHydratedFromCache, pathname, router, status, user?.verified]);

    useEffect(() => {
        if (status !== "authenticated" || !user?.user_id) {
            setMyProfile(null);
            return;
        }

        if (myProfile?.user?.user_id === user.user_id) {
            return;
        }

        void refreshMyProfile(user.user_id);
    }, [myProfile?.user?.user_id, refreshMyProfile, setMyProfile, status, user?.user_id]);

    return <>{children}</>;
}
