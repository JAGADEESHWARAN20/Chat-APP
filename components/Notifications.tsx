"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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

import {
  useNotification,
  type Inotification,
  useNotificationSubscription,
} from "@/lib/store/notifications";

import {
  useUnifiedRoomStore,
  type RoomWithMembership,
} from "@/lib/store/roomstore";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/supabase";

import { Swipeable } from "@/components/ui/swipeable";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "@/components/ui/accordion";
import { useAuthSync } from "@/hooks/useAuthSync";

// ─────────────────────────────────────────────────────────────
// Type from DB rooms
// ─────────────────────────────────────────────────────────────
type DBRoom = Database["public"]["Tables"]["rooms"]["Row"];

// ─────────────────────────────────────────────────────────────
// Fix transformRoom helper
// (Always return a RoomWithMembership type)
// ─────────────────────────────────────────────────────────────
const transformRoom = async (
  room: DBRoom,
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

    const { data: participant } = await supabase
      .from("room_participants")
      .select("status")
      .eq("room_id", room.id)
      .eq("user_id", userId)
      .single();

    const { count } = await supabase
      .from("room_members")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("status", "accepted");

    const participationStatus =
      membership?.status ??
      participant?.status ??
      null;

    return {
      id: room.id,
      name: room.name,
      is_private: room.is_private,
      created_by: room.created_by,
      created_at: room.created_at,

      isMember: participationStatus === "accepted",
      participationStatus:
  membership?.status === "pending" || membership?.status === "accepted"
    ? membership.status
    : participant?.status === "pending" || participant?.status === "accepted"
    ? participant.status
    : null,

      memberCount: count ?? 0,

      // UI-only fields:
      unreadCount: undefined,
      latestMessage: undefined,
      online_users: undefined,
    };
  } catch (err) {
    console.error("transformRoom error:", err);

    return {
      id: room.id,
      name: room.name,
      is_private: room.is_private,
      created_by: room.created_by,
      created_at: room.created_at,

      isMember: false,
      participationStatus: null,
      memberCount: 0,
      unreadCount: undefined,
      latestMessage: undefined,
      online_users: undefined,
    };
  }
};

// ─────────────────────────────────────────────────────────────
// Notification UI helpers
// ─────────────────────────────────────────────────────────────
function getNotificationDisplay(n: Inotification) {
  const sender = n.users?.display_name || n.users?.username || "Someone";
  const room = n.rooms?.name || "a room";

  switch (n.type) {
    case "room_invite":
      return {
        icon: <UserPlus className="h-4 w-4" />,
        text: `${sender} invited you to ${room}`,
      };

    case "join_request":
      return {
        icon: <Mail className="h-4 w-4" />,
        text: `${sender} wants to join ${room}`,
      };

    case "user_joined":
      return {
        icon: <UserCheck className="h-4 w-4" />,
        text: `${sender} joined ${room}`,
      };

    case "message":
      return {
        icon: <Mail className="h-4 w-4" />,
        text: n.message || `New message in ${room}`,
      };

    case "join_request_accepted":
      return {
        icon: <UserCheck className="h-4 w-4" />,
        text: `You're now in ${room}!`,
      };

    case "join_request_rejected":
      return {
        icon: <UserX className="h-4 w-4" />,
        text: `Request to join ${room} denied`,
      };

    case "room_left":
      return {
        icon: <LogOut className="h-4 w-4" />,
        text: `${sender} left ${room}`,
      };

    default:
      return {
        icon: <Bell className="h-4 w-4" />,
        text: n.message || "New notification",
      };
  }
}

function shouldShowNotificationActions(n: Inotification) {
  return ["join_request", "room_invite"].includes(n.type);
}

