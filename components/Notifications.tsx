"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNotification, Inotification } from "@/lib/store/notifications";
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
  Bell,
} from "lucide-react";
import { Database } from "@/lib/types/supabase";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Swipeable } from "./ui/swipeable";
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
    isLoading,
  } = useNotification();
  
  const { setSelectedRoom } = useRoomStore();
  const { fetchAvailableRooms } = useRoomContext();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // Initialize notifications
  useEffect(() => {
    if (!user?.id) {
      console.log("❌ No user ID, skipping notification init");
      return;
    }

    console.log("🔔 Initializing notifications for user:", user.id);
    
    fetchNotifications(user.id);
    subscribeToNotifications(user.id);

    return () => {
      console.log("🧹 Cleaning up notifications");
      unsubscribeFromNotifications();
    };
  }, [user?.id, fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications]);

  // Refresh when panel opens
  useEffect(() => {
    if (isOpen && user?.id) {
      console.log("📱 Notification panel opened, refreshing...");
      fetchNotifications(user.id);
    }
  }, [isOpen, user?.id, fetchNotifications]);

  const handleAccept = async (id: string, roomId: string | null, type: string) => {
    if (!user || !roomId) {
      return toast.error("Missing data for action.");
    }
    if (loadingIds.has(id)) return;
  
    setLoadingIds((prev) => new Set([...prev, id]));
  
    try {
      removeNotification(id);
  
      const res = await fetch(`/api/notifications/${id}/accept`, { method: "POST" });
      const data = await res.json();
  
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept notification");
      }
  
      await markAsRead(id);
      await fetchAvailableRooms();
      await fetchNotifications(user.id);
  
      if (["room_invite", "join_request"].includes(type)) {
        const { data: fetchedRoom, error } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", roomId)
          .single();
  
        if (!error && fetchedRoom) {
          const enrichedRoom = await transformRoom(fetchedRoom, user.id, supabase);
          setSelectedRoom(enrichedRoom);
          toast.success(`Joined ${fetchedRoom.name} successfully!`);
          router.push(`/chat/${roomId}`);
        }
      } else {
        toast.success("Notification accepted.");
      }
    } catch (err: any) {
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
      removeNotification(id);

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
      if (!user || loadingIds.has(id)) return;

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
          text: n.message || `New message from ${sender} in ${room}` 
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
          text: n.message || `${sender} left ${room}` 
        };
      default:
        return { 
          icon: <Mail className="h-4 w-4 text-gray-400" />, 
          text: n.message || "New notification" 
        };
    }
  }, []);

  const shouldShowActions = useCallback((n: Inotification) => {
    const actionableTypes = ['join_request', 'room_invite'];
    return actionableTypes.includes(n.type) && n.status !== "read";
  }, []);

  // Memoize sorted notifications
  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [notifications]);

  console.log("🎨 Rendering Notifications:", {
    count: notifications.length,
    isOpen,
    userId: user?.id,
    isLoading
  });

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col h-full w-full sm:max-w-sm"
      >
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <SheetTitle>Notifications ({notifications.length})</SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
              <Bell className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">No notifications yet</p>
              <p className="text-sm text-gray-500">
                When you get notifications, they&apos;ll appear here.
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
          ) : (
            <div className="space-y-2">
              {sortedNotifications.map((n) => {
                const { icon, text } = getNotificationDisplay(n);
                const isLoadingItem = loadingIds.has(n.id);

                return (
                  <Swipeable
                    key={n.id}
                    onSwipeLeft={() => !isLoadingItem && handleAccept(n.id, n.room_id, n.type)}
                    onSwipeRight={() => !isLoadingItem && handleReject(n.id, n.sender_id, n.room_id)}
                  >
                    <div
                      className={`p-4 flex items-start space-x-4 hover:bg-muted/50 relative ${
                        n.status === "read" ? "opacity-50" : ""
                      } ${isLoadingItem ? "opacity-75 cursor-not-allowed" : ""}`}
                    >
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={n.users?.avatar_url || ""} alt={n.users?.username || "User"} />
                        <AvatarFallback>
                          {(n.users?.username || "U")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          {icon}
                          <span className="line-clamp-2">{text}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(n.created_at || "").toLocaleString()}
                        </p>
                      </div>

                      {shouldShowActions(n) ? (
                        <div className="flex space-x-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(n.id, n.sender_id, n.room_id);
                            }}
                            disabled={isLoadingItem}
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
                            disabled={isLoadingItem}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="flex-shrink-0">
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
                      
                      {isLoadingItem && (
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