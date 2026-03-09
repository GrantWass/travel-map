"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, UserPlus, Check, Slash, Copy, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
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
  onSelectTrip?: (tripId: number) => void;
}

/* ---------------- Avatar ---------------- */

function UserAvatar({
  name,
  image,
  size = 36,
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
      <div
        style={{ width: size, height: size }}
        className="shrink-0 overflow-hidden rounded-full"
      >
        <Image
          src={image}
          alt={`${name} avatar`}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold"
    >
      {initials}
    </div>
  );
}

/* ---------------- Search Result ---------------- */

function SearchUserRow({
  user,
  isCurrentUser,
  requestBusy,
  onRequest,
  onClick,
}: any) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <UserAvatar name={user.name} image={user.profile_image_url} />

        <div className="flex min-w-0 flex-col">
          <button
            className="min-w-0 truncate text-left text-sm font-medium hover:underline"
            onClick={onClick}
          >
            {user.name}
          </button>

          {user.bio && (
            <div className="text-xs text-muted-foreground line-clamp-2">
              {user.bio}
            </div>
          )}
        </div>
      </div>

      {isCurrentUser ? (
        <Button size="sm" disabled className="w-full sm:w-auto">
          You
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={onRequest}
          disabled={requestBusy}
          className="w-full sm:w-auto"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Request
        </Button>
      )}
    </div>
  );
}

/* ---------------- Request Row ---------------- */

function RequestRow({
  name,
  image,
  status,
  onClick,
  onAccept,
  onDecline,
}: any) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar name={name} image={image} />

        <button
          className="min-w-0 truncate text-left text-sm hover:underline"
          onClick={onClick}
        >
          {name ?? "Unknown"}
        </button>
      </div>

      {onAccept ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={onAccept} className="flex-1 sm:flex-none">
            <Check className="mr-2 h-4 w-4" />
            Accept
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onDecline}
            className="flex-1 sm:flex-none"
          >
            <Slash className="mr-2 h-4 w-4" />
            Decline
          </Button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{status}</div>
      )}
    </div>
  );
}

/* ---------------- Friend Row ---------------- */

function FriendRow({ name, image, onClick }: any) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar name={name} image={image} />

        <button
          className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
          onClick={onClick}
        >
          {name ?? "Unknown"}
        </button>
      </div>

      <div className="shrink-0 text-xs text-muted-foreground">Friends</div>
    </div>
  );
}

/* ================= Modal ================= */

