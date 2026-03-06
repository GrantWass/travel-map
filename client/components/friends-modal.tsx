"use client";

import { useEffect, useState } from "react";
import { X, UserPlus, Phone, Check, Slash, Copy, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createSmsInvite,
  createInviteLink,
  createFriendRequest,
  respondFriendRequest,
  getUserProfile,
} from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useFriendsStore } from "@/stores/friends-store";
import UserProfileModal from "./user-profile-modal";

interface FriendsModalProps {
  onClose: () => void;
}

/* ----------------------------- Avatar ----------------------------- */

function UserAvatar({
  name,
  image,
  size = 32,
}: {
  name?: string | null;
  image?: string | null;
  size?: number;
}) {
  const initials =
    (name || "")
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2) || "?";

  if (image) {
    return (
      <img
        src={image}
        alt={`${name} avatar`}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold"
    >
      {initials}
    </div>
  );
}

/* -------------------------- Search Result Row -------------------------- */

function SearchUserRow({
  user,
  isCurrentUser,
  requestBusy,
  onRequest,
  onClick,
}: any) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
      <div className="flex items-start gap-3">
        <UserAvatar name={user.name} image={user.profile_image_url} size={40} />

        <div className="flex flex-col">
          <button
            className="text-sm font-medium text-left hover:underline"
            onClick={onClick}
          >
            {user.name}
          </button>

          {user.bio && (
            <div className="text-xs text-muted-foreground mt-1 max-w-lg">
              {user.bio}
            </div>
          )}
        </div>
      </div>

      {isCurrentUser ? (
        <Button size="sm" disabled>
          You
        </Button>
      ) : (
        <Button size="sm" onClick={onRequest} disabled={requestBusy}>
          <UserPlus className="mr-2 h-3.5 w-3.5" />
          Request
        </Button>
      )}
    </div>
  );
}

/* -------------------------- Request Row -------------------------- */

function RequestRow({
  name,
  image,
  status,
  onClick,
  onAccept,
  onDecline,
}: any) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-3">
        <UserAvatar name={name} image={image} />

        <button className="text-sm hover:underline" onClick={onClick}>
          {name ?? "Unknown"}
        </button>
      </div>

      {onAccept ? (
        <div className="flex gap-2">
          <Button onClick={onAccept}>
            <Check className="mr-2 h-3.5 w-3.5" />
            Accept
          </Button>

          <Button variant="outline" onClick={onDecline}>
            <Slash className="mr-2 h-3.5 w-3.5" />
            Decline
          </Button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{status}</div>
      )}
    </div>
  );
}

/* ----------------------------- Friend Row ----------------------------- */

function FriendRow({ name, image, onClick }: any) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-3">
        <UserAvatar name={name} image={image} />

        <button className="text-sm hover:underline" onClick={onClick}>
          {name ?? "Unknown"}
        </button>
      </div>

      <div className="text-xs text-muted-foreground">Friends</div>
    </div>
  );
}

/* ============================= MAIN MODAL ============================= */

