"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";

import { useUser } from "@/lib/store/user";
import {
  useSelectedRoom,
  useAvailableRooms,
  useRoomActions,
  useRoomLoading,
  type RoomWithMembership,
} from "@/lib/store/unused/roomstore";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Loader2,
  MessageSquare,
  Users,
  Plus,
  ChevronLeft,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface LeftSidebarProps {
  user: { id: string } | null;
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
  handleToggleLeft?: () => void;
}

/** Extended local type */
type RoomLocal = RoomWithMembership & {
  unreadCount?: number;
  latestMessage?: string | null;
  online_users?: number;
};

const LeftSidebar = React.memo<LeftSidebarProps>(
  ({ user, isOpen, onClose, className, handleToggleLeft }) => {
    const authUser = useUser((s) => s.user);

    const selectedRoom = useSelectedRoom();
    const availableRooms = useAvailableRooms();
    const isLoading = useRoomLoading();

    const { setSelectedRoomId, createRoom, fetchRooms } = useRoomActions();

    // ------------------------------
    // Local State
    // ------------------------------
    const [searchTerm, setSearchTerm] = useState("");
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const debouncedRef = useRef<NodeJS.Timeout | null>(null);

    // ------------------------------
    // Client-side only: Joined Rooms
    // ------------------------------
    const joinedRooms = useMemo(
      () =>
        availableRooms.filter(
          (r) => r.isMember && r.participationStatus === "accepted"
        ) as RoomLocal[],
      [availableRooms]
    );

    const filteredRooms = useMemo(() => {
      if (!searchTerm.trim()) return joinedRooms;
      const s = searchTerm.toLowerCase();
      return joinedRooms.filter((r) => r.name.toLowerCase().includes(s));
    }, [joinedRooms, searchTerm]);

    // ------------------------------
    // Search input debounce
    // ------------------------------
    const handleSearchChange = useCallback((value: string) => {
      if (debouncedRef.current) clearTimeout(debouncedRef.current);
      debouncedRef.current = setTimeout(() => setSearchTerm(value), 250);
    }, []);

    // ------------------------------
    // Create Room
    // ------------------------------
    const handleCreateRoom = useCallback(async () => {
      const name = newRoomName.trim();
      if (!name) {
        toast.error("Room name cannot be empty");
        return;
      }

      setIsCreating(true);
      try {
        await createRoom(name, false);
        toast.success("Room created");
        setShowCreateRoom(false);
        setNewRoomName("");
        // fetch updated rooms
        fetchRooms({ force: true });
      } catch {
        toast.error("Failed to create room");
      } finally {
        setIsCreating(false);
      }
    }, [newRoomName, createRoom, fetchRooms]);

    // ------------------------------
    // Selecting a room
    // ------------------------------
    const handleRoomClick = useCallback(
      (roomId: string) => {
        setSelectedRoomId(roomId);
        onClose?.();
      },
      [onClose, setSelectedRoomId]
    );

    // ------------------------------
    // Render each room row
    // ------------------------------
    const renderItem = useCallback(
      (room: RoomLocal) => {
        const unread =
          room.unreadCount ??
          (room as any).unread_count ??
          0;

        return (
          <button
            key={room.id}
            onClick={() => handleRoomClick(room.id)}
            className={cn(
              "w-full flex items-start p-3 rounded-lg transition-colors duration-200 mb-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selectedRoom?.id === room.id
                ? "bg-primary/10 border border-primary/20"
                : "hover:bg-muted/40 border border-transparent"
            )}
          >
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
              <AvatarFallback>
                {room.name[0]?.toUpperCase()}
              </AvatarFallback>
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

              <div className="text-xs sm:text-sm text-muted-foreground truncate mb-1.5">
                {room.latestMessage ?? "No messages yet"}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{room.memberCount ?? 0}</span>

                  {room.online_users ? (
                    <span className="text-emerald-500 font-medium">
                      ({room.online_users} online)
                    </span>
                  ) : null}
                </div>

                <div className="text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Joined
                </div>
              </div>
            </div>
          </button>
        );
      },
      [selectedRoom?.id, handleRoomClick]
    );

    // ------------------------------
    // First load — fetch rooms once
    // ------------------------------
    useEffect(() => {
      if (authUser?.id) fetchRooms();
    }, [authUser?.id, fetchRooms]);

    // Debounce cleanup
    useEffect(() => {
      return () => {
        if (debouncedRef.current) clearTimeout(debouncedRef.current);
      };
    }, []);

    // ------------------------------
    // No Auth UI
    // ------------------------------
    if (!authUser) {
      return (
        <div className="flex flex-col h-full items-center justify-center p-4 text-center">
          <Avatar className="h-14 w-14 mb-3 opacity-60">
            <AvatarFallback>?</AvatarFallback>
          </Avatar>

          <p className="text-sm text-muted-foreground mb-3">
            Please sign in to view rooms
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/auth/login")}
          >
            Sign In
          </Button>
        </div>
      );
    }

    // ------------------------------
    // MAIN SIDEBAR UI
    // ------------------------------
    return (
      <div className={cn("flex flex-col h-full w-full", className)}>
        <Tabs defaultValue="rooms" className="flex flex-col h-full w-full">
          {/* HEADER */}
          <div className="flex-none px-4 py-3">
            <div className="flex items-center justify-between gap-4 mb-4">
              <TabsList className="grid w-full grid-cols-2 h-9">
                <TabsTrigger value="rooms">Rooms</TabsTrigger>
                <TabsTrigger value="chats">Chats</TabsTrigger>
              </TabsList>

              {handleToggleLeft && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:inline-flex h-9 w-9"
                  onClick={handleToggleLeft}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}

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

            {/* CREATE + SEARCH */}
            <div className="relative">
              {!showCreateRoom ? (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Search rooms…"
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="h-9 pr-8"
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 w-9"
                      onClick={() => fetchRooms({ force: true })}
                    >
                      <Loader2
                        className={cn(
                          "h-3.5 w-3.5",
                          isLoading && "animate-spin"
                        )}
                      />
                    </Button>
                  </div>

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
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCreateRoom()
                    }
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
                      onClick={() => {
                        setShowCreateRoom(false);
                        setNewRoomName("");
                      }}
                      disabled={isCreating}
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
            <TabsContent value="rooms" className="absolute inset-0 m-0">
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {isLoading && !filteredRooms.length ? (
                  <div className="flex justify-center items-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !filteredRooms.length ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center">
                    <Users className="h-10 w-10 mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      {searchTerm ? "No matching rooms" : "No rooms joined"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredRooms.map(renderItem)}
                  </div>
                )}
              </div>
            </TabsContent>

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
  }
);

LeftSidebar.displayName = "LeftSidebar";

export default LeftSidebar;
