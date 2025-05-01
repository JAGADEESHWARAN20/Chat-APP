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
  User as UserIcon,
  Settings,
  PlusCircle,
  ArrowRight,
  LogOut,
  RefreshCw,
  Bell,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Database } from "@/lib/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDebounce } from "use-debounce";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type SearchResult = UserProfile | Room;
type Notification = Database["public"]["Tables"]["notifications"]["Row"] & {
  rooms?: { name: string };
  users?: { username: string };
};

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"rooms" | "users" | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [availableRooms, setAvailableRooms] = useState<(Room & { isMember: boolean })[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const supabase = supabaseBrowser();
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  const [isSwitchRoomPopoverOpen, setIsSwitchRoomPopoverOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { selectedRoom, setSelectedRoom, setRooms } = useRoomStore();
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
        setRooms(rooms);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Failed to fetch rooms");
    }
  }, [user, supabase, checkRoomMembership, setRooms]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data: notificationsData, error: notificationsError } = await supabase
        .from("notifications")
        .select(`
          *,
          rooms (name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (notificationsError) {
        console.error("Error fetching notifications:", notificationsError);
        toast.error("Failed to fetch notifications");
        return;
      }

      const senderIds = notificationsData
        ?.filter((notif) => notif.sender_id)
        .map((notif) => notif.sender_id) as string[];
      let usersMap: Record<string, { username: string }> = {};
      if (senderIds?.length) {
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, username")
          .in("id", senderIds);
        if (usersError) {
          console.error("Error fetching users:", usersError);
        } else {
          usersMap = usersData.reduce(
            (acc, user) => ({ ...acc, [user.id]: { username: user.username } }),
            {}
          );
        }
      }

      if (isMounted.current) {
        const enrichedNotifications = notificationsData.map((notif) => ({
          ...notif,
          users: notif.sender_id ? usersMap[notif.sender_id] : undefined,
        }));
        setNotifications(enrichedNotifications as Notification[]);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Failed to fetch notifications");
    }
  }, [user, supabase]);

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
      const data = await response.json();
      setSelectedRoom(room);
      setIsSwitchRoomPopoverOpen(false);
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
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to leave room");
      }
      const { hasOtherRooms } = await response.json();
      toast.success("Left room successfully");
      if (!hasOtherRooms) {
        setSelectedRoom(null);
      } else {
        await fetchAvailableRooms();
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
      await fetchNotifications();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept join request");
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!user) {
      toast.error("You must be logged in to switch rooms");
      return;
    }
    try {
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ status: "read" })
        .eq("id", notification.id);
      if (updateError) throw updateError;
      if (!notification.room_id) {
        throw new Error("Notification is missing room_id");
      }
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", notification.room_id)
        .single();
      if (roomError || !room) throw new Error("Room not found");
      await handleRoomSwitch(room);
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      setIsNotificationsOpen(false);
      toast.success(`Switched to ${room.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to switch room");
      console.error("Error switching room:", error);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedCallback(e.target.value);
  };

  const fetchSearchResults = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        debouncedSearchQuery.trim()
          ? `/api/rooms/search?query=${encodeURIComponent(debouncedSearchQuery)}`
          : "/api/rooms/all"
      );
      const data = await response.json();
      if (isMounted.current) {
        if (response.ok) {
          const results: Room[] = debouncedSearchQuery.trim()
            ? data.rooms || []
            : data.rooms || [];
          const resultsWithMembership = await Promise.all(
            results.map(async (room) => ({
              ...room,
              isMember: await checkRoomMembership(room.id),
            }))
          );
          setSearchResults(resultsWithMembership);
        } else {
          toast.error(data.error || "Failed to search rooms");
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
  }, [debouncedSearchQuery, checkRoomMembership]);

  useEffect(() => {
    fetchSearchResults();
  }, [debouncedSearchQuery, fetchSearchResults]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    fetchAvailableRooms();
    const notificationChannel = supabase
      .channel("global-notifications")
      .on(
        "broadcast",
        { event: "new-message" },
        (payload) => {
          const newNotification = payload.payload as Notification;
          if (isMounted.current) {
            setNotifications((prev) => [newNotification, ...prev].slice(0, 10));
            if (newNotification.status === "unread") {
              toast.info(newNotification.message);
            }
          }
        }
      )
      .on(
        "broadcast",
        { event: "user_joined" },
        (payload) => {
          const newNotification = payload.payload as Notification;
          if (isMounted.current) {
            setNotifications((prev) => [newNotification, ...prev].slice(0, 10));
            if (newNotification.status === "unread") {
              toast.info(newNotification.message);
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("Subscribed to global notifications channel");
        } else if (status === "CLOSED") {
          toast.error("Notification subscription closed");
        } else if (status === "CHANNEL_ERROR") {
          console.error("Notification channel error:", err);
          toast.error("Error in notification subscription");
        }
      });
    return () => {
      supabase.removeChannel(notificationChannel);
    };
  }, [user, fetchNotifications, fetchAvailableRooms, supabase]);

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
    <li key={result.id} className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">
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
          className="flex items-center gap-1"
        >
          <ArrowRight className="h-4 w-4" />
          Switch
        </Button>
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
    <header className="h-20 border-b flex items-center justify-between p-4 bg-white shadow-sm">
      <div className="flex items-center">
        <h1 className="text-xl font-bold mr-4">
          {selectedRoom ? selectedRoom.name : "Daily Chat"}
        </h1>
        <ChatPresence />
      </div>
      <div className="flex items-center space-x-2">
        {user && (
          <>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <PlusCircle className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="hidden md:flex">
                  <PlusCircle className="h-4 w-4 mr-2" /> Create Room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Room</DialogTitle>
                  <DialogDescription>
                    Create a new chat room. Private rooms require approval to join.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="roomName">Room Name</Label>
                    <Input
                      id="roomName"
                      placeholder="Enter room name"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      disabled={isCreating}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="private"
                      checked={isPrivate}
                      onCheckedChange={setIsPrivate}
                      disabled={isCreating}
                    />
                    <Label htmlFor="private">Private Room</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRoom} disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create Room"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {selectedRoom && (
              <>
                {isMember ? (
                  <>
                    <Popover open={isSwitchRoomPopoverOpen} onOpenChange={setIsSwitchRoomPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="hidden md:flex">
                          <RefreshCw className="h-4 w-4 mr-2" /> Switch Room
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="p-4">
                          <h3 className="font-semibold text-lg mb-2">Switch Room</h3>
                          {availableRooms.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No rooms available</p>
                          ) : (
                            <ul className="space-y-2">
                              {availableRooms.map((room) => (
                                <li
                                  key={room.id}
                                  className="flex items-center justify-between"
                                >
                                  <span className="text-sm font-semibold">
                                    {room.name} {room.is_private && "🔒"}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant={selectedRoom?.id === room.id ? "secondary" : "outline"}
                                    onClick={() => handleRoomSwitch(room)}
                                    className="flex items-center gap-1"
                                  >
                                    <ArrowRight className="h-4 w-4" />
                                    Switch
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="destructive"
                      size="icon" className="md:hidden bg-red-600 hover:bg-red-700"
                      
                      onClick={handleLeaveRoom}
                      disabled={isLeaving}
                    >
                      {isLeaving ? (
                        <>
                          <RefreshCw size="sm" className="hidden md:flex bg-red-600 hover:bg-red-700 h-4 w-4 animate-spin" />
                        </>
                      ) : (
                        <>
                          <LogOut className="h-4 w-4" />
                        </>
                      )}
                      <span className="hidden md:inline ml-2">Leave</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => handleJoinRoom(selectedRoom.id)}
                    size="sm" className="hidden md:flex"
                  >
                    <ArrowRight className="h-4 w-4 md:hidden" />
                    <span className="hidden md:inline ml-2">Join Room</span>
                  </Button>
                )}
              </>
            )}

            <Popover open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  {notifications.filter((n) => n.status === "unread").length > 0 && (
                    <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2">Notifications</h3>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No notifications</p>
                  ) : (
                    <ul className="space-y-2">
                      {notifications.map((notif) => (
                        <li
                          key={notif.id}
                          className="flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-700 p-2 rounded"
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div>
                            <p className="text-sm">{notif.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {notif.created_at ? new Date(notif.created_at).toLocaleString() : "Unknown time"}
                            </p>
                          </div>
                          {notif.type === "join_request" && notif.status === "unread" && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptJoinRequest(notif.id);
                              }}
                            >
                              Accept
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Search className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="hidden md:flex">
                  <Search className="h-4 w-4 mr-2" /> Search
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="p-4">
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setIsSearchPopoverOpen(false);
                        router.push("/profile");
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Search</h3>
                  <Input
                    type="text"
                    placeholder="Search rooms..."
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    className="mb-4"
                  />
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant={searchType === "rooms" ? "default" : "outline"}
                      onClick={() => handleSearchByType("rooms")}
                    >
                      Rooms
                    </Button>
                    <Button
                      variant={searchType === "users" ? "default" : "outline"}
                      onClick={() => handleSearchByType("users")}
                    >
                      Users
                    </Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm mb-2">
                        {searchType === "users" ? "User Profiles" : "Rooms"}
                      </h4>
                      <ul className="space-y-2">
                        {searchResults.map((result) =>
                          "username" in result ? (
                            <li
                              key={result.id}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <Avatar>
                                  {result.avatar_url ? (
                                    <AvatarImage
                                      src={result.avatar_url}
                                      alt={result.username || "Avatar"}
                                    />
                                  ) : (
                                    <AvatarFallback>
                                      {result.username?.charAt(0).toUpperCase() ||
                                        result.display_name?.charAt(0).toUpperCase() ||
                                        "?"}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <div>
                                  <div className="text-xs text-gray-500">
                                    {result.username}
                                  </div>
                                  <div className="text-sm font-semibold">
                                    {result.display_name}
                                  </div>
                                </div>
                              </div>
                              <UserIcon className="h-4 w-4 text-gray-500" />
                            </li>
                          ) : (
                            renderRoomSearchResult(result as Room & { isMember: boolean })
                          )
                        )}
                      </ul>
                    </div>
                  )}
                  {searchResults.length === 0 && searchQuery.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      No {searchType || "results"} found.
                    </p>
                  )}
                  {searchQuery.length === 0 && searchType && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Showing all {searchType}...
                    </p>
                  )}
                  {isLoading && (
                    <p className="text-sm text-muted-foreground mt-2">Loading...</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
        {user ? (
          <>
          <Button size="icon" className="md:hidden" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
          <Button size="sm" className="hidden md:flex" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
          </>
        ) : (
            <>
          <Button size="icon" className="md:hidden" onClick={handleLoginWithGithub}>
            <UserIcon className="h-4 w-4" />
          </Button>
          <Button size="sm" className="hidden md:flex" onClick={handleLoginWithGithub}>
            <UserIcon className="h-4 w-4 mr-2" /> Login
          </Button>
            </>
        )}
      </div>
    </header>
  );
}