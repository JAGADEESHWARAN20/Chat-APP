"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Inotification } from "@/lib/store/notifications";

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomWithMembership = Room & {
  isMember: boolean;
  participationStatus: string | null;
};

const transformRoom = async (room: Room, userId: string, supabase: ReturnType<typeof supabaseBrowser>): Promise<RoomWithMembership> => {
  // Check actual membership status
  const { data: membership } = await supabase
    .from("room_participants")
    .select("status")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .single();

  return {
    ...room,
    isMember: !!membership,
    participationStatus: membership?.status || null
  };
};

export default function Notifications({ isOpen, onClose }: NotificationsProps) {
  const user = useUser((state) => state.user) as SupabaseUser | undefined;
  const {
    notifications,
    markAsRead,
    fetchNotifications,
    subscribeToNotifications,
    unsubscribeFromNotifications
  } = useNotification();
  const { setSelectedRoom } = useRoomStore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const supabase = supabaseBrowser();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Initialize notifications and subscribe to updates
  useEffect(() => {
    if (user?.id) {
      const initNotifications = async () => {
        try {
          console.log("[Notifications] Initializing notifications for user:", user.id);
          await fetchNotifications(user.id);
          console.log("[Notifications] Successfully fetched notifications");
          
          console.log("[Notifications] Setting up real-time subscription");
          subscribeToNotifications(user.id);
          console.log("[Notifications] Real-time subscription established");
        } catch (error) {
          console.error("[Notifications] Error initializing notifications:", error);
          toast.error("Failed to load notifications");
        }
      };

      initNotifications();

      // Cleanup subscription when component unmounts
      return () => {
        console.log("[Notifications] Cleaning up notification subscription");
        unsubscribeFromNotifications();
      };
    } else {
      console.log("[Notifications] No user found, skipping initialization");
    }
  }, [user?.id, fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications]);

  const handleAccept = async (notificationId: string, roomId: string | null, type: string) => {
    if (!user || !roomId) {
      toast.error("Unable to process request: Missing user or room information");
      return;
    }

    setIsLoading(true);
    try {
      console.log("[Notifications] Processing accept request:", { notificationId, roomId, type });
      
      const response = await fetch(`/api/notifications/${notificationId}/accept`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("[Notifications] Accept request failed:", error);
        throw new Error(error.message || "Failed to process notification");
      }

      console.log("[Notifications] Successfully processed accept request");
      await markAsRead(notificationId);

      if (type === "room_invite" || type === "join_request") {
        console.log("[Notifications] Fetching updated room information");
        const { data: room, error: roomError } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", roomId)
          .single();

        if (roomError) {
          console.error("[Notifications] Error fetching room:", roomError);
          throw new Error("Failed to fetch room information");
        }

        if (room) {
          const roomWithMembership = await transformRoom(room, user.id, supabase);
          console.log("[Notifications] Switching to room:", roomWithMembership);
          setSelectedRoom(roomWithMembership);
          onClose();
          router.refresh();
        }
      }

      toast.success("Request accepted successfully");
    } catch (error) {
      console.error("[Notifications] Error in accept flow:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (notificationId: string) => {
    if (!user) {
      toast.error("Unable to process request");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/notifications/${notificationId}/reject`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reject notification");
      }

      await markAsRead(notificationId);
      toast.success("Request rejected");
    } catch (error) {
      console.error("Error rejecting notification:", error);
      toast.error("Failed to reject request");
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationContent = useCallback((notification: Inotification) => {
    const senderName = notification.users?.display_name || notification.users?.username || "Someone";
    const roomName = notification.rooms?.name || "a room";

    switch (notification.type) {
      case "room_invite":
        return `${senderName} invited you to join ${roomName}`;
      case "join_request":
        return `${senderName} requested to join ${roomName}`;
      case "message":
        return `New message from ${senderName} in ${roomName}`;
      default:
        return notification.message || "New notification";
    }
  }, []);

  const shouldShowActions = useCallback((notification: Inotification) => {
    return (notification.type === "room_invite" || notification.type === "join_request") &&
      notification.status !== "read";
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="p-0 flex flex-col h-full w-full sm:max-w-sm">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <SheetTitle>Notifications</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <Swipeable
                  key={notification.id}
                  onSwipeLeft={() => shouldShowActions(notification) && handleReject(notification.id)}
                  onSwipeRight={() =>
                    shouldShowActions(notification) &&
                    handleAccept(
                      notification.id,
                      notification.room_id || null,
                      notification.type
                    )
                  }
                >
                  <div
                    className={`p-4 flex items-start space-x-4 hover:bg-muted/50 relative ${notification.status === "read" ? "opacity-50" : ""
                      }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={notification.users?.avatar_url || ""}
                        alt={notification.users?.username || "User"}
                      />
                      <AvatarFallback>
                        {(notification.users?.username || "U")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm leading-none">
                        {getNotificationContent(notification)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(notification.created_at || "").toLocaleString()}
                      </p>
                    </div>
                    {shouldShowActions(notification) && (
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReject(notification.id)}
                          disabled={isLoading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleAccept(
                              notification.id,
                              notification.room_id || null,
                              notification.type
                            )
                          }
                          disabled={isLoading}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Swipeable>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}