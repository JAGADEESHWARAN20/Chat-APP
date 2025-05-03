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

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Notifications({ isOpen, onClose }: NotificationsProps) {
  const user = useUser((state) => state.user) as SupabaseUser | undefined;
  const { notifications, markAsRead, fetchNotifications, subscribeToNotifications } = useNotification();
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

  useEffect(() => {
    if (!user?.id) return;

    let unsubscribe: (() => void) | undefined;
    const fetchAndSubscribe = async () => {
      setIsLoading(true);
      try {
        await fetchNotifications(user.id);
        unsubscribe = subscribeToNotifications(user.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load notifications");
        console.error("Error in fetchAndSubscribe:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [user?.id, fetchNotifications, subscribeToNotifications]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 text-white" aria-labelledby="notifications-title">
        <DialogHeader>
          <DialogTitle id="notifications-title">Notifications</DialogTitle>
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
                className={`p-2 rounded flex items-center gap-3 ${
                  notif.is_read ? "bg-gray-800" : "bg-gray-700"
                }`}
              >
                <Avatar>
                  <AvatarImage src={notif.users?.avatar_url || ""} alt={notif.users?.display_name || "User"} />
                  <AvatarFallback>{notif.users?.display_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p>{notif.content}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(notif.created_at).toLocaleString()}
                  </p>
                </div>
                {notif.type === "room_invite" && !notif.is_read && (
                  <Button
                    onClick={() => handleAccept(notif.id, notif.room_id)}
                    aria-label={`Accept invitation for notification ${notif.id}`}
                  >
                    Accept
                  </Button>
                )}
                {!notif.is_read && (
                  <Button
                    variant="outline"
                    onClick={() => handleMarkAsRead(notif.id)}
                    aria-label={`Mark notification ${notif.id} as read`}
                    className="text-white border-gray-600"
                  >
                    Mark as Read
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
