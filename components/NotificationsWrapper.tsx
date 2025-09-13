"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import Notifications from "./Notifications";
import { useNotificationHandler } from "@/hooks/useNotificationHandler";
import { useUser } from "@/lib/store/user";
import { useNotification } from "@/lib/store/notifications";
import { cn } from "@/lib/utils";

export default function NotificationsWrapper() {
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const { user } = useUser();
    const { notifications } = useNotification();
    
    // Initialize notification handler
    useNotificationHandler();

    // Count unread notifications
    const unreadCount = notifications.filter(n => n.status === 'unread').length;

    return (
        <div className="relative">
            <button
                title="notification"
                onClick={() => setIsNotificationsOpen(true)}
                className="w-[2em] h-[2em] flex items-center justify-center p-[.35em] relative"
            >
                <Bell className="h-5 w-5 hover:fill-slate-800 dark:hover:fill-slate-50" />
                {unreadCount > 0 && (
                    <span className={cn(
                        "absolute -top-1 -right-1 h-4 w-4 text-[10px]",
                        "bg-red-500 text-white rounded-full flex items-center justify-center",
                        "font-semibold animate-pulse"
                    )}>
                        {unreadCount}
                    </span>
                )}
            </button>
            <Notifications
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}
            />
        </div>
    );
}
