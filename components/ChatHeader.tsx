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
  Home,
  Users,
  Activity,
  LogOut,
  UserIcon,
  MessageSquare,
  Send,
  Settings,
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
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { useDebounce } from "use-debounce";
import Notifications from "./Notifications";
import { useNotification, Inotification } from "@/lib/store/notifications";

type UserProfile = Database["public"]["Tables"]["users"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type SearchResult = { type: "room"; data: Room & { isMember: boolean } } | { type: "user"; data: UserProfile };
type RecentAction = {
  id: string;
  type: "room" | "direct";
  name: string;
  lastMessage: string;
  timestamp: string;
};

// Define types for Supabase query responses
interface RoomMessage {
  id: string;
  text: string;
  created_at: string;
  room_id: string;
  rooms: { name: string } | null;
}

interface DirectMessage {
  id: string;
  text: string;
  created_at: string;
  direct_chat_id: string;
  direct_chats: { users: UserProfile } | null;
}

export default function ChatHeader({ user }: { user: SupabaseUser | undefined }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"home" | "rooms" | "activity">("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [availableRooms, setAvailableRooms] = useState<(Room & { isMember: boolean })[]>([]);
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [activityItems, setActivityItems] = useState<Array<(Room & { isMember: boolean }) | UserProfile>>([]);
  const supabase = supabaseBrowser();
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { selectedRoom, setSelectedRoom, setRooms } = useRoomStore();
  const { selectedChat, setSelectedChat } = useDirectChatStore();
  const { notifications, fetchNotifications, subscribeToNotifications } = useNotification();
  const isMounted = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [searchTab, setSearchTab] = useState<"room" | "user">("room");

  const [debouncedCallback] = useDebounce((value: string) => setSearchQuery(value), 100);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 100);

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

  const fetchRecentActions = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch recent room messages
      const { data: roomMessages, error: roomError } = await supabase
        .from("messages")
        .select("id, text, created_at, room_id, rooms!room_id(name)")
        .eq("send_by", user.id)
        .not("room_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10) as { data: RoomMessage[] | null; error: any };
      if (roomError) throw roomError;

      // Fetch recent direct messages
      const { data: directMessages, error: directError } = await supabase
        .from("messages")
        .select("id, text, created_at, direct_chat_id, direct_chats!direct_chat_id(users!other_user_id(id, username, display_name))")
        .eq("send_by", user.id)
        .not("direct_chat_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10) as { data: DirectMessage[] | null; error: any };
      if (directError) throw directError;

      const recent: RecentAction[] = [
        ...(roomMessages?.map((msg) => ({
          id: msg.id,
          type: "room" as const,
          name: msg.rooms?.name || "Unknown Room",
          lastMessage: msg.text,
          timestamp: msg.created_at,
        })) || []),
        ...(directMessages?.map((msg) => ({
          id: msg.id,
          type: "direct" as const,
          name: msg.direct_chats?.users?.display_name || msg.direct_chats?.users?.username || "Unknown User",
          lastMessage: msg.text,
          timestamp: msg.created_at,
        })) || []),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (isMounted.current) {
        setRecentActions(recent);
      }
    } catch (error) {
      console.error("Error fetching recent actions:", error);
      toast.error("Failed to fetch recent actions");
    }
  }, [user, supabase]);

  const fetchActivity = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch rooms for activity
      const { data: roomsData, error: roomsError } = await supabase
        .from("room_participants")
        .select("rooms(*)")
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .limit(5);
      if (roomsError) throw roomsError;

      const rooms = roomsData
        .map((item) => item.rooms)
        .filter((room): room is Room => room !== null);
      const roomsWithMembership = await Promise.all(
        rooms.map(async (room) => ({
          ...room,
          isMember: await checkRoomMembership(room.id),
        }))
      );

      // Fetch user profiles for activity
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .neq("id", user.id)
        .limit(5);
      if (usersError) throw usersError;

      if (isMounted.current) {
        setActivityItems([...roomsWithMembership, ...(usersData || [])]);
      }
    } catch (error) {
      console.error("Error fetching activity:", error);
      toast.error("Failed to fetch activity");
    }
  }, [user, supabase, checkRoomMembership]);

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
      setSelectedChat(null);
      toast.success(`Switched to ${room.name}`);
      await fetchAvailableRooms();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to switch room";
      toast.error(errorMessage);
      console.error("Switch room error:", err);
    }
  };

  const handleDirectChatSelect = (userProfile: UserProfile) => {
    if (!user) {
      toast.error("You must be logged in to start a direct chat");
      return;
    }
    const chat = {
      id: crypto.randomUUID(),
      other_user_id: userProfile.id,
      users: userProfile,
    };
    setSelectedChat(chat);
    setSelectedRoom(null);
    toast.success(`Started chat with ${userProfile.display_name || userProfile.username}`);
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
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    try {
      // Fetch rooms
      const roomsResponse = await fetch(
        `/api/rooms/search?query=${encodeURIComponent(debouncedSearchQuery)}`
      );
      const roomsData = await roomsResponse.json();
      const roomsResults = roomsResponse.ok
        ? await Promise.all(
          (roomsData.rooms || []).map(async (room: Room) => ({
            type: "room" as const,
            data: { ...room, isMember: await checkRoomMembership(room.id) },
          }))
        )
        : [];

      // Fetch users
      const usersResponse = await fetch(
        `/api/users/search?query=${encodeURIComponent(debouncedSearchQuery)}`
      );
      const usersData = await usersResponse.json();
      const usersResults = usersResponse.ok
        ? (usersData || []).map((user: UserProfile) => ({
          type: "user" as const,
          data: user,
        }))
        : [];

      if (isMounted.current) {
        setSearchResults([...roomsResults, ...usersResults]);
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
    if (!user?.id) return;
    fetchAvailableRooms();
    fetchRecentActions();
    fetchActivity();
    fetchNotifications(user.id);
    subscribeToNotifications(user.id);

    return () => {
      // Cleanup is handled by Notifications component
    };
  }, [user, fetchAvailableRooms, fetchRecentActions, fetchActivity, fetchNotifications, subscribeToNotifications]);

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
        setSelectedChat(null);
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

  const renderSearchResult = (result: SearchResult) => (
    <li
      key={result.type === "room" ? result.data.id : result.data.id}
      className="flex items-center justify-between p-2 rounded-md hover:bg-gray-700 transition"
    >
      {result.type === "room" ? (
        <>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-white">
              {result.data.name} {result.data.is_private && "🔒"}
            </span>
          </div>
          {selectedRoom?.id === result.data.id && result.data.isMember ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleLeaveRoom}
              className="bg-red-600 hover:bg-red-700"
              disabled={isLeaving}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : result.data.isMember ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRoomSwitch(result.data)}
              className="text-white border-gray-600 hover:bg-gray-600"
            >
              Switch
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleJoinRoom(result.data.id)}
              disabled={!user}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Join
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {result.data.avatar_url ? (
                <AvatarImage src={result.data.avatar_url} alt={result.data.username || "Avatar"} />
              ) : (
                <AvatarFallback className="bg-gray-600 text-white">
                  {result.data.username?.charAt(0).toUpperCase() ||
                    result.data.display_name?.charAt(0).toUpperCase() ||
                    "?"}
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <div className="text-xs text-gray-400">@{result.data.username}</div>
              <div className="text-sm font-medium text-white">{result.data.display_name}</div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleDirectChatSelect(result.data)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Chat
          </Button>
        </>
      )}
    </li>
  );

  return (
    <>
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            FlyChat
          </h2>
        </div>
        <nav className="flex-1">
          <ul className="space-y-2 p-2">
            <li>
              <button
                onClick={() => {
                  setActiveTab("home");
                  setSelectedRoom(null);
                  setSelectedChat(null);
                }}
                className={`w-full flex items-center gap-2 p-3 rounded-md ${activeTab === "home" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}
              >
                <Home className="h-5 w-5" />
                <span className="text-sm font-medium">Home</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActiveTab("rooms");
                  setSelectedRoom(null);
                  setSelectedChat(null);
                }}
                className={`w-full flex items-center gap-2 p-3 rounded-md ${activeTab === "rooms" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}
              >
                <MessageSquare className="h-5 w-5" />
                <span className="text-sm font-medium">Rooms</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActiveTab("activity");
                  setSelectedRoom(null);
                  setSelectedChat(null);
                }}
                className={`w-full flex items-center gap-2 p-3 rounded-md ${activeTab === "activity" ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"}`}
              >
                <Activity className="h-5 w-5" />
                <span className="text-sm font-medium">Activity</span>
              </button>
            </li>
          </ul>
        </nav>
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

      {/* Chat Header (only shown when a room or direct chat is selected) */}
      {(selectedRoom || selectedChat) && (
        <header className="h-14 border-b border-gray-700 flex items-center justify-between px-4 bg-gray-900 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">
              {selectedRoom ? `#${selectedRoom.name}` : selectedChat ? `@${selectedChat.users?.username}` : "Chat"}
            </h1>
            <ChatPresence />
          </div>
          <div className="flex items-center space-x-3">
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
                    placeholder="Search rooms or users..."
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    className="mb-4 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchQuery.trim() && (
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant={searchTab === "room" ? "default" : "outline"}
                        onClick={() => setSearchTab("room")}
                        className={`flex-1 ${searchTab === "room"
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "text-white border-gray-600 hover:bg-gray-700"
                          }`}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Rooms
                      </Button>
                      <Button
                        variant={searchTab === "user" ? "default" : "outline"}
                        onClick={() => setSearchTab("user")}
                        className={`flex-1 ${searchTab === "user"
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "text-white border-gray-600 hover:bg-gray-700"
                          }`}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Users
                      </Button>
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm text-gray-300 mb-2">
                        {searchTab === "user" ? "User Profiles" : "Rooms"}
                      </h4>
                      <ul className="space-y-2 max-h-60 overflow-y-auto">
                        {searchResults
                          .filter((result) => result.type === searchTab)
                          .map((result) => renderSearchResult(result))}
                      </ul>
                    </div>
                  )}
                  {searchResults.filter((result) => result.type === searchTab).length === 0 &&
                    searchQuery.length > 0 && (
                      <p className="text-sm text-gray-400 mt-2">No {searchTab === "user" ? "users" : "rooms"} found.</p>
                    )}
                  {isLoading && <p className="text-sm text-gray-400 mt-2">Loading...</p>}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>
      )}
    </>
  );
}