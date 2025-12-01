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

import { toast } from "@/components/ui/sonner";
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
  ArrowRight,
  UserPlus,
  Mail,
  UserCheck,
  UserX,
  LogOut,
  Bell,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";

import {
  useNotifications,
  type Notification,
  useNotificationSubscription,
} from "@/lib/store/notifications";

import { useRoomActions, useUnifiedRoomStore } from "@/lib/store/roomstore";
import { useAuthSync } from "@/hooks/useAuthSync";
import { useConnectionManager } from "@/hooks/useConnectionManager";

import { Swipeable } from "@/components/ui/swipeable";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "@/components/ui/accordion";

/* =======================================================================
   Notification UI helpers
   ======================================================================= */

function getNotificationDisplay(n: Notification) {
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

function shouldShowNotificationActions(n: Notification) {
  return ["join_request", "room_invite"].includes(n.type);
}

/* =======================================================================
   Notification Item
   ======================================================================= */

type NotificationItemProps = {
  notification: Notification;
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

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
      className="select-none touch-manipulation"
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
            role="button"
            tabIndex={0}
            aria-expanded={open}
            aria-label={`Notification: ${text}. ${open ? "Expanded" : "Collapsed"
              }. Click to ${open ? "collapse" : "expand"}`}
            onKeyDown={handleKeyDown}
            className={`mx-2 my-1 flex min-h-[80px] cursor-pointer items-start gap-3 rounded-lg p-4 transition-all md:min-h-[70px]
              bg-gradient-to-r from-background/80 to-muted/60
              hover:from-muted/80 hover:to-muted/70
              focus:outline-none focus:ring-2 focus:ring-primary/40
              shadow-sm
              ${notification.status === "read" ? "opacity-70" : ""}
            `}
            onClick={() => setOpen((o) => !o)}
          >
            <Avatar className="flex-shrink-0 h-10 w-10 border border-border/60 shadow-sm">
              <AvatarImage
                src={notification.users?.avatar_url || ""}
                alt={`${notification.users?.username || "User"} avatar`}
              />
              <AvatarFallback aria-hidden="true">
                {notification.users?.username?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-1 items-center gap-2 text-sm font-medium leading-snug">
                  <span aria-hidden="true" className="mt-0.5">
                    {icon}
                  </span>
                  <span className="line-clamp-2 break-words">{text}</span>
                </div>

                {showActions && (
                  <div className="flex flex-shrink-0 items-center gap-1">
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
                      className="h-8 w-8 hover:bg-destructive/15"
                      aria-label="Reject request"
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
                      className="h-8 w-8 text-green-600 hover:bg-green-500/15"
                      aria-label="Accept request"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                <time
                  dateTime={notification.created_at || new Date().toISOString()}
                >
                  {notification.created_at
                    ? new Date(notification.created_at).toLocaleString()
                    : "Just now"}
                </time>
              </p>
            </div>
          </div>

          <AccordionContent>
            <div className="flex flex-wrap gap-2 px-4 pb-4">
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
                    className="min-w-[120px] flex-1"
                  >
                    <X className="mr-1 h-4 w-4" /> Reject
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
                    className="min-w-[120px] flex-1"
                  >
                    <Check className="mr-1 h-4 w-4" /> Accept
                  </Button>
                </>
              )}

              <Button
                size="sm"
                variant="outline"
                className="ml-auto min-w-[120px] flex-1"
                onClick={() => onDelete(notification.id)}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Swipeable>
  );
});

/* =======================================================================
   Connection Status Indicator
   ======================================================================= */

