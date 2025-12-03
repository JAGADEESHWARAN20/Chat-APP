// components/SearchComponent.tsx
"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useDebounce } from "use-debounce";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search as SearchIcon } from "lucide-react";

import { useRooms, useUsers, useUnifiedStore, useRoomActions } from "@/lib/store/unified-roomstore";
import RoomCard from "@/components/UIcomponents/RoomCard";
import UserCard from "@/components/UIcomponents/userCard";

export default function SearchComponent() {
  const rooms = useRooms();
  const users = useUsers();
  const { joinRoom, leaveRoom } = useRoomActions();
  const setSelectedRoomId = useUnifiedStore((s) => s.setSelectedRoomId);
  const setActiveTab = useUnifiedStore((s) => s.setActiveTab);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"rooms" | "users">("rooms");
  const [debounced] = useDebounce(query, 160);

  const openRoom = useCallback(
    (id: string) => {
      setSelectedRoomId(id);
      setActiveTab("home");
    },
    [setSelectedRoomId, setActiveTab]
  );

  const filteredRooms = useMemo(() => {
    if (!debounced) return rooms;
    const q = debounced.toLowerCase();
    return rooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, debounced]);

  const filteredUsers = useMemo(() => {
    if (!debounced) return users;
    const q = debounced.toLowerCase();
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        (u.display_name || "").toLowerCase().includes(q)
    );
  }, [users, debounced]);

  return (
    <div className="w-full min-h-screen p-4 flex flex-col">
      <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rooms or users..."
            className="pl-10 h-12 rounded-xl"
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-2 rounded-lg h-11">
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Rooms Grid */}
{tab === "rooms" && (
  <motion.div
    className="
      flex-1 
      overflow-y-auto 
      scrollbar-thin 
      scrollbar-thumb-muted 
      scrollbar-track-transparent 
      pr-1
    "
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredRooms.length ? (
        filteredRooms.map((room) => (
          <div key={room.id} className="col-span-1">
            <RoomCard
              room={room}
              query={debounced}
              onJoin={joinRoom}
              onLeave={leaveRoom}
              onOpen={openRoom}
            />
          </div>
        ))
      ) : (
        <div className="col-span-full text-center py-12 text-muted-foreground">
          No rooms found.
        </div>
      )}
    </div>
  </motion.div>
)}

{/* Users Grid */}
{tab === "users" && (
  <motion.div
    className="
      flex-1 
      overflow-y-auto 
      scrollbar-thin 
      scrollbar-thumb-muted 
      scrollbar-track-transparent 
      pr-1
    "
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredUsers.length ? (
        filteredUsers.map((user) => (
          <div key={user.id} className="col-span-1">
            <UserCard user={user} query={debounced} />
          </div>
        ))
      ) : (
        <div className="col-span-full text-center py-12 text-muted-foreground">
          No users found.
        </div>
      )}
    </div>
  </motion.div>
)}

    </div>
  );
}
