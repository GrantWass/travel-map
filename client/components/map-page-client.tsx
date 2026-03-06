"use client";

import { useMemo } from "react";

import TravelMap from "@/components/travel-map";
import OnboardingTour from "@/components/onboarding-tour";
import { getStepsForUser } from "@/lib/onboarding-steps";
import type { Trip } from "@/lib/api-types";
import { useAuthStore } from "@/stores/auth-store";

interface MapPageClientProps {
  initialPublicTrips: Trip[];
}

export default function MapPageClient({ initialPublicTrips }: MapPageClientProps) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const refreshSession = useAuthStore((state) => state.refreshSession);

  const pendingSteps = useMemo(() => {
    if (status !== "authenticated" || !user) return [];
    const completed = new Set(user.completed_onboarding_tours ?? []);
    const isStudent = Boolean(user.verified);
    return getStepsForUser(isStudent).filter((s) => !completed.has(s.id));
  }, [status, user]);

  function handleTourComplete() {
    void refreshSession();
  }

  return (
    <>
      <TravelMap initialPublicTrips={initialPublicTrips} />
      {pendingSteps.length > 0 && (
        <OnboardingTour steps={pendingSteps} onComplete={handleTourComplete} />
      )}
    </>
  );
}
