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
      <span className="bg-yellow-300/40 dark:bg-yellow-700/40 px-1 rounded-sm">
        {text.slice(index, index + q.length)}
      </span>
      {text.slice(index + q.length)}
    </>
  );
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
      <Card className="flex flex-col h-full overflow-hidden hover:border-indigo-300/50 dark:hover:border-indigo-600/50 transition-colors duration-200">
        <CardHeader className="h-20 bg-gradient-to-br from-indigo-500/20 to-indigo-700/30 p-4 flex items-center justify-between">
          <p className="text-lg font-semibold truncate flex items-center gap-2">
            #{highlight(room.name, debounced)}
            {room.is_private && (
              <LockIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col justify-between flex-1 p-6">
          <div className="space-y-3">
            {/* Members */}
            <div className="flex items-center gap-2 text-sm">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{members} members</span>

              {online > 0 && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 ml-2 text-xs">
                  <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  {online} online
                </span>
              )}
            </div>

            {room.participationStatus === "pending" && (
              <span className="text-xs font-medium bg-yellow-400/20 px-2 py-1 rounded-md text-yellow-700">
                Pending approval
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col mt-4 gap-2">
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
                  <LogOut className="h-4 w-4 mr-2" />
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
        </CardContent>
      </Card>
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
      <Card className="flex items-center gap-4 p-4 hover:border-indigo-300/50 dark:hover:border-indigo-600/50 transition-all">
        <Avatar className="h-12 w-12 rounded-xl">
          {u.avatar_url ? (
            <AvatarImage
              src={u.avatar_url}
              alt={u.display_name ?? "User"}
              className="object-cover"
            />
          ) : (
            <AvatarFallback className="bg-indigo-600 text-white text-lg">
              {initial}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base truncate">
            {highlight(u.display_name ?? u.username ?? "Unknown", debounced)}
          </p>
          <p className="text-sm text-muted-foreground">
            @{u.username}
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          className="hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/20 transition-colors"
          onClick={() => router.push(`/profile/${u.id}`)}
        >
          View
        </Button>
      </Card>
    );
  };

  //
  // ------------------------------------------------------
  // RENDER UI — premium layout
  // ------------------------------------------------------
  //

  return (
    <div className="w-full max-w-7xl mx-auto p-6 min-h-0 h-full flex flex-col">

      {/* Search + Tabs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 flex-shrink-0">
        <div className="relative flex-1 w-full sm:w-auto">
          <Input
            className="pl-10 h-12 rounded-xl text-base"
            placeholder="Search rooms or users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
        </div>

        {/* Tabs - Using shadcn Tabs component */}
        <Tabs value={tab} onValueChange={(value) => setTab(value as "rooms" | "users")} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
            <TabsTrigger value="rooms" className="rounded-lg">
              Rooms
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg">
              Users
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Scrollable Content Area - Scrollbar applied here */}
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
              className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
            >
              {filteredRooms.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground text-base">
                    No rooms found.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
                  {filteredRooms.map((room) => (
                    <motion.div
                      key={room.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="h-80" // Fixed height for consistent cards
                    >
                      <RoomCard room={room} />
                    </motion.div>
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
              className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
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
                <div className="grid gap-4 pb-6">
                  {userResults.map((u) => (
                    <motion.div
                      key={u.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                    >
                      <UserCard {...u} />
                    </motion.div>
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