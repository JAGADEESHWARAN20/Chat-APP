"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  Compass,
  PlusCircle,
  Bell,
  Settings,
  LockIcon,
} from "lucide-react";
import { Database } from "@/lib/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRoomStore } from "@/lib/store/roomstore";
import Notifications from "./Notifications";
import { useNotification } from "@/lib/store/notifications";
import { Input } from "@/components/ui/input";

// --- Type Definitions ---
type Room = Database["public"]["Tables"]["rooms"]["Row"];

type RoomWithMembership = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
};

export default function NavigationHeader({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const [availableRooms, setAvailableRooms] = useState<RoomWithMembership[]>([]);
  const supabase = supabaseBrowser();
  const [isCreateRoomDialogOpen, setIsCreateRoomDialogOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { selectedRoom, setSelectedRoom, setRooms } = useRoomStore();
  const { notifications, fetchNotifications } = useNotification();
  const isMounted = useRef(true);

  const fetchAvailableRooms = useCallback(async () => {
    if (!user) {
      setAvailableRooms([]);
      setRooms([]);
      return;
    }

    try {
      const { data: memberships, error } = await supabase
        .from("room_members")
        .select("room_id, rooms(*)")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (error) throw error;

      const joinedRoomsRaw = memberships?.map((m) => m.rooms).filter(Boolean) as Room[] || [];
      const roomIds = joinedRoomsRaw.map((r) => r.id);

      const { data: membersData, error: membersError } = roomIds.length > 0
        ? await supabase
            .from("room_members")
            .select("room_id")
            .in("room_id", roomIds)
            .eq("status", "accepted")
        : { data: [], error: null };

      if (membersError) throw membersError;

      const countsMap = new Map<string, number>();
      membersData?.forEach((m) => {
        countsMap.set(m.room_id, (countsMap.get(m.room_id) ?? 0) + 1);
      });

      const joinedRooms: RoomWithMembership[] = joinedRoomsRaw.map((room) => ({
        ...room,
        memberCount: countsMap.get(room.id) ?? 0,
        isMember: true,
        participationStatus: "accepted",
      }));

      setAvailableRooms(joinedRooms);
      setRooms(joinedRooms);
    } catch (error) {
      toast.error("An error occurred while fetching your rooms.");
    }
  }, [user, supabase, setRooms]);

  const handleCreateRoom = async () => {
    if (!user || !newRoomName.trim()) {
      toast.error("Room name cannot be empty.");
      return;
    }

    setIsCreating(true);
    try {
      const { data: newRoom, error: roomError } = await supabase
        .from("rooms")
        .insert({ name: newRoomName.trim(), created_by: user.id, is_private: isPrivate })
        .select()
        .single();
      
      if (roomError) throw roomError;

      const { error: memberError } = await supabase.from("room_members").insert({
        room_id: newRoom.id,
        user_id: user.id,
        status: "accepted",
      });

      if (memberError) throw memberError;

      toast.success("Room created successfully!");
      setNewRoomName("");
      setIsPrivate(false);
      setIsCreateRoomDialogOpen(false);
      
      await fetchAvailableRooms();
      setSelectedRoom({ ...newRoom, isMember: true, memberCount: 1, participationStatus: "accepted" });
      router.push("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create room.");
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchAvailableRooms();
      fetchNotifications(user.id);
    }
  }, [user, fetchAvailableRooms, fetchNotifications]);
  
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <div className="flex items-center space-x-[1.2vw]">
      {/* 1. Create Room Button */}
      <Dialog open={isCreateRoomDialogOpen} onOpenChange={setIsCreateRoomDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Create Room">
            <PlusCircle className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[2em] font-bold">Create New Room</DialogTitle>
          </DialogHeader>
          <div className="grid gap-[1.2em] py-[1em]">
            <Input
              id="roomName"
              placeholder="Enter room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              disabled={isCreating}
            />
            <div className="flex items-center space-x-2">
              <Switch id="private" checked={isPrivate} onCheckedChange={setIsPrivate} disabled={isCreating} />
              <Label htmlFor="private">Private Room</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateRoomDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateRoom} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 2. Explore Button */}
      <Button variant="ghost" size="icon" aria-label="Explore" onClick={() => router.push("/explore")}>
        <Compass className="h-5 w-5" />
      </Button>

      {/* 3. Notifications Button */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsNotificationsOpen(true)}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {notifications.filter((n) => !n.status).length > 0 && (
            <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
          )}
        </Button>
        <Notifications
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        />
      </div>
      
      {/* 4. Settings Button */}
      <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => router.push("/profile")}>
        <Settings className="h-5 w-5" />
      </Button>
    </div>
  );
}