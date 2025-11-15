"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { Users as UsersIcon, Lock as LockIcon, Search as SearchIcon, LogOut } from "lucide-react";

import { useAvailableRooms, useRoomActions, useRoomPresence, fetchAllUsers, type Room } from "@/lib/store/RoomContext";

import { useDebounce } from "use-debounce";
import { toast } from "sonner";

/*
Device size mapping & scroll direction (applies to layout below):

- Mobile (<= 639px / Tailwind `sm` breakpoint):
  - Rooms: vertical scroll (column). User scroll: horizontal (card strip) — as requested.
  - Reason: mobile users expect vertical lists for large content, but user cards work great as a horizontal carousel.

- Tablet (640px - 1023px / Tailwind `md` breakpoint at 768px):
  - Rooms: switches to horizontal strip at `md` (>=768px). Below `md` remains vertical.
  - Users: horizontal strip (same as mobile) — bigger card sizes.

- Desktop (>= 1024px / Tailwind `lg` and above):
  - Rooms: horizontal strip with larger cards, scrolling along X-axis.
  - Users: horizontal strip — same behavior as tablet but with larger dimensions.

Notes:
- Implementation uses `md` breakpoint (>=768px) to toggle rooms to horizontal mode (Option A).
- Users are horizontal on all sizes.
- All font sizes use rem-based Tailwind utilities: `text-base`, `md:text-lg`, etc.
- Cards have `min-width` set so horizontal scrolling forms a strip.
- There is a single main scrolling container per tab to avoid nested double scrolls.
*/

// ------------------------------------------------------
// TYPES — mapped from your Supabase schema
// ------------------------------------------------------

type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const highlight = (text: string, q: string) => {
  if (!q) return text;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <span className="bg-yellow-300/40 dark:bg-yellow-700/40 px-1 rounded-sm">
        {text.slice(index, index + q.length)}
      </span>
      {text.slice(index + q.length)}
    </>
  );
};

// ------------------------------------------------------
// COMPONENT
// ------------------------------------------------------

