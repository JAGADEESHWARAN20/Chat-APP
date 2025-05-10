"use client";

import { useEffect, useState } from "react";
import { useNotification } from "@/lib/store/notifications";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/roomstore"; // Added for setSelectedRoom
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { useRouter } from "next/navigation";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Trash2 } from "lucide-react";
import { Database } from "@/lib/types/supabase"; // Added for Room type

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

type Room = Database["public"]["Tables"]["rooms"]["Row"]; // Added for Room type

export default function Notifications({ isOpen, onClose }: NotificationsProps) {
  const user = useUser((state) => state.user) as SupabaseUser | undefined;
  const { notifications, markAsRead, fetchNotifications, subscribeToNotifications, setNotifications } = useNotification();
  const { setSelectedRoom } = useRoomStore(); // Added for setSelectedRoom
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const supabase = supabaseBrowser();

  const handleAccept = async (notificationId: string, roomId: string | null) => {
    console.log("Joining room:", roomId);
    if (!roomId) {
      toast.error("Invalid room ID");
      return;
    }
    try {
      const response = await fetch(`/api/notifications/${notificationId}/accept`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to accept invitation");
      }
      markAsRead(notificationId);
      router.push(`/`);
      onClose();
      toast.success("Invitation accepted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept invitation");
      console.error("Error accepting invitation:", error);
    }
  };

  const handleReject = async (notificationId: string, roomId: string | null) => {
    if (!roomId) {
      toast.error("Invalid room ID");
      return;
    }
    try {
      const response = await fetch(`/api/notifications/${notificationId}/reject`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reject invitation");
      }
      markAsRead(notificationId);
      onClose();
      toast.success("Invitation rejected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject invitation");
      console.error("Error rejecting invitation:", error);
    }
  };

  const handleNotificationClick = async (notificationId: string, roomId: string | null) => {
    if (!user) {
      toast.error("You must be logged in to switch rooms");
      return;
    }
    if (!roomId) {
      toast.error("Notification is missing room ID");
      return;
    }
    try {
      // Fetch room details to ensure it exists
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      if (roomError || !room) {
        throw new Error("Room not found");
      }

      // Call the room switch API
      const response = await fetch("/api/rooms/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to switch room");
      }

      // Mark notification as read
      markAsRead(notificationId);

      // Update selected room in store
      setSelectedRoom(room);

      // Fetch available rooms (adapted from fetchAvailableRooms in ChatHeader.tsx)
      const { data: roomsData, error: roomsError } = await supabase
        .from("room_participants")
        .select("rooms(*)")
        .eq("user_id", user.id)
        .eq("status", "accepted");
      if (roomsError) {
        throw new Error("Failed to fetch rooms");
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
      // Note: We don't call setRooms here since it's in ChatHeader.tsx; assume UI refreshes on navigation

      // Navigate and close dialog
      router.push("/");
      onClose();
      toast.success(`Switched to ${room.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to switch room");
      console.error("Error switching room:", error);
    }
  };

  // Helper function to check room membership (adapted from ChatHeader.tsx)
  const checkRoomMembership = async (roomId: string) => {
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
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to mark as read");
      }
      markAsRead(notificationId);
      toast.success("Marked as read");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark as read");
      console.error("Error marking as read:", error);
    }
  };

  const handleMarkAsUnread = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/unread`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to mark as unread");
      }
      setNotifications(
        notifications.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: false } : notif
        )
      );
      toast.success("Marked as unread");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark as unread");
      console.error("Error marking as unread:", error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete notification");
      }
      setNotifications(notifications.filter((notif) => notif.id !== notificationId));
      toast.success("Notification deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete notification");
      console.error("Error deleting notification:", error);
    }
  };

  const handleClearAllNotifications = async () => {
    if (!user?.id) {
      toast.error("User not logged in");
      return;
    }
    try {
      const response = await fetch(`/api/notifications`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to clear notifications");
      }
      setNotifications([]);
      toast.success("All notifications cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear notifications");
      console.error("Error clearing notifications:", error);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const fetchAndSubscribe = async () => {
      setIsLoading(true);
      try {
        await fetchNotifications(user.id);
        subscribeToNotifications(user.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load notifications");
        console.error("Error in fetchAndSubscribe:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndSubscribe();
  }, [user?.id, fetchNotifications, subscribeToNotifications]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-labelledby="notifications-title">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle id="notifications-title" className="text-2xl font-bold">Notifications</DialogTitle>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllNotifications}
              className="text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              Clear All
            </Button>
          )}
        </DialogHeader>
        <div className="space-y-4 max-h-[300px] overflow-y-auto overflow-x-hidden custom-scrollbar">
          {isLoading ? (
            <p className="text-gray-400 text-sm">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-gray-400 text-sm">No notifications</p>
          ) : (
            notifications.slice(0, 5).map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-lg flex flex-col items-start justify-center gap-3 ${notif.is_read ? "bg-gray-800/50" : "bg-gray-700/50"} hover:bg-gray-700/70 cursor-pointer transition-colors`}
                onClick={() => handleNotificationClick(notif.id, notif.room_id)}
              >
                <div className="flex gap-3 w-full">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={notif.users?.avatar_url ?? ""} alt={notif.users?.display_name || "User"} className="rounded-full" />
                    <AvatarFallback className="bg-indigo-500 text-white rounded-full">
                      {notif.users?.display_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate text-wrap">{notif.content}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {notif.created_at ? new Date(notif.created_at).toLocaleString() : "Unknown time"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 flex-shrink-0">
                  {notif.type === "join_request" && !notif.is_read && (
                    <>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(notif.id, notif.room_id);
                        }}
                        aria-label={`Accept invitation for notification ${notif.id}`}
                        className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-3 py-1 rounded-lg transition-colors"
                      >
                        Accept
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(notif.id, notif.room_id);
                        }}
                        aria-label={`Reject invitation for notification ${notif.id}`}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded-lg transition-colors"
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {notif.is_read ? (
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsUnread(notif.id);
                      }}
                      aria-label={`Mark notification ${notif.id} as unread`}
                      className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-sm px-3 py-1 rounded-lg transition-colors"
                    >
                      Mark as Unread
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif.id);
                      }}
                      aria-label={`Mark notification ${notif.id} as read`}
                      className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-sm px-3 py-1 rounded-lg transition-colors"
                    >
                      Mark as Read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNotification(notif.id);
                    }}
                    aria-label={`Delete notification ${notif.id}`}
                    className="text-gray-300 hover:text-white hover:bg-red-600/50 rounded-full transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}