"use client";

import React, {
  memo,
  useState,
  useMemo,
  useCallback,
  useEffect,
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
  Search,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDirectChatStore, type DirectChatSummary } from "@/lib/store/directChatStore";
import { useDirectChatActions } from "@/lib/hooks/useDirectChatActions";

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
  const roomPresence = useUnifiedStore((s) => s.roomPresence);

  const searchTerm = useUnifiedStore((s) => s.sidebarSearchTerm);
  const setSearchTerm = useUnifiedStore((s) => s.setSidebarSearchTerm);

  const { setSelectedRoomId, createRoom } = useRoomActions();
  const { chats, setChats, selectedChat, setSelectedChat } = useDirectChatStore((s) => ({
    chats: s.chats,
    setChats: s.setChats,
    selectedChat: s.selectedChat,
    setSelectedChat: s.setSelectedChat,
  }));


  /* --------------------------------------------------------------------------
     LOCAL STATE
  -------------------------------------------------------------------------- */
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [chatUserQuery, setChatUserQuery] = useState("");
  const [chatUserResults, setChatUserResults] = useState<Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }>>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const { openOrCreateDirectChat } = useDirectChatActions();

  useEffect(() => {
    let mounted = true;

    const loadChats = async () => {
      if (!user?.id) {
        setChats([]);
        return;
      }

      setIsLoadingChats(true);
      try {
        const res = await fetch("/api/direct-chats", { method: "GET" });
        if (!res.ok) return;

        const data = await res.json();
        const nextChats = Array.isArray(data?.chats) ? (data.chats as DirectChatSummary[]) : [];

        if (mounted) {
          setChats(nextChats);
        }
      } finally {
        if (mounted) setIsLoadingChats(false);
      }
    };

    loadChats();

    return () => {
      mounted = false;
    };
  }, [user?.id, setChats]);


  useEffect(() => {
    let active = true;

    const run = async () => {
      const q = chatUserQuery.trim();
      if (q.length < 2) {
        if (active) setChatUserResults([]);
        return;
      }

      setIsSearchingUsers(true);
      try {
        const res = await fetch(`/api/users/search?query=${encodeURIComponent(q)}`);
        if (!res.ok) {
          if (active) setChatUserResults([]);
          return;
        }

        const data = await res.json();
        if (!active) return;

        const next = Array.isArray(data)
          ? data.map((u: any) => ({
              id: String(u.id),
              username: u.username ?? null,
              display_name: u.display_name ?? null,
              avatar_url: u.avatar_url ?? null,
            }))
          : [];

        setChatUserResults(next);
      } finally {
        if (active) setIsSearchingUsers(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [chatUserQuery]);

  const handleStartChatWithUser = useCallback(
    async (target: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }) => {
      const opened = await openOrCreateDirectChat(target);
      if (opened) {
        setChatUserQuery("");
        setChatUserResults([]);
      }
    },
    [openOrCreateDirectChat]
  );

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
      setSelectedChat(null);
      setSelectedRoomId(roomId);

      // Always switch Home tab when selecting a room
      useUnifiedStore.getState().setActiveTab("home");

      // Close sidebar on mobile
      onClose?.();
    },
    [setSelectedChat, setSelectedRoomId, onClose]
  );

  const handleChatClick = useCallback((chat: DirectChatSummary) => {
    setSelectedChat(chat);
    setSelectedRoomId(null);
    useUnifiedStore.getState().setActiveTab("home");
    onClose?.();
  }, [setSelectedChat, setSelectedRoomId, onClose]);

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
  

 
 
const renderRoom = useCallback(
  (room: RoomLocal) => {
    const unread = room.unread_count ?? 0;

    // Real realtime presence for this room
    const presence = roomPresence[room.id];

    // # of online users
    const onlineUsers = presence?.onlineUsers ?? 0;

    // # of members (fallback to store)
    const memberCount = room.member_count ?? presence?.userIds?.length ?? 0;

    return (
      <button
        key={room.id}
        onClick={() => handleRoomClick(room.id)}
        className={cn(
          "w-full flex items-start rounded-lg transition-dynamic mb-1  text-left select-none",
          selectedRoom?.id === room.id ? "border shadow-sm" : "hover:border-transparent"
        )}
        style={{
          padding: sidebarStyles.roomPadding,
          gap: sidebarStyles.roomGap,
          borderRadius: sidebarStyles.roomBorderRadius,
          backgroundColor:
            selectedRoom?.id === room.id ? sidebarStyles.activeBg : "transparent",
          border:
            selectedRoom?.id === room.id
              ? `1px solid ${sidebarStyles.activeBorder}`
              : "1px solid transparent",
        }}
      >
        {/* AVATAR */}
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

        {/* CONTENT */}
        <div className="flex-1 min-w-0" style={{ marginLeft: sidebarStyles.roomGap }}>
          {/* TITLE + UNREAD */}
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold truncate" style={{ fontSize: sidebarStyles.roomNameSize }}>
              #{room.name}
            </div>

           
          </div>

         

          {/* MEMBER + ONLINE COUNTS */}
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2 text-muted-foreground"
              style={{ fontSize: sidebarStyles.metaInfoSize }}
            >
              <Users className="h-3 w-3" />

              {/* total members */}
              <span>{memberCount}</span>

              {/* online count only if > 0 */}
              {onlineUsers > 0 && (
                <span className="text-emerald-500 font-medium">
                  ({onlineUsers} online)
                </span>
              )}
            </div>

          </div>
        
        </div>  
        {unread > 0 && (
              <span
                className="font-bold rounded-full px-[1.8em] py-[.5em]"
                style={{
                  fontSize: sidebarStyles.metaInfoSize,
                  backgroundColor: sidebarStyles.unreadBg,
                  color: sidebarStyles.unreadColor,
                }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
      </button>
    );
  },
  [selectedRoom?.id, handleRoomClick, sidebarStyles, roomPresence]
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
          className="flex-none "
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
              <div className="mb-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={chatUserQuery}
                    onChange={(e) => setChatUserQuery(e.target.value)}
                    placeholder="Search users to message..."
                    className="pl-8 h-9"
                  />
                </div>

                {chatUserQuery.trim().length >= 2 && (
                  <div className="rounded-md border border-border/50 bg-background/60 max-h-40 overflow-y-auto">
                    {isSearchingUsers ? (
                      <div className="p-2 text-xs text-muted-foreground">Searching users...</div>
                    ) : chatUserResults.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">No users found</div>
                    ) : (
                      chatUserResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleStartChatWithUser(u)}
                          className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-accent text-left"
                        >
                          <span className="text-sm truncate">{u.display_name || u.username || "Unknown user"}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full border border-border/50">Message</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {isLoadingChats ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : chats.length === 0 ? (
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
                    No direct chats yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chats.map((chat) => {
                    const isActive = selectedChat?.id === chat.id;
                    return (
                      <button
                        key={chat.id}
                        onClick={() => handleChatClick(chat)}
                        className={cn(
                          "w-full flex items-start rounded-lg transition-dynamic text-left select-none",
                          isActive ? "border shadow-sm" : "hover:border-transparent"
                        )}
                        style={{
                          padding: sidebarStyles.roomPadding,
                          gap: sidebarStyles.roomGap,
                          borderRadius: sidebarStyles.roomBorderRadius,
                          backgroundColor: isActive ? sidebarStyles.activeBg : "transparent",
                          border: isActive ? `1px solid ${sidebarStyles.activeBorder}` : "1px solid transparent",
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
                          <AvatarFallback>
                            {(chat.other_user.display_name || chat.other_user.username || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0" style={{ marginLeft: sidebarStyles.roomGap }}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold truncate" style={{ fontSize: sidebarStyles.roomNameSize }}>
                              {chat.other_user.display_name || chat.other_user.username || "Unknown user"}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {chat.latest_message || "Start a conversation"}
                          </p>
                          {chat.interest_status === "pending" && (
                            <p className="text-[11px] mt-1 text-amber-600 dark:text-amber-400">
                              {chat.initiator_id === user?.id ? "Pending acceptance" : "New request"}
                            </p>
                          )}
                          {chat.interest_status === "declined" && (
                            <p className="text-[11px] mt-1 text-rose-600 dark:text-rose-400">Declined</p>
                          )}
                        </div>
                        {chat.unread_count > 0 && (
                          <span
                            className="font-bold rounded-full px-[1.1em] py-[.35em]"
                            style={{
                              fontSize: sidebarStyles.metaInfoSize,
                              backgroundColor: sidebarStyles.unreadBg,
                              color: sidebarStyles.unreadColor,
                            }}
                          >
                            {chat.unread_count > 99 ? "99+" : chat.unread_count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
});

LeftSidebar.displayName = "LeftSidebar";
export default LeftSidebar;