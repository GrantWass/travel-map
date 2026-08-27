"use client";

import { CircleUser, Map, Notebook, Plus, Search, Users } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileDestination = "explore" | "search" | "plans" | "friends" | "profile";

interface MobileNavigationProps {
  active: MobileDestination;
  onExplore: () => void;
  onSearch: () => void;
  onPlans: () => void;
  onAddTrip: () => void;
  onFriends: () => void;
  onProfile: () => void;
}

const ITEMS = [
  { id: "explore", label: "Explore", icon: Map },
  { id: "search", label: "Search", icon: Search },
  { id: "add", label: "Add trip", icon: Plus },
  { id: "plans", label: "Plans", icon: Notebook },
  { id: "friends", label: "Friends", icon: Users },
  { id: "profile", label: "Profile", icon: CircleUser },
] as const;

export default function MobileNavigation(props: MobileNavigationProps) {
  const handlers = {
    explore: props.onExplore,
    search: props.onSearch,
    add: props.onAddTrip,
    plans: props.onPlans,
    friends: props.onFriends,
    profile: props.onProfile,
  };

  return (
    <nav aria-label="Primary navigation" className="app-surface fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[1400] grid h-16 grid-cols-6 rounded-2xl px-1 md:hidden">
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const isAdd = id === "add";
        const isActive = id === props.active;
        return (
          <button
            key={id}
            type="button"
            onClick={handlers[id]}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              isActive && "text-primary",
              isAdd && "-mt-4",
            )}
          >
            <span className={cn("flex h-7 w-9 items-center justify-center rounded-xl", isAdd && "h-11 w-11 bg-primary text-primary-foreground shadow-lg shadow-primary/20")}>
              <Icon className={cn("h-5 w-5", isAdd && "h-6 w-6")} />
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
