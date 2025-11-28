"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useUser } from "@/lib/store/user";
import {
  useSelectedRoom,
  useAvailableRooms,
  useRoomActions,
  useRoomLoading,
  type RoomWithMembership,
} from "@/lib/store/roomstore";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2,  MessageSquare, Users, Plus, ChevronLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner"
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface LeftSidebarProps {
  user: { id: string } | null;
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
handleToggleLeft?: () => void;
}

// extend RoomWithMembership locally for optional fields returned by RPC
type RoomLocal = RoomWithMembership & {
  unreadCount?: number;
  unread_count?: number;
  latestMessage?: string | null;
  online_users?: number;
};

const LeftSidebar = React.memo<LeftSidebarProps>(({ user, isOpen, onClose, className, handleToggleLeft }) => {
  const authUser = useUser((s) => s.user);
  const selectedRoom = useSelectedRoom();
  const availableRooms = useAvailableRooms();
  const isLoading = useRoomLoading();
  const { setSelectedRoomId, createRoom, fetchRooms } = useRoomActions();

  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const supabase = getSupabaseBrowserClient();
  const debouncedRef = useRef<NodeJS.Timeout | null>(null);

  // only show rooms where membership is accepted
  const joinedRooms = useMemo(() => {
    return availableRooms.filter((r) => (r.isMember && r.participationStatus === "accepted")) as RoomLocal[];
  }, [availableRooms]);

  const filteredRooms = useMemo(() => {
    if (!searchTerm.trim()) return joinedRooms;
    const s = searchTerm.toLowerCase();
    return joinedRooms.filter((r) => r.name.toLowerCase().includes(s));
  }, [joinedRooms, searchTerm]);

  const handleSearchChange = useCallback((value: string) => {
    if (debouncedRef.current) clearTimeout(debouncedRef.current);
    debouncedRef.current = setTimeout(() => setSearchTerm(value), 250);
  }, []);

  const handleCreateRoom = useCallback(async () => {
    const trimmedName = newRoomName.trim();
    if (!trimmedName) {
      toast.error("Room name cannot be empty");
      return;
    }
    setIsCreating(true);
    try {
      await createRoom(trimmedName, false);
      setNewRoomName("");
      setShowCreateRoom(false);
      toast.success("Room created");
      await fetchRooms({ force: true });
    } catch (err) {
      console.error("create room", err);
      toast.error("Failed to create room");
    } finally {
      setIsCreating(false);
    }
  }, [newRoomName, createRoom, fetchRooms]);

  const handleRoomClick = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    // Close sidebar on mobile when a room is selected
    // Note: The logic in UnifiedHome now handles closing based on mobile width (<= 768px)
    if (onClose) {
      onClose();
    }
  }, [setSelectedRoomId, onClose]);

  const renderItem = useCallback((item: RoomLocal) => {
    const memberCount = item.memberCount ?? 0;
    const onlineCount = item.online_users ?? 0;
    const unread = (item as any).unreadCount ?? (item as any).unread_count ?? 0;

    return (
      <button
        key={item.id}
        onClick={() => handleRoomClick(item.id)}
        className={cn(
          "w-full flex items-start p-3 rounded-lg transition-colors duration-200 mb-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary",
          selectedRoom?.id === item.id
            ? "bg-[hsl(var(--primary))/0.08] border border-[hsl(var(--primary))/0.16]"
            : "hover:bg-[hsl(var(--muted))/0.4] border border-transparent"
        )}
      >
        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
          <AvatarFallback className="bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]">
            {item.name[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="ml-3 flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <div className="font-semibold text-sm sm:text-base text-[hsl(var(--foreground))] truncate">#{item.name}</div>
            {unread > 0 && (
              <span
                className="text-[10px] font-bold rounded-full px-1.5 py-0.5"
                style={{
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>

          <div className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] truncate mb-1.5">
            {item.latestMessage ?? "No messages yet"}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))]">
              <Users className="h-3 w-3" />
              <span>
                {memberCount}
              </span>
              {onlineCount > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  ({onlineCount} online)
                </span>
              )}
            </div>

            <div
              className="text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              Joined
            </div>
          </div>
        </div>
      </button>
    );
  }, [selectedRoom?.id, handleRoomClick]);

  // realtime subscriptions
  useEffect(() => {
    if (!authUser?.id) return;

    const channel = supabase.channel(`leftsidebar-room-updates-${authUser.id}`);

    (async () => {
      try {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "room_participants" },
          (payload: any) => {
            try {
              const rec = (payload?.new ?? payload?.old) as { status?: string; room_id?: string } | null;
              if (!rec || !rec.status) return;

              const status = rec.status;

              if (!status) return;
              if (status === "accepted" || status === "left" || status === "rejected") {
                fetchRooms({ force: true }).catch((e) => console.error("fetchRooms error:", e));
              }
            } catch (e) {
              console.error("room_participants realtime err:", e);
            }
          }
        );

        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          (payload: any) => {
            try {
              const rec = payload?.new as { type?: string; room_id?: string } | null;
              if (!rec || !rec.type) return;
        
              if (rec.type === "join_request_accepted" && rec.room_id) {
                fetchRooms({ force: true }).catch((e) =>
                  console.error("fetchRooms error:", e)
                );
                toast.success("Join request accepted");
              }
            } catch (e) {
              console.error("notifications realtime err:", e);
            }
          }
        );
        

        await channel.subscribe();
      } catch (err) {
        console.error("subscribe err:", err);
      }
    })();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.error("removeChannel error:", e);
      }
    };
  }, [authUser?.id, supabase, fetchRooms]);

  // initial load
  useEffect(() => {
    if (authUser?.id) {
      fetchRooms().catch((e) => console.error("initial fetchRooms:", e));
    }
  }, [authUser?.id, fetchRooms]);

  // cleanup debounced timer
  useEffect(() => {
    return () => {
      if (debouncedRef.current) clearTimeout(debouncedRef.current);
    };
  }, []);

  if (authUser === undefined) return null;

  // Not Logged In State
  if (!authUser) {
    return (
      <div
        className={cn(
          "flex flex-col h-full w-full items-center justify-center p-4 text-center",
          "bg-background/80 backdrop-blur-sm"
        )}
      >
        <Avatar className="h-14 w-14 mb-3 opacity-60">
          <AvatarFallback className="bg-muted">?</AvatarFallback>
        </Avatar>
        <p className="text-sm text-muted-foreground mb-3">Please sign in to view rooms</p>
        <Button variant="outline" size="sm" onClick={() => (window.location.href = "/auth/login")}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // The parent (UnifiedHome) controls the width/position/visibility. 
        // This component just fills the space it is given.
        "flex flex-col h-full w-full",
        "  z-[50]  lg:bg-transparent lg:backdrop-blur-none",
        "border-r-0", 
        className
      )}
    >
      <Tabs defaultValue="rooms" className="flex flex-col h-full w-full">
        {/* Header Section */}
        <div className="flex-none px-4 py-3">


