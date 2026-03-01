"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import TravelMap from "@/components/travel-map";
import { useAuth } from "@/components/auth-provider";

export default function MapPage() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signup");
    }
  }, [router, status]);

  if (status !== "authenticated") {
    return null;
  }

  return <TravelMap />;
}
