"use client";

import { useState, useEffect, useCallback } from "react";
import { useUnifiedStore } from "@/lib/store/unified-roomstore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import { toast } from "@/components/ui/sonner";
import { useUser } from "@/lib/store/user";
import type { Database } from "@/lib/types/supabase";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoomCard } from "./ui/room-card";
import type { RoomData } from "@/lib/store/unified-roomstore";

// Local participation type
type IRoomParticipant =
  Database["public"]["Tables"]["room_participants"]["Row"];

export default function RoomList() {
  const [userParticipations, setUserParticipations] =
    useState<IRoomParticipant[]>([]);

  const { rooms, selectedRoomId, setSelectedRoomId, fetchRooms } =
    useUnifiedStore((s) => ({
      rooms: s.rooms,
      selectedRoomId: s.selectedRoomId,
      setSelectedRoomId: s.setSelectedRoomId,
      fetchRooms: s.fetchRooms,
    }));

  const supabase = getSupabaseBrowserClient();
  const user = useUser((s) => s.user);

  /* -----------------------------
        REFRESH ROOMS
  ----------------------------- */
  const refreshRooms = async () => {
    if (!user) return toast.error("You must be logged in to refresh rooms");

    try {
      await fetchRooms(); // NO ARGUMENTS
      toast.success("Rooms refreshed");
    } catch (err) {
      toast.error("Failed to refresh rooms");
      console.error(err);
    }
  };

  /* -----------------------------
      SWITCH ROOM
  ----------------------------- */
  const handleRoomSwitch = useCallback(
    async (room: RoomData) => {
      if (!user) {
        toast.error("You must be logged in to switch rooms");
        return;
      }

      // If already accepted member → just switch locally
      if (room.is_member) {
        setSelectedRoomId(room.id);
        toast.success("Switched to room");
        return;
      }

      try {
        const response = await fetch("/api/rooms/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to switch room");
        }

        await fetchRooms(); // NO ARGUMENTS
        const updated = useUnifiedStore
          .getState()
          .rooms.find((r) => r.id === room.id);

        setSelectedRoomId(updated?.id ?? room.id);
        toast.success("Successfully switched room");
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to switch room");
      }
    },
    [user, setSelectedRoomId, fetchRooms]
  );

  /* -----------------------------
      LEAVE ROOM
  ----------------------------- */
  const handleLeaveRoom = async (roomId: string) => {
    if (!user) return toast.error("You must be logged in");

    try {
      const response = await fetch(`/api/rooms/${roomId}/leave`, {
        method: "PATCH",
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(json?.error || "Failed to leave room");

      if (json?.deleted || json?.action === "owner_deleted") {
        toast.success(json?.message || "Room removed");
        await fetchRooms();
        setSelectedRoomId(null);
        return;
      }

      toast.success(json?.message || "Left room successfully");

      if (!json?.hasOtherRooms) {
        setSelectedRoomId(null);
      }

      await fetchRooms();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to leave room");
    }
  };

  /* -----------------------------
      JOIN ROOM
  ----------------------------- */
  const handleJoinRoom = async (roomId: string) => {
    if (!user) return toast.error("You must be logged in to join");

    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok)
        throw new Error(data?.error || data?.message || "Failed to join room");

      if (data?.status === "accepted") {
        toast.success("Joined room");
        await fetchRooms();
        const updated = useUnifiedStore
          .getState()
          .rooms.find((r) => r.id === roomId);

        if (updated) await handleRoomSwitch(updated);
      } else if (data?.status === "pending") {
        toast.info("Join request sent — awaiting approval");
        await fetchParticipations();
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to join room");
    }
  };

  /* -----------------------------
      PARTICIPATION FETCH
  ----------------------------- */
  const fetchParticipations = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("room_participants")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to fetch participations");
      return;
    }

    setUserParticipations(data ?? []);
  }, [supabase, user]);

  /* -----------------------------
      EFFECT: INITIAL LOAD + REALTIME
  ----------------------------- */
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      await fetchParticipations();
      await fetchRooms();
    };

    init();

    // Realtime subscription
    const roomChannel = supabase
      .channel("room_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => fetchRooms()
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
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(participantChannel);
    };
  }, [user, fetchRooms, fetchParticipations, supabase]);

  /* -----------------------------
      AUTH CHECK
  ----------------------------- */
  if (!user)
    return (
      <div className="p-4 text-muted-foreground">Please login to view rooms</div>
    );

  /* -----------------------------
      UI RENDER
  ----------------------------- */
  return (
    <div className="w-[320px] p-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Rooms</h2>
        <Button size="sm" variant="ghost" onClick={refreshRooms}>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3 overflow-y-auto flex-grow">
        {rooms.map((room: RoomData) => {
          const participation = userParticipations.find(
            (p) => p.room_id === room.id
          );

          const isSelected = selectedRoomId === room.id;

          return (
            <div
              key={room.id}
              onClick={() =>
                participation?.status === "accepted" &&
                handleRoomSwitch(room)
              }
              className={cn(
                "cursor-pointer transition-transform duration-200",
                participation?.status === "accepted" && "hover:scale-[1.02]"
              )}
            >
              <RoomCard
                room={room}
                isSelected={isSelected}
                participationStatus={participation?.status || null}
                userCount={room.member_count ?? 0}
                onJoin={() => handleJoinRoom(room.id)}
                onLeave={() => handleLeaveRoom(room.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
