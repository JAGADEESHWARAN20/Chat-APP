"use client";
import React, { memo, useCallback, useMemo, useState } from "react";
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
  Bell,
  Loader2,
} from "lucide-react";
import {
  useNotifications,
  useUnreadCount,
  useRoomActions,
  useUnifiedStore,
  type NotificationData,
} from "@/lib/store/unified-roomstore";
import { Swipeable } from "@/components/ui/swipeable";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "@/components/ui/accordion";

/* ============================================================================ 
   NOTIFICATION HELPERS
============================================================================ */
function getNotificationDisplay(n: NotificationData) {
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
    case "join_request_accepted":
      return {
        icon: <UserCheck className="h-4 w-4" />,
        text: `You're now in ${room}!`,
      };
    default:
      return {
        icon: <Bell className="h-4 w-4" />,
        text: n.message || "New notification",
      };
  }
}
function shouldShowActions(n: NotificationData) {
  return ["join_request", "room_invite"].includes(n.type);
}

/* ============================================================================ 
   NOTIFICATION ITEM COMPONENT
============================================================================ */
interface NotificationItemProps {
  notification: NotificationData;
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}
const NotificationItem = memo(function NotificationItem({
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
  const showActions = shouldShowActions(notification);
  const [open, setOpen] = useState(false);
  return (
    <Swipeable
      onSwipeLeft={() => showActions && !isLoading && onAccept(notification.id)}
      onSwipeRight={() => !isLoading && onReject(notification.id)}
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
            onClick={() => setOpen((o) => !o)}
            className={`mx-2 my-1 flex min-h-[80px] cursor-pointer items-start gap-3 rounded-lg p-4 transition-all
              bg-gradient-to-r from-background/80 to-muted/60
              hover:from-muted/80 hover:to-muted/70
              ${notification.status === "read" ? "opacity-70" : ""}
            `}
          >
            {/* Avatar */}
            <Avatar className="flex-shrink-0 h-10 w-10 border border-border/60 shadow-sm">
              <AvatarImage
                src={notification.users?.avatar_url || ""}
                alt={`${notification.users?.username || "User"} avatar`}
              />
              <AvatarFallback>
                {notification.users?.username?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-1 items-center gap-2 text-sm font-medium">
                  <span className="mt-0.5">{icon}</span>
                  <span className="line-clamp-2 break-words">{text}</span>
                </div>
                {/* Quick Actions */}
                {showActions && (
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReject(notification.id);
                      }}
                      className="h-8 w-8 hover:bg-destructive/15"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAccept(notification.id);
                      }}
                      className="h-8 w-8 text-green-600 hover:bg-green-500/15"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {/* Timestamp */}
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
          </div>
          {/* Expanded Actions */}
          <AccordionContent>
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              {showActions && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReject(notification.id)}
                    className="min-w-[120px] flex-1"
                  >
                    <X className="mr-1 h-4 w-4" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onAccept(notification.id)}
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

/* ============================================================================ 
   MAIN NOTIFICATIONS COMPONENT
============================================================================ */

interface NotificationsProps {
  isOpen?: boolean;
  onClose?: () => void;
}
export default function Notifications({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
}: NotificationsProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen ?? internalIsOpen;
  const handleClose = useCallback(
    () => externalOnClose?.() ?? setInternalIsOpen(false),
    [externalOnClose]
  );

  // Zustand state - auto-updates from realtime
  const notifications = useNotifications();
  const unreadCount = useUnreadCount();
  const { acceptJoinRequest } = useRoomActions();

  // IMPORTANT: use selectors for actions so React/Zustand subscriptions work correctly
  const removeNotification = useUnifiedStore((s) => s.removeNotification);
  const fetchNotifications = useUnifiedStore((s) => s.fetchNotifications);

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const addLoading = (id: string) => setLoadingIds((s) => new Set([...s, id]));
  const removeLoading = (id: string) =>
    setLoadingIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });

  /* ------------------------------------------------------------------------
     HANDLERS
  ------------------------------------------------------------------------ */
  const handleAccept = useCallback(
    async (id: string) => {
      const notification = notifications.find((n) => n.id === id);
      if (!notification?.room_id || loadingIds.has(id)) return;
      addLoading(id);
      try {
        await acceptJoinRequest(id, notification.room_id);
        // acceptJoinRequest already removes the notification in the action (store-side)
      } catch (error) {
        console.error("Accept error:", error);
        // Optionally re-fetch
        await fetchNotifications();
      } finally {
        removeLoading(id);
      }
    },
    [notifications, loadingIds, acceptJoinRequest, fetchNotifications]
  );

  const handleReject = useCallback(
    async (id: string) => {
      if (loadingIds.has(id)) return;
      addLoading(id);

      // Optimistic UI: remove locally immediately through the store action (reactive)
      removeNotification(id);

      try {
        const notification = notifications.find((n) => n.id === id);
        const res = await fetch(`/api/notifications/${id}/reject`, {
          method: "POST",
          body: JSON.stringify({
            room_id: notification?.room_id,
            sender_id: notification?.sender_id,
          }),
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error("Reject failed");
      } catch (error) {
        console.error("Reject error:", error);
        // Re-fetch on error so UI gets the canonical data
        await fetchNotifications();
      } finally {
        removeLoading(id);
      }
    },
    [notifications, loadingIds, removeNotification, fetchNotifications]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (loadingIds.has(id)) return;
      addLoading(id);

      // Optimistic UI: remove locally immediately
      removeNotification(id);

      try {
        const res = await fetch(`/api/notifications/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed");
      } catch (error) {
        console.error("Delete error:", error);
        // Re-fetch on error
        await fetchNotifications();
      } finally {
        removeLoading(id);
      }
    },
    [loadingIds, removeNotification, fetchNotifications]
  );

  /* ------------------------------------------------------------------------
     SORTED NOTIFICATIONS
  ------------------------------------------------------------------------ */
  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [notifications]
  );

  /* ------------------------------------------------------------------------
     RENDER
  ------------------------------------------------------------------------ */
  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-sm"
        hideCloseButton
      >
        {/* Header */}
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
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </SheetTitle>
          </div>
        </SheetHeader>
        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {sortedNotifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Bell className="mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            <div className="py-2">
              {sortedNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  onDelete={handleDelete}
                  isLoading={loadingIds.has(notification.id)}
                />
              ))}
            </div>
          )}
        </div>
        {/* Footer */}
        {notifications.length > 0 && (
          <div className="flex justify-between border-t p-4 text-sm">
            <span className="text-muted-foreground">
              {notifications.length} total
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchNotifications()}
            >
              Refresh
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
