"use client";

import { useEffect, useState, useCallback } from "react";
import { useNotification } from "@/lib/store/notifications";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/roomstore";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { useRouter } from "next/navigation";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Trash2 } from "lucide-react";
import { Database } from "@/lib/types/supabase";
import { checkRoomMembership } from "@/lib/utils/supabase";
import { mapErrorCodeToMessage } from "@/lib/utils/errors";

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

type Room = Database["public"]["Tables"]["rooms"]["Row"];

export default function Notifications({ isOpen, onClose }: NotificationsProps) {
  const user = useUser((state) => state.user) as SupabaseUser | undefined;
  const { notifications, markAsRead, fetchNotifications, subscribeToNotifications, setNotifications } =
    useNotification();
  const { setSelectedRoom } = useRoomStore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({}); // Per-notification loading states
  const supabase = supabaseBrowser();

  // Centralized navigation handler
  const navigateAndClose = useCallback(() => {
    router.push("/");
    onClose();
  }, [router, onClose]);

  // Handle accept invitation
  const handleAccept = useCallback(
    async (notificationId: string, roomId: string | null) => {
      if (!user) {
        toast.error(mapErrorCodeToMessage("AUTH_REQUIRED", "Please log in to accept invitations"));
        return;
      }
      if (!roomId) {
        toast.error(mapErrorCodeToMessage("INVALID_ROOM_ID", "Invalid room ID"));
        return;
      }
      setActionLoading((prev) => ({ ...prev, [notificationId]: true }));
      try {
        const response = await fetch(`/api/notifications/${notificationId}/accept`, {
          method: "PATCH",
        });
        if (!response.ok) {
          const errorData = await response.json();
          const errorCode = errorData.code || "ACTION_FAILED";
          throw new Error(mapErrorCodeToMessage(errorCode, errorData.error || "Failed to accept invitation"));
        }
        markAsRead(notificationId);
        navigateAndClose();
        toast.success("Invitation accepted");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to accept invitation");
        console.error("[Notifications] Error accepting invitation:", error);
      } finally {
        setActionLoading((prev) => ({ ...prev, [notificationId]: false }));
      }
    },
    [user, markAsRead, navigateAndClose]
  );

  // Handle reject invitation
  const handleReject = useCallback(
    async (notificationId: string, roomId: string | null) => {
      if (!roomId) {
        toast.error(mapErrorCodeToMessage("INVALID_ROOM_ID", "Invalid room ID"));
        return;
      }
      setActionLoading((prev) => ({ ...prev, [notificationId]: true }));
      try {
        const response = await fetch(`/api/notifications/${notificationId}/reject`, {
          method: "PATCH",
        });
        if (!response.ok) {
          const errorData = await response.json();
          const errorCode = errorData.code || "ACTION_FAILED";
          throw new Error(mapErrorCodeToMessage(errorCode, errorData.error || "Failed to reject invitation"));
        }
        markAsRead(notificationId);
        navigateAndClose();
        toast.success("Invitation rejected");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to reject invitation");
        console.error("[Notifications] Error rejecting invitation:", error);
      } finally {
        setActionLoading((prev) => ({ ...prev, [notificationId]: false }));
      }
    },
    [markAsRead, navigateAndClose]
  );

  // Handle notification click (switch room)
  const handleNotificationClick = useCallback(
    async (notificationId: string, roomId: string | null) => {
      if (!user) {
        toast.error(mapErrorCodeToMessage("AUTH_REQUIRED", "You must be logged in to switch rooms"));
        return;
      }
      if (!roomId) {
        toast.error(mapErrorCodeToMessage("INVALID_ROOM_ID", "Notification is missing room ID"));
        return;
      }
      setActionLoading((prev) => ({ ...prev, [notificationId]: true }));
      try {
        // Fetch room details
        const { data: room, error: roomError } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", roomId)
          .single();
        if (roomError || !room) {
          throw new Error(mapErrorCodeToMessage("ROOM_NOT_FOUND", "Room not found"));
        }

        // Switch room via API
        const response = await fetch("/api/rooms/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          const errorCode = errorData.code || "ACTION_FAILED";
          throw new Error(mapErrorCodeToMessage(errorCode, errorData.error || "Failed to switch room"));
        }

        // Mark notification as read
        markAsRead(notificationId);

        // Update selected room
        setSelectedRoom(room);

        // Fetch available rooms (simplified from ChatHeader.tsx)
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
            isMember: await checkRoomMembership(supabase, user.id, room.id),
          }))
        );
        // Note: Not calling setRooms here; assume UI refreshes on navigation

        navigateAndClose();
        toast.success(`Switched to ${room.name}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to switch room");
        console.error("[Notifications] Error switching room:", error);
      } finally {
        setActionLoading((prev) => ({ ...prev, [notificationId]: false }));
      }
    },
    [user, markAsRead, setSelectedRoom, supabase, navigateAndClose]
  );

  // Handle mark as read
  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      setActionLoading((prev) => ({ ...prev, [notificationId]: true }));
      try {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
          method: "POST",
        });
        if (!response.ok) {
          const errorData = await response.json();
          const errorCode = errorData.code || "ACTION_FAILED";
          throw new Error(mapErrorCodeToMessage(errorCode, errorData.error || "Failed to mark as read"));
        }
        markAsRead(notificationId);
        toast.success("Marked as read");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to mark as read");
        console.error("[Notifications] Error marking as read:", error);
      } finally {
        setActionLoading((prev) => ({ ...prev, [notificationId]: false }));
      }
    },
    [markAsRead]
  );

  // Handle mark as unread
  const handleMarkAsUnread = useCallback(
    async (notificationId: string) => {
      setActionLoading((prev) => ({ ...prev, [notificationId]: true }));
      try {
        const response = await fetch(`/api/notifications/${notificationId}/unread`, {
          method: "POST",
        });
        if (!response.ok) {
          const errorData = await response.json();
          const errorCode = errorData.code || "ACTION_FAILED";
          throw new Error(mapErrorCodeToMessage(errorCode, errorData.error || "Failed to mark as unread"));
        }
        setNotifications(
          notifications.map((notif) =>
            notif.id === notificationId ? { ...notif, status: "unread" } : notif
          )
        );
        toast.success("Marked as unread");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to mark as unread");
        console.error("[Notifications] Error marking as unread:", error);
      } finally {
        setActionLoading((prev) => ({ ...prev, [notificationId]: false }));
      }
    },
    [setNotifications, notifications]
  );

  // Handle delete notification
  const handleDeleteNotification = useCallback(
    async (notificationId: string) => {
      setActionLoading((prev) => ({ ...prev, [notificationId]: true }));
      try {
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const errorData = await response.json();
          const errorCode = errorData.code || "ACTION_FAILED";
          throw new Error(mapErrorCodeToMessage(errorCode, errorData.error || "Failed to delete notification"));
        }
        setNotifications(notifications.filter((notif) => notif.id !== notificationId));
        toast.success("Notification deleted");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete notification");
        console.error("[Notifications] Error deleting notification:", error);
      } finally {
        setActionLoading((prev) => ({ ...prev, [notificationId]: false }));
      }
    },
    [setNotifications, notifications]
  );

  // Handle clear all notifications
  const handleClearAllNotifications = useCallback(async () => {
    if (!user?.id) {
      toast.error(mapErrorCodeToMessage("AUTH_REQUIRED", "User not logged in"));
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`/api/notifications`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        const errorCode = errorData.code || "ACTION_FAILED";
        throw new Error(mapErrorCodeToMessage(errorCode, errorData.error || "Failed to clear notifications"));
      }
      setNotifications([]);
      toast.success("All notifications cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear notifications");
      console.error("[Notifications] Error clearing notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, setNotifications]);

  // Fetch and subscribe to notifications on mount
  useEffect(() => {
    if (!user?.id) return;

    const fetchAndSubscribe = async () => {
      setIsLoading(true);
      try {
        await fetchNotifications(user.id);
        subscribeToNotifications(user.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load notifications");
        console.error("[Notifications] Error in fetchAndSubscribe:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => {
      // Cleanup subscription
      useNotification.getState().unsubscribeFromNotifications();
    };
  }, [user?.id, fetchNotifications, subscribeToNotifications]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-labelledby="notifications-title">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle id="notifications-title" className="text-2xl font-bold">
            Notifications
          </DialogTitle>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllNotifications}
              disabled={isLoading}
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
                className={`p-3 rounded-lg flex flex-col items-start justify-center gap-3 ${notif.status === "read" ? "bg-gray-800/50" : "bg-gray-700/50"
                  } hover:bg-gray-700/70 cursor-pointer transition-colors`}
                onClick={() => handleNotificationClick(notif.id, notif.room_id)}
              >
                <div className="flex gap-3 w-full">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage
                      src={notif.users?.avatar_url ?? ""}
                      alt={notif.users?.display_name || "User"}
                      className="rounded-full"
                    />
                    <AvatarFallback className="bg-indigo-500 text-white rounded-full">
                      {notif.users?.display_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate text-wrap">{notif.message}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {notif.created_at ? new Date(notif.created_at).toLocaleString() : "Unknown time"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 flex-shrink-0">
                  {notif.type === "join_request" && notif.status !== "read" && (
                    <>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(notif.id, notif.room_id);
                        }}
                        disabled={actionLoading[notif.id]}
                        aria-label={`Accept invitation for notification ${notif.id}`}
                        className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-3 py-1 rounded-lg transition-colors"
                      >
                        {actionLoading[notif.id] ? "Accepting..." : "Accept"}
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(notif.id, notif.room_id);
                        }}
                        disabled={actionLoading[notif.id]}
                        aria-label={`Reject invitation for notification ${notif.id}`}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded-lg transition-colors"
                      >
                        {actionLoading[notif.id] ? "Rejecting..." : "Reject"}
                      </Button>
                    </>
                  )}
                  {notif.status === "read" ? (
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsUnread(notif.id);
                      }}
                      disabled={actionLoading[notif.id]}
                      aria-label={`Mark notification ${notif.id} as unread`}
                      className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-sm px-3 py-1 rounded-lg transition-colors"
                    >
                      {actionLoading[notif.id] ? "Processing..." : "Mark as Unread"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif.id);
                      }}
                      disabled={actionLoading[notif.id]}
                      aria-label={`Mark notification ${notif.id} as read`}
                      className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-sm px-3 py-1 rounded-lg transition-colors"
                    >
                      {actionLoading[notif.id] ? "Processing..." : "Mark as Read"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNotification(notif.id);
                    }}
                    disabled={actionLoading[notif.id]}
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