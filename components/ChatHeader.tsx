"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  DialogTrigger,
  DialogFooter,
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

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"rooms" | "users" | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [availableRooms, setAvailableRooms] = useState<(Room & { isMember: boolean })[]>([]);
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

  const [debouncedCallback] = useDebounce((value: string) => setSearchQuery(value), 300);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const checkRoomMembership = useCallback(
    async (roomId: string) => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("room_members") // Aligned with backend table name
        .select("status")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .single();
      if (error && error.code !== "PGRST116") {
        console.error("Error checking room membership:", error);
        return false;
      }
      return data?.status === "accepted";
    },
    [user, supabase]
  );



  const handleRoomSwitch = async (room: Room) => {
    if (!user) {
      toast.error("You must be logged in to switch rooms");
      return;
    }
    try {
      console.log(`[Switch Room Frontend] Attempting to switch to roomId: ${room.id}`);
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
      setIsSwitchRoomPopoverOpen(false);
      toast.success(`Switched to ${room.name}`);
      await fetchAvailableRooms();
      // Refresh search results to update button states
      if (searchType) {
        console.log("[Switch Room Frontend] Refreshing search results after switching room");
        await fetchSearchResults();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to switch room";
      toast.error(errorMessage);
      console.error("[Switch Room Frontend] Error:", err);
    }
  };

  const handleLeaveRoom = async () => {
    console.log("[Leave Room Frontend] Current selectedRoom:", selectedRoom);

    if (!user) {
      console.error("[Leave Room Frontend] User not authenticated");
      toast.error("Please log in to leave a room");
      return;
    }

    if (!selectedRoom) {
      console.error("[Leave Room Frontend] No room selected");
      toast.error("No room selected");
      return;
    }

    if (!selectedRoom.id || typeof selectedRoom.id !== "string") {
      console.error("[Leave Room Frontend] Invalid or missing room ID", { selectedRoom });
      toast.error("Invalid room selection");
      return;
    }

    const roomId = selectedRoom.id.trim();
    if (!roomId || !UUID_REGEX.test(roomId)) {
      console.error("[Leave Room Frontend] Invalid room ID format:", roomId, { selectedRoom });
      toast.error("Invalid room ID format");
      return;
    }

    try {
      await proceedToLeaveRoom(roomId);
    } catch (error) {
      console.error("[Leave Room Frontend] Error in handleLeaveRoom:", error, { selectedRoom });
      toast.error("Failed to leave the room");
    }
  };

  const proceedToLeaveRoom = async (roomId: string) => {
    setIsLeaving(true);
    console.log(`[Leave Room Frontend] Attempting to leave room: ${roomId}`);

    try {
      console.log(`[Leave Room Frontend] Sending PATCH request to /api/rooms/${roomId}/leave`);
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/leave`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorCode = errorData.code || "UNKNOWN_ERROR";
        let errorMessage = errorData.error || "Failed to leave room";

        // Map backend error codes to user-friendly messages
        switch (errorCode) {
          case "AUTH_REQUIRED":
            errorMessage = "Please log in to leave the room.";
            break;
          case "INVALID_ROOM_ID":
            errorMessage = "The room ID is invalid.";
            break;
          case "ROOM_NOT_FOUND":
            errorMessage = "The room does not exist.";
            break;
          case "NOT_A_MEMBER":
            errorMessage = "You are not a member of this room.";
            break;
          case "CREATOR_CANNOT_LEAVE":
            errorMessage = "As the room creator, you must transfer ownership first.";
            break;
          case "ROOM_DELETION_FAILED":
            errorMessage = "Failed to delete the empty room.";
            break;
          case "LEAVE_FAILED":
            errorMessage = "Unable to leave the room. Please try again.";
            break;
          case "METHOD_NOT_ALLOWED":
            errorMessage = "Incorrect request method. Please contact support.";
            break;
          default:
            errorMessage = "An unexpected error occurred.";
        }

        console.error(`[Leave Room Frontend] API error for roomId: ${roomId}, code: ${errorCode}, message: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log(`[Leave Room Frontend] Successfully left room: ${roomId}`, result);
      toast.success(result.message || "Successfully left the room");

      // Update local state
      setIsMember(false);
      await fetchAvailableRooms();

      if (!result.hasOtherRooms) {
        setSelectedRoom(null);
        router.push("/");
      } else {
        const newSelectedRoom = useRoomStore.getState().selectedRoom;
        if (newSelectedRoom) {
          setSelectedRoom(newSelectedRoom);
        } else {
          setSelectedRoom(null);
          router.push("/");
        }
      }
    } catch (error) {
      console.error("[Leave Room Frontend] Error leaving room:", error, { roomId });
      toast.error(error instanceof Error ? error.message : "Failed to leave room");
    } finally {
      setIsLeaving(false);
    }
  };


  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedCallback(e.target.value);
  };

  const fetchSearchResults = useCallback(async () => {
    if (!searchType) return;
    setIsLoading(true);
    try {
      let url = "";
      if (searchType === "rooms") {
        url = debouncedSearchQuery.trim()
          ? `/api/rooms/search?query=${encodeURIComponent(debouncedSearchQuery)}`
          : "/api/rooms/all";
      } else if (searchType === "users") {
        url = debouncedSearchQuery.trim()
          ? `/api/users/search?query=${encodeURIComponent(debouncedSearchQuery)}`
          : "/api/users/search?query=";
      }

      const response = await fetch(url);
      const data = await response.json();
      if (isMounted.current) {
        if (response.ok) {
          if (searchType === "rooms") {
            const results: Room[] = data.rooms || data;
            const resultsWithMembership = await Promise.all(
              results.map(async (room) => ({
                ...room,
                isMember: await checkRoomMembership(room.id),
              }))
            );
            setSearchResults(resultsWithMembership);
          } else if (searchType === "users") {
            const results: UserProfile[] = data || [];
            setSearchResults(results);
          }
        } else {
          toast.error(data.error || `Failed to search ${searchType}`);
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      if (isMounted.current) {
        toast.error("An error occurred while searching");
        setSearchResults([]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [debouncedSearchQuery, searchType, checkRoomMembership]);

  const handleJoinRoom = useCallback(
    async (roomId?: string) => {
      if (!user) {
        toast.error("You must be logged in to join a room");
        return;
      }
      const currentRoomId = roomId || selectedRoom?.id;
      console.log(`[Join Room Frontend] Attempting to join roomId: ${currentRoomId}`);
      if (!currentRoomId) {
        console.error("[Join Room Frontend] No room selected");
        toast.error("No room selected");
        return;
      }
      if (!UUID_REGEX.test(currentRoomId)) {
        console.error(`[Join Room Frontend] Invalid roomId format: ${currentRoomId}`);
        toast.error("Invalid room ID format");
        return;
      }
      try {
        console.log(`[Join Room Frontend] Sending POST request to /api/rooms/${currentRoomId}/join`);
        const response = await fetch(`/api/rooms/${encodeURIComponent(currentRoomId)}/join`, {
          method: "POST",
        });
        if (!response.ok) {
          const errorData = await response.json();
          const errorCode = errorData.code || "UNKNOWN_ERROR";
          let errorMessage = errorData.error || "Failed to join room";

          switch (errorCode) {
            case "AUTH_REQUIRED":
              errorMessage = "Please log in to join the room.";
              break;
            case "INVALID_ROOM_ID":
              errorMessage = "The room ID is invalid.";
              break;
            case "MISSING_ROOM_ID":
              errorMessage = "Room ID is missing.";
              break;
            case "ROOM_NOT_FOUND":
              errorMessage = "The room does not exist.";
              break;
            case "PARTICIPATION_CHECK_FAILED":
              errorMessage = "Unable to verify membership status.";
              break;
            case "JOIN_FAILED":
              errorMessage = "Unable to join the room. Please try again.";
              break;
            case "MEMBER_ADD_FAILED":
              errorMessage = "Failed to add you to the room members.";
              break;
            case "CREATOR_NOT_FOUND":
              errorMessage = "Room creator not found for private room.";
              break;
            default:
              errorMessage = "An unexpected error occurred.";
          }

          console.error(`[Join Room Frontend] API error for roomId: ${currentRoomId}, code: ${errorCode}, message: ${errorMessage}`);
          throw new Error(errorMessage);
        }
        const data = await response.json();
        console.log(`[Join Room Frontend] Successfully joined roomId: ${currentRoomId}`, data);
        toast.success(data.message);
        if (!data.status || data.status === "accepted") {
          const { data: room, error: roomError } = await supabase
            .from("rooms")
            .select("*")
            .eq("id", currentRoomId)
            .single();
          if (roomError || !room) {
            console.error(`[Join Room Frontend] Failed to fetch room details for roomId: ${currentRoomId}`);
            throw new Error("Failed to fetch room details");
          }
          setSelectedRoom(room);
          setIsMember(true);
          // Refresh search results to update button states
          if (searchType) {
            console.log("[Join Room Frontend] Refreshing search results after joining room");
            await fetchSearchResults();
          }
        }
      } catch (error) {
        console.error(`[Join Room Frontend] Error joining roomId: ${currentRoomId}`, error);
        toast.error(error instanceof Error ? error.message : "Failed to join room");
      }
    },
    [user, selectedRoom, setSelectedRoom, supabase, searchType, fetchSearchResults] // Add dependencies
  );

  const fetchAvailableRooms = useCallback(async () => {
    if (!user) return;
    try {
      const { data: roomsData, error } = await supabase
        .from("room_members") // Aligned with backend table name
        .select("rooms(*)")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (error) {
        console.error("Error fetching rooms:", error);
        toast.error("Failed to fetch rooms");
        return;
      }

      let rooms = roomsData
        .map((item) => item.rooms)
        .filter((room): room is Room => room !== null);

      if (rooms.length === 0) {
        const { data: generalChat, error: generalChatError } = await supabase
          .from("rooms")
          .select("*")
          .eq("name", "General Chat")
          .eq("is_private", false)
          .single();

        if (generalChatError || !generalChat) {
          const { data: newRoom, error: createError } = await supabase
            .from("rooms")
            .insert({ name: "General Chat", is_private: false, created_by: user.id })
            .select()
            .single();

          if (createError || !newRoom) {
            console.error("Error creating General Chat:", createError);
            toast.error("Failed to create default room");
            return;
          }

          await handleJoinRoom(newRoom.id);
          rooms = [newRoom];
        } else {
          await handleJoinRoom(generalChat.id);
          rooms = [generalChat];
        }
      }

      const roomsWithMembership = await Promise.all(
        rooms.map(async (room) => ({
          ...room,
          isMember: await checkRoomMembership(room.id),
        }))
      );

      if (isMounted.current) {
        setAvailableRooms(roomsWithMembership);
        setRooms(roomsWithMembership);
        useRoomStore.getState().initializeDefaultRoom();
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Failed to fetch rooms");
    }
  }, [user, supabase, checkRoomMembership, setRooms, handleJoinRoom]);


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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoomName.trim(),
          is_private: isPrivate,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create room");
      }
      const newRoom = await response.json();
      toast.success("Room created successfully!");
      setNewRoomName("");
      setIsPrivate(false);
      setIsDialogOpen(false);
      await handleJoinRoom(newRoom.id);
      await fetchAvailableRooms();
    } catch (error) {
      if (isMounted.current) {
        toast.error(error instanceof Error ? error.message : "Failed to create room");
      }
    } finally {
      if (isMounted.current) {
        setIsCreating(false);
      }
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

    return () => {
      // Cleanup handled by Notifications component
    };
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

  const renderRoomSearchResult = (result: Room & { isMember: boolean }) => (
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
      ) : (
            <Button
              size="sm"
              onClick={() => {
                console.log(`[Join Room Frontend] Clicking join for roomId: ${result.id}`);
                handleJoinRoom(result.id);
              }}
              disabled={!user}
            >
              Join
            </Button>
      )}
    </li>
  );

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 bg-gray-900 text-white shadow-sm">
      <h1 className="text-lg flex flex-col font-semibold py-2 items-start">
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
                        renderRoomSearchResult(result as Room & { isMember: boolean })
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