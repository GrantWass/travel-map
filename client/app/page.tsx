"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import TravelMap from "@/components/travel-map";
import { useAuthStore } from "@/stores/auth-store";

export default function Page() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);

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
