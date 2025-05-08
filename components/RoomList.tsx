"use client";

import { useState, useEffect } from "react";
import { useRoomStore } from "@/lib/store/roomstore";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useUser } from "@/lib/store/user";
import { IRoom, IRoomParticipant } from "@/lib/types/rooms";
import { ArrowRight, LogOut } from "lucide-react";

export default function RoomList() {
  const [userParticipations, setUserParticipations] = useState<IRoomParticipant[]>([]);
  const { rooms, setRooms, selectedRoom, setSelectedRoom } = useRoomStore();
  const supabase = supabaseBrowser();
  const user = useUser((state) => state.user);

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

      const { success, rooms } = await response.json();
      if (success && rooms) {
        setRooms(rooms as IRoom[]);
        toast.success("Rooms refreshed");
      }
    } catch (err) {
      toast.error("Failed to refresh rooms");
      console.error(err);
    }
  };

  const handleRoomSwitch = async (room: IRoom) => {
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
        const error = await response.json();
        throw new Error(error.error || "Failed to switch room");
      }

      setSelectedRoom(room);
      toast.success(`Switched to ${room.name}`);
    } catch (err) {
      toast.error("Failed to switch room");
      console.error(err);
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    if (!user) {
      toast.error("You must be logged in to leave a room");
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/leave`, {
        method: "PATCH", // Updated to match the PATCH method in the API
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to leave room");
      }

      const { hasOtherRooms } = await response.json();
      toast.success("Left room successfully");
      if (!hasOtherRooms) {
        setSelectedRoom(null); // No rooms left, show ChatAbout
      }
      await refreshRooms();
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
        const { data: room } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", roomId)
          .single();
        if (room) {
          await handleRoomSwitch(room);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join room");
    }
  };

  const canJoinRoom = (room: IRoom) => {
    const participation = userParticipations.find((p) => p.room_id === room.id);
    return !participation || participation.status === "rejected";
  };

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
          setRooms(fetchedRooms as IRoom[]);
        }
      } catch (err) {
        toast.error("Unexpected error fetching rooms");
        console.error("Unexpected error:", err);
      }
    };

    const initializeActiveRoom = async () => {
      const { data, error } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", user.id)
        .eq("active", true)
        .single();
      if (data) {
        const activeRoom = rooms.find((r) => r.id === data.room_id);
        if (activeRoom) {
          setSelectedRoom(activeRoom);
        }
      }
    };

    fetchRooms().then(() => initializeActiveRoom());

    const roomChannel = supabase
      .channel("room_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => fetchRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [user, supabase, setRooms, setSelectedRoom, rooms]);

  useEffect(() => {
    if (!user) return;

    const fetchParticipations = async () => {
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
          setUserParticipations(participations); // No need to cast status, type now matches
        }
      } catch (err) {
        toast.error("Unexpected error fetching participations");
        console.error("Unexpected error:", err);
      }
    };

    fetchParticipations();

    const channel = supabase
      .channel("room_participants_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants" },
        () => fetchParticipations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  if (!user) {
    return (
      <div className="w-64 border-r p-4">
        <p className="text-muted-foreground">Please login to view rooms</p>
      </div>
    );
  }

  return (
    <div className="w-64 border-r p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Rooms</h2>
        <Button size="sm" onClick={refreshRooms}>
          Refresh
        </Button>
      </div>
      <div className="space-y-2">
        {rooms.map((room) => {
          const participation = userParticipations.find((p) => p.room_id === room.id);
          const isMember = participation?.status === "accepted";

          return (
            <div key={room.id} className="flex justify-between items-center gap-2">
              <Button
                variant={selectedRoom?.id === room.id ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  if (isMember) {
                    handleRoomSwitch(room);
                  }
                }}
                disabled={!isMember}
              >
                <span className="truncate flex items-center gap-2">
                  {room.name}
                  {room.is_private && " 🔒"}
                  {isMember && <ArrowRight className="h-4 w-4" />}
                </span>
              </Button>

              {!isMember && canJoinRoom(room) && (
                <Button size="sm" onClick={() => handleJoinRoom(room.id)}>
                  Join
                </Button>
              )}

              {isMember && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleLeaveRoom(room.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}

              {participation?.status === "pending" && (
                <span className="text-sm text-muted-foreground">Pending</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}