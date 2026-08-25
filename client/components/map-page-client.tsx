"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

import TravelMap from "@/components/travel-map";
import { getStepsForUser } from "@/lib/onboarding-steps";
import type { Trip } from "@/lib/api-types";
import { useAuthStore } from "@/stores/auth-store";

const OnboardingTour = dynamic(() => import("@/components/onboarding-tour"));

interface MapPageClientProps {
  initialPublicTrips: Trip[];
  initialDeferredTripIds?: number[];
}

export default function MapPageClient({ initialPublicTrips, initialDeferredTripIds }: MapPageClientProps) {
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
      <TravelMap
        initialPublicTrips={initialPublicTrips}
        initialDeferredTripIds={initialDeferredTripIds}
      />
      {pendingSteps.length > 0 && (
        <OnboardingTour steps={pendingSteps} onComplete={handleTourComplete} />
      )}
    </>
  );
}
