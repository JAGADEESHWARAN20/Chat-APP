// components/Notifications.tsx
"use client";

import React, {
  memo,
  useCallback,
  useMemo,
  useState,
  useTransition,
  Fragment,
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
  MoreHorizontal,
} from "lucide-react";

import {
  useNotifications,
  useUnreadCount,
  useRoomActions,
  useUnifiedStore,
  type NotificationData,
} from "@/lib/store/unified-roomstore";

import { cn } from "@/lib/utils";

/* ===================================================================
   Helpers
   =================================================================== */
const NEEDS_ACTION = new Set(["join_request", "room_invite"]);

function formatNotification(n: NotificationData) {
  const sender =
    (n.sender as any) || (n.users as any) || null;

  const senderName =
    sender?.display_name || sender?.username || "Someone";

  const roomName = n.rooms?.name || "a room";

  if (n.type === "room_invite") {
    return {
      icon: <UserPlus className="h-4 w-4" />,
      title: `${senderName} invited you to ${roomName}`,
    };
  }
  if (n.type === "join_request") {
    return {
      icon: <Mail className="h-4 w-4" />,
      title: `${senderName} wants to join ${roomName}`,
    };
  }
  if (n.type === "user_joined") {
    return {
      icon: <UserCheck className="h-4 w-4" />,
      title: `${senderName} joined ${roomName}`,
    };
  }
  if (n.type === "join_request_accepted") {
    return {
      icon: <UserCheck className="h-4 w-4" />,
      title: `You're now in ${roomName}!`,
    };
  }

  return {
    icon: <Bell className="h-4 w-4" />,
    title: n.message ?? "New notification",
  };
}

/* ===================================================================
   Per-item dropdown (simple)
   =================================================================== */
function ItemMenu({
  onAccept,
  onReject,
  onDelete,
  showAcceptReject,
  loading,
}: {
  onAccept: () => void;
  onReject: () => void;
  onDelete: () => void;
  showAcceptReject: boolean;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-2 rounded-md hover:bg-muted/40"
        title="More"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 z-40 mt-2 w-40 rounded-md border bg-card shadow-lg py-1"
        >
          {showAcceptReject && (
            <Fragment>
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onAccept();
                }}
                disabled={loading}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/30"
              >
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Accept
                </span>
              </button>

              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onReject();
                }}
                disabled={loading}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/30"
              >
                <span className="inline-flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Reject
                </span>
              </button>

              <div className="border-t my-1" />
            </Fragment>
          )}

          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            disabled={loading}
            className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Delete
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ===================================================================
   NotificationRow - memoized, only re-renders on prop change
   =================================================================== */
const NotificationRow = memo(function NotificationRow({
  notification,
  showCheckbox,
  checked,
  onToggleChecked,
  onAccept,
  onReject,
  onDelete,
  loading,
}: {
  notification: NotificationData;
  showCheckbox: boolean;
  checked: boolean;
  onToggleChecked: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  const { icon, title } = useMemo(() => formatNotification(notification), [notification]);
  const sender =
    (notification.sender as any) || (notification.users as any) || null;
  const avatar = sender?.avatar_url ?? "";
  const displayName = sender?.display_name || sender?.username || "Someone";

  const [expanded, setExpanded] = useState(false);
  const needsAction = NEEDS_ACTION.has(notification.type);

  return (
    <div className="border-b border-border/40">
      <div className="flex items-center gap-3 px-1 py-1">
        {/* Checkbox column */}
        <div className="flex-shrink-0 w-10 flex items-center justify-center">
          {showCheckbox ? (
            <input
              aria-label={`Select notification ${notification.id}`}
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                e.stopPropagation();
                onToggleChecked(notification.id);
              }}
              className="h-4 w-4"
            />
          ) : null}
        </div>

        {/* Avatar */}
        <div
          onClick={() => setExpanded((s) => !s)}
          className={cn(
            "flex-1 flex items-start gap-3 cursor-pointer",
            "transition-colors"
          )}
        >
          <Avatar className="h-10 w-10 border shadow-sm flex-shrink-0">
            <AvatarImage src={avatar} />
            <AvatarFallback>{displayName[0]?.toUpperCase() ?? "?"}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex items-start gap-2 text-sm font-medium">
              <div className="flex items-center gap-2 text-sm truncate">
                <span className="mr-1">{icon}</span>
                <span className="truncate">{title}</span>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {/* unread badge */}
                {notification.status !== "read" && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                    New
                  </span>
                )}
              </div>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(notification.created_at).toLocaleString()}
            </p>

            {/* Expanded content */}
            {expanded && (
              <div className="mt-2 text-sm text-muted-foreground">
                <div className="mb-2 break-words">
                  {notification.message ?? "No extra details."}
                </div>
                <div className="flex gap-2">
                  {needsAction && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject(notification.id);
                        }}
                        disabled={loading}
                        className="flex-1"
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAccept(notification.id);
                        }}
                        disabled={loading}
                        className="flex-1"
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Accept
                      </Button>
                    </>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(notification.id);
                    }}
                    disabled={loading}
                    className="ml-auto"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right actions (three-dot dropdown) */}
        <div className="flex-shrink-0 ml-2">
          <ItemMenu
            onAccept={() => onAccept(notification.id)}
            onReject={() => onReject(notification.id)}
            onDelete={() => onDelete(notification.id)}
            showAcceptReject={needsAction}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
});

