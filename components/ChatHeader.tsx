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
  PlusCircle,
  Bell,
  Settings,
  LogOut,
  UserIcon,
  ArrowRightLeft,
  LockIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import { useDebounce } from "use-debounce";
import Notifications from "./Notifications";
import { useNotification } from "@/lib/store/notifications";
import { useRoomPresence } from "@/hooks/useRoomPresence";
// import { SearchTabs } from "./ui/search-tabs"; // (unused import removed)
// import { useActiveUsers } from "@/hooks/useActiveUsers"; // (unused import removed)

type UserProfile = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomMemberRow = Database["public"]["Tables"]["room_members"]["Row"];
type TypingStatusRow = Database["public"]["Tables"]["typing_status"]["Row"];

// Extended Room type including memberCount, isMember, participationStatus
type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
};

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"rooms" | "users" | null>(null);
  const [roomResults, setRoomResults] = useState<RoomWithMembershipCount[]>([]);
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [availableRooms, setAvailableRooms] = useState<RoomWithMembershipCount[]>([]);
  const supabase = supabaseBrowser();
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  const [isSwitchRoomPopoverOpen, setIsSwitchRoomPopoverOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { selectedRoom, setSelectedRoom, setRooms } = useRoomStore();
  const { notifications, fetchNotifications, subscribeToNotifications } = useNotification();
  const isMounted = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const [limit] = useState(100);
  const [offset] = useState(0);
  const [isFaded, setIsFaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFaded(true);
    }, 2);
    return () => clearTimeout(timer);
  }, []);

  const [debouncedCallback] = useDebounce((value: string) => setSearchQuery(value), 300);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const UUID_REGEX = useMemo(
    () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    []
  );

  // Compute all room IDs for presence tracking (availableRooms + roomResults)
  const allRoomIds = useMemo(() => {
    const ids = new Set([
      ...availableRooms.map((r) => r.id),
      ...roomResults.map((r) => r.id),
    ]);
    return Array.from(ids);
  }, [availableRooms, roomResults]);

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

  // Check participation status for a given room (can be accepted or pending)
  const checkRoomParticipation = useCallback(
    async (roomId: string) => {
      if (!user) return null;
      const { data: memberStatus, error: memberError } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (memberError) {
        console.error(
          "Error checking room membership for participation status:",
          memberError
        );
      }

      const { data: participantStatus, error: participantError } =
        await supabase
          .from("room_participants")
          .select("status")
          .eq("room_id", roomId)
          .eq("user_id", user.id);

      if (participantError) {
        console.error(
          "Error checking room participation status:",
          participantError
        );
      }

      if (
        memberStatus &&
        memberStatus.length > 0 &&
        memberStatus[0].status === "accepted"
      ) {
        return "accepted";
      }
      if (
        participantStatus &&
        participantStatus.length > 0 &&
        participantStatus[0].status === "accepted"
      ) {
        return "accepted";
      }
      if (
        memberStatus &&
        memberStatus.length > 0 &&
        memberStatus[0].status === "pending"
      ) {
        return "pending";
      }
      if (
        participantStatus &&
        participantStatus.length > 0 &&
        participantStatus[0].status === "pending"
      ) {
        return "pending";
      }
      return null;
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

        // Aggregate counts client-side (FIX: do not shadow countsMap)
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

  // Handler functions: handleRoomSwitch, handleLeaveRoom, handleJoinRoom, handleCreateRoom remain largely unchanged but work with RoomWithMembershipCount type

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
          body: JSON.stringify({ roomId: newRoomId }), // ✅ remove prevRoomId
        });

        const result = await response.json();
        if (!response.ok) {
          toast.error(result.message || "Failed to switch room");
          return;
        }

        // Find the switched room from availableRooms
        const switchedRoom = availableRooms.find((r) => r.id === newRoomId);

        if (switchedRoom) {
          // ✅ Update selected room immediately
          setSelectedRoom({ ...switchedRoom, isMember: true });

          // ✅ Locally patch availableRooms so popover shows updated status
          setAvailableRooms((prev) =>
            prev.map((room) =>
              room.id === newRoomId
                ? { ...room, isMember: true, participationStatus: "accepted" }
                : room.id === prevRoomId
                ? { ...room, isMember: false } // mark old one as inactive
                : room
            )
          );
        }

        setIsSwitchRoomPopoverOpen(false);
        toast.success(`Switched to ${switchedRoom?.name || "room"}`);

        // ✅ Refresh full list in background
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

        // Update room results to show Join button for this room
        setRoomResults((rooms) =>
          rooms.map((room) =>
            room.id === selectedRoom.id
              ? { ...room, isMember: false, participationStatus: null }
              : room
          )
        );

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

  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      debouncedCallback(e.target.value);
    },
    [debouncedCallback]
  );

  const fetchSearchResults = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setRoomResults([]);
      setUserResults([]);
      return;
    }

    if (!searchType) return;
    setIsLoading(true);
    try {
      if (searchType === "rooms") {
        const apiQuery = debouncedSearchQuery.trim()
          ? `?q=${encodeURIComponent(
              debouncedSearchQuery.trim()
            )}&limit=${limit}&offset=${offset}`
          : `?limit=${limit}&offset=${offset}`;
        const response = await fetch(`/api/rooms/all${apiQuery}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const { rooms: fetchedRooms } = await response.json();

        if (isMounted.current) {
          // Get member counts for all rooms from both tables
          const roomIds = fetchedRooms.map((room: Room) => room.id);

          // Get accepted room members
          const { data: membersData } = await supabase
            .from("room_members")
            .select("room_id, user_id")
            .in("room_id", roomIds)
            .eq("status", "accepted");

          // Get accepted room participants
          const { data: participantsData } = await supabase
            .from("room_participants")
            .select("room_id, user_id")
            .in("room_id", roomIds)
            .eq("status", "accepted");

          // Combine both sets of users and count unique users per room
          const memberCounts = new Map<string, Set<string>>();

          // Add members
          membersData?.forEach((m: Pick<RoomMemberRow, "room_id" | "user_id">) => {
            if (!memberCounts.has(m.room_id)) {
              memberCounts.set(m.room_id, new Set());
            }
            memberCounts.get(m.room_id)!.add(m.user_id);
          });

          // Add participants
          participantsData?.forEach((p: { room_id: string; user_id: string }) => {
            if (!memberCounts.has(p.room_id)) {
              memberCounts.set(p.room_id, new Set());
            }
            memberCounts.get(p.room_id)!.add(p.user_id);
          });

          const roomsWithDetailedStatus = await Promise.all(
            fetchedRooms.map(async (room: Room) => ({
              ...room,
              participationStatus: await checkRoomParticipation(room.id),
              memberCount: memberCounts.get(room.id)?.size ?? 0,
              isMember: await checkRoomMembership(room.id),
            }))
          );
          setRoomResults(roomsWithDetailedStatus);
        }
      } else if (searchType === "users") {
        const { data, error } = await supabase
          .from("users")
          .select("id, username, display_name, avatar_url, created_at")
          .ilike("display_name", `%${debouncedSearchQuery.trim()}%`)
          .limit(10);

        if (error) {
          console.error(`Search error for ${searchType}:`, error);
          toast.error(error.message || `Failed to search ${searchType}`);
          setUserResults([]);
        } else if (data && isMounted.current) {
          setUserResults(data);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      if (isMounted.current) {
        toast.error(
          error instanceof Error ? error.message : "An error occurred while searching"
        );
        setRoomResults([]);
        setUserResults([]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [
    supabase,
    user,
    debouncedSearchQuery,
    checkRoomParticipation,
    checkRoomMembership,
    limit,
    offset,
    searchType,
  ]);

  const handleJoinRoom = useCallback(
    async (roomId?: string) => {
      if (!user) {
        toast.error("You must be logged in to join a room");
        return;
      }
      const currentRoomId = roomId || selectedRoom?.id;
      if (!currentRoomId) {
        toast.error("No room selected");
        return;
      }
      if (!UUID_REGEX.test(currentRoomId)) {
        toast.error("Invalid room ID format");
        return;
      }
      try {
        const response = await fetch(`/api/rooms/switch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roomId: currentRoomId }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.code === "AUTH_REQUIRED") {
            toast.error("Authentication required to join rooms.");
          } else if (result.code === "ROOM_NOT_FOUND") {
            toast.error("Room not found.");
          } else if (result.status === "pending") {
            toast.info(
              result.message || "Join request sent to room owner for approval."
            );
          } else {
            toast.error(result.message || "Failed to join room.");
          }
          return;
        }

        let newParticipationStatus: string | null = "accepted";
        let newIsMember = true;

        if (result.status === "pending") {
          newParticipationStatus = "pending";
          newIsMember = false;
        }

        const { data: room } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", currentRoomId)
          .single();
        if (!room) {
          throw new Error("Failed to fetch room details after join.");
        }

        // Member count unknown at this point, you may fetch or set as 0 and refresh elsewhere
        const roomWithMembership: RoomWithMembershipCount = {
          ...room,
          isMember: newIsMember,
          participationStatus: newParticipationStatus,
          memberCount: 0,
        };

        setSelectedRoom(roomWithMembership);
        setIsMember(newIsMember);
        if (searchType) {
          await fetchSearchResults();
        }
        toast.success(result.message || "Joined room successfully");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to join room");
      }
    },
    [
      user,
      selectedRoom,
      UUID_REGEX,
      setSelectedRoom,
      supabase,
      searchType,
      fetchSearchResults,
      setIsMember,
    ]
  );

  const handleCreateRoom = async () => {
    if (!user) {
      toast.error("You must be logged in to create a room");
      return;
    }
    if (!newRoomName.trim()) {
      toast.error("Room name cannot be empty");
      return;
    }
    setIsCreating(true);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newRoomName.trim(), isPrivate: isPrivate }),
      });

      const newRoomResponse = await response.json();

      if (!response.ok) {
        throw new Error(newRoomResponse.error || "Failed to create room");
      }

      const newRoom = newRoomResponse;

      toast.success("Room created successfully!");
      setNewRoomName("");
      setIsPrivate(false);
      setIsDialogOpen(false);

      const roomWithMembership: RoomWithMembershipCount = {
        ...newRoom,
        isMember: true,
        participationStatus: "accepted",
        memberCount: 1, // Creator is the first member
      };
      setSelectedRoom(roomWithMembership);
      setIsMember(true);
      await fetchAvailableRooms();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSearchByType = (type: "rooms" | "users") => {
    setSearchType(type);
    setSearchQuery("");
    setRoomResults([]);
    setUserResults([]);
  };

  useEffect(() => {
    if (searchType) {
      fetchSearchResults();
    } else {
      setRoomResults([]);
      setUserResults([]);
    }
  }, [debouncedSearchQuery, searchType, fetchSearchResults]);

  useEffect(() => {
    if (!user?.id) return;
    fetchAvailableRooms();
    fetchNotifications(user.id);
    subscribeToNotifications(user.id);
  }, [user, fetchAvailableRooms, fetchNotifications, subscribeToNotifications]);

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

  const renderRoomSearchResult = (result: RoomWithMembershipCount) => (
    <li
      key={result.id}
      className="flex items-center justify-between pb-[1em] rounded-lg transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/30">
          <span className="text-lg font-semibold text-indigo-400">
            {result.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            {/* ✅ Room name: Black in light mode, White in dark mode */}
            <span className="font-semibold text-black dark:text-white">
              {result.name}
            </span>

            {result.is_private && (
              <LockIcon className="h-3.5 w-3.5 text-gray-400" />
            )}
          </div>

          {/* ✅ Adjust member text colors for both themes */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {result.memberCount} {result.memberCount === 1 ? "member" : "members"}
            {(onlineCounts.get(result.id) ?? 0) > 0 }
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {selectedRoom?.id === result.id && result.isMember && UUID_REGEX.test(result.id) ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleLeaveRoom}
            className="bg-red-600/10 text-red-500 hover:bg-red-600/20 hover:text-red-400"
            disabled={isLeaving}
          >
            <LogOut className="h-4 w-4 mr-1" />
            {isLeaving ? "Leaving..." : "Leave"}
          </Button>
        ) : result.isMember ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/rooms/${result.id}/settings`)}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
          >
            <Settings className="h-4 w-4" />
          </Button>
        ) : result.participationStatus === "pending" ? (
          <span className="text-sm text-yellow-500 dark:text-yellow-400">
            Pending
          </span>
        ) : (
          <Button
            size="sm"
            onClick={() => handleJoinRoom(result.id)}
            disabled={!user}
            className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-500 dark:hover:text-indigo-300"
          >
            Join
          </Button>
        )}
      </div>
    </li>
  );

  return (
    <header className="h-[3.6em] lg:w-[50vw] w-[95vw] flex items-center justify-between px-[1.5vw] glass-gradient-header text-foreground bg-background z-10 dark:text-foreground dark:bg-background">
      <h1 className="text-[2.5vw] lg:text-[1em] flex flex-col font-semibold py-[0.8em] lg:py-[2em] items-start">
        {selectedRoom ? `#${selectedRoom.name}` : "Daily Chat"}
        <ChatPresence />
      </h1>
      <div className="flex items-center space-x-[1.2vw]">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <PlusCircle className="h-5 w-5 text-gray-300 hover:text-white transition-colors" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-[2em] font-bold">Create New Room</DialogTitle>
            </DialogHeader>

            <div className="grid gap-[1.2em] py-[1em]">
              <div className="space-y-[0.6em]">
                <Label htmlFor="roomName" className="text-[1em] font-medium text-foreground">
                  Room Name
                </Label>
                <Input
                  id="roomName"
                  placeholder="Enter room name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  disabled={isCreating}
                  className="
                    bg-background
                    border
                    border-border
                    text-foreground
                    placeholder:text-muted-foreground
                    rounded-lg
                    focus-visible:ring-1
                    focus-visible:ring-indigo-500
                    focus-visible:border-indigo-500
                    transition-all
                  "
                />
              </div>

              <div className="flex items-center space-x-[1em]">
                <Switch
                  id="private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  disabled={isCreating}
                  className="
                    data-[state=checked]:bg-indigo-600
                    data-[state=unchecked]:bg-muted
                  "
                />
                <Label htmlFor="private" className="text-[1em] font-medium text-foreground">
                  Private Room
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isCreating}
                className="
                  bg-transparent
                  border-border
                  text-foreground
                  hover:bg-muted
                  hover:text-foreground
                  rounded-lg
                  transition-colors
                "
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateRoom}
                disabled={isCreating}
                className="
                  bg-indigo-600
                  hover:bg-indigo-700
                  text-white
                  rounded-lg
                  transition-colors
                "
              >
                {isCreating ? "Creating..." : "Create Room"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                          onCheckedChange={() => handleRoomSwitch(room.id,selectedRoom?.id)}
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

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsNotificationsOpen(true)}
            className="relative"
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

        <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="center"
            sideOffset={0}
            className="
              w-[400px]
              p-4
              bg-popover
              text-popover-foreground
              backdrop-blur-lg
              border
              border-border
              shadow-xl
              rounded-xl
            "
          >
            <div className="p-1">
              <div className="flex justify-between items-center mb-[0.5em]">
                <h3 className="font-bold text-[1.5em]">Search</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsSearchPopoverOpen(false);
                    router.push("/profile");
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>

              <Input
                type="text"
                placeholder={searchType === "users" ? "Search users..." : "Search rooms..."}
                value={searchQuery}
                onChange={handleSearchInputChange}
                className="
                  mb-1 bg-muted/50 border-border text-foreground 
                  placeholder-muted-foreground rounded-lg 
                  focus:ring-2 focus:ring-indigo-500 
                  focus:border-indigo-500 transition-all
                "
              />

              {/* Toggle buttons */}
              <div className="w-[100%] flex gap-1 mb-[1.2em]">
                <Button
                  variant={searchType === "rooms" ? "default" : "outline"}
                  onClick={() => handleSearchByType("rooms")}
                  className={`${
                    searchType === "rooms"
                      ? "bg-violet-900 text-white hover:bg-violet-800"
                      : "bg-transparent border border-border hover:bg-accent text-black dark:text-white"
                  } rounded-lg transition-colors w-full`}
                >
                  Rooms
                </Button>
                <Button
                  variant={searchType === "users" ? "default" : "outline"}
                  onClick={() => handleSearchByType("users")}
                  className={`${
                    searchType === "users"
                      ? "bg-violet-900 text-white hover:bg-violet-800"
                      : "bg-transparent border border-border hover:bg-accent text-black dark:text-white"
                  } rounded-lg transition-colors w-full`}
                >
                  Users
                </Button>
              </div>

              {/* Results */}
              {searchType === "users" && userResults.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-[1em] text-muted-foreground mb-3">
                    User Profiles
                  </h4>
                  <ul className="space-y-3 overflow-y-auto max-h-[440px] scrollbar-none lg:scrollbar-custom">
                    {userResults.map((result) => (
                      <li
                        key={result.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            {result.avatar_url ? (
                              <AvatarImage
                                src={result.avatar_url}
                                alt={result.username || "Avatar"}
                                className="rounded-full"
                              />
                            ) : (
                              <AvatarFallback className="bg-indigo-500 text-white rounded-full">
                                {result.username?.charAt(0).toUpperCase() ||
                                  result.display_name?.charAt(0).toUpperCase() ||
                                  "?"}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <div className="text-xs text-muted-foreground">{result.username}</div>
                            {/* ✅ Black in light, White in dark */}
                            <div className="text-[1em] font-medium text-black dark:text-white">
                              {result.display_name}
                            </div>
                          </div>
                        </div>
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rooms results */}
              {searchType === "rooms" && (
                <div className="mt-4">
                  <h4 className="font-semibold text-[1em] text-muted-foreground mb-3">Rooms</h4>
                  <ul className="space-y-[.1em] overflow-y-auto max-h-[440px] py-[.2em] rounded-lg scrollbar-none lg:scrollbar-custom">
                    {isLoading ? (
                      Array(3)
                        .fill(0)
                        .map((_, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted animate-pulse"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-accent"></div>
                              <div>
                                <div className="h-4 w-32 bg-accent rounded mb-2"></div>
                                <div className="h-3 w-24 bg-accent rounded"></div>
                              </div>
                            </div>
                            <div className="h-8 w-16 bg-accent rounded"></div>
                          </li>
                        ))
                    ) : roomResults.length > 0 ? (
                      roomResults.map((result) => renderRoomSearchResult(result))
                    ) : (
                      <li className="text-[1em] text-muted-foreground p-2">No rooms found</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Empty & Loading states */}
              {((searchType === "users" && userResults.length === 0) ||
                (searchType === "rooms" && roomResults.length === 0)) &&
                searchQuery.length > 0 && (
                  <p className="text-[1em] text-muted-foreground mt-3">
                    No {searchType} found.
                  </p>
                )}

              {searchQuery.length === 0 && searchType && (
                <p
                  className={`text-[1em] text-muted-foreground mt-3 transition-opacity duration-500 ${
                    isFaded ? "opacity-0" : "opacity-100"
                  }`}
                >
                  Showing all {searchType}...
                </p>
              )}

              {isLoading && (
                <p
                  className={`text-[1em] text-muted-foreground mt-3 transition-opacity duration-500 ${
                    isFaded ? "opacity-0" : "opacity-100"
                  }`}
                >
                  Loading...
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}