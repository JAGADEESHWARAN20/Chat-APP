// components/Notifications.tsx - FIXED
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
  Bell, // ADDED MISSING IMPORT
} from "lucide-react";
import { Database } from "@/lib/types/supabase";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Swipeable } from "./ui/swipeable";
import { Inotification } from "@/lib/store/notifications"; // Import from store instead
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useRoomContext } from "@/lib/store/RoomContext";

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
  const { data: membership, error: membershipError } = await supabase
    .from("room_members")
    .select("status")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .single();

  if (membershipError) console.error("Membership fetch error:", membershipError);

  const { data: participation, error: participationError } = await supabase
    .from("room_participants")
    .select("status")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .single();

  if (participationError) console.error("Participation fetch error:", participationError);

  let participationStatus: string | null = null;
  if (membership) participationStatus = membership.status;
  else if (participation) participationStatus = participation.status;

  return {
    ...room,
    isMember: membership?.status === "accepted" || participation?.status === "accepted",
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
    setNotifications,
    isLoading, // ADDED MISSING IMPORT
  } = useNotification();
  const { setSelectedRoom } = useRoomStore();
  const { fetchAvailableRooms } = useRoomContext();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log("🔔 Notifications component - user:", user?.id);
  
    if (!user?.id) {
      console.log("❌ No user ID, clearing notifications");
      setNotifications([]); // Clear notifications when no user
      return;
    }
  
    // Initialize notifications
    const initNotifications = async () => {
      try {
        console.log("🔄 Initializing notifications...");
        await fetchNotifications(user.id);
        subscribeToNotifications(user.id);
      } catch (error) {
        console.error("💥 Failed to initialize notifications:", error);
      }
    };
  
    initNotifications();
  
    return () => {
      console.log("🧹 Cleaning up notifications");
      unsubscribeFromNotifications();
    };
  }, [user?.id, fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications, setNotifications]);


  const handleAccept = async (id: string, roomId: string | null, type: string) => {
    if (!user || !roomId) {
      return toast.error("Missing data for action.");
    }
    if (loadingIds.has(id)) return;
  
    setLoadingIds((prev) => new Set([...prev, id]));
  
    try {
      removeNotification(id); // Optimistic
  
      const res = await fetch(`/api/notifications/${id}/accept`, { method: "POST" });
      const data = await res.json();
  
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept notification");
      }
  
      await markAsRead(id);
      await fetchAvailableRooms();  // Refresh rooms to update membership and counts (RoomContext integration)
  
      // Refetch notifications to ensure acceptance notification (if sent to self) is visible
      await fetchNotifications(user.id);
  
      if (["room_invite", "join_request"].includes(type)) {
        let retries = 3;
        let room: Room | null = null;
        while (retries > 0) {
          const { data: fetchedRoom, error } = await supabase
            .from("rooms")
            .select("*")
            .eq("id", roomId)
            .single();
  
          if (error) {
            console.error("Room fetch error:", error);
            if (retries === 1) throw error;
            await new Promise((resolve) => setTimeout(resolve, 1000));
            retries--;
            continue;
          }
  
          room = fetchedRoom;
          break;
        }
  
        if (room) {
          const enrichedRoom = await transformRoom(room, user.id, supabase);
          setSelectedRoom(enrichedRoom);
          toast.success(`Joined ${room.name} successfully!`);
          router.push(`/chat/${roomId}`);
          router.refresh();
        } else {
          toast.warning("Room joined but couldn't load details.");
        }
      } else {
        toast.success("Notification accepted.");
      }
    } catch (err: any) {
      // Rollback optimistic update
      await fetchNotifications(user.id);
      toast.error(err.message || "Error accepting notification.");
    } finally {
      setLoadingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleReject = async (id: string, senderId: string | null, roomId: string | null) => {
    if (!user || !senderId || !roomId) {
      return toast.error("Missing data for reject.");
    }
    if (loadingIds.has(id)) return;

    setLoadingIds((prev) => new Set([...prev, id]));

    try {
      removeNotification(id); // Optimistic

      const res = await fetch(`/api/notifications/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: id, sender_id: senderId, room_id: roomId }),
      });

      if (!res.ok) {
        throw new Error((await res.json()).error || "Reject failed");
      }

      await markAsRead(id);
      await fetchNotifications(user.id);
      toast.success("Request rejected.");
    } catch (err: any) {
      await fetchNotifications(user.id);
      toast.error(err.message || "Reject error.");
    } finally {
      setLoadingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDeleteNotification = useCallback(
    async (id: string) => {
      if (!user || loadingIds.has(id)) return toast.error("Login required or in progress.");

      setLoadingIds((prev) => new Set([...prev, id]));

      try {
        const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });

        if (!res.ok) {
          throw new Error((await res.json()).error || "Delete failed");
        }

        removeNotification(id);
        toast.success("Notification deleted.");
      } catch (err: any) {
        toast.error(err.message || "Error deleting.");
      } finally {
        setLoadingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    },
    [user, loadingIds, removeNotification]
  );

  const getNotificationDisplay = useCallback((n: Inotification) => {
    const sender = n.users?.display_name || n.users?.username || "Someone";
    const room = n.rooms?.name || "a room";

    switch (n.type) {
      case "room_invite":
        return { 
          icon: <UserPlus className="h-4 w-4 text-blue-500" />, 
          text: `${sender} invited you to join ${room}` 
        };

      case "join_request":
        return { 
          icon: <Mail className="h-4 w-4 text-purple-500" />, 
          text: `${sender} requested to join ${room}` 
        };

      case "user_joined":
        return { 
          icon: <UserCheck className="h-4 w-4 text-green-500" />, 
          text: n.message || `${sender} joined ${room}` 
        };

      case "message":
        return { 
          icon: <Mail className="h-4 w-4 text-green-500" />, 
          text: `New message from ${sender} in ${room}` 
        };

      case "join_request_accepted":
        return { 
          icon: <UserCheck className="h-4 w-4 text-green-600" />, 
          text: n.message || `Your request to join ${room} was accepted` 
        };

      case "join_request_rejected":
        return { 
          icon: <UserX className="h-4 w-4 text-red-600" />, 
          text: n.message || `Your request to join ${room} was rejected` 
        };

      case "room_left":
        return { 
          icon: <LogOut className="h-4 w-4 text-gray-500" />, 
          text: n.message || `${sender} left ${room}.` 
        };

      // 👇 Optional: handle old rows created before we removed "notification_unread"
      case "notification_unread":
        return { 
          icon: <Mail className="h-4 w-4 text-gray-400" />, 
          text: n.message || "New notification" 
        };

      default:
        return { 
          icon: <Mail className="h-4 w-4 text-gray-400" />, 
          text: n.message || "New notification" 
        };
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
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
              <div className="text-center space-y-4">
                <Bell className="h-12 w-12 mx-auto text-gray-300" />
                <p className="text-lg font-medium">No notifications yet</p>
                <p className="text-sm text-gray-500">
                  When you get notifications, they'll appear here.
                </p>
                {user?.id && (
                  <button
                    onClick={() => fetchNotifications(user.id)}
                    className="mt-4 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    disabled={isLoading}
                  >
                    {isLoading ? "Refreshing..." : "Refresh Notifications"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const { icon, text } = getNotificationDisplay(n);
                const isLoading = loadingIds.has(n.id);

                return (
                  <Swipeable
                    key={n.id}
                    onSwipeLeft={() => !isLoading && handleAccept(n.id, n.room_id, n.type)}
                    onSwipeRight={() => !isLoading && handleReject(n.id, n.sender_id, n.room_id)}
                  >
                    <div
                      className={`p-4 flex items-start space-x-4 hover:bg-muted/50 relative ${
                        n.status === "read" ? "opacity-50" : ""
                      } ${isLoading ? "opacity-75 cursor-not-allowed" : ""}`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={n.users?.avatar_url || ""} alt={n.users?.username || "User"} />
                        <AvatarFallback>
                          {(n.users?.username || "U")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          {icon}
                          <span>{text}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(n.created_at || "").toLocaleString()}
                        </p>
                      </div>

                      {shouldShowActions(n) ? (
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(n.id, n.sender_id, n.room_id);
                            }}
                            disabled={isLoading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAccept(n.id, n.room_id, n.type);
                            }}
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
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNotification(n.id);
                            }}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {isLoading && (
                        <div className="absolute inset-0 bg-black/20 rounded flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        </div>
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