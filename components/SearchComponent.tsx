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

  /* --------------------------------------------------------------------------
     CSS VARIABLES STYLES
  -------------------------------------------------------------------------- */
  const searchStyles = {
    // Layout & Spacing
    padding: 'var(--layout-gap, 1rem)',
    gap: 'var(--layout-gap, 1rem)',
    borderRadius: 'var(--radius-unit, 0.5rem)',
    containerHeight: '100vh',
    
    // Typography
    fontSize: 'var(--fs-body, 1rem)',
    fontSizeSmall: 'var(--fs-small, 0.875rem)',
    fontSizeLarge: 'var(--fs-subtitle, 1.25rem)',
    fontFamily: 'var(--font-family-base, "Inter", system-ui, sans-serif)',
    lineHeight: 'var(--lh-normal, 1.4)',
    tabsHeight: "2.2rem",
    tabsRadius: "0.15rem",
    tabsPadding: "0.1em",
    triggerPadding: "0.35rem 0.5rem",
    

    // Colors
    backgroundColor: 'hsl(var(--background))',
    foregroundColor: 'hsl(var(--foreground))',
    mutedForeground: 'hsl(var(--muted-foreground))',
    accentColor: 'hsl(var(--accent))',
    accentForeground: 'hsl(var(--accent-foreground))',
    
    // Input & Form Elements
    inputHeight: 'var(--header-height, 3.75rem)',
    inputPadding: 'var(--density-padding, 1rem)',
    inputBorderRadius: 'var(--density-radius, 0.5rem)',
    inputBorderColor: 'hsl(var(--input))',
    
    
    
    // Grid & Cards
    cardGap: 'var(--density-gap, 0.75rem)',
    cardRadius: 'var(--density-radius, 0.5rem)',
    cardPadding: 'var(--density-padding, 1rem)',
    
    // Icons
    iconSize: 'calc(var(--spacing-unit, 1rem) * 1.25)',
    iconOpacity: '0.5',
    
    // Scrollbar
    scrollbarColor: 'hsl(var(--muted-foreground) / 0.3)',
    scrollbarTrack: 'transparent',
    
    // Glass Effects
    glassOpacity: 'var(--glass-opacity, 0.75)',
    glassBlur: 'var(--glass-blur, 16px)',
    borderOpacity: 'var(--border-opacity, 0.15)',
    
    // Responsive Breakpoints
    breakpointSm: '480px',
    breakpointMd: '768px',
    breakpointLg: '1024px',
    breakpointXl: '1280px',
    
    // Animation
    transitionDuration: 'var(--motion-duration, 200ms)',
    transitionEasing: 'var(--motion-easing, cubic-bezier(0.2, 0, 0, 1))',
  };

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
    <div 
      className="w-full min-h-screen flex flex-col"
      style={{
        padding: searchStyles.padding,
        backgroundColor: searchStyles.backgroundColor,
        color: searchStyles.foregroundColor,
        fontFamily: searchStyles.fontFamily,
        fontSize: `calc(${searchStyles.fontSize} * var(--app-font-scale, 1))`,
        minHeight: searchStyles.containerHeight,
      }}
    >
      <div 
        className="flex flex-col sm:flex-row gap-4 items-center mb-6"
        style={{ gap: searchStyles.gap }}
      >
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rooms or users..."
            className="pl-10 rounded-xl"
            style={{
              height: searchStyles.inputHeight,
              paddingLeft: `calc(${searchStyles.inputPadding} * 2.5)`,
              borderRadius: `calc(${searchStyles.inputBorderRadius} * 1.5)`,
              fontSize: searchStyles.fontSize,
              borderColor: searchStyles.inputBorderColor,
            }}
          />
          <SearchIcon 
            className="absolute opacity-50"
            style={{
              left: `calc(${searchStyles.padding} * 0.75)`,
              top: '50%',
              transform: 'translateY(-50%)',
              width: searchStyles.iconSize,
              height: searchStyles.iconSize,
              opacity: searchStyles.iconOpacity,
            }}
          />
        </div>

        <Tabs
  value={tab}
  onValueChange={(v) => setTab(v as any)}
  className="w-full sm:w-auto"
>
  <TabsList
    className="grid grid-cols-2 rounded-lg p-0"
    style={{
      height: searchStyles.tabsHeight,
      borderRadius: searchStyles.tabsRadius,
      padding: searchStyles.tabsPadding, // ← Add variable-based padding
    }}
  >
    <TabsTrigger
      value="rooms"
      className="px-3 py-1 sm:px-4 sm:py-2"
      style={{
        fontSize: searchStyles.fontSizeSmall,
        padding: searchStyles.triggerPadding, // ← Control trigger padding
      }}
    >
      Rooms
    </TabsTrigger>

    <TabsTrigger
      value="users"
      className="px-3 py-1 sm:px-4 sm:py-2"
      style={{
        fontSize: searchStyles.fontSizeSmall,
        padding: searchStyles.triggerPadding,
      }}
    >
      Users
    </TabsTrigger>
  </TabsList>
</Tabs>

      </div>

      {/* Rooms Grid */}
      {tab === "rooms" && (
        <motion.div
          className="flex-1 overflow-y-auto pr-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            scrollbarColor: `${searchStyles.scrollbarColor} ${searchStyles.scrollbarTrack}`,
          }}
        >
          <div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            style={{ gap: searchStyles.cardGap }}
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
                  paddingTop: `calc(${searchStyles.padding} * 3)`,
                  paddingBottom: `calc(${searchStyles.padding} * 3)`,
                  fontSize: searchStyles.fontSizeSmall,
                  color: searchStyles.mutedForeground,
                }}
              >
                No rooms found.
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Users Grid */}
      {tab === "users" && (
        <motion.div
          className="flex-1 overflow-y-auto pr-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            scrollbarColor: `${searchStyles.scrollbarColor} ${searchStyles.scrollbarTrack}`,
          }}
        >
          <div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            style={{ gap: searchStyles.cardGap }}
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
                  paddingTop: `calc(${searchStyles.padding} * 3)`,
                  paddingBottom: `calc(${searchStyles.padding} * 3)`,
                  fontSize: searchStyles.fontSizeSmall,
                  color: searchStyles.mutedForeground,
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