<div className="flex items-center justify-between gap-4 mb-4">
  <TabsList className="grid w-full grid-cols-2 h-9">
    <TabsTrigger value="rooms" className="text-xs sm:text-sm">Rooms</TabsTrigger>
    <TabsTrigger value="chats" className="text-xs sm:text-sm">Chats</TabsTrigger>
  </TabsList>

{handleToggleLeft && (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => handleToggleLeft?.()}
    aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
    className="h-9 w-9 shrink-0 hidden md:inline-flex"
  >
    <ChevronLeft className="h-5 w-5" />
  </Button>
)}


{onClose && isOpen && (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => onClose?.()}
    className="h-9 w-9 shrink-0 md:hidden"
    aria-label="Close sidebar"
  >
    <ChevronLeft className="h-5 w-5" />
  </Button>
)}

</div>

          {/* Create/Search Area */}
          <div className="relative">
            {showCreateRoom ? (
              <div className="space-y-2 p-3 rounded-lg border bg-[hsl(var(--muted))/0.3]">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter room name..."
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleCreateRoom()}
                    disabled={isCreating}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateRoom} disabled={isCreating || !newRoomName.trim()} className="flex-1 h-8 text-xs">
                    {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowCreateRoom(false); setNewRoomName(""); }} disabled={isCreating} className="h-8 text-xs">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input 
                      placeholder="Search rooms..." 
                      onChange={(e) => handleSearchChange(e.target.value)} 
                      className="h-9 pr-8"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => fetchRooms({ force: true })} 
                      className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                      title="Refresh rooms"
                    >
                      <Loader2 className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                    </Button>
                  </div>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowCreateRoom(true)} title="Create Room">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content Section (Flex-1 to fill remaining height) */}
        <div className="flex-1 min-h-0 relative w-full">
           <TabsContent value="rooms" className="absolute inset-0 z-[50] m-0 flex flex-col">
            <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3">
              {isLoading && !filteredRooms.length ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                  <Users className="h-10 w-10 mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground mb-2">{searchTerm ? "No matching rooms" : "No rooms joined"}</p>
                  {!searchTerm && (
                    <Button variant="link" size="sm" onClick={() => setShowCreateRoom(true)} className="text-primary">
                      Create one now
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-1 z-[99999]">
                  {filteredRooms.map(renderItem)}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="chats" className="absolute inset-0 m-0 flex flex-col">
            <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3">
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <MessageSquare className="h-10 w-10 mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Direct messages coming soon</p>
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