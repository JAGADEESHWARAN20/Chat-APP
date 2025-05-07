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
  LogOut,
  UserIcon,
  Users,
  MessageSquare,
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
import { useNotification, Inotification } from "@/lib/store/notifications";

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

  const checkRoomMembership = useCallback(
    async (roomId: string) => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("room_participants")
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

  const fetchAvailableRooms = useCallback(async () => {
    if (!user) return;
    try {
      const { data: roomsData, error } = await supabase
        .from("room_participants")
        .select("rooms(*)")
        .eq("user_id", user.id)
        .eq("status", "accepted");
      if (error) {
        console.error("Error fetching rooms:", error);
        toast.error("Failed to fetch rooms");
        return;
      }
      const rooms = roomsData
        .map((item) => item.rooms)
        .filter((room): room is Room => room !== null);
      const roomsWithMembership = await Promise.all(
        rooms.map(async (room) => ({
          ...room,
          isMember: await checkRoomMembership(room.id),
        }))
      );
      if (isMounted.current) {
        setAvailableRooms(roomsWithMembership);
        setRooms(roomsWithMembership);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Failed to fetch rooms");
    }
  }, [user, supabase, checkRoomMembership, setRooms]);

  const handleRoomSwitch = async (room: Room) => {
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
      await fetchAvailableRooms();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to switch room";
      toast.error(errorMessage);
      console.error("Switch room error:", err);
    }
  };

  const handleLeaveRoom = async () => {
    if (!user || !selectedRoom) {
      toast.error("No room selected");
      return;
    }
    setIsLeaving(true);
    try {
      const response = await fetch(`/api/rooms/${selectedRoom.id}/leave`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to leave room");
      }
      const { hasOtherRooms } = await response.json();
      toast.success("Left room successfully");
      setIsMember(false);
      await fetchAvailableRooms();
      if (!hasOtherRooms) {
        setSelectedRoom(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave room");
    } finally {
      setIsLeaving(false);
    }
  };

  const handleAcceptJoinRequest = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/accept`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to accept join request");
      }
      toast.success("Join request accepted");
      if (user?.id) {
        await fetchNotifications(user.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept join request");
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
      // Cleanup is handled by Notifications component
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

  const handleLoginWithGithub = () => {
    supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: location.origin + "/auth/callback",
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const handleSearchByType = (type: "rooms" | "users") => {
    setSearchType(type);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleJoinRoom = async (roomId?: string) => {
    if (!user) {
      toast.error("You must be logged in to join a room");
      return;
    }
    const currentRoomId = roomId || selectedRoom?.id;
    if (!currentRoomId) {
      toast.error("No room selected");
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${currentRoomId}/join`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to join room");
      }
      const data = await response.json();
      toast.success(data.message);
      if (!data.status || data.status === "accepted") {
        const { data: room, error: roomError } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", currentRoomId)
          .single();
        if (roomError || !room) {
          throw new Error("Failed to fetch room details");
        }
        setSelectedRoom(room);
        setIsMember(true);
        await fetchAvailableRooms();
        const notification = {
          id: crypto.randomUUID(),
          user_id: user.id,
          type: "user_joined",
          room_id: currentRoomId,
          sender_id: user.id,
          message: `${user.email} joined the room ${room.name}`,
          status: "unread",
          created_at: new Date().toISOString(),
        };
        await supabase
          .channel("global-notifications")
          .send({
            type: "broadcast",
            event: "user_joined",
            payload: notification,
          });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join room");
    }
  };

  const renderRoomSearchResult = (result: Room & { isMember: boolean }) => (
    <li key={result.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-700 transition">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-gray-400" />
        <span className="text-sm font-medium text-white">
          {result.name} {result.is_private && "🔒"}
        </span>
      </div>
      {selectedRoom?.id === result.id && result.isMember ? (
        <Button
          size="sm"
          variant="destructive"
          onClick={handleLeaveRoom}
          className="bg-red-600 hover:bg-red-700"
          disabled={isLeaving}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      ) : result.isMember ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRoomSwitch(result)}
          className="text-white border-gray-600 hover:bg-gray-600"
        >
          Switch
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => handleJoinRoom(result.id)}
          disabled={!user}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Join
        </Button>
      )}
    </li>
  );

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Chat Rooms
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {availableRooms.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No rooms available</p>
          ) : (
            <ul className="p-2 space-y-2">
              {availableRooms.map((room) => (
                <li
                  key={room.id}
                  className={`p-3 rounded-md cursor-pointer flex items-center gap-2 ${selectedRoom?.id === room.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-700"
                    }`}
                  onClick={() => handleRoomSwitch(room)}
                >
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    {room.name} {room.is_private && "🔒"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4 border-t border-gray-700">
          {user ? (
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="w-full text-gray-300 hover:text-white hover:bg-gray-700"
            >
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          ) : (
            <Button
              onClick={handleLoginWithGithub}
              variant="ghost"
              size="sm"
              className="w-full text-gray-300 hover:text-white hover:bg-gray-700"
            >
              Login with GitHub
            </Button>
          )}
        </div>
      </aside>

      {/* Main Header */}
      <header className="flex-1 h-14 border-b border-gray-700 flex items-center justify-between px-4 bg-gray-900 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">
            {selectedRoom ? `#${selectedRoom.name}` : "Daily Chat"}
          </h1>
          <ChatPresence />
        </div>
        <div className="flex items-center space-x-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                <PlusCircle className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 text-white rounded-lg shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Create New Room</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="roomName" className="text-gray-300">Room Name</Label>
                  <Input
                    id="roomName"
                    placeholder="Enter room name"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    disabled={isCreating}
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="private"
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                    disabled={isCreating}
                    className="data-[state=checked]:bg-blue-600"
                  />
                  <Label htmlFor="private" className="text-gray-300">Private Room</Label>
                </div>
              </div>
              <DialogFooter className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isCreating}
                  className="text-gray-300 border-gray-600 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateRoom}
                  disabled={isCreating || !newRoomName.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isCreating ? "Creating..." : "Create Room"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsNotificationsOpen(true)}
              className="text-gray-300 hover:text-white hover:bg-gray-700 relative"
            >
              <Bell className="h-5 w-5" />
              {notifications.filter((n) => !n.is_read).length > 0 && (
                <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
                  {notifications.filter((n) => !n.is_read).length}
                </span>
              )}
            </Button>
            <Notifications
              isOpen={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
            />
          </div>

          <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                <Search className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 bg-gray-800 text-white rounded-lg shadow-lg">
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-lg text-white">Search</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setIsSearchPopoverOpen(false);
                      router.push("/profile");
                    }}
                    className="text-gray-300 hover:text-white hover:bg-gray-700"
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
                  className="mb-4 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={searchType === "rooms" ? "default" : "outline"}
                    onClick={() => handleSearchByType("rooms")}
                    className={`flex-1 ${searchType === "rooms"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "text-white border-gray-600 hover:bg-gray-700"
                      }`}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Rooms
                  </Button>
                  <Button
                    variant={searchType === "users" ? "default" : "outline"}
                    onClick={() => handleSearchByType("users")}
                    className={`flex-1 ${searchType === "users"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "text-white border-gray-600 hover:bg-gray-700"
                      }`}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Users
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-sm text-gray-300 mb-2">
                      {searchType === "users" ? "User Profiles" : "Rooms"}
                    </h4>
                    <ul className="space-y-2 max-h-60 overflow-y-auto">
                      {searchResults.map((result) =>
                        "display_name" in result ? (
                          <li
                            key={result.id}
                            className="flex items-center justify-between p-2 rounded-md hover:bg-gray-700 transition"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                {result.avatar_url ? (
                                  <AvatarImage
                                    src={result.avatar_url}
                                    alt={result.username || "Avatar"}
                                  />
                                ) : (
                                  <AvatarFallback className="bg-gray-600 text-white">
                                    {result.username?.charAt(0).toUpperCase() ||
                                      result.display_name?.charAt(0).toUpperCase() ||
                                      "?"}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div>
                                <div className="text-xs text-gray-400">
                                  @{result.username}
                                </div>
                                <div className="text-sm font-medium text-white">
                                  {result.display_name}
                                </div>
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
                  <p className="text-sm text-gray-400 mt-2">
                    No {searchType || "results"} found.
                  </p>
                )}
                {searchQuery.length === 0 && searchType && (
                  <p className="text-sm text-gray-400 mt-2">
                    Showing all {searchType}...
                  </p>
                )}
                {isLoading && (
                  <p className="text-sm text-gray-400 mt-2">Loading...</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>
    </div>
  );
}