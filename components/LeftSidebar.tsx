"use client";

import React, {
  memo,
  useState,
  useMemo,
  useCallback,
} from "react";

import {
  useRooms,
  useSelectedRoom,
  useUnifiedStore,
  useRoomActions,
  type RoomData,
} from "@/lib/store/unified-roomstore";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Loader2,
  MessageSquare,
  Users,
  Plus,
  ChevronLeft,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
   LEFT SIDEBAR PROPS
---------------------------------------------------------------------------- */
interface LeftSidebarProps {
  user: { id: string } | null;
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
  handleToggleLeft?: () => void;
}

type RoomLocal = RoomData & {
  latestMessage?: string | null;
  unreadCount?: number;
};

/* ============================================================================
   LEFT SIDEBAR — FULLY REFACTORED
============================================================================ */
const LeftSidebar = memo<LeftSidebarProps>(function LeftSidebar({
  user,
  isOpen,
  onClose,
  className,
  handleToggleLeft,
}) {
  /* --------------------------------------------------------------------------
     STORE HOOKS
  -------------------------------------------------------------------------- */
  const rooms = useRooms();
  const selectedRoom = useSelectedRoom();

  const searchTerm = useUnifiedStore((s) => s.sidebarSearchTerm);
  const setSearchTerm = useUnifiedStore((s) => s.setSidebarSearchTerm);

  const { setSelectedRoomId, createRoom } = useRoomActions();

  /* --------------------------------------------------------------------------
     LOCAL STATE
  -------------------------------------------------------------------------- */
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  /* --------------------------------------------------------------------------
     DERIVED: JOINED ROOMS
  -------------------------------------------------------------------------- */
  const joinedRooms = useMemo(
    () =>
      rooms.filter(
        (r: RoomData) => r.is_member && r.participation_status === "accepted"
      ) as RoomLocal[],
    [rooms]
  );

  /* --------------------------------------------------------------------------
     DERIVED: FILTERED ROOMS
  -------------------------------------------------------------------------- */
  const filteredRooms = useMemo(() => {
    if (!searchTerm.trim()) return joinedRooms;
    const q = searchTerm.toLowerCase();
    return joinedRooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [joinedRooms, searchTerm]);

  /* --------------------------------------------------------------------------
     SELECT ROOM + SYNC WITH HOME + CLOSE SIDEBAR
  -------------------------------------------------------------------------- */
  const handleRoomClick = useCallback(
    (roomId: string) => {
      setSelectedRoomId(roomId);

      // Always switch Home tab when selecting a room
      useUnifiedStore.getState().setActiveTab("home");

      // Close sidebar on mobile
      onClose?.();
    },
    [setSelectedRoomId, onClose]
  );

  /* --------------------------------------------------------------------------
     CREATE ROOM
  -------------------------------------------------------------------------- */
  const handleCreateRoom = useCallback(async () => {
    const name = newRoomName.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      await createRoom(name, false);
      setShowCreateRoom(false);
      setNewRoomName("");
    } finally {
      setIsCreating(false);
    }
  }, [newRoomName, createRoom]);

  /* --------------------------------------------------------------------------
     RENDER A ROOM
  -------------------------------------------------------------------------- */
  const renderRoom = useCallback(
    (room: RoomLocal) => {
      const unread = room.unread_count ?? 0;

      return (
        <button
          key={room.id}
          onClick={() => handleRoomClick(room.id)}
          className={cn(
            "w-full flex items-start p-3 rounded-lg transition-colors duration-200 mb-1 text-left select-none",
            selectedRoom?.id === room.id
              ? "bg-primary/10 border border-primary/20 shadow-sm"
              : "hover:bg-muted/40 border border-transparent"
          )}
        >
          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border border-border/40">
            <AvatarFallback>{room.name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="ml-3 flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <div className="font-semibold text-sm sm:text-base truncate">
                #{room.name}
              </div>

              {unread > 0 && (
                <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-primary text-primary-foreground">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>

            <div className="text-xs text-muted-foreground truncate mb-1.5">
              {room.latest_message ?? "No messages yet"}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{room.member_count}</span>

                {room.online_users ? (
                  <span className="text-emerald-500 font-medium">
                    ({room.online_users} online)
                  </span>
                ) : null}
              </div>

              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100/60 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-full">
                Joined
              </span>
            </div>
          </div>
        </button>
      );
    },
    [selectedRoom?.id, handleRoomClick]
  );

  /* --------------------------------------------------------------------------
     NO USER LOGGED IN
  -------------------------------------------------------------------------- */
  if (!user) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4 text-center">
        <Avatar className="h-14 w-14 mb-3 opacity-60">
          <AvatarFallback>?</AvatarFallback>
        </Avatar>

        <p className="text-sm text-muted-foreground mb-3">
          Please sign in to view rooms
        </p>
      </div>
    );
  }

  /* ============================================================================
     FINAL SIDEBAR UI
  ============================================================================ */
  return (
    <div className={cn("flex flex-col h-full w-full bg-background", className)}>
      <Tabs defaultValue="rooms" className="flex flex-col h-full w-full">

        {/* HEADER */}
        <div className="flex-none px-4 py-3 border-b bg-background">
          <div className="flex items-center justify-between gap-4 mb-4">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="rooms" className="text-sm">
                Rooms
              </TabsTrigger>
              <TabsTrigger value="chats" className="text-sm">
                Chats
              </TabsTrigger>
            </TabsList>

            {/* Desktop close */}
            {handleToggleLeft && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex h-9 w-9"
                onClick={handleToggleLeft}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}

            {/* Mobile close */}
            {onClose && isOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9"
                onClick={onClose}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* SEARCH + CREATE */}
          <div className="relative">
            {!showCreateRoom ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Search rooms…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9"
                />

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setShowCreateRoom(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <Input
                  placeholder="Enter room name…"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                  disabled={isCreating}
                  className="h-8 text-sm"
                />

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={isCreating || !newRoomName.trim()}
                    onClick={handleCreateRoom}
                  >
                    {isCreating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isCreating}
                    onClick={() => {
                      setShowCreateRoom(false);
                      setNewRoomName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 min-h-0 relative">

          {/* ROOMS TAB */}
          <TabsContent value="rooms" className="absolute inset-0 m-0">
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {!filteredRooms.length ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Users className="h-10 w-10 mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {searchTerm ? "No matching rooms" : "No rooms joined"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">{filteredRooms.map(renderRoom)}</div>
              )}
            </div>
          </TabsContent>

          {/* CHATS TAB */}
          <TabsContent value="chats" className="absolute inset-0 m-0">
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <MessageSquare className="h-10 w-10 mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Direct messages coming soon
                </p>
              </div>
            </div>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
});

LeftSidebar.displayName = "LeftSidebar";
export default LeftSidebar;
