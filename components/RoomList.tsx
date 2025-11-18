"use client";

import { useState, useEffect, useCallback } from "react";
import { useRoomStore } from "@/lib/store/roomstore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useUser } from "@/lib/store/user";
import { Database } from "@/lib/types/supabase";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoomCard } from "./ui/room-card";
import { RoomWithMembership } from "@/lib/store/roomstore"; // ← Single source: Use store's type

// Define missing type from Supabase schema (IRoomParticipant was in deleted file)
type IRoomParticipant = Database["public"]["Tables"]["room_participants"]["Row"];

export default function RoomList() {
  const [userParticipations, setUserParticipations] = useState<IRoomParticipant[]>([]);
  const { 
    rooms, 
    setRooms, 
    selectedRoom, 
    setSelectedRoom,
    fetchRooms // ← Use store's RPC fetch (includes memberCount!)
  } = useRoomStore();
  const supabase = getSupabaseBrowserClient();
  const user = useUser((state) => state.user);

  const refreshRooms = async () => {
    if (!user) {
      toast.error("You must be logged in to refresh rooms");
      return;
    }

    try {
      await fetchRooms(); // ← Delegate to store: fetches + transforms with memberCount
      toast.success("Rooms refreshed");
    } catch (err) {
      toast.error("Failed to refresh rooms");
      console.error(err);
    }
  };

  const handleRoomSwitch = useCallback(async (room: RoomWithMembership) => {
    if (!user) {
      toast.error("You must be logged in to switch rooms");
      return;
    }

    try {
      // Optimistic switch (no API needed if already member)
      if (room.isMember) {
        setSelectedRoom(room); // ← Already full type with memberCount
        toast.success("Switched to room");
        return;
      }

      // Fallback: API switch if needed
      const response = await fetch("/api/rooms/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to switch room");
      }

      // Refresh to get updated membership + counts
      await fetchRooms();
      const updatedRoom = rooms.find((r) => r.id === room.id);
      if (updatedRoom) {
        setSelectedRoom(updatedRoom);
        toast.success("Successfully switched room");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to switch room");
    }
  }, [user, setSelectedRoom, fetchRooms, rooms]);

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
      await fetchRooms(); // ← Refresh via store
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
        await fetchRooms(); // ← Refresh to update membership + counts
        const updatedRoom = rooms.find((r) => r.id === roomId);
        if (updatedRoom) {
          await handleRoomSwitch(updatedRoom);
        }
      } else if (data.status === "pending") {
        await fetchParticipations();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join room");
    }
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

      setUserParticipations(participations || []);
    } catch (err) {
      toast.error("Unexpected error fetching participations");
      console.error("Unexpected error:", err);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;

    const initialize = async () => {
      await fetchParticipations();
      await fetchRooms(); // ← Store handles transformation with memberCount

      // Initialize active room logic
      const { data: activeRooms, error: activeRoomsError } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", user.id)
        .eq("active", true);
      
      if (activeRoomsError) {
        console.error("Error fetching active rooms:", activeRoomsError.message);
        toast.error("Failed to initialize active room");
        return;
      }

      if (!activeRooms?.length) {
        const generalChat = rooms.find((r) => r.name === "General Chat");
        if (generalChat && generalChat.created_by === user.id) {
          await handleRoomSwitch(generalChat);
        } else {
          setSelectedRoom(null);
        }
        return;
      }

      if (activeRooms.length > 1) {
        const firstActiveRoomId = activeRooms[0].room_id;
        const { error: fixError } = await supabase
          .from("room_members")
          .update({ active: false })
          .eq("user_id", user.id)
          .neq("room_id", firstActiveRoomId);
        if (fixError) {
          console.error("Error fixing multiple active rooms:", fixError.message);
          toast.error("Failed to fix active room state");
          return;
        }
        const activeRoom = rooms.find((r) => r.id === firstActiveRoomId);
        if (activeRoom) {
          setSelectedRoom(activeRoom);
        } else {
          setSelectedRoom(null);
        }
      } else {
        const activeRoom = rooms.find((r) => r.id === activeRooms[0].room_id);
        if (activeRoom) {
          setSelectedRoom(activeRoom);
        } else {
          setSelectedRoom(null);
        }
      }
    };

    initialize();

    // Realtime: Rooms changes
    const roomChannel = supabase
      .channel("room_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => fetchRooms()
      )
      .subscribe();

    // Realtime: Participants changes
    const participantChannel = supabase
      .channel("room_participants_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants" },
        () => fetchParticipations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(participantChannel);
    };
  }, [user, supabase, fetchRooms, fetchParticipations, handleRoomSwitch, rooms, setSelectedRoom]);

  if (!user) {
    return (
      <div className="w-64 border-r p-4">
        <p className="text-muted-foreground">Please login to view rooms</p>
      </div>
    );
  }

  return (
    <div className="w-[320px] p-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Rooms</h2>
        <Button size="sm" onClick={refreshRooms} variant="ghost">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3 overflow-y-auto flex-grow">
        {rooms.map((room) => {
          const participation = userParticipations.find((p) => p.room_id === room.id);
          const isSelected = selectedRoom?.id === room.id;
          
          return (
            <div
              key={room.id}
              onClick={() => participation?.status === "accepted" && handleRoomSwitch(room)}
              className={cn(
                "cursor-pointer transition-transform duration-200",
                participation?.status === "accepted" && "hover:scale-[1.02]"
              )}
            >
              <RoomCard
                room={room}
                isSelected={isSelected}
                onJoin={() => handleJoinRoom(room.id)}
                onLeave={() => handleLeaveRoom(room.id)}
                participationStatus={participation?.status || null}
                userCount={room.memberCount || 0} // ← Use memberCount from store type
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}