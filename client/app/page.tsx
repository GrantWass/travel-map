"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import TravelMap from "@/components/travel-map";
import OnboardingTour from "@/components/onboarding-tour";
import { getStepsForUser } from "@/lib/onboarding-steps";
import { useAuthStore } from "@/stores/auth-store";

export default function Page() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const refreshSession = useAuthStore((state) => state.refreshSession);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signup");
    }
  }, [router, status]);

  const pendingSteps = useMemo(() => {
    if (status !== "authenticated" || !user) return [];
    const completed = new Set(user.completed_onboarding_tours ?? []);
    const isStudent = Boolean(user.verified);
    return getStepsForUser(isStudent).filter((s) => !completed.has(s.id));
  }, [status, user]);

  function handleTourComplete() {
    void refreshSession();
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <>
      <TravelMap />
      {pendingSteps.length > 0 && (
        <OnboardingTour steps={pendingSteps} onComplete={handleTourComplete} />
      )}
    </>
  );
}
