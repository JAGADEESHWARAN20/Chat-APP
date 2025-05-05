"use client";

import { useEffect, useState } from "react";
import { useNotification } from "@/lib/store/notifications";
import { useUser } from "@/lib/store/user";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { useRouter } from "next/navigation";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Trash2 } from "lucide-react";

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Notifications({ isOpen, onClose }: NotificationsProps) {
  const user = useUser((state) => state.user) as SupabaseUser | undefined;
  const { notifications, markAsRead, fetchNotifications, subscribeToNotifications, setNotifications } = useNotification();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const supabase = supabaseBrowser();

  const handleAccept = async (notificationId: string, roomId: string | null) => {
    if (!roomId) {
      toast.error("Invalid room ID");
      return;
    }
    try {
      const response = await fetch(`/api/notifications/${notificationId}/accept`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to accept invitation");
      }
      markAsRead(notificationId);
      router.push(`/rooms/${roomId}`);
      onClose();
      toast.success("Invitation accepted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept invitation");
      console.error("Error accepting invitation:", error);
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
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ status: "read" })
        .eq("id", notificationId);
      if (updateError) throw updateError;

      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      if (roomError || !room) throw new Error("Room not found");

      const response = await fetch("/api/rooms/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to switch room");
      }

      markAsRead(notificationId);
      router.push(`/rooms/${roomId}`);
      onClose();
      toast.success(`Switched to ${room.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to switch room");
      console.error("Error switching room:", error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ status: "read" })
        .eq("id", notificationId);
      if (error) {
        throw new Error(error.message || "Failed to mark as read");
      }
      markAsRead(notificationId);
      toast.success("Marked as read");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark as read");
      console.error("Error marking as read:", error);
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
      <DialogContent className="bg-gray-800 text-white" aria-labelledby="notifications-title">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle id="notifications-title">Notifications</DialogTitle>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllNotifications}
              className="text-white hover:bg-gray-700"
            >
              Clear All
            </Button>
          )}
        </DialogHeader>
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-gray-400">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-gray-400">No notifications</p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-2 rounded flex items-center gap-3 ${notif.is_read ? "bg-gray-800" : "bg-gray-700"} cursor-pointer`}
                onClick={() => handleNotificationClick(notif.id, notif.room_id)}
              >
                <Avatar>
                  <AvatarImage src={notif.users?.avatar_url ?? ""} alt={notif.users?.display_name || "User"} />
                  <AvatarFallback>{notif.users?.display_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p>{notif.content}</p>
                  <p className="text-sm text-gray-400">
                    {notif.created_at ? new Date(notif.created_at).toLocaleString() : "Unknown time"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {notif.type === "room_invite" && !notif.is_read && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAccept(notif.id, notif.room_id);
                      }}
                      aria-label={`Accept invitation for notification ${notif.id}`}
                    >
                      Accept
                    </Button>
                  )}
                  {!notif.is_read && (
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif.id);
                      }}
                      aria-label={`Mark notification ${notif.id} as read`}
                      className="text-white border-gray-600"
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
                    className="text-white hover:bg-gray-700"
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