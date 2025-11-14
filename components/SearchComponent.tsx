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
          aspect-[3/4]
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
                  className="bg-indigo-600 text-white"
                  onClick={() => router.push(`/rooms/${room.id}`)}
                >
                  Open Room
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                  onClick={() => handleLeave(room.id)}
                >
                  <LogOut className="h-[1rem] w-[1rem] mr-[0.4rem]" />
                  Leave
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="bg-indigo-600 text-white"
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
          rounded-xl shadow-sm hover:shadow-md transition-all
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
          className="ml-auto text-[0.85rem] px-[1rem]"
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
    <div className="w-full max-w-[80rem] mx-auto p-[1.5rem]">

      {/* Search + Tabs */}
      <div className="flex items-center gap-[1rem] mb-[2rem]">
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
        <div className="hidden md:flex gap-[0.6rem]">
          <Button
            variant={tab === "rooms" ? "default" : "ghost"}
            onClick={() => setTab("rooms")}
            className="rounded-xl px-[1.2rem]"
          >
            Rooms
          </Button>
          <Button
            variant={tab === "users" ? "default" : "ghost"}
            onClick={() => setTab("users")}
            className="rounded-xl px-[1.2rem]"
          >
            Users
          </Button>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden flex gap-[0.6rem] mb-[1rem]">
        <button
          onClick={() => setTab("rooms")}
          className={`flex-1 py-[0.7rem] rounded-xl text-[1rem] ${
            tab === "rooms" ? "bg-indigo-500/20 text-indigo-500" : "bg-muted/20"
          }`}
        >
          Rooms
        </button>

        <button
          onClick={() => setTab("users")}
          className={`flex-1 py-[0.7rem] rounded-xl text-[1rem] ${
            tab === "users" ? "bg-indigo-500/20 text-indigo-500" : "bg-muted/20"
          }`}
        >
          Users
        </button>
      </div>

      {/* Animated Tab Content */}
      <AnimatePresence mode="wait">
        {/* ROOMS */}
        {tab === "rooms" && (
          <motion.div
            key="rooms-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="
                grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
                gap-[1.5rem]
                md:overflow-visible
                max-md:flex max-md:overflow-x-auto max-md:gap-[1.2rem] max-md:pb-[1rem]
                snap-x snap-mandatory
              "
            >
              {filteredRooms.map((room) => (
                <div key={room.id} className="snap-center max-md:min-w-[90%]">
                  <RoomCard room={room} />
                </div>
              ))}
            </div>

            {filteredRooms.length === 0 && (
              <p className="text-center text-muted-foreground text-[1rem] py-[3rem]">
                No rooms found.
              </p>
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
          >
            {loadingUsers ? (
              <p className="text-center text-muted-foreground py-[2rem]">
                Loading users…
              </p>
            ) : userResults.length === 0 ? (
              <p className="text-center text-muted-foreground py-[2rem]">
                No users found.
              </p>
            ) : (
              <div className="grid gap-[1rem]">
                {userResults.map((u) => (
                  <UserCard key={u.id} {...u} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

SearchComponent.displayName = "SearchComponent";
export default SearchComponent;
