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
  Search,
  PlusCircle,
  Bell,
  Settings,
  ArrowRight,
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
import { SearchTabs } from "./ui/search-tabs";
import { useActiveUsers } from "@/hooks/useActiveUsers";


type UserProfile = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];

// Extended Room type including memberCount, isMember, participationStatus
type RoomWithMembershipCount = Room & {
  isMember: boolean;
  participationStatus: string | null;
  memberCount: number;
  activeUsers?: number;
};

type SearchResult = UserProfile | RoomWithMembershipCount;

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
  const { selectedRoom, setSelectedRoom, setRooms, initializeDefaultRoom } = useRoomStore();
  const { notifications, fetchNotifications, subscribeToNotifications } = useNotification();
  const isMounted = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const [limit] = useState(100);
  const [offset] = useState(0);
  const [isFaded, setIsFaded] = useState(false);
  const activeUsersCount = useActiveUsers(selectedRoom?.id ?? null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFaded(true);
    }, 2); // 2-second delay

    return () => clearTimeout(timer); // Cleanup timeout on unmount
  }, []);


  const [debouncedCallback] = useDebounce((value: string) => setSearchQuery(value), 300);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const UUID_REGEX = useMemo(
    () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    []
  );

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

        // Aggregate counts client-side
        const countsMap = new Map<string, number>();
        membersData?.forEach((m) => {
          countsMap.set(m.room_id, (countsMap.get(m.room_id) ?? 0) + 1);
        });

      }

      // For each room, get presence data
      const presencePromises = roomIds.map(async (roomId) => {
        const { data: roomMembers } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', roomId)
          .eq('status', 'accepted');

        const { data: presenceData } = await supabase
          .from('typing_status')
          .select('user_id')
          .eq('room_id', roomId)
          .in('user_id', roomMembers?.map(member => member.user_id) || []);

        // Get unique active users (filter out duplicates)
        const uniqueActiveUsers = new Set(presenceData?.map(p => p.user_id));

        return {
          roomId,
          activeUsers: uniqueActiveUsers.size
        };
      });

      const presenceResults = await Promise.all(presencePromises);
      const activeUsersMap = new Map(presenceResults.map(r => [r.roomId, r.activeUsers]));

      // Attach memberCount, activeUsers, and isMember:true, participationStatus to each room
      const joinedRooms: RoomWithMembershipCount[] = joinedRoomsRaw.map((room) => ({
        ...room,
        memberCount: countsMap.get(room.id) ?? 0,
        activeUsers: activeUsersMap.get(room.id) ?? 0,
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

  // Handler functions: handleRoomSwitch, handleLeaveRoom, handleJoinRoom, handleCreateRoom remain largely unchanged but work with RoomWithMembershipCount type

  const handleRoomSwitch = useCallback(
    async (room: RoomWithMembershipCount) => {
      if (!user) {
        toast.error("You must be logged in to switch rooms", {
          className: "text-red-600 bg-white border border-red-400 shadow-md",
        });
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
            toast.info(
              result.message || "Switch request sent to room owner for approval."
            );
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
          memberCount: room.memberCount, // keep existing count
        };

        setSelectedRoom(updatedRoomWithMembership);
        setIsSwitchRoomPopoverOpen(false);
        setIsMember(newIsMember);
        toast.success(result.message || `Switched to ${room.name}`, {
          className: "text-green-600 bg-white border border-green-400 shadow-md",
        });
        await fetchAvailableRooms();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to switch room");
        await fetchAvailableRooms();
      }
    },
    [user, setSelectedRoom, fetchAvailableRooms]
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
            membersError?.message ||
              participantsError?.message ||
              "Failed to leave room"
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
          const defaultRoom = availableRooms.find(
            (room) => room.name === "General Chat"
          );
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
          membersData?.forEach(m => {
            if (!memberCounts.has(m.room_id)) {
              memberCounts.set(m.room_id, new Set());
            }
            memberCounts.get(m.room_id)?.add(m.user_id);
          });
          
          // Add participants
          participantsData?.forEach(p => {
            if (!memberCounts.has(p.room_id)) {
              memberCounts.set(p.room_id, new Set());
            }
            memberCounts.get(p.room_id)?.add(p.user_id);
          });

          const roomsWithDetailedStatus = await Promise.all(
            fetchedRooms.map(async (room: Room) => ({
              ...room,
              participationStatus: await checkRoomParticipation(room.id),
              memberCount: memberCounts.get(room.id)?.size ?? 0,
              isMember: await checkRoomMembership(room.id)
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

  // Render a room result with memberCount shown
  // Render a room result with only active count
const renderRoomSearchResult = (result: RoomWithMembershipCount) => (
  <li
    key={result.id}
    className="flex items-center justify-between p-2 rounded-lg 
               bg-gray-800/60 hover:bg-gray-700/60 transition-colors"
  >
    <div className="flex items-center gap-3">
      {/* Room icon */}
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
        <span className="text-lg font-semibold text-indigo-400">
          {result.name.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Room info */}
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{result.name}</span>
          {result.is_private && (
            <LockIcon className="h-3.5 w-3.5 text-gray-400" />
          )}
        </div>
        {/* ✅ Only active users, no member count */}
        <p className="text-sm text-green-400">
          {result.activeUsers ?? 0} active
        </p>
      </div>
    </div>

    {/* Actions (same as before) */}
    <div className="flex items-center gap-2">
      {selectedRoom?.id === result.id && result.isMember && UUID_REGEX.test(result.id) ? (
        <Button
          size="sm"
          variant="destructive"
          onClick={handleLeaveRoom}
          className="bg-red-600/10 text-red-400 hover:bg-red-600/20 hover:text-red-300"
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
          className="text-indigo-400 hover:text-indigo-300"
        >
          <Settings className="h-4 w-4" />
        </Button>
      ) : result.participationStatus === "pending" ? (
        <span className="text-sm text-yellow-400">Pending</span>
      ) : (
        <Button
          size="sm"
          onClick={() => handleJoinRoom(result.id)}
          disabled={!user}
          className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300"
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
              <DialogTitle className="text-[2em] font-bold">
                Create New Room
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-[1.2em] py-[1em]">
              <div className="space-y-[0.6em]">
                <Label
                  htmlFor="roomName"
                  className="text-[1em] font-medium text-gray-300"
                >
                  Room Name
                </Label>
                <Input
                  id="roomName"
                  placeholder="Enter room name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  disabled={isCreating}
                  className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-0 focus:border-transparent transition-all"
                />
              </div>
              <div className="flex items-center space-x-[1em]">
                <Switch
                  id="private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  disabled={isCreating}
                  className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-gray-600"
                />
                <Label
                  htmlFor="private"
                  className="text-[1em] font-medium text-gray-300"
                >
                  Private Room
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isCreating}
                className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateRoom}
                disabled={isCreating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                {isCreating ? "Creating..." : "Create Room"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {selectedRoom && (
          <Popover
            open={isSwitchRoomPopoverOpen}
            onOpenChange={setIsSwitchRoomPopoverOpen}
          >
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

    {availableRooms.length === 0 ? (
      <p className="text-[1em] text-gray-400">No rooms available</p>
    ) : (
      <ul className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-none lg:scrollbar-custom">
  {availableRooms.map((room) => (
    <li
      key={room.id}
      className="flex items-center justify-between p-2 rounded-lg 
                 bg-gray-800/60 hover:bg-gray-700/60 transition-colors"
    >
      <div className="flex items-center gap-3">
        {/* Room icon */}
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
          <span className="text-lg font-semibold text-indigo-400">
            {room.name.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Room info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{room.name}</span>
            {room.is_private && (
              <LockIcon className="h-3.5 w-3.5 text-gray-400" />
            )}
          </div>
          {/* ✅ Only keep active indicator */}
          <p className="text-sm text-green-400">
            {room.activeUsers ?? 0} active
          </p>
        </div>
      </div>

      {/* Toggle switch */}
      <Switch
        checked={selectedRoom?.id === room.id}
        onCheckedChange={() => handleRoomSwitch(room)}
        className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-gray-600"
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
              bg-background/95
              backdrop-blur-lg
              border-none
              shadow-xl
              rounded-xl
            "
          >

            <div className="p-1">
              <div className="flex justify-between items-center mb-[0.5em]">
                <h3 className="font-bold text-[1.5em] text-white">Search</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsSearchPopoverOpen(false);
                    router.push("/profile");
                  }}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <Input
                type="text"
                placeholder={
                  searchType === "users" ? "Search users..." : "Search rooms..."
                }
                value={searchQuery}
                onChange={handleSearchInputChange}
                className="mb-1 bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
              <div className="w-[100%] flex gap-1 mb-[1.2em]">
                <Button
                  variant={searchType === "rooms" ? "default" : "outline"}
                  onClick={() => handleSearchByType("rooms")}
                  className={`${
                    searchType === "rooms"
                      ? "bg-indigo-600 hover:bg-indigo-700"
                      : "bg-transparent border-gray-600 hover:bg-gray-700"
                  } text-white rounded-lg transition-colors w-full`}
                >
                  Rooms
                </Button>
                <Button
                  variant={searchType === "users" ? "default" : "outline"}
                  onClick={() => handleSearchByType("users")}
                  className={`${
                    searchType === "users"
                      ? "bg-indigo-600 hover:bg-indigo-700"
                      : "bg-transparent border-gray-600 hover:bg-gray-700"
                  } text-white rounded-lg transition-colors w-full`}
                >
                  Users
                </Button>
              </div>
              {searchType === "users" && userResults.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-[1em] text-gray-300 mb-3">
                    User Profiles
                  </h4>
                  <ul className="space-y-3 overflow-y-auto max-h-[440px] scrollbar-none lg:scrollbar-custom">
                    {userResults.map((result) => (
                      <li
                        key={result.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
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
                            <div className="text-xs text-gray-400">
                              {result.username}
                            </div>
                            <div className="text-[1em] font-medium text-white">
                              {result.display_name}
                            </div>
                          </div>
                        </div>
                        <UserIcon className="h-4 w-4 text-gray-400" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {searchType === "rooms" && (
                <div className="mt-4">
                  <h4 className="font-semibold text-[1em] text-gray-300 mb-3">
                    Rooms
                  </h4>
                  <ul className="space-y-[.1em] overflow-y-auto max-h-[440px] py-[.2em] rounded-lg scrollbar-none lg:scrollbar-custom">
                    {isLoading ? (
                      // Loading skeletons
                      Array(3).fill(0).map((_, i) => (
                        <li key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50 animate-pulse">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gray-700"></div>
                            <div>
                              <div className="h-4 w-32 bg-gray-700 rounded mb-2"></div>
                              <div className="h-3 w-24 bg-gray-700 rounded"></div>
                            </div>
                          </div>
                          <div className="h-8 w-16 bg-gray-700 rounded"></div>
                        </li>
                      ))
                    ) : roomResults.length > 0 ? (
                      roomResults.map((result) => renderRoomSearchResult(result))
                    ) : (
                      <li className="text-[1em] text-gray-400 p-2">No rooms found</li>
                    )}
                  </ul>
                </div>
              )}
              {((searchType === "users" && userResults.length === 0) ||
                (searchType === "rooms" && roomResults.length === 0)) &&
                searchQuery.length > 0 && (
                  <p className="text-[1em] text-gray-400 mt-3">
                    No {searchType} found.
                  </p>
                )}
             {searchQuery.length === 0 && searchType && (
                <p
                  className={`text-[1em] text-gray-400 mt-3 transition-opacity duration-500 ${
                    isFaded ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  Showing all {searchType}...
                </p>
              )}
              {isLoading && (
                <p
                  className={`text-[1em] text-gray-400 mt-3 transition-opacity duration-500 ${
                    isFaded ? 'opacity-0' : 'opacity-100'
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
};
