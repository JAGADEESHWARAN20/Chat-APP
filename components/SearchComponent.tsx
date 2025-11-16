"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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

type PartialProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const highlight = (text: string, q: string) => {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-yellow-300/40 dark:bg-yellow-700/40 px-1 rounded-sm">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
};

const SearchComponent = memo(function SearchComponent({
  user,
}: {
  user: PartialProfile;
}) {
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

    let isActive = true;

    (async () => {
      setLoadingUsers(true);
      try {
        const all = (await fetchAllUsers()) as PartialProfile[];
        const q = debounced.toLowerCase();

        const list = !debounced.trim()
          ? all
          : all.filter(
              (u) =>
                u.username?.toLowerCase().includes(q) ||
                u.display_name?.toLowerCase().includes(q)
            );

        if (isActive) setUserResults(list);
      } catch (err) {
        toast.error("Failed loading users");
      }
      setLoadingUsers(false);
    })();

    return () => {
      isActive = false;
    };
  }, [tab, debounced]);

  const handleJoin = useCallback(
    async (roomId: string) => {
      if (!UUID_REGEX.test(roomId)) return toast.error("Invalid room ID");
      try {
        await joinRoom(roomId);
      } catch (err) {
        toast.error((err as Error)?.message ?? "Failed to join");
      }
    },
    [joinRoom]
  );

  const handleLeave = useCallback(
    async (roomId: string) => {
      try {
        await leaveRoom(roomId);
      } catch (err) {
        toast.error((err as Error)?.message ?? "Failed to leave");
      }
    },
    [leaveRoom]
  );

  /* ========================================================= */
  /* ROOM CARD (Dark/Light Optimized)                          */
  /* ========================================================= */
  const RoomCard = ({ room }: { room: Room }) => {
    const online = presence?.[room.id]?.onlineUsers ?? 0;
    const members = room.memberCount ?? 0;

    return (
      <Card className="
        flex items-center h-[20vh] min-w-[16rem] md:min-w-[22rem]
        rounded-2xl shadow-sm transition-all
        bg-card/80 backdrop-blur-sm 
        border border-border hover:border-primary/40
      ">
        <CardHeader className="
          w-[12em] h-full 
          bg-gradient-to-br 
          from-indigo-500/20 to-indigo-700/40 
          rounded-md
          flex items-center
        ">
          <p className="text-base md:text-lg font-semibold truncate flex items-center gap-2">
            #{highlight(room.name, debounced)}
            {room.is_private && (
              <LockIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col justify-between flex-1 p-4">
          <div className="space-y-2 text-sm md:text-base">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{members} members</span>

              {online > 0 && (
                <span className="flex items-center gap-1 text-green-500 ml-2 text-xs md:text-sm font-medium">
                  <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  {online} online
                </span>
              )}
            </div>

            {room.participationStatus === "pending" && (
              <span className="
                text-xs font-medium 
                bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 
                px-2 py-1 rounded-md
              ">
                Pending approval
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {room.isMember ? (
              <>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => router.push(`/rooms/${room.id}`)}
                >
                  Open Room
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 dark:text-red-400 hover:text-red-700"
                  onClick={() => handleLeave(room.id)}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => handleJoin(room.id)}
              >
                Join Room
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  /* ========================================================= */
  /* USER CARD (Dark/Light Optimized)                          */
  /* ========================================================= */
  const UserCard = (u: PartialProfile) => {
    const first = (u.display_name ?? u.username ?? "?")[0]?.toUpperCase();

    return (
      <Card className="
        flex items-center gap-6 justify-start p-4 w-full h-[15em]
        rounded-xl bg-card backdrop-blur-sm 
        border border-border hover:border-primary/40 hover:bg-card/60
        transition-all
      ">
        <Avatar className="h-[10em] w-[10em] rounded-xl">
          {u.avatar_url ? (
            <AvatarImage
              src={u.avatar_url}
              alt={u.display_name ?? "User"}
              className="object-cover"
            />
          ) : (
            <AvatarFallback className="bg-indigo-600 text-white text-lg">
              {first}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="min-w-0 text-left">
          <p className="font-semibold text-base md:text-lg truncate">
            {highlight(u.display_name ?? u.username ?? "Unknown", debounced)}
          </p>
          <p className="text-xs text-muted-foreground">@{u.username}</p>

          <Button
            size="sm"
            variant="secondary"
            className="w-full mt-4"
            onClick={() => router.push(`/profile/${u.id}`)}
          >
            View
          </Button>
        </div>
      </Card>
    );
  };

  /* ========================================================= */
  /* MAIN UI - Dark/Light Ready                                */
  /* ========================================================= */
  return (
    <div className="w-full mx-auto p-4 md:p-6 h-full flex flex-col overflow-hidden bg-background">
      
      {/* Search Bar + Tabs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 flex-shrink-0">
        <div className="relative flex-1">
          <Input
            className="pl-10 h-12 rounded-xl text-sm md:text-base bg-card border-border"
            placeholder="Search rooms or users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SearchIcon className="
            absolute left-3 top-1/2 -translate-y-1/2 
            text-muted-foreground h-5 w-5
          " />
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "rooms" | "users")}
          className="w-full sm:w-auto"
        >
         <TabsList className="grid grid-cols-2 w-full sm:w-auto bg-card border border-border rounded-xl">
  <TabsTrigger
    value="rooms"
    className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
  >
    Rooms
  </TabsTrigger>

  <TabsTrigger
    value="users"
    className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
  >
    Users
  </TabsTrigger>
</TabsList>

        </Tabs>
      </div>

      {/* Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">

        <AnimatePresence mode="wait">
          {/* ROOMS TAB */}
          {tab === "rooms" && (
            <motion.div
              key="rooms-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-hidden"
            >
              {filteredRooms.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No rooms found.
                </div>
              ) : (
                <>
                  {/* MOBILE VERTICAL */}
                  <div className="block md:hidden h-[80vh] pb-12 overflow-y-auto scrollbar-thin scroll-container">
                    <div className="flex flex-col gap-4 px-1 pb-4">
                      {filteredRooms.map((room) => (
                        <motion.div
                          key={room.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <RoomCard room={room} />
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* DESKTOP HORIZONTAL */}
                  <div className="hidden md:flex h-full overflow-x-auto scrollbar-custom overflow-y-hidden scroll-container">
                    <div className="flex gap-6 px-2 pb-6">
                      {filteredRooms.map((room) => (
                        <motion.div
                          key={room.id}
                          layout
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex-shrink-0"
                        >
                          <RoomCard room={room} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* USERS TAB */}
          {tab === "users" && (
            <motion.div
              key="users-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              {loadingUsers ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Loading users…
                </div>
              ) : userResults.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No users found.
                </div>
              ) : (
                <div className="h-[80vh] overflow-y-auto scrollbar-thin scroll-container pb-[6em]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-2">
                    {userResults.map((u) => (
                      <motion.div
                        key={u.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
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
