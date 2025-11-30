"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import Notifications from "./Notifications";
import { useNotificationHandler } from "@/hooks/useNotificationHandler";
import { useUser } from "@/lib/store/user";
import { useNotifications } from "@/lib/store/notifications"; // ✅ correct import
import { cn } from "@/lib/utils";

export default function NotificationsWrapper() {
  const [isOpen, setIsOpen] = useState(false);
  const { user: currentUser, authUser } = useUser();

  // ✅ NEW API FROM STORE
  const {
    unread,           // replaces unreadCount
    fetch: fetchNotifications, // replaces fetchNotifications
    hasError,
  } = useNotifications();

  const userId = currentUser?.id || authUser?.id;

  useNotificationHandler();

  // 🔁 Fetch on open
  useEffect(() => {
    if (isOpen && userId) fetchNotifications(userId);
  }, [isOpen, userId, fetchNotifications]);

  const handleClick = () => {
    if (!userId) {
      window.location.href = "/auth/signin";
      return;
    }
    setIsOpen(true);
  };

  return (
    <div className="relative">
      {/* ============================
       🔔 Notification Trigger Button
      ============================ */}
      <motion.button
        title="Notifications"
        aria-label={`Notifications ${unread > 0 ? `${unread} unread` : ""}`}
        onClick={handleClick}
        disabled={!userId}
        whileTap={{ scale: 1 }}
        whileHover={{ scale: 1 }}
        className={cn(
          "relative flex items-center justify-center rounded-full",
          "w-[2.6em] h-[2.6em] transition-all duration-300 shadow-sm",
          "bg-[var(--action-bg)] border border-[var(--action-ring)] hover:bg-[var(--action-hover)] hover:shadow-lg",
          !userId && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* 🔴 Glow animation */}
        <AnimatePresence>
          {unread > 0 && (
            <motion.div
              key="glow"
              className="absolute inset-0 rounded-full bg-[var(--action-active)]/20 blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.8 }}
            />
          )}
        </AnimatePresence>

        {/* 🔔 Bell Icon */}
        <Bell
          className={cn(
            "relative z-10 h-[2em] w-[2em] transition-colors duration-200",
            unread > 0
              ? "stroke-[var(--action-active)] fill-[var(--action-active)]"
              : "stroke-[var(--action-text)]"
          )}
        />

        {/* Unread badge */}
        <AnimatePresence>
          {unread > 0 && userId && (
            <motion.span
              key="badge"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center",
                "rounded-full bg-[var(--action-active)] text-white text-xs font-semibold shadow-md"
              )}
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Ping indicator for errors */}
        {hasError && userId && (
          <span className="absolute -top-1 -right-1 h-2 w-2 animate-ping rounded-full bg-red-500" />
        )}
      </motion.button>

      {/* ============================
       📜 Notifications Drawer
      ============================ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="notification-panel"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="absolute right-0 z-50 mt-3 w-[22rem] sm:w-[24rem]"
          >
            <Notifications isOpen={isOpen} onClose={() => setIsOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
