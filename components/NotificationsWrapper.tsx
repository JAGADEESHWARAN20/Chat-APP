"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Notifications from "./Notifications";
import { useNotificationHandler } from "@/hooks/useNotificationHandler";
import { useUser } from "@/lib/store/user";
import { useNotification } from "@/lib/store/notifications";
import { cn } from "@/lib/utils";

export default function NotificationsWrapper() {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { user: currentUser, authUser } = useUser();
  const { unreadCount, fetchNotifications, hasError } = useNotification();

  useNotificationHandler();
  const userId = currentUser?.id || authUser?.id;

  useEffect(() => {
    if (isNotificationsOpen && userId) {
      fetchNotifications(userId);
    }
  }, [isNotificationsOpen, userId, fetchNotifications]);

  const handleBellClick = () => {
    if (!userId) {
      window.location.href = "/auth/signin";
      return;
    }
    setIsNotificationsOpen(true);
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <motion.button
        title="notification"
        onClick={handleBellClick}
        disabled={!userId}
        className={cn(
          "relative w-[2.5em] h-[2.5em] group flex items-center justify-center rounded-full transition-all duration-300",
          "bg-white dark:bg-transparent backdrop-blur-sm border border-border/30 shadow-sm",
          "hover:bg-red-800 dark:hover:bg-red-600",
          !userId && "opacity-50 cursor-not-allowed group"
        )}
        aria-label={`Notifications ${unreadCount > 0 ? `${unreadCount} unread` : ""}`}
      >
        {/* Subtle glow when unread */}
        {unreadCount > 0 && (
          <motion.div
            className="absolute inset-0 rounded-full bg-red-500/20  blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
          />
        )}

        {/* Bell Icon */}
        <Bell
          className={cn(
            "h-5 w-5 relative z-10 transition-all duration-300",
            hasError
              ? "text-red-500"
              : unreadCount > 0
              ? "stroke-red-600 group-hover:stroke-white/70 dark:stroke-red-400 dark:stroke-white text-red-600 dark:text-red-400"
              : "stroke-gray-700 group-hover:stroke-white/70 dark:group-hover:stroke-white dark:stroke-gray-200",
            "group-hover:fill-white "
          )}
        />

        {/* Badge */}
        <AnimatePresence>
          {unreadCount > 0 && userId && (
            <motion.span
              key="badge"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 text-xs
                         bg-red-500 dark:bg-red-600 text-white rounded-full 
                         flex items-center justify-center font-semibold px-1 shadow-md"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Error Ping */}
        {hasError && userId && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
        )}
      </motion.button>

      {/* Notifications Dropdown */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <motion.div
            key="notification-panel"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="absolute right-0 mt-3 z-50 w-[22rem] sm:w-[24rem]"
          >
            <Notifications
              isOpen={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
