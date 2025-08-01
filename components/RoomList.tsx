"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRoomStore } from "@/lib/store/roomstore";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useUser } from "@/lib/store/user";
import { IRoom, IRoomParticipant } from "@/lib/types/rooms";
import { ArrowRight, LogOut } from "lucide-react";
import debounce from "lodash.debounce";

export default function RoomList() {
  const [userParticipations, setUserParticipations] = useState<IRoomParticipant[]>([]);
  const { rooms, setRooms, selectedRoom, setSelectedRoom } = useRoomStore();
  const supabase = supabaseBrowser();
  const user = useUser((state) => state.user);

  const refreshDebounced = useRef(
    debounce(async () => {
      await refreshRooms();
    }, 500)
  ).current;

  const refreshRooms = async () => {
    if (!user) {
      toast.error("You must be logged in to refresh rooms");
      return;
    }

    try {
      const response = await fetch("/api/rooms/all");
      if (!response.ok) {
        throw new Error("Failed to fetch rooms");
      }

      const { success, rooms: fetchedRooms } = await response.json();
      if (success && fetchedRooms) {
        const roomsWithMemberCount = await Promise.all(
          fetchedRooms.map(async (room: IRoom) => {
            const { count, error } = await supabase
              .from("room_members")
              .select("id", { count: "exact" })
              .eq("room_id", room.id)
              .eq("status", "accepted");
            const memberCount = error ? 0 : (count || 0);
            return {
              ...room,
              isMember: userParticipations.some((p) => p.room_id === room.id && p.status === "accepted"),
              participationStatus: userParticipations.find((p) => p.room_id === room.id)?.status || null,
              memberCount,
            };
          })
        );
        setRooms(roomsWithMemberCount);
      }
    } catch (err) {
      toast.error("Failed to refresh rooms");
      console.error(err);
    }
  };

  const handleRoomSwitch = useCallback(
    async (room: IRoom) => {
      if (!user) {
        toast.error("You must be logged in to switch rooms");
        return;
      }

      try {
        const response = await fetch("/api/rooms/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to switch room");
        }

        const updatedRoom = rooms.find((r) => r.id === room.id) || {
          ...room,
          isMember: userParticipations.some((p) => p.room_id === room.id && p.status === "accepted"),
          participationStatus: userParticipations.find((p) => p.room_id === room.id)?.status || null,
          memberCount: 0,
        };
        setSelectedRoom(updatedRoom);
        toast.success("Successfully switched room");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to switch room");
      }
    },
    [user, setSelectedRoom, userParticipations, rooms]
  );

  const handleLeaveRoom = async (roomId: string) => {
    if (!user) {
      toast.error("You must be logged in to leave a room");
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/leave`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to leave room");
      }

      const { hasOtherRooms } = await response.json();
      toast.success("Left room successfully");
      if (!hasOtherRooms) {
        setSelectedRoom(null);
      }
      refreshDebounced();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave room");
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!user) {
      toast.error("You must be logged in to join a room");
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to join room");
      }

      const data = await response.json();
      toast.success(data.message);
      if (!data.status || data.status === "accepted") {
        const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).single();
        if (room) {
          await handleRoomSwitch(room);
        }
      } else if (data.status === "pending") {
        await fetchParticipations();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join room");
    }
  };

  const canJoinRoom = (room: IRoom) => {
    const participation = userParticipations.find((p) => p.room_id === room.id);
    return !participation || participation.status === "rejected";
  };

  const fetchParticipations = useCallback(async () => {
    if (!user) return;

    try {
      const { data: participations, error } = await supabase
        .from("room_participants")
        .select("*")
        .eq("user_id", user.id);
      if (error) {
        toast.error("Failed to fetch participations");
        console.error("Error fetching participations:", error);
        return;
      }

      if (participations) {
        setUserParticipations(participations);
      }
    } catch (err) {
      toast.error("Unexpected error fetching participations");
      console.error("Unexpected error:", err);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;

    const fetchRooms = async () => {
      try {
        const response = await fetch("/api/rooms/all");
        if (!response.ok) {
          throw new Error("Failed to fetch rooms");
        }

        const { success, rooms: fetchedRooms } = await response.json();
        if (success && fetchedRooms) {
          const roomsWithMemberCount = await Promise.all(
            fetchedRooms.map(async (room: IRoom) => {
              const { count, error } = await supabase
                .from("room_members")
                .select("id", { count: "exact" })
                .eq("room_id", room.id)
                .eq("status", "accepted");
              const memberCount = error ? 0 : (count || 0);
              return {
                ...room,
                isMember: userParticipations.some((p) => p.room_id === room.id && p.status === "accepted"),
                participationStatus: userParticipations.find((p) => p.room_id === room.id)?.status || null,
                memberCount,
              };
            })
          );
          setRooms(roomsWithMemberCount);
        }
      } catch (err) {
        toast.error("Unexpected error fetching rooms");
        console.error("Unexpected error:", err);
      }
    };

    const initializeActiveRoom = async () => {
      if (selectedRoom) return; // Skip if already selected
      const { data: activeRooms, error: activeRoomsError } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", user.id)
        .eq("active", true)
        .limit(1); // Ensure only one active room
      if (activeRoomsError) {
        console.error("Error fetching active rooms:", activeRoomsError.message);
        toast.error("Failed to initialize active room");
        return;
      }

      if (activeRooms && activeRooms.length > 0) {
        const activeRoom = rooms.find((r) => r.id === activeRooms[0].room_id);
        if (activeRoom) setSelectedRoom(activeRoom);
      } else {
        const generalChat = rooms.find((r) => r.name === "General Chat");
        if (generalChat && generalChat.created_by === user.id) {
          setSelectedRoom(generalChat);
        } else {
          setSelectedRoom(null);
        }
      }
    };

    fetchRooms().then(() => initializeActiveRoom());

    const roomChannel = supabase
      .channel("room_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            refreshDebounced();
          }
        }
      )
      .subscribe();

    const participantsChannel = supabase
      .channel("room_participants_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            fetchParticipations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [user, supabase, setRooms, setSelectedRoom, rooms, userParticipations,selectedRoom, fetchParticipations, refreshDebounced]);

  if (!user) {
    return (
      <div className="w-64 border-r p-4 bg-white dark:bg-gray-800">
        <p className="text-muted-foreground">Please login to view rooms</p>
      </div>
    );
  }

  return (
    <div className="w-64 border-r p-4 bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Rooms</h2>
        <Button size="sm" variant="outline" onClick={refreshRooms}>
          Refresh
        </Button>
      </div>
      <div className="space-y-2">
        {rooms.map((room) => {
          const participation = userParticipations.find((p) => p.room_id === room.id);
          const isMember = participation?.status === "accepted";
          const isPending = participation?.status === "pending";

          return (
            <div
              key={room.id}
              className="flex justify-between items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Button
                variant={selectedRoom?.id === room.id ? "secondary" : "ghost"}
                className="w-full justify-start text-gray-900 dark:text-white"
                onClick={() => {
                  if (isMember) {
                    handleRoomSwitch(room);
                  } else if (canJoinRoom(room)) {
                    handleJoinRoom(room.id);
                  }
                }}
                disabled={isPending}
              >
                <span className="truncate flex items-center gap-2">
                  {room.name}
                  {room.is_private && " 🔒"}
                  {isMember && <ArrowRight className="h-4 w-4" />}
                </span>
              </Button>

              {!isMember && !isPending && (
                <Button size="sm" variant="outline" onClick={() => handleJoinRoom(room.id)}>
                  Join
                </Button>
              )}

              {isMember && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleLeaveRoom(room.id)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}

              {isPending && (
                <span className="text-sm text-muted-foreground">Pending</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
