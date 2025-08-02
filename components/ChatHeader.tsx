"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import ChatPresence from "./ChatPresence";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LogOut,
  ArrowRightLeft,
  LockIcon,
} from "lucide-react";
import { Database } from "@/lib/types/supabase";
import { toast } from "sonner";
import { useRoomStore } from "@/lib/store/roomstore";
import { Switch } from "@/components/ui/switch";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];

type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
};

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [isSwitchRoomPopoverOpen, setIsSwitchRoomPopoverOpen] = useState(false);
  const { selectedRoom, setSelectedRoom, rooms } = useRoomStore();
  const isMounted = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const UUID_REGEX = useMemo(
    () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    []
  );

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

  const checkRoomParticipation = useCallback(
    async (roomId: string) => {
      if (!user) return null;
      const { data: memberStatus, error: memberError } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (memberError) {
        console.error("Error checking room membership for participation status:", memberError);
      }

      const { data: participantStatus, error: participantError } = await supabase
        .from("room_participants")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (participantError) {
        console.error("Error checking room participation status:", participantError);
      }

      if (memberStatus && memberStatus.length > 0 && memberStatus[0].status === "accepted") {
        return "accepted";
      }
      if (participantStatus && participantStatus.length > 0 && participantStatus[0].status === "accepted") {
        return "accepted";
      }
      if (memberStatus && memberStatus.length > 0 && memberStatus[0].status === "pending") {
        return "pending";
      }
      if (participantStatus && participantStatus.length > 0 && participantStatus[0].status === "pending") {
        return "pending";
      }
      return null;
    },
    [user, supabase]
  );

  const handleRoomSwitch = useCallback(
    async (room: RoomWithMembershipCount) => {
      if (!user) {
        toast.error("You must be logged in to switch rooms");
        return;
      }
      try {
        const response = await fetch(`/api/rooms/switch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roomId: room.id }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.code === "AUTH_REQUIRED") {
            toast.error("Authentication required to switch rooms.");
          } else if (result.code === "ROOM_NOT_FOUND") {
            toast.error("Room not found.");
          } else if (result.status === "pending") {
            toast.info(result.message || "Switch request sent to room owner for approval.");
          } else {
            toast.error(result.message || "Failed to switch room.");
          }
          return;
        }

        let newParticipationStatus: string | null = "accepted";
        let newIsMember = true;

        if (result.status === "pending") {
          newParticipationStatus = "pending";
          newIsMember = false;
        }

        const updatedRoomWithMembership: RoomWithMembershipCount = {
          ...room,
          isMember: newIsMember,
          participationStatus: newParticipationStatus,
          memberCount: room.memberCount,
        };

        setSelectedRoom(updatedRoomWithMembership);
        setIsSwitchRoomPopoverOpen(false);
        setIsMember(newIsMember);
        toast.success(result.message || `Switched to ${room.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to switch room");
      }
    },
    [user, setSelectedRoom]
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

        const { data: remainingRooms } = await supabase
          .from("room_members")
          .select("room_id")
          .eq("user_id", user.id)
          .eq("status", "accepted");

        if (remainingRooms && remainingRooms.length === 0) {
          setSelectedRoom(null);
          router.push("/");
        } else {
          const defaultRoom = rooms.find((room) => room.name === "General Chat");
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
    [user, selectedRoom, UUID_REGEX, supabase, setSelectedRoom, router, rooms]
  );

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
    if (!selectedRoom && rooms.length > 0) {
      useRoomStore.getState().initializeDefaultRoom();
    }
  }, [selectedRoom, rooms]);

  return (
    <header className="
  h-[3.6em]
  w-full
  flex items-center justify-between
  px-4 lg:px-8
  glass-gradient-header
  text-foreground bg-background
  z-10 dark:text-foreground dark:bg-background
">
     <h1 className="
        text-[1.1em] lg:text-[1.3em]
        flex flex-col font-semibold py-[0.35em] items-start
      ">
        {selectedRoom ? `#${selectedRoom.name}` : "Daily Chat"}
        <ChatPresence />
      </h1>

      <div className="flex items-center space-x-[1.2vw]">
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
                bg-gray-800/70
                backdrop-blur-xl
                rounded-2xl
                p-[.7em]
                text-white
                !max-w-[95vw]
                !max-h-[99vh]
              "
            >
              <div className="p-[.3vw]">
                <h3 className="font-semibold text-[1.1em] mb-2">Switch Room</h3>
                {rooms.length === 0 ? (
                  <p className="text-[1em] text-gray-400">No rooms available</p>
                ) : (
                  <ul className="space-y-2">
                    {rooms.map((room) => (
                      <li key={room.id} className="flex items-center justify-between">
                        <span className="text-[1em] flex gap-2 font-semibold text-white">
                          {room.name} ({room.memberCount ?? 0}){" "}
                          <span>{room.is_private && <LockIcon />}</span>
                        </span>
                        {room.participationStatus === "pending" ? (
                          <span className="text-[1em] text-muted-foreground">Pending</span>
                        ) : (
                          <Switch
                            checked={selectedRoom?.id === room.id}
                            onCheckedChange={() => handleRoomSwitch(room)}
                            className="data-[state=checked]:bg-blue-400 data-[state=unchecked]:bg-gray-200"
                          />
                        )}
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
