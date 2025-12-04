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
   LEFT SIDEBAR — REFACTORED WITH CSS VARIABLES
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
     CSS VARIABLES STYLES
  -------------------------------------------------------------------------- */
  const sidebarStyles = useMemo(() => ({
    /* Layout & Spacing */
    padding: 'var(--layout-gap)',
    gap: 'var(--layout-gap)',
    borderRadius: 'var(--radius-unit)',
  
    /* Typography */
    fontSize: 'var(--fs-body)',
    fontFamily: 'var(--font-family-base)',
  
    /* Colors (fixed invalid HSL values) */
    backgroundColor: 'hsl(var(--sidebar-background))',
    color: 'hsl(var(--sidebar-foreground))',
    borderColor: 'hsl(var(--sidebar-border))',
  
    /* Room Item Styling */
    roomPadding: 'var(--density-padding)',
    roomGap: 'var(--density-gap)',
    roomBorderRadius: 'var(--density-radius)',
  
    /* Avatar Sizes */
    avatarSizeSm: 'var(--sidebar-width-icon)',
    avatarSizeLg: 'calc(var(--sidebar-width-icon) * 1.2)',
  
    /* Text Sizes */
    roomNameSize: 'var(--fs-small)',
    messagePreviewSize: 'var(--fs-tiny)',
    metaInfoSize: 'calc(var(--fs-tiny) * 0.9)',
  
    /* States */
    activeBg: 'hsl(var(--sidebar-primary) / 0.1)',
    activeBorder: 'hsl(var(--sidebar-primary) / 0.2)',
    hoverBg: 'hsl(var(--sidebar-accent))',
    hoverColor: 'hsl(var(--sidebar-accent-foreground))',
  
    /* Unread Badge */
    unreadBg: 'hsl(var(--sidebar-primary))',
    unreadColor: 'hsl(var(--sidebar-primary-foreground))',
  
    /* Glass Effects */
    glassOpacity: 'var(--glass-opacity)',
    glassBlur: 'var(--glass-blur)',
  }), []);
  

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
            "w-full flex items-start rounded-lg transition-dynamic mb-1 text-left select-none",
            selectedRoom?.id === room.id
              ? "border shadow-sm"
              : "hover:border-transparent"
          )}
          style={{
            padding: sidebarStyles.roomPadding,
            gap: sidebarStyles.roomGap,
            borderRadius: sidebarStyles.roomBorderRadius,
            backgroundColor: selectedRoom?.id === room.id 
              ? sidebarStyles.activeBg 
              : 'transparent',
            border: selectedRoom?.id === room.id 
              ? `1px solid ${sidebarStyles.activeBorder}`
              : '1px solid transparent',
            fontFamily: sidebarStyles.fontFamily,
          }}
        >
          <Avatar 
            className="border"
            style={{
              height: sidebarStyles.avatarSizeSm,
              width: sidebarStyles.avatarSizeSm,
              borderColor: `hsl(${sidebarStyles.borderColor} / 0.4)`,
            }}
          >
            <AvatarFallback>{room.name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0" style={{ marginLeft: sidebarStyles.roomGap }}>
            <div className="flex items-center justify-between mb-1">
              <div 
                className="font-semibold truncate"
                style={{ fontSize: sidebarStyles.roomNameSize }}
              >
                #{room.name}
              </div>

              {unread > 0 && (
                <span 
                  className="font-bold rounded-full px-1.5 py-0.5"
                  style={{
                    fontSize: sidebarStyles.metaInfoSize,
                    backgroundColor: sidebarStyles.unreadBg,
                    color: sidebarStyles.unreadColor,
                  }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>

            <div 
              className="text-muted-foreground truncate mb-1.5"
              style={{ fontSize: sidebarStyles.messagePreviewSize }}
            >
              {room.latest_message ?? "No messages yet"}
            </div>

            <div className="flex items-center justify-between">
              <div 
                className="flex items-center gap-2 text-muted-foreground"
                style={{ fontSize: sidebarStyles.metaInfoSize }}
              >
                <Users className="h-3 w-3" />
                <span>{room.member_count}</span>

                {room.online_users ? (
                  <span className="text-emerald-500 font-medium">
                    ({room.online_users} online)
                  </span>
                ) : null}
              </div>

              <span 
                className="px-1.5 py-0.5 bg-emerald-100/60 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-full"
                style={{ fontSize: sidebarStyles.metaInfoSize }}
              >
                Joined
              </span>
            </div>
          </div>
        </button>
      );
    },
    [selectedRoom?.id, handleRoomClick, sidebarStyles]
  );

  /* --------------------------------------------------------------------------
     NO USER LOGGED IN
  -------------------------------------------------------------------------- */
  if (!user) {
    return (
      <div 
        className="flex flex-col h-full items-center justify-center p-4 text-center"
        style={{
          backgroundColor: sidebarStyles.backgroundColor,
          color: `hsl(${sidebarStyles.color})`,
          padding: sidebarStyles.padding,
        }}
      >
        <Avatar 
          className="mb-3 opacity-60"
          style={{
            height: sidebarStyles.avatarSizeLg,
            width: sidebarStyles.avatarSizeLg,
          }}
        >
          <AvatarFallback>?</AvatarFallback>
        </Avatar>

        <p 
          className="text-sm text-muted-foreground mb-3"
          style={{ fontSize: sidebarStyles.roomNameSize }}
        >
          Please sign in to view rooms
        </p>
      </div>
    );
  }

  /* ============================================================================
     FINAL SIDEBAR UI
  ============================================================================ */
  return (
    <div 
      className={cn("flex flex-col h-full w-full", className)}
      style={{
        backgroundColor: sidebarStyles.backgroundColor,
        color: `hsl(${sidebarStyles.color})`,
        fontFamily: sidebarStyles.fontFamily,
        fontSize: sidebarStyles.fontSize,
      }}
    >
      <Tabs defaultValue="rooms" className="flex flex-col h-full w-full">

        {/* HEADER */}
        <div 
          className="flex-none border-b"
          style={{
            padding: `calc(${sidebarStyles.padding} * 0.75) ${sidebarStyles.padding}`,
            borderColor: `hsl(${sidebarStyles.borderColor})`,
          }}
        >
          <div className="flex items-center justify-between gap-4 mb-4">
            <TabsList 
              className="grid w-full grid-cols-2"
              style={{ height: sidebarStyles.avatarSizeSm }}
            >
              <TabsTrigger 
                value="rooms" 
                className="text-sm"
                style={{ fontSize: sidebarStyles.roomNameSize }}
              >
                Rooms
              </TabsTrigger>
              <TabsTrigger 
                value="chats" 
                className="text-sm"
                style={{ fontSize: sidebarStyles.roomNameSize }}
              >
                Chats
              </TabsTrigger>
            </TabsList>

            {/* Desktop close */}
            {handleToggleLeft && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex"
                onClick={handleToggleLeft}
                style={{
                  height: sidebarStyles.avatarSizeSm,
                  width: sidebarStyles.avatarSizeSm,
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}

            {/* Mobile close */}
            {onClose && isOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={onClose}
                style={{
                  height: sidebarStyles.avatarSizeSm,
                  width: sidebarStyles.avatarSizeSm,
                }}
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
                  style={{ height: sidebarStyles.avatarSizeSm }}
                />

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCreateRoom(true)}
                  style={{
                    height: sidebarStyles.avatarSizeSm,
                    width: sidebarStyles.avatarSizeSm,
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div 
                className="rounded-lg border space-y-2"
                style={{
                  padding: sidebarStyles.roomPadding,
                  borderRadius: sidebarStyles.roomBorderRadius,
                  backgroundColor: `hsl(${sidebarStyles.backgroundColor} / 0.3)`,
                  borderColor: `hsl(${sidebarStyles.borderColor})`,
                }}
              >
                <Input
                  placeholder="Enter room name…"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                  disabled={isCreating}
                  className="text-sm"
                  style={{ 
                    height: `calc(${sidebarStyles.avatarSizeSm} * 0.9)`,
                    fontSize: sidebarStyles.roomNameSize,
                  }}
                />

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={isCreating || !newRoomName.trim()}
                    onClick={handleCreateRoom}
                    style={{ 
                      fontSize: sidebarStyles.roomNameSize,
                      padding: `calc(${sidebarStyles.roomPadding} * 0.5)`,
                    }}
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
                    style={{ 
                      fontSize: sidebarStyles.roomNameSize,
                      padding: `calc(${sidebarStyles.roomPadding} * 0.5)`,
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
            <div 
              className="flex-1 overflow-y-auto pb-3"
              style={{
                paddingLeft: sidebarStyles.padding,
                paddingRight: sidebarStyles.padding,
              }}
            >
              {!filteredRooms.length ? (
                <div 
                  className="flex flex-col items-center justify-center h-48 text-center"
                  style={{ gap: sidebarStyles.gap }}
                >
                  <Users 
                    className="mb-3 text-muted-foreground/50"
                    style={{
                      height: sidebarStyles.avatarSizeLg,
                      width: sidebarStyles.avatarSizeLg,
                    }}
                  />
                  <p 
                    className="text-sm text-muted-foreground"
                    style={{ fontSize: sidebarStyles.roomNameSize }}
                  >
                    {searchTerm ? "No matching rooms" : "No rooms joined"}
                  </p>
                </div>
              ) : (
                <div style={{ gap: sidebarStyles.gap }}>
                  {filteredRooms.map(renderRoom)}
                </div>
              )}
            </div>
          </TabsContent>

          {/* CHATS TAB */}
          <TabsContent value="chats" className="absolute inset-0 m-0">
            <div 
              className="flex-1 overflow-y-auto pb-3"
              style={{
                paddingLeft: sidebarStyles.padding,
                paddingRight: sidebarStyles.padding,
              }}
            >
              <div 
                className="flex flex-col items-center justify-center h-48 text-center"
                style={{ gap: sidebarStyles.gap }}
              >
                <MessageSquare 
                  className="mb-3 text-muted-foreground/50"
                  style={{
                    height: sidebarStyles.avatarSizeLg,
                    width: sidebarStyles.avatarSizeLg,
                  }}
                />
                <p 
                  className="text-sm text-muted-foreground"
                  style={{ fontSize: sidebarStyles.roomNameSize }}
                >
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