export default function FriendsModal({ onClose }: FriendsModalProps) {
  const { incoming, outgoing, accepted, loaded, refresh } = useFriendsStore();

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState("/signup");
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [copyInviteState, setCopyInviteState] = useState<"idle" | "copied" | "error">("idle");

  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);

  const currentUserId = useAuthStore((s) => s.user?.user_id ?? null);

  const load = async () => {
    setError(null);
    try {
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not load friends");
    }
  };

  useEffect(() => {
    if (!loaded) {
      setRefreshing(true);
      void load().finally(() => setRefreshing(false));
    } else {
      void load();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const baseSignupUrl = `${window.location.origin}/signup`;
    setInviteLink(baseSignupUrl);

    const loadInviteLink = async () => {
      setInviteLinkLoading(true);
      try {
        const response = await createInviteLink();
        const inviteToken = response?.invite?.invite_token;
        if (typeof inviteToken === "string" && inviteToken.trim().length > 0) {
          setInviteLink(`${baseSignupUrl}?invite=${encodeURIComponent(inviteToken)}`);
        }
      } catch {
        // Keep fallback signup URL when token generation fails.
      } finally {
        setInviteLinkLoading(false);
      }
    };

    void loadInviteLink();
  }, []);

  async function handleSendInvite() {
    setPhoneError(null);
    const raw = phoneInput.trim();

    if (!raw) {
      setPhoneError("Phone number is required");
      return;
    }

    setInviteBusy(true);

    try {
      const { parsePhoneNumberFromString } = await import("libphonenumber-js");
      const parsed = parsePhoneNumberFromString(raw, "US");

      if (!parsed || !parsed.isValid()) {
        setPhoneError("Invalid phone number");
        return;
      }

      const normalized = parsed.format("E.164");

      await createSmsInvite(normalized);

      setPhoneInput("");
      await load();
    } catch (err: any) {
      setError(err?.message || "Could not send invite");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleSendRequestToId(id: number) {
    setRequestBusy(true);

    try {
      await createFriendRequest(id);

      setSearchQuery("");
      setSearchResults([]);

      await load();
    } catch (err: any) {
      setError(err?.message || "Could not send friend request");
    } finally {
      setRequestBusy(false);
    }
  }

  async function handleCopyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyInviteState("copied");
      window.setTimeout(() => setCopyInviteState("idle"), 1600);
    } catch {
      setCopyInviteState("error");
      window.setTimeout(() => setCopyInviteState("idle"), 2200);
    }
  }

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const id = window.setTimeout(async () => {
      setSearchLoading(true);

      try {
        const res = await (await import("@/lib/api-client")).searchUsers(
          searchQuery.trim()
        );

        setSearchResults(res.users || []);
      } catch (err: any) {
        setError(err?.message || "Search failed");
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(id);
  }, [searchQuery]);

  async function handleRespond(friendshipId: number, status: "accepted" | "declined") {
    try {
      await respondFriendRequest(friendshipId, status);
      await load();
    } catch (err: any) {
      setError(err?.message || "Could not update request");
    }
  }

  return (
    <>
      <div
        className="backdrop-fade fixed inset-0 z-[1500] bg-foreground/10 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="modal-expand fixed left-1/2 top-1/2 z-[1600] w-[min(720px,96vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card border border-border shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold">Friends</h2>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary hover:bg-border"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="p-4 grid gap-6">
            <section>
              <h3 className="text-sm font-medium">Invite link</h3>

              <div className="mt-2 flex gap-2">
                <div className="flex h-10 flex-1 items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    {inviteLinkLoading ? "Generating invite link..." : inviteLink}
                  </span>
                </div>
                <Button onClick={handleCopyInviteLink} disabled={inviteLinkLoading}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copyInviteState === "copied"
                    ? "Copied"
                    : copyInviteState === "error"
                    ? "Retry"
                    : "Copy"}
                </Button>
              </div>

              {copyInviteState === "error" && (
                <div className="mt-2 text-sm text-red-600">
                  Could not copy automatically. You can still copy the link above.
                </div>
              )}
            </section>

            {/*
            <section>
              <h3 className="text-sm font-medium">Invite via SMS</h3>

              <div className="mt-2 flex gap-2">
                <input
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setPhoneError(null);
                  }}
                  placeholder="+15551234567"
                  className="h-10 flex-1 rounded-md border border-input px-3"
                />

                <Button onClick={handleSendInvite} disabled={inviteBusy}>
                  <Phone className="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>

              {phoneError && (
                <div className="text-sm text-red-600 mt-2">{phoneError}</div>
              )}
            </section>
            */}

            {/* Search */}

            <section>
              <h3 className="text-sm font-medium">Find by name</h3>

              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name"
                className="mt-2 h-10 w-full rounded-md border border-input px-3"
              />

              {searchLoading && (
                <p className="text-sm text-muted-foreground mt-2">
                  Searching…
                </p>
              )}

              <div className="mt-2 grid gap-2">
                {searchResults.map((u) => (
                  <SearchUserRow
                    key={u.user_id}
                    user={u}
                    isCurrentUser={u.user_id === currentUserId}
                    requestBusy={requestBusy}
                    onRequest={() => handleSendRequestToId(u.user_id)}
                    onClick={async () => {
                      const p = await getUserProfile(u.user_id);
                      setSelectedProfile({ ...p.user, trips: p.trips });
                    }}
                  />
                ))}
              </div>
            </section>

            {/* Incoming */}

            <section>
              <h3 className="text-sm font-medium">Incoming requests</h3>

              <div className="mt-2 grid gap-2">
                {incoming.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No incoming requests.
                  </p>
                )}

                {incoming.map((req) => (
                  <RequestRow
                    key={req.id}
                    name={req.requester_name}
                    image={(req as any).requester_profile_image_url}
                    onClick={async () => {
                      const p = await getUserProfile(req.requester_id);
                      setSelectedProfile({ ...p.user, trips: p.trips });
                    }}
                    onAccept={() => handleRespond(req.id, "accepted")}
                    onDecline={() => handleRespond(req.id, "declined")}
                  />
                ))}
              </div>
            </section>

            {/* Pending */}

            <section>
              <h3 className="text-sm font-medium">Pending requests</h3>

              <div className="mt-2 grid gap-2">
                {outgoing.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No pending requests.
                  </p>
                )}

                {outgoing.map((req) => (
                  <RequestRow
                    key={req.id}
                    name={req.addressee_name}
                    image={(req as any).addressee_profile_image_url}
                    status={req.status}
                    onClick={async () => {
                      const p = await getUserProfile(req.addressee_id);
                      setSelectedProfile({ ...p.user, trips: p.trips });
                    }}
                  />
                ))}
              </div>
            </section>

            {/* Friends */}

            <section>
              <h3 className="text-sm font-medium">Friends</h3>

              <div className="mt-2 grid gap-2">
                {accepted.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No friends yet.
                  </p>
                )}

                {accepted.map((f) => {
                  const me = useAuthStore.getState().user?.user_id ?? null;

                  const otherId =
                    me === f.requester_id ? f.addressee_id : f.requester_id;

                  const otherName =
                    me === f.requester_id
                      ? f.addressee_name
                      : f.requester_name;

                  const otherImage =
                    me === f.requester_id
                      ? (f as any).addressee_profile_image_url
                      : (f as any).requester_profile_image_url;

                  return (
                    <FriendRow
                      key={f.id}
                      name={otherName}
                      image={otherImage}
                      onClick={async () => {
                        const p = await getUserProfile(otherId);
                        setSelectedProfile({ ...p.user, trips: p.trips });
                      }}
                    />
                  );
                })}
              </div>
            </section>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>

      {selectedProfile && (
        <UserProfileModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          canEditProfile={false}
        />
      )}
    </>
  );
}