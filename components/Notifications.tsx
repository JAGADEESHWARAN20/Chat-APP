// components/Notifications.tsx
"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

import { useNotification, Inotification, useNotificationSubscription } from "@/lib/store/notifications";
import { useRoomStore } from "@/lib/store/roomstore";
import { useRoomContext } from "@/lib/store/RoomContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Database } from "@/lib/types/supabase";
import { Swipeable } from "./ui/swipeable";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "@/components/ui/accordion";
import { useAuthSync } from "@/hooks/useAuthSync";

/* -------------------- Types -------------------- */

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomWithMembership = Room & { isMember: boolean; participationStatus: string | null };

interface NotificationsProps {
  isOpen?: boolean;
  onClose?: () => void;
}

/* -------------------- Helpers -------------------- */

/** Map DB types to our local "display" types if needed */
function normalizeNotificationType(dbType: string): string {
  const map: Record<string, string> = {
    join_request: "join_request",
    new_message: "message",
    room_switch: "room_invite",
    user_joined: "user_joined",
    join_request_rejected: "join_request_rejected",
    join_request_accepted: "join_request_accepted",
    notification_unread: "notification_unread",
    room_left: "room_left",
  };
  return map[dbType] ?? dbType;
}

/* ---------- Lightweight room enrichment (used only on accept) ---------- */
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

/* ---------- Notification display helpers ---------- */
function getNotificationDisplay(n: Inotification) {
  const sender = n.users?.display_name || n.users?.username || "Someone";
  const room = n.rooms?.name || "a room";

  switch (n.type) {
    case "room_invite":
      return { icon: <UserPlus className="h-4 w-4" />, text: `${sender} invited you to join ${room}` };
    case "join_request":
      return { icon: <Mail className="h-4 w-4" />, text: `${sender} requested to join ${room}` };
    case "user_joined":
      return { icon: <UserCheck className="h-4 w-4" />, text: n.message || `${sender} joined ${room}` };
    case "message":
      return { icon: <Mail className="h-4 w-4" />, text: n.message || `New message from ${sender} in ${room}` };
    case "join_request_accepted":
      return { icon: <UserCheck className="h-4 w-4" />, text: n.message || `Your request to join ${room} was accepted` };
    case "join_request_rejected":
      return { icon: <UserX className="h-4 w-4" />, text: n.message || `Your request to join ${room} was rejected` };
    case "room_left":
      return { icon: <LogOut className="h-4 w-4" />, text: n.message || `${sender} left ${room}` };
    case "system":
    case "info":
      return { icon: <Mail className="h-4 w-4" />, text: n.message || "System notification" };
    default:
      return { icon: <Mail className="h-4 w-4" />, text: n.message || "New notification" };
  }
}

function shouldShowNotificationActions(n: Inotification) {
  return (n.type === "join_request" || n.type === "room_invite") && n.status !== "read";
}

/* -------------------- NotificationItem -------------------- */

type NotificationItemProps = {
  notification: Inotification;
  onAccept: (id: string, roomId: string | null, type: string) => Promise<void> | void;
  onReject: (id: string, senderId: string | null, roomId: string | null) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  isLoading?: boolean;
};

