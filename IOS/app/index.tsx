import { Redirect } from "expo-router";

import { useAuth } from "@/src/hooks/use-auth";

export default function IndexScreen() {
  const { status } = useAuth();

  if (status === "loading") {
    return null;
  }

  if (status === "authenticated") {
    return <Redirect href="/map" />;
  }

  return <Redirect href="/sign-in" />;
}
