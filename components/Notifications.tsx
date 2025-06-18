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

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomWithMembership = Room & {
  isMember: boolean;
  participationStatus: string | null;
};

const transformRoom = (room: Room): RoomWithMembership => ({
  ...room,
  isMember: true, // Since this is called after accepting invite
  participationStatus: "accepted"
});

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
          await fetchNotifications(user.id);
          subscribeToNotifications(user.id);
        } catch (error) {
          console.error("Error initializing notifications:", error);
          toast.error("Failed to load notifications");
        }
      };

      initNotifications();

      // Cleanup subscription when component unmounts
      return () => {
        unsubscribeFromNotifications();
      };
    }
  }, [user?.id, fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications]);

  const handleAccept = async (notificationId: string, roomId: string | null, type: string) => {
    if (!user || !roomId) {
      toast.error("Unable to process request");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/notifications/${notificationId}/accept`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process notification");
      }

      await markAsRead(notificationId);

      if (type === "room_invite") {
        const { data: room } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", roomId)
          .single();

        if (room) {
          const roomWithMembership = transformRoom(room);
          setSelectedRoom(roomWithMembership);
          router.push(`/rooms/${room.id}`);
          onClose();
        }
      }

      toast.success("Request accepted successfully");
    } catch (error) {
      console.error("Error accepting notification:", error);
      toast.error("Failed to accept request");
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

  const getNotificationContent = useCallback((notification: any) => {
    const senderName = notification.users?.display_name || notification.users?.username || "Someone";
    
    switch (notification.type) {
      case "room_invite":
        return `${senderName} invited you to join ${notification.rooms?.name || "a room"}`;
      case "message":
        return `New message from ${senderName} in ${notification.rooms?.name || "a room"}`;
      default:
        return notification.message || "New notification";
    }
  }, []);

  const shouldShowActions = useCallback((notification: any) => {
    return notification.type === "room_invite" && notification.status !== "read";
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
                    className={`p-4 flex items-start space-x-4 hover:bg-muted/50 relative ${
                      notification.status === "read" ? "opacity-50" : ""
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