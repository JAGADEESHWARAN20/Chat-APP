"use client";

/* ✅ Imports */
import React, { memo, useEffect, useState, useCallback, useMemo } from "react";
import type { MouseEvent } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
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
  Loader2,
} from "lucide-react";

import { useNotification, Inotification, useNotificationSubscription } from "@/lib/store/notifications"; // ✅ use store + built-in subscription
import { useRoomStore } from "@/lib/store/roomstore";
import { useRoomContext } from "@/lib/store/RoomContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Database } from "@/lib/types/supabase";
import { Swipeable } from "./ui/swipeable";

/* ✅ Auth: either import the right hook name... */
import { useAuthSync } from "@/hooks/useAuthSync";
/* ...or if you really want to keep `useAuth` here, re-export it once in hooks:
   // hooks/index.ts (new)
   export { useAuthSync as useAuth } from "./useAuthSync";
   and then you'd import { useAuth } from "@/hooks"
*/

/* Types */
type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomWithMembership = Room & { isMember: boolean; participationStatus: string | null };

interface NotificationsProps {
  isOpen?: boolean;
  onClose?: () => void;
}

/* ----------  Module-level helpers (pure, no hooks!)  ---------- */

function getNotificationDisplay(n: Inotification) {
  const sender = n.users?.display_name || n.users?.username || "Someone";
  const room = n.rooms?.name || "a room";

  switch (n.type) {
    case "room_invite":
      return { icon: <UserPlus className="h-4 w-4 text-blue-500" />, text: `${sender} invited you to join ${room}` };
    case "join_request":
      return { icon: <Mail className="h-4 w-4 text-purple-500" />, text: `${sender} requested to join ${room}` };
    case "user_joined":
      return { icon: <UserCheck className="h-4 w-4 text-green-500" />, text: n.message || `${sender} joined ${room}` };
    case "message":
      return { icon: <Mail className="h-4 w-4 text-green-500" />, text: n.message || `New message from ${sender} in ${room}` };
    case "join_request_accepted":
      return { icon: <UserCheck className="h-4 w-4 text-green-600" />, text: n.message || `Your request to join ${room} was accepted` };
    case "join_request_rejected":
      return { icon: <UserX className="h-4 w-4 text-red-600" />, text: n.message || `Your request to join ${room} was rejected` };
    case "room_left":
      return { icon: <LogOut className="h-4 w-4 text-gray-500" />, text: n.message || `${sender} left ${room}` };
    default:
      return { icon: <Mail className="h-4 w-4 text-muted-foreground" />, text: n.message || "New notification" };
  }
}

function shouldShowNotificationActions(n: Inotification) {
  return (n.type === "join_request" || n.type === "room_invite") && n.status !== "read";
}

/* ----------  Utilities  ---------- */

const transformRoom = async (
  room: Room,
  userId: string,
  supabase: ReturnType<typeof getSupabaseBrowserClient>
): Promise<RoomWithMembership> => {
  try {
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
  } catch (error) {
    console.error("Error transforming room:", error);
    return { ...room, isMember: false, participationStatus: null };
  }
};

/* ----------  Presentational item (memoized)  ---------- */

