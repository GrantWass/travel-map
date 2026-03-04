"use client";

import { useEffect, useState } from "react";
import { X, UserPlus, Phone, Check, Slash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSmsInvite, createFriendRequest, respondFriendRequest } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useFriendsStore } from "@/stores/friends-store";

interface FriendsModalProps {
  onClose: () => void;
}

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

  const load = async () => {
    setError(null);
    try {
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not load friends");
    }
  };

  // On open: if no cache yet, show loading; otherwise show cached data and
  // silently re-fetch in the background to pick up new requests.
  useEffect(() => {
    if (!loaded) {
      setRefreshing(true);
      void load().finally(() => setRefreshing(false));
    } else {
      void load();
    }
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

  // simple debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const id = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await (await import("@/lib/api-client")).searchUsers(searchQuery.trim());
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
    <div className="backdrop-fade fixed inset-0 z-[1500] bg-foreground/10 backdrop-blur-sm" onClick={onClose}>
      <div className="modal-expand fixed left-1/2 top-1/2 z-[1600] w-[min(720px,96vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">Friends</h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary hover:bg-border">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid gap-4">
            <section>
              <h3 className="text-sm font-medium">Invite via SMS</h3>
              <div className="mt-2 flex gap-2">
                <input value={phoneInput} onChange={(e) => { setPhoneInput(e.target.value); setPhoneError(null); }} placeholder="+15551234567" className="h-10 flex-1 rounded-md border border-input px-3" />
                <Button onClick={handleSendInvite} disabled={inviteBusy}>
                  <Phone className="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>
              {phoneError ? <div className="text-sm text-red-600 mt-2">{phoneError}</div> : null}
            </section>

            <section>
              <h3 className="text-sm font-medium">Find by name</h3>
              <div className="mt-2">
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search users by name" className="h-10 w-full rounded-md border border-input px-3" />
                {searchLoading ? <p className="text-sm text-muted-foreground">Searching…</p> : null}
                <div className="mt-2 grid gap-2">
                  {searchResults.map((u) => (
                      <div key={u.user_id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
                        <div className="flex items-start gap-3">
                          {u.profile_image_url ? (
                            <img src={u.profile_image_url} alt={`${u.name} avatar`} className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                              {((u.name || "").split(" ").filter(Boolean).map((p: string) => p[0]).join("").slice(0,2) || "?")}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <div className="text-sm font-medium">{u.name}</div>
                            {u.bio ? <div className="text-xs text-muted-foreground mt-1 max-w-lg truncate">{u.bio}</div> : null}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Button size="sm" onClick={() => void handleSendRequestToId(u.user_id)} disabled={requestBusy}>
                            <UserPlus className="mr-2 h-3.5 w-3.5" />Request
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium">Incoming requests</h3>
              <div className="mt-2 grid gap-2">
                {refreshing && !loaded ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
                {incoming.length === 0 && !(refreshing && !loaded) ? <p className="text-sm text-muted-foreground">No incoming requests.</p> : null}
                {incoming.map((req) => (
                  <div key={req.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                    <div className="text-sm">From {req.requester_name ?? `user ${req.requester_id}`}</div>
                    <div className="flex gap-2">
                      <Button onClick={() => void handleRespond(req.id, "accepted")}>
                        <Check className="mr-2 h-3.5 w-3.5" />Accept
                      </Button>
                      <Button variant="outline" onClick={() => void handleRespond(req.id, "declined")}>
                        <Slash className="mr-2 h-3.5 w-3.5" />Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium">Pending requests</h3>
              <div className="mt-2 grid gap-2">
                {outgoing.length === 0 ? <p className="text-sm text-muted-foreground">No pending requests.</p> : null}
                {outgoing.map((req) => (
                  <div key={req.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                    <div className="text-sm">To {req.addressee_name ?? `user ${req.addressee_id}`}</div>
                    <div className="text-xs text-muted-foreground">{req.status}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium">Friends</h3>
              <div className="mt-2 grid gap-2">
                {accepted.length === 0 ? <p className="text-sm text-muted-foreground">No friends yet.</p> : null}
                {accepted.map((f) => {
                  const me = useAuthStore.getState().user?.user_id ?? null;
                  const otherName = me === f.requester_id ? f.addressee_name : f.requester_name;
                  return (
                    <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                      <div className="text-sm">{otherName ?? `user ${me === f.requester_id ? f.addressee_id : f.requester_id}`}</div>
                      <div className="text-xs text-muted-foreground">Friends</div>
                    </div>
                  );
                })}
              </div>
            </section>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
