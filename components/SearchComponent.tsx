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

// ------------------------------------------------------
// CONSTANTS & HELPERS
// ------------------------------------------------------

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
// MAIN COMPONENT — Option A (horizontal strip on desktop)
// ------------------------------------------------------

const SearchComponent = memo(function SearchComponent({ user }: { user: PartialProfile }) {
  const router = useRouter();

  // state
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"rooms" | "users">("rooms");
  const [userResults, setUserResults] = useState<PartialProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [debounced] = useDebounce(query, 300);

  // store
  const rooms = useAvailableRooms();
  const presence = useRoomPresence();
  const { joinRoom, leaveRoom } = useRoomActions();

  // filter rooms
  const filteredRooms = useMemo(() => {
    if (!debounced.trim()) return rooms;
    const q = debounced.toLowerCase();
    return rooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, debounced]);

  // fetch users
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

  // actions
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

  // Room card
  const RoomCard = ({ room }: { room: Room }) => {
    const online = presence?.[room.id]?.onlineUsers ?? 0;
    const members = room.memberCount ?? 0;

    return (
      <Card className="flex flex-col h-full min-h-[18rem] md:min-h-[20rem] md:min-w-[20rem] rounded-2xl shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="h-20 bg-gradient-to-br from-indigo-500/20 to-indigo-700/30 p-4 flex items-center justify-between">
          <p className="text-lg md:text-xl font-semibold truncate flex items-center gap-2">
            #{highlight(room.name, debounced)}
            {room.is_private && <LockIcon className="h-4 w-4 text-muted-foreground" />}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col justify-between flex-1 p-4 md:p-6">
          <div className="space-y-3 text-sm md:text-base">
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
              <span className="text-xs md:text-sm font-medium bg-yellow-400/20 px-2 py-1 rounded-md text-yellow-700">
                Pending approval
              </span>
            )}

            
          </div>

          <div className="flex flex-col gap-2 mt-4">
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

  // User card
  const UserCard = (u: PartialProfile) => {
    const initial = (u.display_name ?? u.username ?? "?")[0]?.toUpperCase();
    return (
      <Card className="flex items-center gap-4 p-4 rounded-xl min-w-[14rem] md:min-w-[16rem]">
        <Avatar className="h-12 w-12 rounded-lg">
          {u.avatar_url ? (
            <AvatarImage src={u.avatar_url} alt={u.display_name ?? "User"} className="object-cover" />
          ) : (
            <AvatarFallback className="bg-indigo-600 text-white text-lg">{initial}</AvatarFallback>
          )}
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base md:text-lg truncate">{highlight(u.display_name ?? u.username ?? "Unknown", debounced)}</p>
          <p className="text-sm md:text-base text-muted-foreground">@{u.username}</p>
        </div>

        <Button size="sm" variant="secondary" onClick={() => router.push(`/profile/${u.id}`)}>
          View
        </Button>
      </Card>
    );
  };

  // main render
  return (
    <div className="w-full max-w-7xl mx-auto p-6 min-h-0 h-full flex flex-col text-base md:text-lg">
      {/* Search + Tabs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 flex-shrink-0">
        <div className="relative flex-1 w-full sm:w-auto">
          <Input
            className="pl-10 h-12 rounded-xl text-base md:text-lg"
            placeholder="Search rooms or users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "rooms" | "users")} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
            <TabsTrigger value="rooms" className="rounded-lg">Rooms</TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg">Users</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content area: single scroll behavior that adapts */}
      <div
        className={`flex-1 min-h-0 ${
          tab === "rooms" ? "overflow-y-auto md:overflow-x-auto" : "overflow-x-auto"
        } scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent`}
        aria-live="polite"
      >
        <AnimatePresence mode="wait">
          {/* Rooms: Mobile = vertical stack (column), Desktop (md+) = horizontal scroll single row */}
          {tab === "rooms" && (
            <motion.div key="rooms-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-2">
              {filteredRooms.length === 0 ? (
                <div className="h-full flex items-center justify-center py-12">
                  <p className="text-muted-foreground text-base">No rooms found.</p>
                </div>
              ) : (
                <div
                  className="
                    md:flex md:flex-row md:items-stretch md:gap-6 md:py-4 md:px-2
                    flex flex-col gap-4 px-2 py-2
                    "
                >
                  {/* For desktop: horizontal scroll container — set card min-width so they form a strip */}
                  <div className="md:flex md:flex-row md:space-x-6 md:overflow-x-auto md:pb-4 w-full">
                    {filteredRooms.map((room) => (
                      <motion.div key={room.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="md:min-w-[20rem] flex-shrink-0">
                        <RoomCard room={room} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Users: always horizontal scroll with card views (mobile + desktop) */}
          {tab === "users" && (
            <motion.div key="users-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-2">
              {loadingUsers ? (
                <div className="h-full flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Loading users…</p>
                </div>
              ) : userResults.length === 0 ? (
                <div className="h-full flex items-center justify-center py-12">
                  <p className="text-muted-foreground">No users found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto py-2 px-2">
                  <div className="flex gap-4 md:gap-6 items-start">
                    {userResults.map((u) => (
                      <motion.div key={u.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                        <UserCard {...u} />
                      </motion.div>
                    ))}
                  </div>
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