const NotificationItem = memo(function NotificationItem({
  notification,
  onAccept,
  onReject,
  onDelete,
  isLoading = false,
}: {
  notification: Inotification;
  onAccept: (id: string, roomId: string | null, type: string) => void;
  onReject: (id: string, senderId: string | null, roomId: string | null) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}) {
  const { icon, text } = useMemo(() => getNotificationDisplay(notification), [notification]);
  const showActions = useMemo(() => shouldShowNotificationActions(notification), [notification]);

  const handleAccept = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onAccept(notification.id, notification.room_id, notification.type);
  }, [notification, onAccept]);

  const handleReject = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onReject(notification.id, notification.sender_id, notification.room_id);
  }, [notification, onReject]);

  const handleDelete = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onDelete(notification.id);
  }, [notification, onDelete]);

  const handleClick = useCallback(() => {
    console.log("🔔 Notification clicked:", { notificationId: notification.id, type: notification.type });
  }, [notification]);

  return (
    <Swipeable
      onSwipeLeft={() => !isLoading && onAccept(notification.id, notification.room_id, notification.type)}
      onSwipeRight={() => !isLoading && onReject(notification.id, notification.sender_id, notification.room_id)}
    >
      <div
        className={`p-4 flex items-start space-x-4 hover:bg-muted/50 border-b border-slate-800/20  transition-colors relative ${
          notification.status === "read" ? "opacity-60" : "bg-muted/30"
        } ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onClick={handleClick}
      >
        {/* Avatar */}
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={notification.users?.avatar_url || ""} alt={notification.users?.username || "User"} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {(notification.users?.username || "U")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            {icon}
            <span className="line-clamp-2 font-medium">{text}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {notification.created_at
              ? new Date(notification.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Unknown date"}
          </p>
        </div>

        {/* Actions */}
        {showActions ? (
          <div className="flex space-x-1 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={handleReject} disabled={isLoading} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleAccept} disabled={isLoading} className="h-8 w-8 hover:bg-green-500/10 hover:text-green-600">
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div>
            <Button asChild variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
            {/* if you're using shadcn DropdownMenu here, keep your original code */}
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 rounded flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </div>
    </Swipeable>
  );
});

/* ----------  Main component  ---------- */

export default function Notifications({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
}: NotificationsProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  /* ✅ Selector pattern to avoid re-renders */
  const { notifications, markAsRead, fetchNotifications, removeNotification, isLoading, unreadCount } =
  useNotification((s) => ({
    notifications: s.notifications,
    markAsRead: s.markAsRead,
    fetchNotifications: s.fetchNotifications,
    removeNotification: s.removeNotification,
    isLoading: s.isLoading,
    unreadCount: s.unreadCount,
  }));


  const { setSelectedRoom } = useRoomStore();
  const { fetchRooms } = useRoomContext();

  /* ✅ Auth */
  const { userId, isAuthenticated } = useAuthSync(); // <- consistent name

  const supabase = getSupabaseBrowserClient();

  /* ✅ Real-time subscription via store hook (replaces missing useNotificationManager) */
  useNotificationSubscription(userId ?? null);

  const isOpen = externalIsOpen ?? internalIsOpen;

  const handleClose = useCallback(() => {
    externalOnClose?.() || setInternalIsOpen(false);
  }, [externalOnClose]);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications(userId);
  }, [userId, fetchNotifications]);

  useEffect(() => {
    if (isOpen && userId && notifications.length === 0) {
      fetchNotifications(userId);
    }
  }, [isOpen, userId, notifications.length, fetchNotifications]);

  const handleAccept = useCallback(
    async (id: string, roomId: string | null, type: string) => {
      if (!userId || !roomId || loadingIds.has(id)) return;
      setLoadingIds((prev) => new Set([...prev, id]));
      try {
        removeNotification(id); // optimistic
        const res = await fetch(`/api/notifications/${id}/accept`, { method: "POST", headers: { "Content-Type": "application/json" } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to accept notification");
        await markAsRead(id);
        await fetchRooms();

        if (type === "room_invite" || type === "join_request") {
          const { data: fetchedRoom, error } = await supabase.from("rooms").select("*").eq("id", roomId).single();
          if (!error && fetchedRoom) {
            const enrichedRoom = await transformRoom(fetchedRoom, userId, supabase);
            setSelectedRoom(enrichedRoom);
            toast.success(`Joined ${fetchedRoom.name} successfully!`);
          } else {
            toast.success("Request accepted successfully!");
          }
        } else {
          toast.success("Notification accepted.");
        }
      } catch (err: any) {
        console.error("❌ Error accepting notification:", err);
        toast.error(err.message || "Error accepting notification.");
      } finally {
        setLoadingIds((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      }
    },
    [userId, loadingIds, removeNotification, markAsRead, fetchRooms, supabase, setSelectedRoom]
  );

  const handleReject = useCallback(
    async (id: string, senderId: string | null, roomId: string | null) => {
      if (!userId || !senderId || !roomId || loadingIds.has(id)) return;
      setLoadingIds((prev) => new Set([...prev, id]));
      try {
        removeNotification(id); // optimistic
        const res = await fetch(`/api/notifications/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notification_id: id, sender_id: senderId, room_id: roomId, userId }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Reject failed");
        await markAsRead(id);
        toast.success("Request rejected.");
      } catch (err: any) {
        console.error("❌ Error rejecting notification:", err);
        toast.error(err.message || "Reject error.");
      } finally {
        setLoadingIds((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      }
    },
    [userId, loadingIds, removeNotification, markAsRead]
  );

  const handleDeleteNotification = useCallback(
    async (id: string) => {
      if (!userId || loadingIds.has(id)) return;
      setLoadingIds((prev) => new Set([...prev, id]));
      try {
        const res = await fetch(`/api/notifications/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
        removeNotification(id);
        toast.success("Notification deleted.");
      } catch (err: any) {
        console.error("❌ Error deleting notification:", err);
        toast.error(err.message || "Error deleting notification.");
      } finally {
        setLoadingIds((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      }
    },
    [userId, loadingIds, removeNotification]
  );

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [notifications]);

  const notificationList = useMemo(
    () =>
      sortedNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onAccept={handleAccept}
          onReject={handleReject}
          onDelete={handleDeleteNotification}
          isLoading={loadingIds.has(notification.id)}
        />
      )),
    [sortedNotifications, handleAccept, handleReject, handleDeleteNotification, loadingIds]
  );

  if (!isAuthenticated) {
    return (
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent side="right" className="p-0 flex flex-col h-full w-full sm:max-w-sm">
          <SheetHeader className="p-1 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <SheetTitle>Notifications</SheetTitle>
              </div>
            </div>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Bell className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
            <p className="text-sm text-muted-foreground mb-6">Please sign in to view your notifications</p>
            <Button onClick={() => (window.location.href = "/auth/signin")} className="px-6">
              Sign In
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className=" flex flex-col h-full p-0 w-full sm:max-w-sm">
        <SheetHeader className="p-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <SheetTitle className="flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-start h-full text-muted-foreground text-center">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium mb-2">No notifications yet</p>
              <p className="text-sm text-muted-foreground mb-4">When you get notifications, they&apos;ll appear here.</p>
              <Button onClick={() => userId && fetchNotifications(userId)} disabled={isLoading} variant="outline" size="sm">
                {isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                    Refreshing...
                  </>
                ) : (
                  "Refresh Notifications"
                )}
              </Button>
            </div>
          ) : (
            <div className="">{notificationList}</div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-4 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </span>
              <Button variant="outline" size="sm" onClick={() => userId && fetchNotifications(userId)} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
