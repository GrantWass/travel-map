"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, UserPlus, Check, Slash, Copy, Link as LinkIcon, Users, Bell, Search } from "lucide-react";
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

type Tab = "friends" | "invites" | "discover";

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
      className="rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0"
    >
      {initials}
    </div>
  );
}

/* ---------------- Search Result Row ---------------- */

function SearchUserRow({
  user,
  isCurrentUser,
  requestBusy,
  relationStatus,
  onRequest,
  onClick,
}: {
  user: any;
  isCurrentUser: boolean;
  requestBusy: boolean;
  relationStatus: "none" | "friend" | "outgoing" | "incoming";
  onRequest: () => void;
  onClick: () => void;
}) {
  const statusLabel: Record<string, string> = {
    friend: "Friends",
    outgoing: "Requested",
    incoming: "Incoming",
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-start sm:justify-between">
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
        <Button size="sm" disabled className="w-full sm:w-auto opacity-50">
          You
        </Button>
      ) : relationStatus !== "none" ? (
        <Button size="sm" disabled className="w-full sm:w-auto opacity-50 cursor-not-allowed">
          {statusLabel[relationStatus]}
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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar name={name} image={image} />
        <button
          className="min-w-0 truncate text-left text-sm font-medium hover:underline"
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
        <span className="text-xs text-muted-foreground capitalize">{status}</span>
      )}
    </div>
  );
}

/* ================= Modal ================= */

