"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Lock, Search, User as UserIcon } from "lucide-react";
import { useDebounce } from "use-debounce";
import {
  useRooms,
  useUsers,
  useRoomActions,

  useUnifiedStore,
  type RoomData,
  type UserData,
} from "@/lib/store/unified-roomstore";
import { useUser } from "@/lib/store/user";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

/* -----------------------------------------------
   highlight utility
----------------------------------------------- */
const highlight = (text: string, q: string) => {
  if (!q) return text;
  const pos = text.toLowerCase().indexOf(q.toLowerCase());
  if (pos === -1) return text;
  return (
    <>
      {text.slice(0, pos)}
      <span className="bg-yellow-300/40 dark:bg-yellow-700/40 px-1 rounded">
        {text.slice(pos, pos + q.length)}
      </span>
      {text.slice(pos + q.length)}
    </>
  );
};

/* -----------------------------------------------
   RoomCard - PURE
----------------------------------------------- */
const RoomCard = React.memo(function RoomCard({
  room,
  query,
  onJoin,
  onLeave,
  onOpen,
}: {
  room: RoomData;
  query: string;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const isMember = room.is_member && room.participation_status === "accepted";
  const pending = room.participation_status === "pending";

  return (
    <div className="flex flex-col bg-card/80 w-full max-w-sm h-80 rounded-xl border shadow-sm hover:shadow-lg transition-all overflow-hidden">
      <div className="p-4 bg-gradient-to-br from-indigo-600/20 to-indigo-800/40">
        <p className="font-semibold truncate flex items-center gap-2 text-sm">
          #{highlight(room.name, query)}
          {room.is_private && <Lock className="h-4 w-4 opacity-60" />}
        </p>
      </div>

      <div className="flex flex-col justify-between p-4 flex-1">
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 opacity-60" />
            <span className="font-medium">{room.member_count} members</span>

            {room.online_users > 0 && (
              <span className="ml-auto text-green-500 text-xs flex items-center gap-1">
                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                {room.online_users} online
              </span>
            )}
          </div>

          {pending && (
            <span className="text-xs bg-yellow-500/20 text-yellow-700 px-2 py-1 rounded">
              Pending approval
            </span>
          )}

          {isMember && (
            <span className="text-xs bg-green-500/20 text-green-700 px-2 py-1 rounded">
              ✓ Member
            </span>
          )}

          {room.latest_message && (
            <p className="text-xs opacity-70 truncate mt-2">
              💬 {room.latest_message}
            </p>
          )}

          {room.unread_count > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
              {room.unread_count}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {isMember ? (
            <>
              <Button size="sm" onClick={() => onOpen(room.id)}>
                Open Room
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="text-red-600"
                onClick={() => onLeave(room.id)}
              >
                Leave
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={pending} onClick={() => onJoin(room.id)}>
              {pending ? "Request Sent" : "Join"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

/* -----------------------------------------------
   UserCard
----------------------------------------------- */
const UserCard = React.memo(function UserCard({
  user,
  query,
}: {
  user: UserData;
  query: string;
}) {
  return (
    <div className="flex flex-col bg-card/80 w-full max-w-sm h-80 rounded-xl border shadow-sm hover:shadow-lg transition-all overflow-hidden">
      <div className="p-4 bg-gradient-to-br from-blue-600/20 to-blue-800/40">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar_url || ""} />
            <AvatarFallback className="bg-blue-500 text-white">
              {user.username?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate text-sm">
              {highlight(user.display_name || user.username, query)}
            </p>

            <p className="text-xs text-muted-foreground truncate">
              @{user.username}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between p-4 flex-1">
        <div className="space-y-2 text-xs">
          <UserIcon className="h-4 w-4 opacity-60 inline mr-1" />
          <span className="font-medium">User Profile</span>

          {user.bio && (
            <p className="text-xs opacity-70 truncate mt-2">{user.bio}</p>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`/profile/${user.id}`}>View Profile</a>
          </Button>
        </div>
      </div>
    </div>
  );
});

/* -----------------------------------------------
   MAIN COMPONENT
----------------------------------------------- */
export default function SearchComponent() {
  const router = useRouter();

  const authUser = useUser();
  const userId = authUser?.user?.id ?? null;

  // Zustand reactive slices
  const rooms = useRooms();
  const users = useUsers();

  const { joinRoom, leaveRoom, fetchAll } = useRoomActions();

  // Fix #1 → Reactive setter instead of getState().setUserId
  const setUserId = useUnifiedStore((s) => s.setUserId);


  // Local state
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("rooms");
  const [debounced] = useDebounce(query, 200);

  /* -----------------------------------------------
     On first load → Sync + Fetch all data
  ----------------------------------------------- */
  useEffect(() => {
    if (!userId) return;

    // !!! FIX: use reactive setter, NOT getState()
    setUserId(userId);

    fetchAll(); // rooms + notifications + users
  }, [userId, setUserId, fetchAll]);

  /* -----------------------------------------------
     Filtering
  ----------------------------------------------- */
  const filteredRooms = useMemo(() => {
    if (!debounced) return rooms;
    const q = debounced.toLowerCase();
    return rooms.filter((room) => room.name.toLowerCase().includes(q));
  }, [rooms, debounced]);

  const filteredUsers = useMemo(() => {
    if (!debounced) return users;
    const q = debounced.toLowerCase();
    return users.filter(
      (user) =>
        user.username?.toLowerCase().includes(q) ||
        (user.display_name || "").toLowerCase().includes(q)
    );
  }, [users, debounced]);

  /* -----------------------------------------------
     Handlers
  ----------------------------------------------- */
  const openRoom = useCallback(
    (id: string) => {
      useUnifiedStore.getState().setSelectedRoomId(id);
      useUnifiedStore.getState().setActiveTab("home");
    },
    []
  );
  

  const handleJoin = useCallback(
    async (roomId: string) => joinRoom(roomId),
    [joinRoom]
  );

  const handleLeave = useCallback(
    async (roomId: string) => leaveRoom(roomId),
    [leaveRoom]
  );

  /* -----------------------------------------------
     Render
  ----------------------------------------------- */
  return (
    <div className="w-full min-h-screen p-4 flex flex-col overflow-hidden">
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rooms or users..."
            className="pl-10 h-12 rounded-xl"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-2 h-12">
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "rooms" && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {filteredRooms.length ? (
            filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                query={debounced}
                onJoin={handleJoin}
                onLeave={handleLeave}
                onOpen={openRoom}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12 opacity-70">
              No rooms found.
            </div>
          )}
        </motion.div>
      )}

      {tab === "users" && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {filteredUsers.length ? (
            filteredUsers.map((user) => (
              <UserCard key={user.id} user={user} query={debounced} />
            ))
          ) : (
            <div className="col-span-full text-center py-12 opacity-70">
              No users found.
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
