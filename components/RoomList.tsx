// components/RoomList.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import { toast } from "@/components/ui/sonner"
import { useUser } from "@/lib/store/user";
import type { Database } from "@/lib/types/supabase";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoomCard } from "./ui/room-card";
import type { RoomWithMembership } from "@/lib/store/roomstore"; // ← Single source: Use store's type

// Define missing type from Supabase schema (IRoomParticipant was in deleted file)
type IRoomParticipant = Database["public"]["Tables"]["room_participants"]["Row"];

export default function RoomList() {
  const [userParticipations, setUserParticipations] = useState<IRoomParticipant[]>([]);

  // Only select what we need from the store
  const {
    rooms,
    selectedRoomId,
    setSelectedRoomId,
    fetchRooms
  } = useUnifiedRoomStore((s) => ({
    rooms: s.rooms,
    selectedRoomId: s.selectedRoomId,
    setSelectedRoomId: s.setSelectedRoomId,
    fetchRooms: s.fetchRooms,
  }));

  const supabase = getSupabaseBrowserClient();
  const user = useUser((state) => state.user);

  const refreshRooms = async () => {
    if (!user) {
      toast.error("You must be logged in to refresh rooms");
      return;
    }

    try {
      await fetchRooms({ force: true } as any);
      toast.success("Rooms refreshed");
    } catch (err) {
      toast.error("Failed to refresh rooms");
      console.error(err);
    }
  };

  const handleRoomSwitch = useCallback(
    async (room: RoomWithMembership) => {
      if (!user) {
        toast.error("You must be logged in to switch rooms");
        return;
      }

      try {
        // If user is already a member, just set selection locally
        if (room.isMember) {
          setSelectedRoomId(room.id);
          toast.success("Switched to room");
          return;
        }

        // If not a member, call server endpoint to switch (fallback)
        const response = await fetch("/api/rooms/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to switch room");
        }

        // Refresh canonical state then set selected room id
        await fetchRooms({ force: true } as any);
        const updatedRooms = useUnifiedRoomStore.getState().rooms;
        const updatedRoom = updatedRooms.find((r) => r.id === room.id);
        if (updatedRoom) {
          setSelectedRoomId(updatedRoom.id);
          toast.success("Successfully switched room");
        } else {
          // Still switch locally as fallback
          setSelectedRoomId(room.id);
          toast.success("Switched to room (optimistic)");
        }
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to switch room");
      }
    },
    [user, setSelectedRoomId, fetchRooms]
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

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.error || "Failed to leave room");
      }

      // If room deleted by owner action, backend may return deleted/owner_deleted
      if (json?.deleted || json?.action === "owner_deleted") {
        toast.success(json?.message || "Room removed");
        // refresh and clear selection if needed
        await fetchRooms({ force: true } as any);
        setSelectedRoomId(null);
        return;
      }

      // Standard leave
      toast.success(json?.message || "Left room successfully");
      // if user had no other active rooms, clear selection
      if (!json?.hasOtherRooms) {
        setSelectedRoomId(null);
      }
      await fetchRooms({ force: true } as any);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to leave room");
      console.error("Leave error:", error);
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

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to join room");
      }

      // Show a single toast depending on status
      if (!data?.status || data?.status === "accepted") {
        toast.success(data?.message || "Joined room");
        await fetchRooms({ force: true } as any);
        const updatedRooms = useUnifiedRoomStore.getState().rooms;
        const updatedRoom = updatedRooms.find((r) => r.id === roomId);
        if (updatedRoom) {
          // automatically switch into room
          await handleRoomSwitch(updatedRoom);
        }
      } else if (data?.status === "pending") {
        toast.info(data?.message || "Join request sent — awaiting approval");
        await fetchParticipations();
      } else {
        toast.success(data?.message || "Request processed");
        await fetchRooms({ force: true } as any);
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to join room");
      console.error("Join error:", error);
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

    let mounted = true;

    const initialize = async () => {
      await fetchParticipations();
      await fetchRooms({ force: true } as any);

      // Get active rooms for the user
      const { data: activeRooms, error: activeRoomsError } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", user.id)
        .eq("active", true);

      if (activeRoomsError) {
        console.error("Error fetching active rooms:", activeRoomsError.message);
        if (mounted) toast.error("Failed to initialize active room");
        return;
      }

      const storeRooms = useUnifiedRoomStore.getState().rooms;

      if (!activeRooms?.length) {
        // no active rooms: pick general or clear
        const generalChat = storeRooms.find((r) => r.name === "General Chat");
        if (generalChat) {
          setSelectedRoomId(generalChat.id);
        } else {
          setSelectedRoomId(null);
        }
        return;
      }

      if (activeRooms.length > 1) {
        const firstActiveRoomId = activeRooms[0].room_id;
        // make only the first active, deactivate others
        const { error: fixError } = await supabase
          .from("room_members")
          .update({ active: false })
          .eq("user_id", user.id)
          .neq("room_id", firstActiveRoomId);

        if (fixError) {
          console.error("Error fixing multiple active rooms:", fixError.message);
          if (mounted) toast.error("Failed to fix active room state");
          return;
        }

        const activeRoom = storeRooms.find((r) => r.id === firstActiveRoomId);
        if (activeRoom) setSelectedRoomId(activeRoom.id);
        else setSelectedRoomId(null);
      } else {
        const activeRoom = storeRooms.find((r) => r.id === activeRooms[0].room_id);
        if (activeRoom) setSelectedRoomId(activeRoom.id);
        else setSelectedRoomId(null);
      }
    };

    initialize();

    // realtime subscriptions
    const roomChannel = supabase
      .channel("room_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => fetchRooms({ force: true } as any)
      )
      .subscribe();

    const participantChannel = supabase
      .channel("room_participants_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants" },
        () => fetchParticipations()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(participantChannel);
    };
  }, [user, supabase, fetchRooms, fetchParticipations, setSelectedRoomId]);

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
          const isSelected = selectedRoomId === room.id;

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
                userCount={room.memberCount || 0}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
