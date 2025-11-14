"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from "react";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import {
  Users as UsersIcon,
  Lock as LockIcon,
  Search as SearchIcon,
  LogOut,
} from "lucide-react";

import {
  useAvailableRooms,
  useRoomActions,
  useRoomPresence,
  fetchAllUsers,
  type Room,
} from "@/lib/store/RoomContext";

import { useDebounce } from "use-debounce";
import { toast } from "sonner";

//
// ------------------------------------------------------
// TYPES — mapped from your Supabase schema
// ------------------------------------------------------
//

type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

//
// ------------------------------------------------------
// UTILITY HELPERS
// ------------------------------------------------------
//

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const highlight = (text: string, q: string) => {
  if (!q) return text;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <span className="bg-yellow-300/40 dark:bg-yellow-700/40 px-[0.2rem] rounded-sm">
        {text.slice(index, index + q.length)}
      </span>
      {text.slice(index + q.length)}
    </>
  );
};

// Custom scrollbar styles as CSS-in-JS
const scrollbarStyles = {
  scrollbar: `
    /* Firefox */
    scrollbar-width: thin;
    scrollbar-color: rgb(75 85 99) transparent;
    
    /* WebKit */
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background-color: rgb(75 85 99);
      border-radius: 3px;
    }
    &::-webkit-scrollbar-thumb:hover {
      background-color: rgb(107 114 128);
    }
  `,
};

//
// ------------------------------------------------------
// MAIN COMPONENT — premium grade
// ------------------------------------------------------
//

