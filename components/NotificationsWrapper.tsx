"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import Notifications from "./Notifications";
import { useUser } from "@/lib/store/user";
import { useUnreadCount, useUnifiedStore } from "@/lib/store/unified-roomstore";
import { cn } from "@/lib/utils";

export default function NotificationsWrapper() {
  const [isOpen, setIsOpen] = useState(false);

  const { user: currentUser, authUser } = useUser();
  const userId = currentUser?.id || authUser?.id;

  const unread = useUnreadCount();
  const fetchNotifications = useUnifiedStore((s) => s.fetchNotifications);

  useEffect(() => {
    if (isOpen && userId) {
      fetchNotifications();
    }
  }, [isOpen, userId, fetchNotifications]);

  const handleClick = useCallback(() => {
    if (!userId) {
      window.location.href = "/auth/signin";
      return;
    }
    setIsOpen(true);
  }, [userId]);

  return (
    <div className="relative">
      {/* ================= TRIGGER BUTTON (UI MATCHED) ================ */}
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
          "backdrop-blur-xl",

          // Theme-aware backgrounds
          "bg-[hsl(var(--background)/0.6)] border border-[hsl(var(--border)/0.3)]",
          "hover:bg-[hsl(var(--accent)/0.3)] hover:shadow-md",

          !userId && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Glow animation when unread exists */}
        <AnimatePresence>
          {unread > 0 && (
            <motion.div
              key="glow"
              className="absolute inset-0 rounded-full blur-lg"
              style={{
                backgroundColor: "hsl(var(--primary)/0.25)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.25, 0.4, 0.25] }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.8 }}
            />
          )}
        </AnimatePresence>

        {/* Bell Icon */}
        <Bell
          className={cn(
            "relative z-10 h-[1.7em] w-[1.7em] transition-colors",
            unread > 0
              ? "stroke-[hsl(var(--primary))]"
              : "stroke-[hsl(var(--foreground))]"
          )}
        />

        {/* Unread Badge */}
        <AnimatePresence>
          {unread > 0 && userId && (
            <motion.span
              key="badge"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "absolute -top-1.5 -right-1.5 min-w-[1.2rem] h-5 px-1 flex items-center justify-center",
                "rounded-full text-white text-xs font-semibold shadow-md"
              )}
              style={{
                backgroundColor: "hsl(var(--primary))",
              }}
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ================= NOTIFICATION PANEL ================ */}
      <AnimatePresence>
        {isOpen && userId && (
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