/* ===================================================================
   Main Notifications component
   =================================================================== */
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
    if (externalOnClose) externalOnClose();
    else setInternalOpen(false);
  }, [externalOnClose]);

  // store selectors
  const notifications = useNotifications();
  const unreadCount = useUnreadCount();
  const removeNotification = useUnifiedStore((s) => s.removeNotification);
  const fetchNotifications = useUnifiedStore((s) => s.fetchNotifications);
  const { acceptJoinRequest } = useRoomActions();

  const [isPending, startTransition] = useTransition();
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anySelected = selected.size > 0;

  const setLoad = useCallback((id: string, val: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (val) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // toggle single selection
  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // select all toggle
  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === notifications.length) return new Set();
      return new Set(notifications.map((x) => x.id));
    });
  }, [notifications]);

  // fast optimistic reject
  const fastReject = useCallback(
    async (id: string) => {
      if (loadingIds.has(id)) return;
      setLoad(id, true);
      // optimistic remove so UI & other components update instantly
      removeNotification(id);

      try {
        // call API
        await fetch(`/api/notifications/${id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch (err) {
        console.error("reject error", err);
        // recovery: re-fetch notifications to restore canonical state
        await fetchNotifications();
      } finally {
        setLoad(id, false);
      }
    },
    [loadingIds, removeNotification, fetchNotifications, setLoad]
  );

  // fast optimistic delete
  const fastDelete = useCallback(
    async (id: string) => {
      if (loadingIds.has(id)) return;
      setLoad(id, true);
      // optimistic remove
      removeNotification(id);

      try {
        const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete failed");
      } catch (err) {
        console.error("delete error", err);
        await fetchNotifications();
      } finally {
        setLoad(id, false);
      }
    },
    [loadingIds, removeNotification, fetchNotifications, setLoad]
  );

  // fast optimistic accept (uses store action)
  const fastAccept = useCallback(
    async (id: string) => {
      if (loadingIds.has(id)) return;
      setLoad(id, true);
      const n = notifications.find((x) => x.id === id);
      try {
        if (!n?.room_id) throw new Error("no room");
        // call action (this action already handles store changes and server call)
        await acceptJoinRequest(id, n.room_id);
      } catch (err) {
        console.error("accept error", err);
        await fetchNotifications();
      } finally {
        setLoad(id, false);
      }
    },
    [loadingIds, notifications, acceptJoinRequest, fetchNotifications, setLoad]
  );

  // bulk delete (optimistic)
  const bulkDelete = useCallback(
    async () => {
      if (!selected.size) return;
      // snapshot selected
      const ids = Array.from(selected);
      // optimistic remove
      ids.forEach((id) => removeNotification(id));
      // clear selection
      setSelected(new Set());

      // call deletions concurrently but don't fail the whole UI
      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`delete ${id} failed`);
          } catch (err) {
            console.error("bulk delete error for", id, err);
            // re-fetch to recover canonical state
            await fetchNotifications();
          }
        })
      );
    },
    [selected, removeNotification, fetchNotifications]
  );

  // sorted notifications memo
  const sorted = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
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
          <div className="flex items-center gap-3 w-full">
            <div className="flex items-center gap-3 flex-1">
              <input
                aria-label="Select all notifications"
                type="checkbox"
                checked={sorted.length > 0 && selected.size === sorted.length}
                onChange={toggleSelectAll}
                className="h-4 w-4"
              />
              <SheetTitle className="flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </SheetTitle>
            </div>

            <div className="flex items-center gap-1">
              {anySelected && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={bulkDelete}
                  className="mr-1"
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete ({selected.size})
                </Button>
              )}

              <Button
                size="icon"
                variant="ghost"
                onClick={() => startTransition(() => fetchNotifications())}
                title="Refresh"
              >
                <Loader2 className="h-[1em] w-[1em] p-0" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={close}
                title="Close"
              >
                <ArrowRight className="h-[1.5em] w-[1.5em] p-0" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center p-8 text-muted-foreground">
              <Bell className="mb-4 h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">All caught up</p>
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            <div className="pb-[2em] pt-1">
              {sorted.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  showCheckbox={true}
                  checked={selected.has(n.id)}
                  onToggleChecked={toggleSelected}
                  onAccept={fastAccept}
                  onReject={fastReject}
                  onDelete={fastDelete}
                  loading={loadingIds.has(n.id)}
                />
              ))}
            </div>
          )}
        </div>

        {sorted.length > 0 && (
          <div className="border-t p-4 text-sm flex justify-between items-center">
            <span className="text-muted-foreground">
              {sorted.length} notifications
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => startTransition(() => fetchNotifications())}
              >
                Refresh
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
