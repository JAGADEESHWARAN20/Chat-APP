"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useDebounce } from "use-debounce";
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

  /* -------------------------------------------------------------------------- */
/* CSS VARS SIMPLICITY */
/* -------------------------------------------------------------------------- */
  const s = {
    gap: "var(--layout-gap, 1rem)",
    borderRadius: "var(--radius-unit, 0.5rem)",
    fontSize: "var(--fs-body, 1rem)",
    fontSizeSmall: "var(--fs-small, 0.875rem)",
    fontFamily: 'var(--font-family-base, "Inter", system-ui, sans-serif)',
    inputHeight: "var(--header-height, 3.75rem)",
    inputPadding: "var(--density-padding, 1rem)",
    inputBorder: "hsl(var(--input))",
    cardGap: "var(--density-gap, 0.75rem)",
    mutedForeground: "hsl(var(--muted-foreground))",
    iconSize: "calc(var(--spacing-unit, 1rem) * 1.25)",
    transition: "var(--motion-duration, 200ms)",
    transitionEase: "var(--motion-easing, cubic-bezier(0.2, 0, 0, 1))",
  };

  /* -------------------------------------------------------------------------- */
  /* Data Filtering */
  /* -------------------------------------------------------------------------- */

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

  /* -------------------------------------------------------------------------- */
  /* UI */
  /* -------------------------------------------------------------------------- */

  return (
    <div
      className="w-full min-h-screen flex flex-col"
      style={{
        padding: s.gap,
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
      }}
    >
      {/* SEARCH + TABS */}
      <div
        className="flex flex-col sm:flex-row gap-4 items-center mb-6 w-full"
        style={{ gap: s.gap }}
      >
        {/* Search Field Container */}
        <div
          className="relative w-full sm:flex-1 flex items-center"
          style={{
            height: s.inputHeight,
            borderRadius: `calc(${s.borderRadius} * 1.5)`,
            border: `1px solid ${s.inputBorder}`,
            paddingLeft: `calc(${s.inputPadding} * 2.2)`,
            transition: `border ${s.transition} ${s.transitionEase}`,
          }}
        >
          <SearchIcon
            className="absolute left-3 opacity-50 pointer-events-none"
            style={{
              width: s.iconSize,
              height: s.iconSize,
            }}
          />

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rooms or users..."
            className="w-full ml-[2em] outline-none bg-transparent"
            style={{
              fontSize: s.fontSize,
              fontFamily: s.fontFamily,
            }}
          />
        </div>

       {/* Enhanced Tabs */}
<Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full  sm:w-auto">
<TabsList
  className="grid grid-cols-2 rounded-lg overflow-hidden border shadow-sm"
  style={{
    borderColor: s.inputBorder,
    height: "var(--tab-height)",
    backgroundColor: "var(--tab-bg)",
    borderRadius: "var(--tab-radius)",
    transition: `background ${s.transition} ${s.transitionEase}`,
  }}
>

<TabsTrigger
  value="rooms"
  className={`
    px-4 h-full flex items-center justify-center
    transition-all font-medium text-[var(--tab-text)]
    data-[state=active]:!bg-[var(--tab-active-bg)]
    data-[state=active]:!text-[var(--tab-active-text)]
    data-[state=active]:!font-semibold
  `}
  style={{ fontSize: s.fontSizeSmall }}
>
  Rooms
</TabsTrigger>


    <TabsTrigger
      value="users"
      className={`
        px-4 h-full flex items-center justify-center
    transition-all font-medium text-[var(--tab-text)]
    data-[state=active]:!bg-[var(--tab-active-bg)]
    data-[state=active]:!text-[var(--tab-active-text)]
    data-[state=active]:!font-semibold
      `}
      style={{ fontSize: s.fontSizeSmall }}
    >
      Users
    </TabsTrigger>
  </TabsList>
</Tabs>


      </div>

      {/* RESULTS */}
    {/* RESULTS */}
{tab === "rooms" && (
  <motion.div
    className="flex-1 overflow-y-auto scrollbar-thin pr-1"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    style={{
      maxHeight: "var(--results-height)",
      minHeight: "calc(var(--results-height) * 0.65)", // ensures visibility
      paddingBottom: "0.5rem",
    }}
  >
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-y-auto scrollbar-custom"
      style={{
        gap: s.cardGap,
        minHeight: "100%", // grid always fills container
      }}
    >
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
        <div
          className="col-span-full text-center py-12 text-muted-foreground"
          style={{
            fontSize: s.fontSizeSmall,
            color: s.mutedForeground,
          }}
        >
          No rooms found.
        </div>
      )}
    </div>
  </motion.div>
)}

{tab === "users" && (
  <motion.div
    className="flex-1 overflow-y-auto scrollbar-thin pr-1"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    style={{
      maxHeight: "var(--results-height)",
      minHeight: "calc(var(--results-height) * 0.75)",
      paddingBottom: "0.5rem",
    }}
  >
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-y-auto scrollbar-custom"
      style={{
        gap: s.cardGap,
        minHeight: "100%",
      }}
    >
      {filteredUsers.length ? (
        filteredUsers.map((user) => (
          <div key={user.id} className="col-span-1">
            <UserCard user={user} query={debounced} />
          </div>
        ))
      ) : (
        <div
          className="col-span-full text-center py-12 text-muted-foreground"
          style={{
            fontSize: s.fontSizeSmall,
            color: s.mutedForeground,
          }}
        >
          No users found.
        </div>
      )}
    </div>
  </motion.div>
)}

    </div>
  );
}