const SearchComponent = memo(function SearchComponent({
  user,
}: {
  user: PartialProfile;
}) {
  const router = useRouter();

  //
  // ------------------------------------------------------
  // STATE
  // ------------------------------------------------------
  //
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"rooms" | "users">("rooms");
  const [userResults, setUserResults] = useState<PartialProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [debounced] = useDebounce(query, 300);

  //
  // ------------------------------------------------------
  // STORE DATA
  // ------------------------------------------------------
  //
  const rooms = useAvailableRooms();
  const presence = useRoomPresence();
  const { joinRoom, leaveRoom } = useRoomActions();

  //
  // ------------------------------------------------------
  // FILTER ROOMS (optimized)
  // ------------------------------------------------------
  //
  const filteredRooms = useMemo(() => {
    if (!debounced.trim()) return rooms;
    const q = debounced.toLowerCase();

    return rooms.filter((room) =>
      room.name.toLowerCase().includes(q)
    );
  }, [rooms, debounced]);

  //
  // ------------------------------------------------------
  // FETCH USERS (optimized, safe, typed)
  // ------------------------------------------------------
  //
  useEffect(() => {
    if (tab !== "users") return;

    let active = true;

    (async () => {
      setLoadingUsers(true);

      try {
        const users = (await fetchAllUsers()) as PartialProfile[];
        const q = debounced.toLowerCase();

        const results = !debounced.trim()
          ? users
          : users.filter(
              (u) =>
                u.username?.toLowerCase().includes(q) ||
                u.display_name?.toLowerCase().includes(q)
            );

        if (active) setUserResults(results);
      } catch {
        toast.error("Failed loading users");
      }

      setLoadingUsers(false);
    })();

    return () => {
      active = false;
    };
  }, [tab, debounced]);

  //
  // ------------------------------------------------------
  // ROOM ACTIONS
  // ------------------------------------------------------
  //

  const handleJoin = useCallback(
    async (roomId: string) => {
      if (!UUID_REGEX.test(roomId))
        return toast.error("Invalid room ID");

      try {
        await joinRoom(roomId);
      } catch (err: unknown) {
        toast.error((err as Error)?.message ?? "Failed to join");
      }
    },
    [joinRoom]
  );

  const handleLeave = useCallback(
    async (roomId: string) => {
      try {
        await leaveRoom(roomId);
      } catch (err: unknown) {
        toast.error((err as Error)?.message ?? "Failed to leave");
      }
    },
    [leaveRoom]
  );

  //
  // ------------------------------------------------------
  // ROOM CARD — premium shadcn style
  // ------------------------------------------------------
  //
  const RoomCard = ({ room }: { room: Room }) => {
    const online = presence?.[room.id]?.onlineUsers ?? 0;
    const members = room.memberCount ?? 0;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="
          flex flex-col rounded-2xl bg-card border shadow-sm 
          overflow-hidden min-w-[18rem] md:min-w-0
          aspect-[3/4] hover:border-indigo-300/50 dark:hover:border-indigo-600/50
          transition-colors duration-200
        "
      >
        {/* Header */}
        <div className="h-[5rem] bg-gradient-to-br from-indigo-500/20 to-indigo-700/30 p-[1rem] flex items-center justify-between">
          <p className="text-[1.15rem] font-semibold truncate flex items-center gap-[0.4rem]">
            #{highlight(room.name, debounced)}
            {room.is_private && (
              <LockIcon className="h-[1rem] w-[1rem] text-muted-foreground" />
            )}
          </p>
        </div>

        {/* Body */}
        <div className="flex flex-col justify-between flex-1 p-[1.2rem]">
          <div className="space-y-[0.7rem]">
            {/* Members */}
            <div className="flex items-center gap-[0.6rem] text-[0.9rem]">
              <UsersIcon className="h-[1.1rem] w-[1.1rem] text-muted-foreground" />
              <span className="font-medium">{members} members</span>

              {online > 0 && (
                <span className="flex items-center gap-[0.3rem] text-green-600 dark:text-green-400 ml-[0.4rem] text-[0.85rem]">
                  <span className="h-[0.5rem] w-[0.5rem] bg-green-500 rounded-full animate-pulse" />
                  {online} online
                </span>
              )}
            </div>

            {room.participationStatus === "pending" && (
              <span className="text-[0.8rem] font-medium bg-yellow-400/20 px-[0.5rem] py-[0.2rem] rounded-md text-yellow-700">
                Pending approval
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col mt-[1rem] gap-[0.6rem]">
            {room.isMember ? (
              <>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                  onClick={() => router.push(`/rooms/${room.id}`)}
                >
                  Open Room
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  onClick={() => handleLeave(room.id)}
                >
                  <LogOut className="h-[1rem] w-[1rem] mr-[0.4rem]" />
                  Leave
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                onClick={() => handleJoin(room.id)}
              >
                Join Room
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  //
  // ------------------------------------------------------
  // USER CARD — premium
  // ------------------------------------------------------
  //
  const UserCard = (u: PartialProfile) => {
    const initial =
      (u.display_name ?? u.username ?? "?")[0]?.toUpperCase();

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="
          flex items-center gap-[1rem] p-[1rem] border bg-card
          rounded-xl shadow-sm hover:shadow-md hover:border-indigo-300/50 
          dark:hover:border-indigo-600/50 transition-all
        "
      >
        <Avatar className="h-[3rem] w-[3rem] rounded-xl">
          {u.avatar_url ? (
            <AvatarImage
              src={u.avatar_url}
              alt={u.display_name ?? "User"}
              className="object-cover"
            />
          ) : (
            <AvatarFallback className="bg-indigo-600 text-white text-[1.2rem]">
              {initial}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="min-w-0">
          <p className="font-semibold text-[1rem] truncate">
            {highlight(u.display_name ?? u.username ?? "Unknown", debounced)}
          </p>
          <p className="text-[0.85rem] text-muted-foreground">
            @{u.username}
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          className="ml-auto text-[0.85rem] px-[1rem] hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/20 transition-colors"
          onClick={() => router.push(`/profile/${u.id}`)}
        >
          View
        </Button>
      </motion.div>
    );
  };

  //
  // ------------------------------------------------------
  // RENDER UI — premium layout
  // ------------------------------------------------------
  //

  return (
    <div className="w-full max-w-[80rem] mx-auto p-[1.5rem] min-h-0 h-full flex flex-col">

      {/* Search + Tabs */}
      <div className="flex items-center gap-[1rem] mb-[2rem] flex-shrink-0">
        <div className="relative flex-1">
          <Input
            className="pl-[2.4rem] h-[3rem] rounded-xl text-[1rem]"
            placeholder="Search rooms or users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SearchIcon className="absolute left-[0.9rem] top-1/2 -translate-y-1/2 text-muted-foreground h-[1.2rem] w-[1.2rem]" />
        </div>

        {/* Desktop Tabs */}
        <div className="hidden md:flex gap-[0.6rem] flex-shrink-0">
          <Button
            variant={tab === "rooms" ? "default" : "ghost"}
            onClick={() => setTab("rooms")}
            className="rounded-xl px-[1.2rem] hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/20 transition-colors"
          >
            Rooms
          </Button>
          <Button
            variant={tab === "users" ? "default" : "ghost"}
            onClick={() => setTab("users")}
            className="rounded-xl px-[1.2rem] hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/20 transition-colors"
          >
            Users
          </Button>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden flex gap-[0.6rem] mb-[1rem] flex-shrink-0">
        <button
          onClick={() => setTab("rooms")}
          className={`flex-1 py-[0.7rem] rounded-xl text-[1rem] transition-colors ${
            tab === "rooms" 
              ? "bg-indigo-500/20 text-indigo-500" 
              : "bg-muted/20 hover:bg-muted/30"
          }`}
        >
          Rooms
        </button>

        <button
          onClick={() => setTab("users")}
          className={`flex-1 py-[0.7rem] rounded-xl text-[1rem] transition-colors ${
            tab === "users" 
              ? "bg-indigo-500/20 text-indigo-500" 
              : "bg-muted/20 hover:bg-muted/30"
          }`}
        >
          Users
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Animated Tab Content */}
        <AnimatePresence mode="wait">
          {/* ROOMS */}
          {tab === "rooms" && (
            <motion.div
              key="rooms-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              {filteredRooms.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground text-[1rem]">
                    No rooms found.
                  </p>
                </div>
              ) : (
                <div
                  className="
                    h-full overflow-y-auto
                    grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
                    gap-[1.5rem] content-start
                    max-md:grid-cols-1 max-md:overflow-x-visible
                  "
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgb(75 85 99) transparent',
                  }}
                  // Apply CSS via style tag
                  dangerouslySetInnerHTML={{
                    __html: `
                      <style>
                        .rooms-grid::-webkit-scrollbar {
                          width: 6px;
                        }
                        .rooms-grid::-webkit-scrollbar-track {
                          background: transparent;
                        }
                        .rooms-grid::-webkit-scrollbar-thumb {
                          background-color: rgb(75 85 99);
                          border-radius: 3px;
                        }
                        .rooms-grid::-webkit-scrollbar-thumb:hover {
                          background-color: rgb(107 114 128);
                        }
                      </style>
                    `,
                  }}
                >
                  {filteredRooms.map((room) => (
                    <div key={room.id} className="break-inside-avoid">
                      <RoomCard room={room} />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* USERS */}
          {tab === "users" && (
            <motion.div
              key="users-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              {loadingUsers ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">
                    Loading users…
                  </p>
                </div>
              ) : userResults.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">
                    No users found.
                  </p>
                </div>
              ) : (
                <div 
                  className="
                    h-full overflow-y-auto
                    grid gap-[1rem] content-start
                  "
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgb(75 85 99) transparent',
                  }}
                  // Apply CSS via style tag
                  dangerouslySetInnerHTML={{
                    __html: `
                      <style>
                        .users-grid::-webkit-scrollbar {
                          width: 6px;
                        }
                        .users-grid::-webkit-scrollbar-track {
                          background: transparent;
                        }
                        .users-grid::-webkit-scrollbar-thumb {
                          background-color: rgb(75 85 99);
                          border-radius: 3px;
                        }
                        .users-grid::-webkit-scrollbar-thumb:hover {
                          background-color: rgb(107 114 128);
                        }
                      </style>
                    `,
                  }}
                >
                  {userResults.map((u) => (
                    <UserCard key={u.id} {...u} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

SearchComponent.displayName = "SearchComponent";
export default SearchComponent;