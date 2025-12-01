"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Lock, Search } from "lucide-react";
import { useDebounce } from "use-debounce";

import {
  useRooms,
  useRoomActions,
  useUnifiedRealtime,
  useUnifiedStore,
  type RoomData,
} from "@/lib/store/unified-roomstore";

import { useUser } from "@/lib/store/user";

/* ============================================================================
   UTIL: highlight search
============================================================================ */

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

/* ============================================================================
   ROOM CARD (PURE, FAST)
============================================================================ */

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
      {/* Header */}
      <div className="p-4 bg-gradient-to-br from-indigo-600/20 to-indigo-800/40">
        <p className="font-semibold truncate flex items-center gap-2 text-sm">
          #{highlight(room.name, query)}
          {room.is_private && <Lock className="h-4 w-4 opacity-60" />}
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-col justify-between p-4 flex-1">
        {/* Stats */}
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
              {room.unread_count} unread
            </span>
          )}
        </div>

        {/* Actions */}
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

/* ============================================================================
   MAIN COMPONENT
============================================================================ */

export default function SearchComponent() {
  const router = useRouter();
  const authUser = useUser();
  const userId = authUser?.user?.id ?? null;

  // Zustand state — realtime reactive
  const rooms = useRooms();
  const { joinRoom, leaveRoom, fetchAll } = useRoomActions();

  // Activate realtime
  useUnifiedRealtime(userId);

  // Local UI state
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("rooms");
  const [users, setUsers] = useState<any[]>([]);
  const [debounced] = useDebounce(query, 200);

  /* ------------------------------------------------------------------------
     ON FIRST LOAD → Sync user ID + fetch data
  ------------------------------------------------------------------------ */
  useEffect(() => {
    if (!userId) return;

    // ✔ sets user ID into the unified store (important)
    useUnifiedStore.getState().setUserId(userId);

    fetchAll(); // rooms + notifications
  }, [userId, fetchAll]);

  /* ------------------------------------------------------------------------
     Load user list only when switching to "users" tab
  ------------------------------------------------------------------------ */
  useEffect(() => {
    if (tab !== "users") return;

    (async () => {
      try {
        const res = await fetch("/api/users");
        setUsers((await res.json()) || []);
      } catch (err) {
        console.error("Fetching users failed:", err);
      }
    })();
  }, [tab]);

  /* ------------------------------------------------------------------------
     FILTERING (realtime reactive)
  ------------------------------------------------------------------------ */

  const filteredRooms = useMemo(() => {
    if (!debounced) return rooms;
    const q = debounced.toLowerCase();
    return rooms.filter((room) => room.name.toLowerCase().includes(q));
  }, [rooms, debounced]);

  /* ------------------------------------------------------------------------
     Handlers
  ------------------------------------------------------------------------ */

  const openRoom = useCallback(
    (id: string) => router.push(`/rooms/${id}`),
    [router]
  );

  const handleJoin = useCallback(
    async (roomId: string) => joinRoom(roomId),
    [joinRoom]
  );

  const handleLeave = useCallback(
    async (roomId: string) => leaveRoom(roomId),
    [leaveRoom]
  );

  /* ------------------------------------------------------------------------
     RENDER
  ------------------------------------------------------------------------ */

  return (
    <div className="w-full min-h-screen p-4 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rooms or users..."
            className="pl-10 h-12 rounded-xl"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-2 h-12">
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Rooms */}
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

      {/* Users */}
      {tab === "users" && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {users.length ? (
            users.map((u) => (
              <div key={u.id} className="p-4 border rounded-xl bg-card">
                {u.username}
              </div>
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