export default function FriendsModal({ onClose, onSelectTrip }: FriendsModalProps) {
  const { incoming, outgoing, accepted, loaded, refresh } = useFriendsStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [requestBusy, setRequestBusy] = useState(false);

  const [inviteLink, setInviteLink] = useState("/signup");
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const activeProfileRequestIdRef = useRef(0);

  const currentUserId = useAuthStore((s) => s.user?.user_id ?? null);

  async function load() {
    await refresh();
  }

  useEffect(() => {
    if (!loaded) load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const base = `${window.location.origin}/signup`;
    setInviteLink(base);

    async function getLink() {
      setInviteLinkLoading(true);
      try {
        const r = await createInviteLink();
        const token = r?.invite?.invite_token;

        if (token) {
          setInviteLink(`${base}?invite=${token}`);
        }
      } finally {
        setInviteLinkLoading(false);
      }
    }

    getLink();
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1500);
  }

  async function handleSendRequest(id: number) {
    setRequestBusy(true);
    await createFriendRequest(id);
    setSearchQuery("");
    setSearchResults([]);
    await load();
    setRequestBusy(false);
  }

  /* -------- search -------- */

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const id = setTimeout(async () => {
      const res = await (await import("@/lib/api-client")).searchUsers(
        searchQuery
      );
      setSearchResults(res.users || []);
    }, 300);

    return () => clearTimeout(id);
  }, [searchQuery]);

  /* -------- respond -------- */

  async function respond(id: number, status: "accepted" | "declined") {
    await respondFriendRequest(id, status);
    await load();
  }

  async function openProfileOptimistic(
    userId: number,
    seed: { name?: string | null; profile_image_url?: string | null; bio?: string | null } = {}
  ) {
    const requestId = activeProfileRequestIdRef.current + 1;
    activeProfileRequestIdRef.current = requestId;

    const fallbackName = (seed.name || "Traveler").trim() || "Traveler";
    const initials =
      fallbackName
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "TR";

    // Open profile modal immediately with known row data, then hydrate full profile.
    setSelectedProfile({
      user_id: userId,
      name: fallbackName,
      email: "",
      bio: seed.bio ?? "",
      verified: false,
      college: null,
      profile_image_url: seed.profile_image_url ?? null,
      trips: [],
      initials,
    });

    try {
      const profileResponse = await getUserProfile(userId);
      if (requestId !== activeProfileRequestIdRef.current) {
        return;
      }
      setSelectedProfile({ ...profileResponse.user, trips: profileResponse.trips });
    } catch {
      // Keep optimistic profile shown if hydration fails.
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[1500] bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="fixed inset-3 flex max-h-[calc(100dvh-1.5rem)] flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[720px] sm:max-h-[96dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 lg:max-h-[98dvh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}

          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">Friends</h2>

            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* body */}

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6">
            {/* invite link */}

            <section>
              <h3 className="text-sm font-medium">Invite link</h3>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center mt-2">
                <div className="flex flex-1 min-w-0 items-center gap-2 border rounded-md px-3 h-10 text-sm text-muted-foreground">
                  <LinkIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {inviteLinkLoading
                      ? "Generating invite link..."
                      : inviteLink}
                  </span>
                </div>

                <Button onClick={handleCopy} className="w-full sm:w-auto">
                  <Copy className="mr-2 h-4 w-4" />
                  {copyState === "copied" ? "Copied" : "Copy"}
                </Button>
              </div>
            </section>

            {/* search */}

            <section>
              <h3 className="text-sm font-medium">Find by name</h3>

              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users"
                className="mt-2 w-full h-10 border rounded-md px-3"
              />

              <div className="mt-3 space-y-2">
                {searchResults.map((u) => (
                  <SearchUserRow
                    key={u.user_id}
                    user={u}
                    isCurrentUser={u.user_id === currentUserId}
                    requestBusy={requestBusy}
                    onRequest={() => handleSendRequest(u.user_id)}
                    onClick={() => {
                      void openProfileOptimistic(u.user_id, {
                        name: u.name,
                        profile_image_url: u.profile_image_url,
                        bio: u.bio,
                      });
                    }}
                  />
                ))}
              </div>
            </section>

            {/* incoming */}

            <section>
              <h3 className="text-sm font-medium">Incoming requests</h3>

              <div className="mt-2 space-y-2">
                {incoming.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No incoming requests
                  </p>
                )}

                {incoming.map((req) => (
                  <RequestRow
                    key={req.id}
                    name={req.requester_name}
                    image={(req as any).requester_profile_image_url}
                    onClick={() => {
                      void openProfileOptimistic(req.requester_id, {
                        name: req.requester_name,
                        profile_image_url: (req as any).requester_profile_image_url,
                      });
                    }}
                    onAccept={() => respond(req.id, "accepted")}
                    onDecline={() => respond(req.id, "declined")}
                  />
                ))}
              </div>
            </section>

            {/* pending */}

            <section>
              <h3 className="text-sm font-medium">Pending requests</h3>

              <div className="mt-2 space-y-2">
                {outgoing.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No pending requests
                  </p>
                )}

                {outgoing.map((req) => (
                  <RequestRow
                    key={req.id}
                    name={req.addressee_name}
                    image={(req as any).addressee_profile_image_url}
                    status={req.status}
                    onClick={() => {
                      void openProfileOptimistic(req.addressee_id, {
                        name: req.addressee_name,
                        profile_image_url: (req as any).addressee_profile_image_url,
                      });
                    }}
                  />
                ))}
              </div>
            </section>

            {/* friends */}

            <section>
              <h3 className="text-sm font-medium">Friends</h3>

              <div className="mt-2 space-y-2">
                {accepted.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No friends yet
                  </p>
                )}

                {accepted.map((f) => {
                  const me = currentUserId;

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
                      onClick={() => {
                        void openProfileOptimistic(otherId, {
                          name: otherName,
                          profile_image_url: otherImage,
                        });
                      }}
                    />
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>

      {selectedProfile && (
        <UserProfileModal
          profile={selectedProfile}
          onClose={() => {
            activeProfileRequestIdRef.current += 1;
            setSelectedProfile(null);
          }}
          onSelectTrip={(tripId) => {
            onSelectTrip?.(tripId);
            onClose();
          }}
          canEditProfile={false}
        />
      )}
    </>
  );
}