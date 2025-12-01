// components/SearchComponent.tsx
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
   UTILITY: Highlight search text
============================================================================ */

const highlight = (text: string, query: string) => {
  if (!query) return text;
  const pos = text.toLowerCase().indexOf(query.toLowerCase());
  if (pos === -1) return text;

  return (
    <>
      {text.slice(0, pos)}
      <span className="bg-yellow-300/40 dark:bg-yellow-700/40 px-1 rounded-sm">
        {text.slice(pos, pos + query.length)}
      </span>
      {text.slice(pos + query.length)}
    </>
  );
};

/* ============================================================================
   ROOM CARD COMPONENT
============================================================================ */

interface RoomCardProps {
  room: RoomData;
  query: string;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onOpen: (id: string) => void;
}

const RoomCard = React.memo(function RoomCard({
  room,
  query,
  onJoin,
  onLeave,
  onOpen,
}: RoomCardProps) {
  const isMember = room.is_member && room.participation_status === "accepted";
  const isPending = room.participation_status === "pending";

  return (
    <div className="flex flex-col bg-card/80 w-full max-w-sm h-80 rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden hover:bg-card/90">
      {/* Header */}
      <div className="p-4 bg-gradient-to-br from-indigo-600/20 to-indigo-800/40">
        <p className="font-semibold truncate flex items-center gap-2 text-sm sm:text-base">
          #{highlight(room.name, query)}
          {room.is_private && (
            <Lock className="h-4 w-4 opacity-50 flex-shrink-0" />
          )}
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-col justify-between p-4 flex-1">
        {/* Stats */}
        <div className="space-y-2 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 opacity-60 flex-shrink-0" />
            <span className="font-medium">{room.member_count} members</span>

            {room.online_users > 0 && (
              <span className="text-green-500 text-xs flex items-center gap-1 ml-auto">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                {room.online_users} online
              </span>
            )}
          </div>

          {/* Status Badges */}
          {isPending && (
            <span className="text-xs bg-yellow-500/20 text-yellow-700 px-2 py-1 rounded-md inline-block">
              ⏳ Pending approval
            </span>
          )}

          {isMember && (
            <span className="text-xs bg-green-500/20 text-green-700 px-2 py-1 rounded-md inline-block">
              ✓ Member
            </span>
          )}

          {/* Latest Message */}
          {room.latest_message && (
            <div className="text-xs text-muted-foreground truncate mt-2">
              💬 {room.latest_message}
            </div>
          )}

          {/* Unread Count */}
          {room.unread_count > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full inline-block">
              {room.unread_count} unread
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-col gap-2">
          {isMember ? (
            <>
              <Button
                size="sm"
                onClick={() => onOpen(room.id)}
                className="hover:bg-primary/90"
              >
                Open Room
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:border-red-300"
                onClick={() => onLeave(room.id)}
              >
                Leave
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => onJoin(room.id)}
              className="hover:bg-primary/90"
            >
              {isPending ? "Request Sent" : "Join"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

/* ============================================================================
   USER CARD COMPONENT
============================================================================ */

interface UserCardProps {
  user: {
    id: string;
    username?: string;
    display_name?: string;
    created_at: string;
  };
  query: string;
  onOpenDM: (id: string) => void;
}

const UserCard = React.memo(function UserCard({
  user,
  query,
  onOpenDM,
}: UserCardProps) {
  return (
    <div className="flex flex-col bg-card/80 w-full max-w-sm h-64 rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden hover:bg-card/90">
      <div className="p-4 bg-gradient-to-br from-purple-600/20 to-purple-800/40">
        <p className="font-semibold truncate flex items-center gap-2 text-sm sm:text-base">
          @{highlight(user.username || user.display_name || "Unknown", query)}
        </p>
      </div>

      <div className="flex flex-col justify-between p-4 flex-1">
        <div className="space-y-1 text-xs sm:text-sm">
          <span className="opacity-70">
            Joined: {new Date(user.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="mt-3">
          <Button
            size="sm"
            onClick={() => onOpenDM(user.id)}
            className="w-full hover:bg-primary/90"
          >
            Message
          </Button>
        </div>
      </div>
    </div>
  );
});

/* ============================================================================
   MAIN SEARCH COMPONENT
============================================================================ */

export default function SearchComponent() {
  const router = useRouter();
  const authUser = useUser();
  const userId = authUser?.user?.id || null;

  // Zustand state - auto-updates from realtime
  const rooms = useRooms();
  const { joinRoom, leaveRoom, fetchAll } = useRoomActions();

  // Initialize realtime subscription
  useUnifiedRealtime(userId);

  // Local state
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("rooms");
  const [users, setUsers] = useState<any[]>([]);
  const [debounced] = useDebounce(query, 250);

  /* ------------------------------------------------------------------------
     INITIAL FETCH
  ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!userId) return;

    // Set user ID in store
    useUnifiedStore.getState().setUserId(userId);

    // Fetch all data
    fetchAll();
  }, [userId, fetchAll]);

  /* ------------------------------------------------------------------------
     FETCH USERS (when switching to users tab)
  ------------------------------------------------------------------------ */

  useEffect(() => {
    if (activeTab !== "users") return;

    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        setUsers(data || []);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };

    fetchUsers();
  }, [activeTab]);

  /* ------------------------------------------------------------------------
     FILTERED DATA
  ------------------------------------------------------------------------ */

  const filteredRooms = useMemo(() => {
    if (!debounced) return rooms;
    const q = debounced.toLowerCase();
    return rooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, debounced]);

  const filteredUsers = useMemo(() => {
    if (!debounced) return users;
    const q = debounced.toLowerCase();
    return users.filter((u) =>
      (u.username || u.display_name)?.toLowerCase().includes(q)
    );
  }, [users, debounced]);

  /* ------------------------------------------------------------------------
     HANDLERS
  ------------------------------------------------------------------------ */

  const handleJoin = useCallback(
    async (roomId: string) => {
      await joinRoom(roomId);
    },
    [joinRoom]
  );

  const handleLeave = useCallback(
    async (roomId: string) => {
      await leaveRoom(roomId);
    },
    [leaveRoom]
  );

  const handleOpenRoom = useCallback(
    (id: string) => router.push(`/rooms/${id}`),
    [router]
  );

  const handleOpenDM = useCallback(
    (id: string) => router.push(`/dm/${id}`),
    [router]
  );

  /* ------------------------------------------------------------------------
     RENDER
  ------------------------------------------------------------------------ */

  return (
    <div className="w-full min-h-screen p-4 flex flex-col overflow-hidden">
      {/* Header & Search */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rooms or users..."
              className="pl-10 h-12 rounded-xl text-sm sm:text-base"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 opacity-50" />
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-2 h-10 sm:h-12">
              <TabsTrigger value="rooms" className="text-xs sm:text-sm">
                Rooms
              </TabsTrigger>
              <TabsTrigger value="users" className="text-xs sm:text-sm">
                Users
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-4">
        {/* Rooms Grid */}
        {activeTab === "rooms" && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {filteredRooms.length > 0 ? (
              filteredRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  query={debounced}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onOpen={handleOpenRoom}
                />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {debounced ? "No rooms found" : "No rooms available"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {debounced
                    ? "Try adjusting your search"
                    : "Join some rooms to get started"}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Users Grid */}
        {activeTab === "users" && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  query={debounced}
                  onOpenDM={handleOpenDM}
                />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {debounced ? "No users found" : "No users available"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {debounced
                    ? "Try adjusting your search"
                    : "Users will appear here"}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}