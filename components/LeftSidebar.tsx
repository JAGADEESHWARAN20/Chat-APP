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
import { Loader2, ChevronRight, MessageSquare, Users, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface LeftSidebarProps {
  user: { id: string } | null;
  isOpen: boolean;
  onClose?: () => void;
}

// extend RoomWithMembership locally for optional fields returned by RPC
type RoomLocal = RoomWithMembership & {
  unreadCount?: number;
  unread_count?: number;
  latestMessage?: string | null;
  online_users?: number;
};

const LeftSidebar = React.memo<LeftSidebarProps>(({ user, isOpen, onClose }) => {
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

  const renderItem = useCallback((item: RoomLocal) => {
    const memberCount = item.memberCount ?? 0;
    const onlineCount = item.online_users ?? 0;
    const unread = (item as any).unreadCount ?? (item as any).unread_count ?? 0;

    return (
      <div
        key={item.id}
        className={`flex items-start p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
          selectedRoom?.id === item.id ? "bg-primary/10 dark:bg-primary/20" : "hover:bg-muted"
        }`}
        onClick={() => setSelectedRoomId(item.id)}
      >
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarFallback className="bg-muted">{item.name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="ml-3 flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-foreground truncate">#{item.name}</div>
            {unread > 0 && (
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-1">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>

          <div className="text-sm text-muted-foreground truncate mb-2">
            {item.latestMessage ?? "No messages yet"}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
              {onlineCount > 0 && <span className="text-green-600 ml-1">({onlineCount} online)</span>}
            </div>
            <div className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full px-2 py-1">
              Joined
            </div>
          </div>

          <div className="text-xs text-muted-foreground mt-1">
            Created: {new Date(item.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  }, [selectedRoom?.id, setSelectedRoomId]);

  // realtime subscriptions (subscribe using async IIFE to avoid returning a Promise from useEffect)
  useEffect(() => {
    if (!authUser?.id) return;

    const channel = supabase.channel(`leftsidebar-room-updates-${authUser.id}`);

    (async () => {
      try {
        // participants changes: when a participant row becomes accepted/left/rejected => refresh
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "room_participants" },
          (payload: any) => {
            try {
              const rec = payload?.new ?? payload?.old;
              if (!rec) return;
              const status = (rec as any).status as string | undefined;
              if (!status) return;
              if (status === "accepted" || status === "left" || status === "rejected") {
                fetchRooms({ force: true }).catch((e) => console.error("fetchRooms error:", e));
              }
            } catch (e) {
              console.error("room_participants realtime err:", e);
            }
          }
        );

        // notifications: owner acceptance may insert a join_request_accepted notification
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          (payload: any) => {
            try {
              const rec = payload?.new ?? payload?.old;
              if (!rec) return;
              const t = (rec as any).type as string | undefined;
              if (t === "join_request_accepted") {
                fetchRooms({ force: true }).catch((e) => console.error("fetchRooms error:", e));
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

  if (!authUser) {
    return (
      <div
        className={`fixed lg:static inset-y-0 left-0 w-full lg:w-64 px-4 py-3 bg-card  h-full flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0 z-50 md:z-50 lg:z-0" : "-translate-x-full lg:translate-x-0"
        } z-50 md:z-50 lg:z-0`}
      >
        <div className="flex flex-col items-center justify-center h-full text-center px-4 text-muted-foreground">
          <Avatar className="h-14 w-14 mb-3 opacity-60">
            <AvatarFallback>?</AvatarFallback>
          </Avatar>

          <p className="text-sm mb-2">You are not logged in</p>

          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/auth/login")}
            className="mt-1"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed lg:static inset-y-0 left-0 w-full lg:w-1/4 px-4 py-3 bg-card border-r border-white/10 h-full flex flex-col transition-transform duration-300 ${
        isOpen ? "translate-x-0 z-50 md:z-50 lg:z-0" : "-translate-x-full lg:translate-x-0"
      } z-50 md:z-50 lg:z-0`}
    >
      <Tabs defaultValue="rooms" className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-5">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rooms">My Rooms</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
              <ChevronRight className="h-5 w-5 rotate-180" />
            </Button>
          )}
        </div>

        <div className="mb-3">
          {showCreateRoom ? (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
              <div className="flex gap-2 mb-3">
                <Input placeholder="Search my rooms..." onChange={(e) => handleSearchChange(e.target.value)} className="flex-1" />
                <Button variant="outline" size="icon" onClick={() => fetchRooms({ force: true })} title="Refresh rooms">
                  <Loader2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Enter room name..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleCreateRoom()}
                disabled={isCreating}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateRoom} disabled={isCreating || !newRoomName.trim()} className="flex-1">
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setShowCreateRoom(false); setNewRoomName(""); }} disabled={isCreating}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowCreateRoom(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Room
            </Button>
          )}
        </div>

        <TabsContent value="rooms" className="flex-1 overflow-hidden">
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
            {isLoading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground mb-2">{searchTerm ? "No matching rooms" : "No rooms joined yet"}</p>
                <Button variant="outline" onClick={() => setShowCreateRoom(true)}>
                  Create Your First Room
                </Button>
              </div>
            ) : (
              filteredRooms.map(renderItem)
            )}
          </div>
        </TabsContent>

        <TabsContent value="chats" className="flex-1 overflow-hidden">
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No chats yet</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

LeftSidebar.displayName = "LeftSidebar";

export default LeftSidebar;