export const NotificationItem: React.FC<NotificationItemProps> = memo(function NotificationItem({
  notification,
  onAccept,
  onReject,
  onDelete,
  isLoading = false,
}) {
  const { icon, text } = useMemo(() => getNotificationDisplay(notification), [notification]);
  const showActions = useMemo(() => shouldShowNotificationActions(notification), [notification]);

  // local expand state for accordion (string id for shadcn single accordion)
  const [open, setOpen] = useState(false);

  const isAction =
    notification.type === "join_request" || notification.type === "room_invite";

  const handleClick = useCallback(
    (e?: MouseEvent) => {
      if (e) e.stopPropagation();
      setOpen((prev) => !prev);
    },
    [setOpen]
  );

  // Swipe handlers use your Swipeable component's API
  const handleSwipeLeft = useCallback(() => {
    if (isAction && !isLoading) onAccept(notification.id, notification.room_id, notification.type);
  }, [isAction, isLoading, onAccept, notification]);

  const handleSwipeRight = useCallback(() => {
    if (!isLoading) onReject(notification.id, notification.sender_id, notification.room_id);
  }, [isLoading, onReject, notification]);

  return (
    <Swipeable
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
      swipeThreshold={120}
      enableMouseEvents={true}
      className="select-none"
    >
      <Accordion type="single" collapsible value={open ? notification.id : ""} onValueChange={(v) => setOpen(v === notification.id)}>
        <AccordionItem value={notification.id} className="border-b border-slate-800/20">
          {/* MAIN ROW */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
            className={`p-4 flex items-start space-x-4 transition-colors duration-150 relative
              ${notification.status === "read" ? "opacity-60" : "bg-muted/30"}
              ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={notification.users?.avatar_url ?? ""} alt={notification.users?.username ?? "Sender avatar"} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {(notification.users?.username ?? "U")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                {icon}
                <span className="line-clamp-2 font-medium">{text}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {notification.created_at
                  ? new Date(notification.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Unknown date"}
              </p>
            </div>

            {/* Actions/overflow */}
            <div className="flex items-center gap-1">
              {showActions ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); onReject(notification.id, notification.sender_id, notification.room_id); }}
                    disabled={isLoading}
                    className="h-8 w-8 hover:bg-destructive/10"
                    aria-label="Reject"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); onAccept(notification.id, notification.room_id, notification.type); }}
                    disabled={isLoading}
                    className="h-8 w-8 hover:bg-green-500/10"
                    aria-label="Accept"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="icon" asChild aria-label="More">
                  <button onClick={(e) => e.stopPropagation()} className="h-8 w-8 flex items-center justify-center">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </Button>
              )}
            </div>
          </div>

          {/* ACCORDION CONTENT */}
          <AccordionContent>
            <div className="px-4 pb-4 bg-muted/40 flex items-center gap-3">
              {showActions && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReject(notification.id, notification.sender_id, notification.room_id)}
                    className="text-destructive"
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAccept(notification.id, notification.room_id, notification.type)}
                    className="text-green-600"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Accept
                  </Button>
                </>
              )}

              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(notification.id)}
                  className="text-muted-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Swipeable>
  );
});

/* -------------------- Main Notifications component -------------------- */

export default function Notifications({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
}: NotificationsProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const {
    notifications,
    markAsRead,
    fetchNotifications,
    removeNotification,
    isLoading,
    unreadCount,
    lastFetch,
  } = useNotification((s) => ({
    notifications: s.notifications,
    markAsRead: s.markAsRead,
    fetchNotifications: s.fetchNotifications,
    removeNotification: s.removeNotification,
    isLoading: s.isLoading,
    unreadCount: s.unreadCount,
    lastFetch: s.lastFetch,
  }));

  const { setSelectedRoom } = useRoomStore();
  const { fetchRooms } = useRoomContext();

  const { userId, isAuthenticated } = useAuthSync();

  const supabase = getSupabaseBrowserClient();

  // subscribe to realtime updates via store hook
  useNotificationSubscription(userId ?? null);

  const isOpen = externalIsOpen ?? internalIsOpen;

  // minimize re-opening animation cost with shorter duration classes (shadcn Sheet may handle className)
  const handleClose = useCallback(() => {
    if (externalOnClose) externalOnClose();
    else setInternalIsOpen(false);
  }, [externalOnClose]);

  // caching policy: avoid refetching if lastFetch was within 20 seconds
  const CACHE_TTL = 20_000;
  const lastFetchRef = useRef<number | null>(lastFetch ?? null);

  useEffect(() => {
    lastFetchRef.current = lastFetch ?? null;
  }, [lastFetch]);

  // fetch on initial mount or when userId becomes available. Fast path: skip fetch if recent.
  useEffect(() => {
    if (!userId) return;

    const shouldFetch = (() => {
      if (!lastFetchRef.current) return true;
      return Date.now() - lastFetchRef.current > CACHE_TTL;
    })();

    if (shouldFetch) {
      // Use a small AbortController to abort if component unmounts quickly
      let cancelled = false;
      const ac = new AbortController();

      (async () => {
        try {
          await fetchNotifications(userId);
        } catch (err) {
          if (!cancelled) console.error("fetchNotifications error:", err);
        }
      })();

      return () => {
        cancelled = true;
        ac.abort();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, fetchNotifications]);

  // fetch when panel opens — but skip if we already have notifications (fast)
  useEffect(() => {
    if (!isOpen || !userId) return;

    if (notifications.length === 0) {
      fetchNotifications(userId).catch((err) => console.error("fetchNotifications when open:", err));
    }
  }, [isOpen, userId, notifications.length, fetchNotifications]);

  /* -------------------- Handlers -------------------- */

  const addLoading = useCallback((id: string) => {
    setLoadingIds((prev) => new Set(prev).add(id));
  }, []);

  const removeLoading = useCallback((id: string) => {
    setLoadingIds((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  }, []);

  const handleAccept = useCallback(
    async (id: string, roomId: string | null, type: string) => {
      if (!userId || !roomId || loadingIds.has(id)) return;
      addLoading(id);

      try {
        // optimistic remove
        removeNotification(id);

        const res = await fetch(`/api/notifications/${id}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to accept notification");

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
        console.error("Error accepting notification:", err);
        toast.error(err?.message || "Error accepting notification");
      } finally {
        removeLoading(id);
      }
    },
    [userId, loadingIds, removeNotification, markAsRead, fetchRooms, supabase, setSelectedRoom, addLoading, removeLoading]
  );

  const handleReject = useCallback(
    async (id: string, senderId: string | null, roomId: string | null) => {
      if (!userId || !senderId || !roomId || loadingIds.has(id)) return;
      addLoading(id);

      try {
        removeNotification(id); // optimistic

        const res = await fetch(`/api/notifications/${id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomId, sender_id: senderId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Reject failed");

        await markAsRead(id);
        toast.success("Request rejected.");
      } catch (err: any) {
        console.error("Error rejecting notification:", err);
        toast.error(err?.message || "Reject error.");
      } finally {
        removeLoading(id);
      }
    },
    [userId, loadingIds, removeNotification, markAsRead, addLoading, removeLoading]
  );

  const handleDeleteNotification = useCallback(
    async (id: string) => {
      if (!userId || loadingIds.has(id)) return;
      addLoading(id);

      try {
        const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Delete failed");
        removeNotification(id);
        toast.success("Notification deleted.");
      } catch (err: any) {
        console.error("Error deleting notification:", err);
        toast.error(err?.message || "Error deleting notification.");
      } finally {
        removeLoading(id);
      }
    },
    [userId, loadingIds, removeNotification, addLoading, removeLoading]
  );

  /* -------------------- Notification list memo -------------------- */

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const dateA = new Date(a.created_at ?? 0).getTime();
      const dateB = new Date(b.created_at ?? 0).getTime();
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

  /* -------------------- Render -------------------- */

  // short-circuit: don't render heavy UI until auth resolved or user not authenticated
  if (!isAuthenticated) {
    return (
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent side="right" className="p-0 flex flex-col h-full w-full sm:max-w-sm transition-all duration-150">
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
      <SheetContent
        side="right"
        className="flex flex-col h-full p-0 w-full sm:max-w-sm transition-all duration-150"
      >
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
            <div className="flex flex-col items-center justify-start h-full text-muted-foreground text-center p-6">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium mb-2">No notifications yet</p>
              <p className="text-sm text-muted-foreground mb-4">When you get notifications, they$apos;ll appear here.</p>
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
