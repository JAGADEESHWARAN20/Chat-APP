"use client";

import { useEffect, useState } from "react";
import { useNotification } from "@/lib/store/notifications";
import { useUser } from "@/lib/store/user";
import { useRoomStore } from "@/lib/store/roomstore";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { useRouter } from "next/navigation";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Check, X, ArrowLeft } from "lucide-react";
import { Database } from "@/lib/types/supabase";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Swipeable } from "./ui/swipeable";

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

type Room = Database["public"]["Tables"]["rooms"]["Row"];

export default function Notifications({ isOpen, onClose }: NotificationsProps) {
  const user = useUser((state) => state.user) as SupabaseUser | undefined;
  const { notifications, markAsRead, fetchNotifications, subscribeToNotifications, setNotifications } = useNotification();
  const { setSelectedRoom } = useRoomStore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const supabase = supabaseBrowser();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleAccept = async (notificationId: string, roomId: string | null, type: string) => {
    if (!roomId) {
      toast.error("Invalid room ID");
      return;
    }
    if (!user) {
      toast.error("You must be logged in to accept requests");
      return;
    }

    try {
      const response = await fetch(`/api/notifications/${notificationId}/accept`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to accept request");
      }
      markAsRead(notificationId);
      await fetchNotifications(user.id);
      toast.success(`${type === "join_request" ? "Join" : "Switch"} request approved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept request");
      console.error("Error accepting request:", error);
    }
  };

  const handleReject = async (notificationId: string, roomId: string | null, type: string) => {
    if (!roomId) {
      toast.error("Invalid room ID");
      return;
    }
    if (!user) {
      toast.error("You must be logged in to reject requests");
      return;
    }

    try {
      const response = await fetch(`/api/notifications/${notificationId}/reject`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reject request");
      }
      markAsRead(notificationId);
      await fetchNotifications(user.id);
      toast.success(`${type === "join_request" ? "Join" : "Switch"} request rejected`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject request");
      console.error("Error rejecting request:", error);
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
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      if (roomError || !room) {
        throw new Error("Room not found");
      }

      const response = await fetch("/api/rooms/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to switch room");
      }

      if (data.status === "pending") {
        toast.info(data.message || "Switch request sent to room owner for approval");
        markAsRead(notificationId);
        await fetchNotifications(user.id);
        return;
      }

      markAsRead(notificationId);
      setSelectedRoom(room);

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

      router.push("/");
      onClose();
      toast.success(`Switched to ${room.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to switch room");
      console.error("Error switching room:", error);
    }
  };

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

  const renderNotificationContent = (notif: any) => (
    <div
      className={`p-4 rounded-lg flex items-start gap-3 w-full transition-colors ${notif.status === "read" ? "bg-gray-800/50" : "bg-indigo-900/20"}`}
      onClick={() => handleNotificationClick(notif.id, notif.room_id)}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={notif.users?.avatar_url ?? ""} alt={notif.users?.display_name || "User"} />
        <AvatarFallback className="bg-indigo-500 text-white">
          {notif.users?.display_name?.[0] || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate text-wrap">{notif.message}</p>
        <p className="text-xs text-gray-400 mt-1">
          {notif.created_at ? new Date(notif.created_at).toLocaleString() : "Unknown time"}
        </p>
        {(notif.type === "join_request" || notif.type === "room_switch") && notif.join_status === "pending" && (
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAccept(notif.id, notif.room_id, notif.type);
              }}
              className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
            >
              <Check className="h-4 w-4 mr-1" /> Accept
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleReject(notif.id, notif.room_id, notif.type);
              }}
              className="bg-red-600 hover:bg-red-700 text-white h-8 px-3"
            >
              <X className="h-4 w-4 mr-1" /> Decline
            </Button>
          </div>
        )}
      </div>
      {!isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteNotification(notif.id);
          }}
          className="text-gray-300 hover:text-white hover:bg-red-600/50"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full p-4 sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between mb-4">
          <SheetTitle className="text-2xl font-bold">Notifications</SheetTitle>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllNotifications}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-300 hover:text-white hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>
        <div className="space-y-2 max-h-[calc(100vh-100px)] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-20">
              <p className="text-gray-400">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex justify-center items-center h-20">
              <p className="text-gray-400">No notifications</p>
            </div>
          ) : (
            notifications.map((notif) =>
              isMobile ? (
                <Swipeable
                  key={notif.id}
                  onSwipeLeft={() => handleDeleteNotification(notif.id)}
                  swipeThreshold={50}
                >
                  {renderNotificationContent(notif)}
                </Swipeable>
              ) : (
                <div key={notif.id}>
                  {renderNotificationContent(notif)}
                </div>
              )
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}