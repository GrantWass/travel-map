import { create } from "zustand";
import { getFriendships } from "@/lib/api-client";
import type { FriendshipRecord } from "@/lib/api-types";

interface FriendsState {
  incoming: FriendshipRecord[];
  outgoing: FriendshipRecord[];
  accepted: FriendshipRecord[];
  loaded: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
}

export const useFriendsStore = create<FriendsState>((set) => ({
  incoming: [],
  outgoing: [],
  accepted: [],
  loaded: false,
  refresh: async () => {
    const data = await getFriendships();
    set({
      incoming: data.incoming ?? [],
      outgoing: data.outgoing ?? [],
      accepted: data.accepted ?? [],
      loaded: true,
    });
  },
  clear: () => set({ incoming: [], outgoing: [], accepted: [], loaded: false }),
}));
