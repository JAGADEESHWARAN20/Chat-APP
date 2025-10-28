// components/NotificationsWrapper.tsx - UPDATED
"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import Notifications from "./Notifications";
import { useNotificationHandler } from "@/hooks/useNotificationHandler";
import { useUser } from "@/lib/store/user";
import { useNotification } from "@/lib/store/notifications";
import { cn } from "@/lib/utils";

export default function NotificationsWrapper() {
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const { user } = useUser();
    const { unreadCount, fetchNotifications, hasError, notifications } = useNotification();
    
    // Initialize notification handler
    useNotificationHandler();

    // Auto-refresh notifications when sheet opens
    useEffect(() => {
        if (isNotificationsOpen && user?.id) {
            console.log("🔄 Refreshing notifications on open");
            fetchNotifications(user.id);
        }
    }, [isNotificationsOpen, user?.id, fetchNotifications]);

    // Add debug logging
    useEffect(() => {
        if (notifications.length > 0) {
            console.log("🔔 Current notifications:", notifications.map(n => ({
                id: n.id,
                type: n.type,
                status: n.status,
                message: n.message
            })));
        }
    }, [notifications]);
    
    return (
        <div className="relative">
            <button
                title="notification"
                onClick={() => setIsNotificationsOpen(true)}
                className="w-[2em] h-[2em] flex items-center justify-center p-[.35em] relative group"
                aria-label={`Notifications ${unreadCount > 0 ? `${unreadCount} unread` : ''}`}
            >
                <Bell className={cn(
                    "h-5 w-5 transition-all duration-200",
                    unreadCount > 0 
                        ? "text-blue-600 fill-blue-600 animate-pulse" 
                        : "hover:fill-slate-800 dark:hover:fill-slate-50",
                    hasError && "text-red-500"
                )} />
                
                {unreadCount > 0 && (
                    <span className={cn(
                        "absolute -top-1 -right-1 min-w-[1.25rem] h-5 text-xs",
                        "bg-red-500 text-white rounded-full flex items-center justify-center",
                        "font-semibold animate-bounce transition-all duration-300",
                        "px-1 transform scale-100"
                    )}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
                
                {hasError && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
            </button>
            
            <Notifications
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}
            />
        </div>
    );
}