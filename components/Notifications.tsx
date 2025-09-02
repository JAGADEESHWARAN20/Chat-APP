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
import {
  Check,
  X,
  Trash2,
  MoreVertical,
  ArrowRight,
  UserPlus,
  Mail,
  UserCheck,
  UserX,
  LogOut,
} from "lucide-react";
import { Database } from "@/lib/types/supabase";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Swipeable } from "./ui/swipeable";
import { Inotification } from "@/lib/store/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomWithMembership = Room & {
  isMember: boolean;
  participationStatus: string | null;
};

const transformRoom = async (
  room: Room,
  userId: string,
  supabase: ReturnType<typeof supabaseBrowser>
): Promise<RoomWithMembership> => {
  const { data: membership } = await supabase
    .from("room_members")
    .select("status")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .single();

  const { data: participation } = await supabase
    .from("room_participants")
    .select("status")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .single();

  let participationStatus: string | null = null;
  if (membership) participationStatus = membership.status;
  else if (participation) participationStatus = participation.status;

  return {
    ...room,
    isMember: membership?.status === "accepted",
    participationStatus,
  };
};

export default function Notifications({ isOpen, onClose }: NotificationsProps) {
  const user = useUser((state) => state.user) as SupabaseUser | undefined;
  const {
    notifications,
    markAsRead,
    fetchNotifications,
    subscribeToNotifications,
    unsubscribeFromNotifications,
    removeNotification,
  } = useNotification();
  const { setSelectedRoom } = useRoomStore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const supabase = supabaseBrowser();
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    if (!user?.id) return;

    const init = async () => {
      try {
        await fetchNotifications(user.id);
        subscribeToNotifications(user.id);
      } catch (err) {
        toast.error("Failed to load notifications.");
      }
    };

    init();
    return () => unsubscribeFromNotifications();
  }, [user?.id, fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications]);

  const handleAccept = async (id: string, roomId: string | null, type: string) => {
    if (!user || !roomId) return toast.error("Missing data for action.");

    setIsLoading(true);
    try {
      const res = await fetch(`/api/notifications/${id}/accept`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to accept notification");

      await markAsRead(id);
      await removeNotification(id);

      if (["room_invite", "join_request"].includes(type)) {
        const { data: room, error } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", roomId)
          .single();

        if (error || !room) throw new Error("Room fetch failed");

        const enrichedRoom = await transformRoom(room, user.id, supabase);
        setSelectedRoom(enrichedRoom);
        onClose();
        router.refresh();
      }

      toast.success("Request accepted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error accepting.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (id: string, senderId: string, roomId: string) => {
    if (!user || !senderId || !roomId) return toast.error("Missing data for reject.");

    setIsLoading(true);
    try {
      const res = await fetch(`/api/notifications/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: id, sender_id: senderId, room_id: roomId }),
      });

      if (!res.ok) throw new Error("Reject failed");
      await markAsRead(id);
      await removeNotification(id);
      toast.success("Request rejected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNotification = useCallback(
    async (id: string) => {
      if (!user) return toast.error("Login required.");

      setIsLoading(true);
      try {
        const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");

        await removeNotification(id);
        toast.success("Notification deleted.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error deleting.");
      } finally {
        setIsLoading(false);
      }
    },
    [user, removeNotification]
  );

  // ✅ Now returns both icon + message
  const getNotificationDisplay = useCallback((n: Inotification) => {
    const sender = n.users?.display_name || n.users?.username || "Someone";
    const room = n.rooms?.name || "a room";

    switch (n.type) {
      case "room_invite":
        return { icon: <UserPlus className="h-4 w-4 text-blue-500" />, text: `${sender} invited you to join ${room}` };
      case "join_request":
        return { icon: <Mail className="h-4 w-4 text-purple-500" />, text: `${sender} requested to join ${room}` };
      case "message":
        return { icon: <Mail className="h-4 w-4 text-green-500" />, text: `New message from ${sender} in ${room}` };
      case "join_request_accepted":
        return { icon: <UserCheck className="h-4 w-4 text-green-600" />, text: n.message || `Your request to join ${room} was accepted.` };
      case "join_request_rejected":
        return { icon: <UserX className="h-4 w-4 text-red-600" />, text: n.message || `Your request to join ${room} was rejected.` };
      case "room_left":
        return { icon: <LogOut className="h-4 w-4 text-gray-500" />, text: n.message || `${sender} left ${room}.` };
      default:
        return { icon: <Mail className="h-4 w-4 text-gray-400" />, text: n.message || "New notification" };
    }
  }, []);

  const shouldShowActions = useCallback((n: Inotification) => {
    return (n.type === "room_invite" || n.type === "join_request") && n.status !== "read";
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side={isMobile ? "right" : "right"}
        className="p-0 flex flex-col h-full w-full sm:max-w-sm"
      >
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <SheetTitle>Notifications</SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const { icon, text } = getNotificationDisplay(n);

                return (
                  <Swipeable
                    key={n.id}
                    onSwipeLeft={() => handleAccept(n.id, n.room_id || null, n.type)}
                    onSwipeRight={() => handleReject(n.id, n.sender_id!, n.room_id!)}
                  >
                    <div
                      className={`p-4 flex items-start space-x-4 hover:bg-muted/50 relative ${
                        n.status === "read" ? "opacity-50" : ""
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={n.users?.avatar_url || ""} alt={n.users?.username || "User"} />
                        <AvatarFallback>
                          {(n.users?.username || "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          {icon}
                          <span>{text}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(n.created_at || "").toLocaleString()}
                        </p>
                      </div>

                      {shouldShowActions(n) ? (
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReject(n.id, n.sender_id!, n.room_id!)}
                            disabled={isLoading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAccept(n.id, n.room_id || null, n.type)}
                            disabled={isLoading}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDeleteNotification(n.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </Swipeable>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