const SearchComponent = memo(function SearchComponent({ user }: { user: PartialProfile }) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"rooms" | "users">("rooms");
  const [userResults, setUserResults] = useState<PartialProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [debounced] = useDebounce(query, 300);

  const rooms = useAvailableRooms();
  const presence = useRoomPresence();
  const { joinRoom, leaveRoom } = useRoomActions();

  const filteredRooms = useMemo(() => {
    if (!debounced.trim()) return rooms;
    const q = debounced.toLowerCase();
    return rooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, debounced]);

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
      } catch (e) {
        toast.error("Failed loading users");
      }
      setLoadingUsers(false);
    })();
    return () => {
      active = false;
    };
  }, [tab, debounced]);

  const handleJoin = useCallback(
    async (roomId: string) => {
      if (!UUID_REGEX.test(roomId)) return toast.error("Invalid room ID");
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

  // Room card: min-width so horizontal strip forms
  const RoomCard = ({ room }: { room: Room }) => {
    const online = presence?.[room.id]?.onlineUsers ?? 0;
    const members = room.memberCount ?? 0;

    return (
      <Card className="flex flex-col h-full min-h-[16rem] md:min-h-[20rem] md:min-w-[22rem] rounded-2xl shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="h-20 bg-gradient-to-br from-indigo-500/20 to-indigo-700/30 p-4 flex items-center justify-between">
          <p className="text-base md:text-lg font-semibold truncate flex items-center gap-2">
            #{highlight(room.name, debounced)}
            {room.is_private && <LockIcon className="h-4 w-4 text-muted-foreground" />}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col justify-between flex-1 p-3 md:p-5">
          <div className="space-y-2 text-sm md:text-base">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{members} members</span>
              {online > 0 && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 ml-2 text-xs md:text-sm">
                  <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  {online} online
                </span>
              )}
            </div>

            {room.participationStatus === "pending" && (
              <span className="text-xs md:text-sm font-medium bg-yellow-400/20 px-2 py-1 rounded-md text-yellow-700">Pending approval</span>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-3">
            {room.isMember ? (
              <>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => router.push(`/rooms/${room.id}`)}>
                  Open Room
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleLeave(room.id)}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave
                </Button>
              </>
            ) : (
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => handleJoin(room.id)}>
                Join Room
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // User card: fixed min width to create carousel on horizontal scroll
  const UserCard = (u: PartialProfile) => {
    const initial = (u.display_name ?? u.username ?? "?")[0]?.toUpperCase();
    return (
      <Card className="flex flex-col items-center justify-between p-3 rounded-xl aspect-[3/4] min-w-[10rem] md:min-w-[12rem] max-w-[12rem]">
        <Avatar className="h-16 w-16 rounded-lg mb-3">
          {u.avatar_url ? (
            <AvatarImage src={u.avatar_url} alt={u.display_name ?? "User"} className="object-cover" />
          ) : (
            <AvatarFallback className="bg-indigo-600 text-white text-lg">{initial}</AvatarFallback>
          )}
        </Avatar>
        <div className="min-w-0 w-full text-center">
          <p className="font-semibold text-sm md:text-base truncate">{highlight(u.display_name ?? u.username ?? "Unknown", debounced)}</p>
          <p className="text-xs md:text-sm text-muted-foreground">@{u.username}</p>
        </div>
        <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => router.push(`/profile/${u.id}`)}>
          View
        </Button>
      </Card>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 min-h-0 h-full flex flex-col text-sm md:text-base lg:text-lg">
      {/* Search + Tabs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 flex-shrink-0">
        <div className="relative flex-1 w-full sm:w-auto">
          <Input className="pl-10 h-12 rounded-xl text-sm md:text-base" placeholder="Search rooms or users…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "rooms" | "users")} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
            <TabsTrigger value="rooms" className="rounded-lg">Rooms</TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg">Users</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content container: single-scroll-per-tab strategy */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {/* ROOMS TAB */}
          {tab === "rooms" && (
            <motion.section
              key="rooms-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              {filteredRooms.length === 0 ? (
                <div className="h-full flex items-center justify-center py-12">
                  <p className="text-muted-foreground">No rooms found.</p>
                </div>
              ) : (
                <>
                  {/* Mobile: vertical scroll (Y) */}
                  <div className="block md:hidden h-[80vh] overflow-y-auto custom-scrollbar-y py-2">
                    <div className="flex flex-col gap-4 px-2 py-2">
                      {filteredRooms.map((room) => (
                        <motion.div
                          key={room.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                        >
                          <RoomCard room={room} />
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Large devices: horizontal scroll (X) */}
                  <div className="hidden md:block w-full overflow-x-auto custom-scrollbar-x py-4">
                    <div className="flex gap-4 md:gap-6 px-2 md:px-4 items-stretch max-w-full overflow-hidden">
                      {filteredRooms.map((room) => (
                        <motion.div
                          key={room.id}
                          layout
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          className="flex-shrink-0"
                        >
                          <RoomCard room={room} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.section>
          )}

          {/* USERS TAB — Always horizontal scroll */}
          {tab === "users" && (
            <motion.section
              key="users-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-[80vw] "
            >
              {loadingUsers ? (
                <div className="h-full flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Loading users…</p>
                </div>
              ) : userResults.length === 0 ? (
                <div className="h-full flex items-center justify-center py-12">
                  <p className="text-muted-foreground">No users found.</p>
                </div>
              ) : (
                <div className="w-full  py-3">
                  <div className=" w-full flex md:flex-col gap-4 md:gap-6 px-2 md:px-4 items-start  overflow-x-auto md:overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    {userResults.map((u) => (
                      <motion.div
                        key={u.id}
                        layout
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        className="flex-shrink-0"
                      >
                        <UserCard {...u} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

SearchComponent.displayName = "SearchComponent";
export default SearchComponent;