export default function FriendsModal({ onClose, onSelectTrip }: FriendsModalProps) {
  const { incoming, outgoing, accepted, loaded, refresh } = useFriendsStore();

  const [activeTab, setActiveTab] = useState<Tab>("friends");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [requestBusy, setRequestBusy] = useState(false);

  const [inviteLink, setInviteLink] = useState("/signup");
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const activeProfileRequestIdRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const prevTabRef = useRef<Tab | null>(null);

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
      const res = await (await import("@/lib/api-client")).searchUsers(searchQuery);
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
      if (requestId !== activeProfileRequestIdRef.current) return;
      setSelectedProfile({ ...profileResponse.user, trips: profileResponse.trips });
    } catch {
      // Keep optimistic profile shown if hydration fails.
    }
  }

  /* -------- height animation -------- */

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const outer = bodyRef.current;
    if (!inner || !outer) return;

    const maxH = window.innerHeight * 0.4;
    const newH = Math.min(inner.scrollHeight, maxH);
    const isTabSwitch = prevTabRef.current !== null && prevTabRef.current !== activeTab;
    prevTabRef.current = activeTab;

    if (isTabSwitch) {
      // Pin to the current rendered height with no transition — this prevents
      // new (taller) content from overflowing before the animation starts.
      const currentH = outer.getBoundingClientRect().height;
      outer.style.transition = "none";
      outer.style.height = `${currentH}px`;
      outer.style.overflowY = "hidden";
      // Force a reflow so the browser registers currentH as the animation "from" state.
      void outer.offsetHeight;
      // Now enable transition and animate to the new height.
      outer.style.transition = "height 0.25s cubic-bezier(0.22, 1, 0.36, 1)";
      outer.style.height = `${newH}px`;
      // Restore scrolling after the transition finishes.
      const onEnd = () => {
        outer.style.overflowY = "auto";
        outer.removeEventListener("transitionend", onEnd);
      };
      outer.addEventListener("transitionend", onEnd);
    } else {
      outer.style.transition = "none";
      outer.style.height = `${newH}px`;
    }
  }, [activeTab]);

  useEffect(() => {
    const inner = innerRef.current;
    const outer = bodyRef.current;
    if (!inner || !outer) return;

    const ro = new ResizeObserver(() => {
      const maxH = window.innerHeight * 0.4;
      const newH = Math.min(inner.scrollHeight, maxH);
      outer.style.transition = "height 0.2s cubic-bezier(0.22, 1, 0.36, 1)";
      outer.style.height = `${newH}px`;
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [activeTab]);

  /* -------- relation lookup -------- */

  function getRelationStatus(userId: number): "none" | "friend" | "outgoing" | "incoming" {
    const me = currentUserId;
    if (accepted.some((f) => f.requester_id === userId || f.addressee_id === userId)) return "friend";
    if (outgoing.some((r) => r.addressee_id === userId)) return "outgoing";
    if (incoming.some((r) => r.requester_id === userId)) return "incoming";
    return "none";
  }

  /* -------- friends list -------- */

  const friendsList = accepted.map((f) => {
    const me = currentUserId;
    const otherId = me === f.requester_id ? f.addressee_id : f.requester_id;
    const otherName = me === f.requester_id ? f.addressee_name : f.requester_name;
    const otherImage =
      me === f.requester_id
        ? (f as any).addressee_profile_image_url
        : (f as any).requester_profile_image_url;
    return { id: f.id, otherId, otherName, otherImage };
  });

  const hasIncoming = incoming.length > 0;

  /* -------- tabs config -------- */

  const tabs: { key: Tab; label: string; icon: React.ReactNode; dot?: boolean }[] = [
    { key: "friends", label: "My Friends", icon: <Users className="h-4 w-4" /> },
    { key: "invites", label: "Invites", icon: <Bell className="h-4 w-4" />, dot: hasIncoming },
    { key: "discover", label: "Add Friends", icon: <Search className="h-4 w-4" /> },
  ];

  return (
    <>
      <div
        className="backdrop-fade fixed inset-0 z-[1500] bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="modal-expand-center fixed inset-3 z-[1600] flex max-h-[calc(100dvh-1.5rem)] flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[680px] sm:max-h-[88dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight">Friends</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* tab bar */}
        <div className="flex border-b border-border px-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-foreground border-b-2 border-primary -mb-px"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.dot && (
                <span className="absolute right-2 top-2.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </div>

        {/* body */}
        <div ref={bodyRef} className="overflow-y-auto overflow-x-hidden">
          <div ref={innerRef} key={activeTab} className="tab-enter">

          {/* ── Tab 1: Friends ── */}
          {activeTab === "friends" && (
            <div className="p-5 space-y-3">
              {friendsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No friends yet</p>
                  <p className="text-xs text-muted-foreground/70">
                    Head to the Discover tab to find and add friends.
                  </p>
                </div>
              ) : (
                friendsList.map((f, idx) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* number badge */}
                    <span className="shrink-0 w-6 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                      {idx + 1}
                    </span>
                    <UserAvatar name={f.otherName} image={f.otherImage} size={36} />
                    <button
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                      onClick={() =>
                        openProfileOptimistic(f.otherId, {
                          name: f.otherName,
                          profile_image_url: f.otherImage,
                        })
                      }
                    >
                      {f.otherName ?? "Unknown"}
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">Friend</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Tab 2: Invites (incoming requests) ── */}
          {activeTab === "invites" && (
            <div className="p-5 space-y-3">
              {incoming.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Bell className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No pending invites</p>
                  <p className="text-xs text-muted-foreground/70">
                    Friend requests you receive will appear here.
                  </p>
                </div>
              ) : (
                incoming.map((req) => (
                  <RequestRow
                    key={req.id}
                    name={req.requester_name}
                    image={(req as any).requester_profile_image_url}
                    onClick={() =>
                      openProfileOptimistic(req.requester_id, {
                        name: req.requester_name,
                        profile_image_url: (req as any).requester_profile_image_url,
                      })
                    }
                    onAccept={() => respond(req.id, "accepted")}
                    onDecline={() => respond(req.id, "declined")}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Tab 3: Discover (search + invite link + outgoing) ── */}
          {activeTab === "discover" && (
            <div className="p-5 space-y-6">
              {/* search */}
              <section>
                <h3 className="text-sm font-semibold mb-2">Find by name</h3>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users…"
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {searchResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {searchResults.map((u) => (
                      <SearchUserRow
                        key={u.user_id}
                        user={u}
                        isCurrentUser={u.user_id === currentUserId}
                        requestBusy={requestBusy}
                        relationStatus={getRelationStatus(u.user_id)}
                        onRequest={() => handleSendRequest(u.user_id)}
                        onClick={() =>
                          openProfileOptimistic(u.user_id, {
                            name: u.name,
                            profile_image_url: u.profile_image_url,
                            bio: u.bio,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* invite link */}
              <section>
                <h3 className="text-sm font-semibold mb-2">Invite link</h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex flex-1 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 h-10 text-sm text-muted-foreground">
                    <LinkIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {inviteLinkLoading ? "Generating…" : inviteLink}
                    </span>
                  </div>
                  <Button onClick={handleCopy} className="w-full sm:w-auto">
                    <Copy className="mr-2 h-4 w-4" />
                    {copyState === "copied" ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </section>

              {/* outgoing requests */}
              {outgoing.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-2">Sent requests</h3>
                  <div className="space-y-2">
                    {outgoing.map((req) => (
                      <RequestRow
                        key={req.id}
                        name={req.addressee_name}
                        image={(req as any).addressee_profile_image_url}
                        status={req.status}
                        onClick={() =>
                          openProfileOptimistic(req.addressee_id, {
                            name: req.addressee_name,
                            profile_image_url: (req as any).addressee_profile_image_url,
                          })
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
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