// ─────────────────────────────────────────────────────────────
// 📌 Notification Item Component
// ─────────────────────────────────────────────────────────────
type NotificationItemProps = {
  notification: Inotification;
  onAccept: (id: string, roomId: string | null, type: string) => Promise<void>;
  onReject: (
    id: string,
    senderId: string | null,
    roomId: string | null
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
};

export const NotificationItem = memo(function NotificationItem({
  notification,
  onAccept,
  onReject,
  onDelete,
  isLoading = false,
}: NotificationItemProps) {
  const { icon, text } = useMemo(
    () => getNotificationDisplay(notification),
    [notification]
  );

  const showActions = shouldShowNotificationActions(notification);

  const [open, setOpen] = useState(false);

  return (
    <Swipeable
      onSwipeLeft={() =>
        showActions &&
        !isLoading &&
        onAccept(notification.id, notification.room_id, notification.type)
      }
      onSwipeRight={() =>
        !isLoading &&
        onReject(notification.id, notification.sender_id, notification.room_id)
      }
      swipeThreshold={120}
      enableMouseEvents
      className="select-none"
    >
      <Accordion
        type="single"
        collapsible
        value={open ? notification.id : ""}
        onValueChange={(v) => setOpen(v === notification.id)}
      >
        <AccordionItem
          value={notification.id}
          className="border-b border-border/50"
        >
          <div
            className={`p-4 flex items-start gap-3 rounded-lg mx-2 my-1 cursor-pointer transition-all
              ${notification.status === "read" ? "opacity-70" : "bg-muted/40"}
            `}
            onClick={() => setOpen((o) => !o)}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={notification.users?.avatar_url || ""} />
              <AvatarFallback>
                {notification.users?.username?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {icon}
                <span className="line-clamp-2">{text}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {notification.created_at
                  ? new Date(notification.created_at).toLocaleString()
                  : "Just now"}
              </p>
            </div>

            {showActions && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject(
                      notification.id,
                      notification.sender_id,
                      notification.room_id
                    );
                  }}
                  className="h-8 w-8 hover:bg-destructive/20"
                >
                  <X className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccept(
                      notification.id,
                      notification.room_id,
                      notification.type
                    );
                  }}
                  className="h-8 w-8 hover:bg-green-500/20 text-green-600"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <AccordionContent>
            <div className="px-4 pb-4 flex gap-2">
              {showActions && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onReject(
                        notification.id,
                        notification.sender_id,
                        notification.room_id
                      )
                    }
                  >
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>

                  <Button
                    size="sm"
                    onClick={() =>
                      onAccept(
                        notification.id,
                        notification.room_id,
                        notification.type
                      )
                    }
                  >
                    <Check className="h-4 w-4 mr-1" /> Accept
                  </Button>
                </>
              )}

              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => onDelete(notification.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Swipeable>
  );
});

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function Notifications({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen ?? internalIsOpen;
  const handleClose = useCallback(
    () => externalOnClose?.() ?? setInternalIsOpen(false),
    [externalOnClose]
  );

  const {
    notifications,
    markAsRead,
    fetchNotifications,
    removeNotification,
    isLoading,
    unreadCount,
    lastFetch,
  } = useNotification();

  const setSelectedRoomId = useUnifiedRoomStore(
    (s) => s.setSelectedRoomId
  );
  const { fetchRooms } = useUnifiedRoomStore();

  const supabase = getSupabaseBrowserClient();
  const { userId, isAuthenticated } = useAuthSync();

  useNotificationSubscription(userId ?? null);

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // Cache TTL
  const CACHE_TTL = 20_000;
  const lastFetchRef = useRef(lastFetch);
  useEffect(() => {
    lastFetchRef.current = lastFetch;
  }, [lastFetch]);

  // Initial load
  useEffect(() => {
    if (!userId) return;

    if (!lastFetchRef.current || Date.now() - lastFetchRef.current > CACHE_TTL) {
      fetchNotifications(userId);
    }
  }, [userId, fetchNotifications]);

  // Reload if drawer opens with no notifications
  useEffect(() => {
    if (isOpen && notifications.length === 0 && userId) {
      fetchNotifications(userId);
    }
  }, [isOpen, userId, notifications.length, fetchNotifications]);

  const addLoading = (id: string) =>
    setLoadingIds((s) => new Set(s).add(id));
  const removeLoading = (id: string) =>
    setLoadingIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });

  // ─────────────────────────────────────────────────────────────
  // Accept
  // ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