function ConnectionStatus({
  connectionState,
  onRetry,
}: {
  connectionState: "connected" | "connecting" | "disconnected";
  onRetry: () => void;
}) {
  const statusConfig = {
    connected: { icon: Wifi, text: "Connected", color: "text-green-500" },
    connecting: {
      icon: Loader2,
      text: "Connecting...",
      color: "text-yellow-500",
    },
    disconnected: { icon: WifiOff, text: "Disconnected", color: "text-red-500" },
  };

  const { icon: Icon, text, color } = statusConfig[connectionState];

  return (
    <div
      className="flex items-center gap-2 border-b bg-background/80 px-4 py-2 text-sm backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <Icon
        className={`h-4 w-4 ${color} ${connectionState === "connecting" ? "animate-spin" : ""
          }`}
      />
      <span>{text}</span>
      {connectionState === "disconnected" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="ml-auto h-6 px-2 text-xs"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}

/* =======================================================================
   Main Component
   ======================================================================= */

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
    fetch: fetchNotifications,
    remove,
    unread,
    isLoading,
    lastFetch,
  } = useNotifications();

  const { fetchRooms } = useUnifiedRoomStore();
  const { userId, isAuthenticated } = useAuthSync();
  const { connectionState, attemptReconnection } = useConnectionManager(userId);

  // Start realtime subscription
  useNotificationSubscription(userId ?? null);

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // Cache TTL for initial fetches
  const CACHE_TTL = 30_000;
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

  // Reload when drawer opens and nothing loaded
  useEffect(() => {
    if (isOpen && notifications.length === 0 && userId) {
      fetchNotifications(userId);
    }
  }, [isOpen, userId, notifications.length, fetchNotifications]);

  const addLoading = (id: string) =>
    setLoadingIds((s) => {
      const next = new Set(s);
      next.add(id);
      return next;
    });

  const removeLoading = (id: string) =>
    setLoadingIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });

  /* -------------------------------------------------------------------
     Accept
     ------------------------------------------------------------------- */
  // In Notifications.tsx - update handleAccept function
  const handleAccept = useCallback(
    async (id: string, roomId: string | null, type: string) => {
      if (!userId || !roomId || loadingIds.has(id)) return;

      addLoading(id);

      // OPTIMISTIC UPDATE: Immediately update search component
      // This ensures UI updates before the real-time event arrives
      const { updateRoomMembership } = useRoomActions();
      updateRoomMembership(roomId, {
        participationStatus: "accepted",
        isMember: true,
      });

      remove(id); // optimistic remove from notifications

      try {
        const res = await fetch(`/api/notifications/${id}/accept`, {
          method: "POST",
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Accept failed");
        }

        // Force refresh rooms to get updated counts
        await fetchRooms();

        toast.success(
          type === "join_request"
            ? "Join request accepted! The user has been added to the room."
            : "Action completed successfully."
        );
      } catch (err: any) {
        console.error("Accept error:", err);
        toast.error(err.message || "Failed to accept");

        // Rollback optimistic update on error
        updateRoomMembership(roomId, {
          participationStatus: "pending", // Rollback to pending
          isMember: false,
        });

        if (userId) {
          // re-sync from backend
          fetchNotifications(userId);
        }
      } finally {
        removeLoading(id);
      }
    },
    [userId, loadingIds, remove, fetchRooms, fetchNotifications]
  );
  /* -------------------------------------------------------------------
     Reject
     ------------------------------------------------------------------- */
  const handleReject = useCallback(
    async (id: string, senderId: string | null, roomId: string | null) => {
      if (loadingIds.has(id)) return;

      addLoading(id);
      remove(id); // optimistic remove

      try {
        const res = await fetch(`/api/notifications/${id}/reject`, {
          method: "POST",
          body: JSON.stringify({ room_id: roomId, sender_id: senderId }),
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Reject failed");
        }

        toast.success("Request rejected");
      } catch (err: any) {
        console.error("Reject error:", err);
        toast.error(err.message || "Failed to reject");
        if (userId) {
          fetchNotifications(userId);
        }
      } finally {
        removeLoading(id);
      }
    },
    [userId, loadingIds, remove, fetchNotifications]
  );

  /* -------------------------------------------------------------------
     Delete
     ------------------------------------------------------------------- */
  const handleDelete = useCallback(
    async (id: string) => {
      if (loadingIds.has(id)) return;

      addLoading(id);

      try {
        await fetch(`/api/notifications/${id}`, {
          method: "DELETE",
        });

        remove(id);
        toast.success("Deleted");
      } catch (err: any) {
        console.error("Delete error:", err);
        toast.error("Delete failed");
      } finally {
        removeLoading(id);
      }
    },
    [loadingIds, remove]
  );

  /* -------------------------------------------------------------------
     Sort + list
     ------------------------------------------------------------------- */
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

  /* -------------------------------------------------------------------
     Empty states with connection awareness
     ------------------------------------------------------------------- */
  const renderEmptyState = () => {
    if (connectionState === "disconnected") {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <WifiOff className="mb-4 h-16 w-16 text-muted-foreground/30" />
          <h3 className="mb-2 text-lg font-semibold">Connection Lost</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Unable to load notifications. Please check your connection.
          </p>
          <Button onClick={attemptReconnection}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      );
    }

    if (isLoading && notifications.length === 0) {
      return (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading notifications...
          </span>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Bell className="mb-4 h-12 w-12 opacity-50" />
        <p className="text-lg font-medium">All caught up!</p>
        <p className="text-sm">No new notifications</p>
      </div>
    );
  };

  /* -------------------------------------------------------------------
     If not authenticated
     ------------------------------------------------------------------- */
  if (!isAuthenticated) {
    return (
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <ArrowRight />
              </Button>
              <SheetTitle>Notifications</SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <Bell className="mb-4 h-16 w-16 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">Sign in required</h3>
            <p className="mt-1 text-sm text-muted-foreground">
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

  /* -------------------------------------------------------------------
     Authenticated drawer
     ------------------------------------------------------------------- */
  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-sm"
        hideCloseButton
      >
        <SheetHeader className="border-b bg-gradient-to-r from-background to-muted/60 p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="rounded-full border border-border/40 shadow-sm"
            >
              <ArrowRight />
            </Button>
            <SheetTitle className="flex items-center gap-2">
              Notifications
              {unread > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </SheetTitle>
          </div>
        </SheetHeader>

        <ConnectionStatus
          connectionState={connectionState}
          onRetry={attemptReconnection}
        />

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading && notifications.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="py-2">{list}</div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="flex justify-between border-t p-4 text-sm">
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
