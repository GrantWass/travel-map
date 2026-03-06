const INVITE_TOKEN_CACHE_KEY = "travel-map.pending-invite-token.v1";

function normalizeInviteToken(token: string | null | undefined): string | null {
  if (typeof token !== "string") {
    return null;
  }

  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getInviteTokenFromSearch(searchParams: URLSearchParams): string | null {
  return normalizeInviteToken(searchParams.get("invite"));
}

export function getStoredInviteToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeInviteToken(window.sessionStorage.getItem(INVITE_TOKEN_CACHE_KEY));
  } catch {
    return null;
  }
}

export function persistInviteToken(inviteToken: string | null | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeInviteToken(inviteToken);

  try {
    if (!normalized) {
      window.sessionStorage.removeItem(INVITE_TOKEN_CACHE_KEY);
      return;
    }

    window.sessionStorage.setItem(INVITE_TOKEN_CACHE_KEY, normalized);
  } catch {
    // Ignore storage failures.
  }
}

export function buildSignupHref(options?: {
  nextPath?: string;
  inviteToken?: string | null;
  prompt?: string;
}): string {
  const params = new URLSearchParams();
  const nextPath = options?.nextPath?.trim();
  const inviteToken = normalizeInviteToken(options?.inviteToken);
  const prompt = options?.prompt?.trim();

  if (nextPath) {
    params.set("next", nextPath);
  }

  if (inviteToken) {
    params.set("invite", inviteToken);
  }

  if (prompt) {
    params.set("prompt", prompt);
  }

  const query = params.toString();
  return query ? `/signup?${query}` : "/signup";
}
