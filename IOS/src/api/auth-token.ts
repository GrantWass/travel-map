import AsyncStorage from "@react-native-async-storage/async-storage";

import { AUTH_TOKEN_KEY } from "@/src/constants/storage";

let inMemoryAuthToken: string | null = null;
let isHydrated = false;

export async function hydrateAuthToken(): Promise<string | null> {
  if (isHydrated) {
    return inMemoryAuthToken;
  }

  try {
    const stored = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    inMemoryAuthToken = stored || null;
  } catch {
    inMemoryAuthToken = null;
  }

  isHydrated = true;
  return inMemoryAuthToken;
}

export async function setAuthToken(token: string | null): Promise<void> {
  inMemoryAuthToken = token;
  isHydrated = true;

  try {
    if (token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

export async function readAuthToken(): Promise<string | null> {
  if (!isHydrated) {
    await hydrateAuthToken();
  }

  return inMemoryAuthToken;
}
