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

type UserProfile = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type SearchResult = UserProfile | Room;

type RoomWithMembership = Room & {
  isMember: boolean;
  participationStatus: string | null;
};

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"rooms" | "users" | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [availableRooms, setAvailableRooms] = useState<RoomWithMembership[]>([]);
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

  const [debouncedCallback] = useDebounce((value: string) => setSearchQuery(value), 300);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const UUID_REGEX = useMemo(() => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, []);

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
      // Check both room_members and room_participants for user's status
      const { data: memberStatus, error: memberError } = await supabase
        .from("room_members")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (memberError) {
        console.error("Error checking room membership for participation status:", memberError);
        // Do not return, continue to check room_participants
      }

      const { data: participantStatus, error: participantError } = await supabase
        .from("room_participants")
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      if (participantError) {
        console.error("Error checking room participation status:", participantError);
        // Do not return, continue
      }

      // Prioritize accepted status, then pending, then null
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
      return null; // Not a member or participant, or status is rejected
    },
    [user, supabase]
  );

  const fetchAvailableRooms = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setAvailableRooms([]);
      setRooms([]);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch all rooms from the API route (which now returns all rooms)
      const response = await fetch(`/api/rooms?limit=${limit}&offset=${offset}`); // Use API route
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const { rooms: fetchedRooms } = await response.json(); // Destructure to get 'rooms'

      if (isMounted.current) {
        // The API route already provides 'isMember' flag, so no need to re-check membership here
        // We still need to check participationStatus as the API only gives 'isMember' (accepted in either)
        const roomsWithDetailedStatus = await Promise.all(
          fetchedRooms.map(async (room: RoomWithMembership) => ({ // Cast to RoomWithMembership as API provides isMember
            ...room,
            participationStatus: await checkRoomParticipation(room.id), // Fetch detailed participation status
          }))
        );
        setAvailableRooms(roomsWithDetailedStatus);
        setRooms(roomsWithDetailedStatus);
        if (!selectedRoom && roomsWithDetailedStatus.length > 0) {
          initializeDefaultRoom();
        }
      }
    } catch (error) {
      console.error("Error fetching available rooms:", error);
      if (isMounted.current) {
        toast.error("An error occurred while fetching rooms");
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [user, supabase, setRooms, selectedRoom, initializeDefaultRoom, checkRoomParticipation]); // Removed checkRoomMembership as API provides isMember

  const handleRoomSwitch = useCallback(async (room: Room) => {
    if (!user) {
      toast.error("You must be logged in to switch rooms", {
        className: "text-red-600 bg-white border border-red-400 shadow-md",
      });
      return;
    }
    try {
      // Check if the user is already an accepted member/participant
      const isCurrentlyMember = await checkRoomMembership(room.id);
      const currentParticipationStatus = await checkRoomParticipation(room.id);

      if (isCurrentlyMember || currentParticipationStatus === "accepted") {
        // If already accepted, just switch the room without upserting
        const roomWithMembership: RoomWithMembership = {
          ...room,
          isMember: true, // Already confirmed as member/accepted participant
          participationStatus: "accepted",
        };
        setSelectedRoom(roomWithMembership);
        setIsSwitchRoomPopoverOpen(false);
        setIsMember(true); // Update local state for selected room
        toast.success(`Switched to ${room.name}`, {
          className: "text-green-600 bg-white border border-green-400 shadow-md",
        });
      } else {
        // If not a member, attempt to join (upsert)
        const { data, error } = await supabase
          .from("room_members")
          .upsert(
            { room_id: room.id, user_id: user.id, status: "accepted" },
            { onConflict: "room_id,user_id" }
          );

        if (error) {
          if (error.code === "23503") {
            toast.error("Room or user does not exist.");
            return;
          }
          throw new Error(error.message || "Failed to switch room");
        }

        const isMemberAfterJoin = await checkRoomMembership(room.id);
        const participationStatusAfterJoin = await checkRoomParticipation(room.id);
        const roomWithMembership: RoomWithMembership = {
          ...room,
          isMember: isMemberAfterJoin,
          participationStatus: participationStatusAfterJoin,
        };

        setSelectedRoom(roomWithMembership);
        setIsSwitchRoomPopoverOpen(false);
        setIsMember(isMemberAfterJoin);
        toast.success(`Switched to ${room.name}`, {
          className: "text-green-600 bg-white border border-green-400 shadow-md",
        });
      }
      await fetchAvailableRooms(); // Refresh available rooms list
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch room");
      await fetchAvailableRooms();
    }
  }, [user, supabase, checkRoomMembership, checkRoomParticipation, setSelectedRoom, fetchAvailableRooms]);

  const handleLeaveRoom = useCallback(async () => {
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
      // Delete from room_members
      const { error: membersError } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", selectedRoom.id)
        .eq("user_id", user.id);

      // Delete from room_participants (if user is also a participant)
      const { error: participantsError } = await supabase
        .from("room_participants")
        .delete()
        .eq("room_id", selectedRoom.id)
        .eq("user_id", user.id);

      if (membersError || participantsError) {
        throw new Error(membersError?.message || participantsError?.message || "Failed to leave room");
      }

      toast.success("Successfully left the room");
      setIsMember(false);
      await fetchAvailableRooms(); // Refresh the list of available rooms

      // Logic to select a new room or redirect if no rooms left
      const { data: remainingRooms } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (remainingRooms && remainingRooms.length === 0) {
        setSelectedRoom(null);
        router.push("/");
      } else {
        // Try to select the default room if available, otherwise clear selection
        const defaultRoom = availableRooms.find(room => room.name === "General Chat"); // Assuming 'General Chat' is default
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
  }, [user, selectedRoom, UUID_REGEX, supabase, fetchAvailableRooms, setSelectedRoom, router, availableRooms]);

  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedCallback(e.target.value);
  }, [debouncedCallback]);

  const fetchSearchResults = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setSearchResults([]);
      return;
    }

    if (!searchType) return;
    setIsLoading(true);
    try {
      let response;
      if (searchType === "rooms") {
        // Call the API route directly to get all rooms (filtered by query if present)
        const apiQuery = debouncedSearchQuery.trim() ? `?query=${encodeURIComponent(debouncedSearchQuery.trim())}` : "";
        response = await fetch(`/api/rooms${apiQuery}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const { rooms: fetchedRooms } = await response.json();

        if (isMounted.current) {
          // The API route already provides 'isMember' flag
          // We still need to check participationStatus as the API only gives 'isMember' (accepted in either)
          const roomsWithDetailedStatus = await Promise.all(
            fetchedRooms.map(async (room: RoomWithMembership) => ({ // Cast to RoomWithMembership as API provides isMember
              ...room,
              participationStatus: await checkRoomParticipation(room.id), // Fetch detailed participation status
            }))
          );
          setSearchResults(roomsWithDetailedStatus as SearchResult[]);
        }
      } else if (searchType === "users") {
        // For users, we still query directly from the client as before
        const { data, error } = await supabase
          .from("users")
          .select("id, username, display_name, avatar_url")
          .ilike("display_name", `%${debouncedSearchQuery.trim()}%`)
          .limit(10);

        if (error) {
          console.error(`Search error for ${searchType}:`, error);
          toast.error(error.message || `Failed to search ${searchType}`);
          setSearchResults([]);
        } else if (data && isMounted.current) {
          setSearchResults(data as UserProfile[]);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      if (isMounted.current) {
        toast.error(error instanceof Error ? error.message : "An error occurred while searching");
        setSearchResults([]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [searchType, supabase, user, debouncedSearchQuery, checkRoomParticipation]); // Removed checkRoomMembership as API provides isMember


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
        const { data, error } = await supabase
          .from("room_members")
          .upsert(
            { room_id: currentRoomId, user_id: user.id, status: "accepted" },
            { onConflict: "room_id,user_id" }
          );

        if (error) {
          throw new Error(error.message || "Failed to join room");
        }

        const { data: room } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", currentRoomId)
          .single();
        if (!room) {
          throw new Error("Failed to fetch room details");
        }

        const isMember = await checkRoomMembership(room.id);
        const participationStatus = await checkRoomParticipation(room.id);
        const roomWithMembership: RoomWithMembership = {
          ...room,
          isMember,
          participationStatus,
        };
        setSelectedRoom(roomWithMembership);
        setIsMember(true);
        if (searchType) {
          await fetchSearchResults();
        }
        toast.success("Joined room successfully");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to join room");
      }
    },
    [user, selectedRoom, UUID_REGEX, setSelectedRoom, supabase, searchType, fetchSearchResults, setIsMember, checkRoomMembership, checkRoomParticipation]
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
      const { data, error } = await supabase
        .from("rooms")
        .insert({ name: newRoomName.trim(), is_private: isPrivate, created_by: user.id })
        .select()
        .single();

      if (error) {
        throw new Error(error.message || "Failed to create room");
      }

      const newRoom = data;
      await supabase
        .from("room_members")
        .insert({ room_id: newRoom.id, user_id: user.id, status: "accepted" });

      toast.success("Room created successfully!");
      setNewRoomName("");
      setIsPrivate(false);
      setIsDialogOpen(false);
      await handleJoinRoom(newRoom.id);
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
    setSearchResults([]);
  };

  useEffect(() => {
    if (searchType) {
      fetchSearchResults();
    } else {
      setSearchResults([]);
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

  const renderRoomSearchResult = (result: Room & { isMember: boolean; participationStatus: string | null }) => (
    <li key={result.id} className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">
          {result.name} {result.is_private && "🔒"}
        </span>
      </div>
      {selectedRoom?.id === result.id && result.isMember && UUID_REGEX.test(result.id) ? (
        <Button
          size="sm"
          variant="destructive"
          onClick={handleLeaveRoom}
          className="bg-red-600 hover:bg-red-700"
          disabled={isLeaving}
        >
          <LogOut className="h-4 w-4" />
          {isLeaving ? "Leaving..." : "Leave"}
        </Button>
      ) : result.isMember ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRoomSwitch(result)}
          className="flex items-center gap-1 text-white border-gray-600"
        >
          <span className="flex items-center gap-1">
            <ArrowRight className="h-4 w-4" />
            Switch
          </span>
        </Button>
      ) : result.participationStatus === "pending" ? (
        <span className="text-sm text-muted-foreground">Pending</span>
      ) : (
        <Button
          size="sm"
          onClick={() => handleJoinRoom(result.id)}
          disabled={!user}
        >
          Join
        </Button>
      )}
    </li>
  );

  return (
    <header className="h-14 flex items-center justify-between px-4 glass-gradient-header text-white z-10">
      <h1 className="text-[2.5vw] lg:text-[1em] flex flex-col font-semibold py-2 lg:py-[2em] items-start">
        {selectedRoom ? `#${selectedRoom.name}` : "Daily Chat"}
        <ChatPresence />
      </h1>
      <div className="flex items-center space-x-4">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <PlusCircle className="h-5 w-5 text-gray-300 hover:text-white transition-colors" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Create New Room</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-5">
              <div className="space-y-3">
                <Label htmlFor="roomName" className="text-sm font-medium text-gray-300">Room Name</Label>
                <Input
                  id="roomName"
                  placeholder="Enter room name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  disabled={isCreating}
                  className="bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-0 focus:border-transparent transition-all"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Switch
                  id="private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  disabled={isCreating}
                  className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-gray-600"
                />
                <Label htmlFor="private" className="text-sm font-medium text-gray-300">Private Room</Label>
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
          <Popover open={isSwitchRoomPopoverOpen} onOpenChange={setIsSwitchRoomPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <ArrowRightLeft className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-gray-800 text-white">
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-2">Switch Room</h3>
                {availableRooms.length === 0 ? (
                  <p className="text-sm text-gray-400">No rooms available</p>
                ) : (
                  <ul className="space-y-2">
                    {availableRooms.map((room) => (
                      <li key={room.id} className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">
                          {room.name} {room.is_private && "🔒"}
                        </span>
                        {room.participationStatus === "pending" ? (
                          <span className="text-sm text-muted-foreground">Pending</span>
                        ) : (
                          <Button
                            size="sm"
                            variant={selectedRoom?.id === room.id ? "secondary" : "outline"}
                            onClick={() => handleRoomSwitch(room)}
                            className="text-white border-gray-600"
                          >
                            <span className="flex items-center gap-1">
                              <ArrowRight className="h-4 w-4" />
                              Switch
                            </span>
                          </Button>
                        )}
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
          <Notifications isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
        </div>
        <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={{ left: 16 }}
            className="mr-2 sm:mr-4 md:mr-0"
          >
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-xl text-white">Search</h3>
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
                placeholder={searchType === "users" ? "Search users..." : "Search rooms..."}
                value={searchQuery}
                onChange={handleSearchInputChange}
                className="mb-4 bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
              <div className="flex gap-3 mb-5">
                <Button
                  variant={searchType === "rooms" ? "default" : "outline"}
                  onClick={() => handleSearchByType("rooms")}
                  className={`${searchType === "rooms" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-transparent border-gray-600 hover:bg-gray-700"} text-white rounded-lg transition-colors`}
                >
                  Rooms
                </Button>
                <Button
                  variant={searchType === "users" ? "default" : "outline"}
                  onClick={() => handleSearchByType("users")}
                  className={`${searchType === "users" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-transparent border-gray-600 hover:bg-gray-700"} text-white rounded-lg transition-colors`}
                >
                  Users
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-sm text-gray-300 mb-3">
                    {searchType === "users" ? "User Profiles" : "Rooms"}
                  </h4>
                  <ul className="space-y-3">
                    {searchResults.map((result) =>
                      "display_name" in result ? (
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
                              <div className="text-xs text-gray-400">{result.username}</div>
                              <div className="text-sm font-medium text-white">{result.display_name}</div>
                            </div>
                          </div>
                          <UserIcon className="h-4 w-4 text-gray-400" />
                        </li>
                      ) : (
                        renderRoomSearchResult(result as Room & { isMember: boolean; participationStatus: string | null })
                      )
                    )}
                  </ul>
                </div>
              )}
              {searchResults.length === 0 && searchQuery.length > 0 && (
                <p className="text-sm text-gray-400 mt-3">No {searchType || "results"} found.</p>
              )}
              {searchQuery.length === 0 && searchType && (
                <p className="text-sm text-gray-400 mt-3">Showing all {searchType}...</p>
              )}
              {isLoading && <p className="text-sm text-gray-400 mt-3">Loading...</p>}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