// Accept (fixed)
// ─────────────────────────────────────────────────────────────
const handleAccept = useCallback(
  async (id: string, roomId: string | null, type: string) => {
    if (!userId || !roomId || loadingIds.has(id)) return;

    addLoading(id);
    removeNotification(id);

    try {
      const res = await fetch(`/api/notifications/${id}/accept`, {
        method: "POST",
      });

      if (!res.ok) throw new Error(await res.text());

      await markAsRead(id);

      // Always refresh room list globally
      await fetchRooms();

      // Fetch the room from DB
      const { data: room } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (!room) {
        toast.error("Room not found");
        return;
      }

      // Enrich room data (no navigation)
      await transformRoom(room, userId, supabase);

      // 🔥 Always show this — applies to requester or owner
      toast.success("Request accepted successfully!");

      // ❌ Removed setSelectedRoomId → no auto navigation for anyone
    } catch (err: any) {
      toast.error(err.message || "Failed to accept");
    } finally {
      removeLoading(id);
    }
  },
  [
    userId,
    loadingIds,
    removeNotification,
    markAsRead,
    fetchRooms,
    supabase,
  ]
);


  // ─────────────────────────────────────────────────────────────
  // Reject
  // ─────────────────────────────────────────────────────────────
  const handleReject = useCallback(
    async (
      id: string,
      senderId: string | null,
      roomId: string | null
    ) => {
      if (loadingIds.has(id)) return;

      addLoading(id);
      removeNotification(id);

      try {
        const res = await fetch(`/api/notifications/${id}/reject`, {
          method: "POST",
          body: JSON.stringify({ room_id: roomId, sender_id: senderId }),
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw new Error("Reject failed");

        await markAsRead(id);
        toast.success("Request rejected");
      } catch {
        toast.error("Failed to reject");
      } finally {
        removeLoading(id);
      }
    },
    [loadingIds, removeNotification, markAsRead]
  );

  // ─────────────────────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (id: string) => {
      if (loadingIds.has(id)) return;

      addLoading(id);

      try {
        await fetch(`/api/notifications/${id}`, {
          method: "DELETE",
        });

        removeNotification(id);
        toast.success("Deleted");
      } catch {
        toast.error("Delete failed");
      } finally {
        removeLoading(id);
      }
    },
    [loadingIds, removeNotification]
  );

  // Sort by date
  const sorted = useMemo(
    () =>
      [...notifications].sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      ),
    [notifications]
  );

  const list = useMemo(
    () =>
      sorted.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onAccept={handleAccept}
          onReject={handleReject}
          onDelete={handleDelete}
          isLoading={loadingIds.has(n.id)}
        />
      )),
    [sorted, handleAccept, handleReject, handleDelete, loadingIds]
  );

  // ─────────────────────────────────────────────────────────────
  // If not authenticated
  // ─────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <ArrowRight />
              </Button>
              <SheetTitle>Notifications</SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Bell className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">Sign in required</h3>
            <p className="text-sm text-muted-foreground">
              Log in to see your notifications
            </p>
            <Button
              className="mt-4"
              onClick={() => (window.location.href = "/auth/signin")}
            >
              Sign In
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Authenticated Drawer
  // ─────────────────────────────────────────────────────────────
  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-sm p-0" hideCloseButton>
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <ArrowRight />
            </Button>
            <SheetTitle className="flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            <div className="py-2">{list}</div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-4 border-t text-sm flex justify-between">
            <span className="text-muted-foreground">
              {notifications.length} total
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={isLoading}
              onClick={() => userId && fetchNotifications(userId)}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
