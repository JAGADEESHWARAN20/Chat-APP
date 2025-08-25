"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User as SupabaseUser, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import ChatPresence from "./ChatPresence";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  Settings,
  LogOut,
  ArrowRightLeft,
  LockIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Database } from "@/lib/types/supabase";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useRoomStore } from "@/lib/store/roomstore";
import { useRoomPresence } from "@/hooks/useRoomPresence";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomMemberRow = Database["public"]["Tables"]["room_members"]["Row"];

// Extended Room type including memberCount, isMember, participationStatus
type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
};

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const [availableRooms, setAvailableRooms] = useState<RoomWithMembershipCount[]>([]);
  const supabase = supabaseBrowser();
  const [isSwitchRoomPopoverOpen, setIsSwitchRoomPopoverOpen] = useState(false);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const { selectedRoom, setSelectedRoom, setRooms } = useRoomStore();
  const isMounted = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const UUID_REGEX = useMemo(
    () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    []
  );

  // Compute all room IDs for presence tracking
  const allRoomIds = useMemo(() => {
    const ids = new Set([
      ...availableRooms.map((r) => r.id),
    ]);
    return Array.from(ids);
  }, [availableRooms]);

  const onlineCounts = useRoomPresence(allRoomIds);

  // Check if current user is a member of given room
  const checkRoomMembership = useCallback(
    async (roomId: string) => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .eq("status", "accepted");
      if (error) {
        console.error("Error checking room membership:", error);
        return false;
      }
      return data && data.length > 0 && data[0].status === "accepted";
    },
    [user, supabase]
  );

  // Fetch all available rooms where user is a member with memberCount included
  const fetchAvailableRooms = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setAvailableRooms([]);
      setRooms([]);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch accepted memberships for user + associated rooms
      const { data: memberships, error } = await supabase
        .from("room_members")
        .select("room_id, rooms(id, name, is_private, created_by, created_at)")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (error) {
        setAvailableRooms([]);
        setRooms([]);
        setIsLoading(false);
        return;
      }

      const joinedRoomsRaw = (memberships || [])
        .map((m) => m.rooms as Room)
        .filter(Boolean);

      // Collect room IDs for count query
      const roomIds = joinedRoomsRaw.map((r) => r.id);
      let countsMap = new Map<string, number>();

      if (roomIds.length > 0) {
        const { data: membersData, error: membersError } = await supabase
          .from("room_members")
          .select("room_id")
          .in("room_id", roomIds)
          .eq("status", "accepted");

        if (membersError) {
          console.error("Error fetching member counts:", membersError);
        }

        // Aggregate counts client-side
        membersData?.forEach((m: Pick<RoomMemberRow, "room_id">) => {
          countsMap.set(m.room_id, (countsMap.get(m.room_id) ?? 0) + 1);
        });
      }

      // Attach memberCount, isMember:true, participationStatus to each room
      const joinedRooms: RoomWithMembershipCount[] = joinedRoomsRaw.map((room) => ({
        ...room,
        memberCount: countsMap.get(room.id) ?? 0,
        isMember: true,
        participationStatus: "accepted",
      }));

      setAvailableRooms(joinedRooms);
      setRooms(joinedRooms);
    } catch (error) {
      setAvailableRooms([]);
      setRooms([]);
      toast.error("An error occurred while fetching rooms");
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase, setRooms]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("room-members-listener")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members" },
        async (payload: RealtimePostgresChangesPayload<RoomMemberRow>) => {
          // SAFELY extract room_id from new/old rows
          const room_id =
            (payload.new as RoomMemberRow | null)?.room_id ??
            (payload.old as RoomMemberRow | null)?.room_id;

          if (!room_id) return;

          // Recalculate memberCount for only this room
          const { count: totalCount } = await supabase
            .from("room_members")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room_id)
            .eq("status", "accepted");

          // Update only that room in availableRooms
          setAvailableRooms((prev) =>
            prev.map((room) =>
              room.id === room_id ? { ...room, memberCount: totalCount ?? 0 } : room
            )
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, user]);

  const handleRoomSwitch = useCallback(
    async (newRoomId: string, prevRoomId: string | null) => {
      if (!user) {
        toast.error("You must be logged in to switch rooms");
        return;
      }

      try {
        const response = await fetch(`/api/rooms/switch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: newRoomId }),
        });

        const result = await response.json();
        if (!response.ok) {
          toast.error(result.message || "Failed to switch room");
          return;
        }

        // Find the switched room from availableRooms
        const switchedRoom = availableRooms.find((r) => r.id === newRoomId);

        if (switchedRoom) {
          // Update selected room immediately
          setSelectedRoom({ ...switchedRoom, isMember: true });

          // Locally patch availableRooms so popover shows updated status
          setAvailableRooms((prev) =>
            prev.map((room) =>
              room.id === newRoomId
                ? { ...room, isMember: true, participationStatus: "accepted" }
                : room.id === prevRoomId
                  ? { ...room, isMember: false }
                  : room
            )
          );
        }

        setIsSwitchRoomPopoverOpen(false);
        toast.success(`Switched to ${switchedRoom?.name || "room"}`);

        // Refresh full list in background
        await fetchAvailableRooms();
      } catch (err) {
        console.error("Room switch failed:", err);
        toast.error("Failed to switch room");
      }
    },
    [user, availableRooms, setSelectedRoom, setAvailableRooms, fetchAvailableRooms]
  );

  const handleLeaveRoom = useCallback(
    async () => {
      if (!user) {
        toast.error("Please log in to leave a room");
        return;
      }

      if (!selectedRoom) {
        toast.error("No room selected");
        return;
      }

      if (!selectedRoom.id || !UUID_REGEX.test(selectedRoom.id)) {
        toast.error("Invalid room ID");
        return;
      }

      try {
        setIsLeaving(true);
        const { error: membersError } = await supabase
          .from("room_members")
          .delete()
          .eq("room_id", selectedRoom.id)
          .eq("user_id", user.id);

        const { error: participantsError } = await supabase
          .from("room_participants")
          .delete()
          .eq("room_id", selectedRoom.id)
          .eq("user_id", user.id);

        if (membersError || participantsError) {
          throw new Error(
            membersError?.message || participantsError?.message || "Failed to leave room"
          );
        }

        toast.success("Successfully left the room");
        setIsMember(false);
        await fetchAvailableRooms();

        const { data: remainingRooms } = await supabase
          .from("room_members")
          .select("room_id")
          .eq("user_id", user.id)
          .eq("status", "accepted");

        if (remainingRooms && remainingRooms.length === 0) {
          setSelectedRoom(null);
          router.push("/");
        } else {
          const defaultRoom = availableRooms.find((room) => room.name === "General Chat");
          if (defaultRoom) {
            setSelectedRoom(defaultRoom);
          } else {
            setSelectedRoom(null);
            router.push("/");
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to leave room");
      } finally {
        setIsLeaving(false);
      }
    },
    [
      user,
      selectedRoom,
      UUID_REGEX,
      supabase,
      fetchAvailableRooms,
      setSelectedRoom,
      router,
      availableRooms,
    ]
  );

  useEffect(() => {
    if (!user?.id) return;
    fetchAvailableRooms();
  }, [user, fetchAvailableRooms]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedRoom && user) {
      checkRoomMembership(selectedRoom.id).then(setIsMember);
    } else {
      setIsMember(false);
    }
  }, [selectedRoom, user, checkRoomMembership]);

  useEffect(() => {
    if (!selectedRoom && availableRooms.length > 0) {
      useRoomStore.getState().initializeDefaultRoom();
    }
  }, [selectedRoom, availableRooms]);

  return (
    <header className="h-[3.6em] lg:w-[50vw] w-[95vw] flex items-center justify-between px-[1.5vw] glass-gradient-header text-foreground bg-background z-10 dark:text-foreground dark:bg-background">
      <h1 className="text-[2.5vw] lg:text-[1em] flex flex-col font-semibold py-[0.8em] lg:py-[2em] items-start">
        {selectedRoom ? `#${selectedRoom.name}` : "Daily Chat"}
        <ChatPresence />
      </h1>
      <div className="flex items-center space-x-[1.2vw]">
        {/* Message Search */}
        <Popover open={isMessageSearchOpen} onOpenChange={setIsMessageSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="center"
            sideOffset={0}
            className="w-[300px] p-4 bg-popover text-popover-foreground backdrop-blur-lg border border-border shadow-xl rounded-xl"
          >
            <div className="p-1">
              <div className="flex justify-between items-center mb-[0.5em]">
                <h3 className="font-bold text-[1.2em]">Search Messages</h3>
              </div>
              <Input
                type="text"
                placeholder="Search messages..."
                value={messageSearchQuery}
                onChange={(e) => setMessageSearchQuery(e.target.value)}
                className="mb-1 bg-muted/50 border-border text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
              {/* Message search results would go here */}
              <p className="text-sm text-muted-foreground mt-2">
                Search functionality coming soon...
              </p>
            </div>
          </PopoverContent>
        </Popover>

        {/* Switch Room */}
        {selectedRoom && (
          <Popover open={isSwitchRoomPopoverOpen} onOpenChange={setIsSwitchRoomPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <ArrowRightLeft className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="center"
              sideOffset={0}
              className="
                !w-[min(32em,95vw)]
                !h-[min(30em,85vh)]
                md:!w-[32em]
                md:!h-[32em]
                mr-[2.3vw]
                lg:mt-[1vw]
                mt-[1em]
                mb-[2vh]
                bg-popover
                text-popover-foreground
                backdrop-blur-xl
                rounded-2xl
                p-[.7em]
                border
                border-border
                !max-w-[95vw]
                !max-h-[99vh]
                shadow-xl
              "
            >
              <div className="p-[.3vw]">
                <h3 className="font-semibold text-[1.1em] mb-2">Switch Room</h3>

                {availableRooms.length === 0 ? (
                  <p className="text-[1em] text-muted-foreground">No rooms available</p>
                ) : (
                  <ul className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-none lg:scrollbar-custom">
                    {availableRooms.map((room) => (
                      <li
                        key={room.id}
                        className="
                          flex items-center justify-between p-2 rounded-lg 
                          bg-card hover:bg-accent transition-colors
                        "
                      >
                        <div className="flex items-center gap-3">
                          {/* Room icon */}
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                            <span className="text-lg font-semibold text-indigo-500">
                              {room.name.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          {/* Room info */}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{room.name}</span>
                              {room.is_private && (
                                <LockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                            <p className="text-sm text-green-500">{onlineCounts.get(room.id) ?? 0} active</p>
                          </div>
                        </div>

                        {/* Toggle switch */}
                        <Switch
                          checked={selectedRoom?.id === room.id}
                          onCheckedChange={() => handleRoomSwitch(room.id, selectedRoom?.id)}
                          className="
                            data-[state=checked]:bg-indigo-600 
                            data-[state=unchecked]:bg-muted
                          "
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  );
}