"use client";

import React, {
  memo,
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";

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

import { cn } from "@/lib/utils";

/* ============================================================================
   HELPERS
============================================================================ */
function formatDisplay(n: NotificationData) {
  const sender =
    n.sender?.display_name ||
    n.sender?.username ||
    n.users?.display_name ||
    n.users?.username ||
    "Someone";

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
        text: n.message ?? "New notification",
      };
  }
}

const NEEDS_ACTION = new Set(["join_request", "room_invite"]);
const hasActions = (n: NotificationData) => NEEDS_ACTION.has(n.type);

/* ============================================================================
   FAST NOTIFICATION ITEM (Only re-renders when its own props change)
============================================================================ */
const NotificationItem = memo(function NotificationItem({
  notification,
  onAccept,
  onReject,
  onDelete,
  isLoading,
}: {
  notification: NotificationData;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}) {
  const sender =
    notification.sender ||
    notification.users ||
    null;

  const displayName =
    sender?.display_name ||
    sender?.username ||
    "Someone";

  const avatar = sender?.avatar_url ?? "";

  const { icon, text } = useMemo(
    () => formatDisplay(notification),
    [notification]
  );

  const [open, setOpen] = useState<"delete" | "actions" | null>(null);

  const toggle = useCallback(
    (section: "delete" | "actions") =>
      setOpen((prev) => (prev === section ? null : section)),
    []
  );

  return (
    <div className="border-b border-border/40">
      <div className="flex items-start w-full">

        {/* LEFT — DELETE ZONE */}
        <div
          onClick={() => toggle("delete")}
          className="w-16 flex-shrink-0 flex items-center justify-center cursor-pointer
                     bg-destructive/5 hover:bg-destructive/15 active:scale-95 transition-all"
        >
          <Trash2 className="h-5 w-5 text-destructive" />
        </div>

        {/* MAIN CONTENT */}
        <div
          onClick={() => toggle("actions")}
          className={cn(
            "flex-1 p-4 cursor-pointer rounded-r-lg transition-all",
            "bg-gradient-to-r from-background/80 to-muted/50",
            "hover:from-muted/70 hover:to-muted/60",
            notification.status === "read" ? "opacity-70" : ""
          )}
        >
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 border shadow">
              <AvatarImage src={avatar} />
              <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex gap-2 text-sm font-medium">
                {icon}
                <span className="line-clamp-2">{text}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DELETE PANEL */}
      {open === "delete" && (
        <div className="px-4 pb-4 pt-2">
          <Button
            size="sm"
            variant="destructive"
            disabled={isLoading}
            onClick={() => onDelete(notification.id)}
            className="w-full"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </>
            )}
          </Button>
        </div>
      )}

      {/* ACTIONS PANEL */}
      {open === "actions" && hasActions(notification) && (
        <div className="px-4 pb-4 pt-2 flex gap-2 animate-in fade-in slide-in-from-right-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(notification.id)}
            disabled={isLoading}
            className="flex-1"
          >
            <X className="mr-1 h-4 w-4" /> Reject
          </Button>
          <Button
            size="sm"
            onClick={() => onAccept(notification.id)}
            disabled={isLoading}
            className="flex-1"
          >
            <Check className="mr-1 h-4 w-4" /> Accept
          </Button>
        </div>
      )}
    </div>
  );
});

/* ============================================================================
   MAIN NOTIFICATIONS UI — FAST, PREMIUM, OPTIMIZED
============================================================================ */
export default function Notifications({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalIsOpen ?? internalOpen;

  const close = useCallback(() => {
    externalOnClose?.() ?? setInternalOpen(false);
  }, [externalOnClose]);

  const notifications = useNotifications();
  const unreadCount = useUnreadCount();
  const removeNotification = useUnifiedStore((s) => s.removeNotification);
  const fetchNotifications = useUnifiedStore((s) => s.fetchNotifications);
  const { acceptJoinRequest } = useRoomActions();

  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const setLoad = (id: string, val: boolean) =>
    setLoading((prev) => {
      const next = new Set(prev);
      val ? next.add(id) : next.delete(id);
      return next;
    });

  /* FAST ACTION HANDLERS */
  const fastReject = useCallback(
    async (id: string) => {
      if (loading.has(id)) return;
      setLoad(id, true);
      removeNotification(id); // instant UI update

      try {
        const n = notifications.find((x) => x.id === id);
        await fetch(`/api/notifications/${id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: n?.room_id,
            sender_id: n?.sender_id,
          }),
        });
      } finally {
        setLoad(id, false);
      }
    },
    [notifications, loading]
  );

  const fastDelete = useCallback(
    async (id: string) => {
      if (loading.has(id)) return;
      setLoad(id, true);
      removeNotification(id);

      try {
        await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      } finally {
        setLoad(id, false);
      }
    },
    [loading]
  );

  const fastAccept = useCallback(
    async (id: string) => {
      const n = notifications.find((x) => x.id === id);
      if (!n || loading.has(id)) return;

      setLoad(id, true);

      try {
        await acceptJoinRequest(id, n.room_id!);
      } finally {
        setLoad(id, false);
      }
    },
    [notifications, loading]
  );

  /* SORTED using useMemo — only recalcs on notifications change */
  const sorted = useMemo(
    () =>
      [...notifications].sort(
        (a, b) =>
          +new Date(b.created_at) - +new Date(a.created_at)
      ),
    [notifications]
  );

  return (
    <Sheet open={isOpen} onOpenChange={close}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-sm"
        hideCloseButton
      >
        <SheetHeader className="border-b bg-gradient-to-r from-background to-muted/50 p-4">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" onClick={close}>
              <ArrowRight />
            </Button>

            <SheetTitle className="flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* NOTIFICATION LIST */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bell className="h-12 w-12 opacity-40 mb-3" />
              <p className="text-lg font-medium">All caught up!</p>
            </div>
          ) : (
            <div className="pb-10 pt-2">
              {sorted.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onAccept={fastAccept}
                  onReject={fastReject}
                  onDelete={fastDelete}
                  isLoading={loading.has(n.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        {sorted.length > 0 && (
          <div className="border-t p-4 text-sm flex justify-between">
            <span className="text-muted-foreground">
              {sorted.length} notifications
            </span>

            <Button
              size="sm"
              variant="outline"
              onClick={() => startTransition(fetchNotifications)}
            >
              Refresh
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
