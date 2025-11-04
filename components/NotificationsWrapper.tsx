// components/NotificationsWrapper.tsx - Updated for your user store
"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import Notifications from "./Notifications";
import { useNotificationHandler } from "@/hooks/useNotificationHandler";
import { useUser } from "@/lib/store/user"; // Your actual user store
import { useNotification } from "@/lib/store/notifications";
import { cn } from "@/lib/utils";

export default function NotificationsWrapper() {
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const { user: currentUser, authUser } = useUser(); // Use your store structure
    const { unreadCount, fetchNotifications, hasError } = useNotification();
    
    // Initialize notification handler
    useNotificationHandler();

    // Get the actual user ID
    const userId = currentUser?.id || authUser?.id;

    // Add comprehensive logging
    useEffect(() => {
        console.log("🔔 NotificationsWrapper - User state:", {
            userId,
            currentUser: currentUser ? { id: currentUser.id, email: currentUser.email } : null,
            authUser: authUser ? { id: authUser.id, email: authUser.email } : null,
            unreadCount
        });
    }, [userId, currentUser, authUser, unreadCount]);

    // Auto-refresh notifications when sheet opens
    useEffect(() => {
        if (isNotificationsOpen && userId) {
            console.log("🔄 Refreshing notifications on open");
            fetchNotifications(userId);
        }
    }, [isNotificationsOpen, userId, fetchNotifications]);

    const handleBellClick = () => {
        console.log("🔔 Bell icon clicked - User:", {
            userId,
            userEmail: currentUser?.email || authUser?.email
        });
        
        if (!userId) {
            console.log("🚫 No user - redirecting to sign in");
            // Redirect to sign in
            window.location.href = '/auth/signin';
            return;
        }
        
        setIsNotificationsOpen(true);
    };

    return (
        <div className="relative">
            <button
                title="notification"
                onClick={handleBellClick}
                className={cn(
                    "w-[2em] h-[2em] flex items-center justify-center p-[.35em] relative group transition-all duration-200",
                    !userId && "opacity-50 cursor-not-allowed"
                )}
                aria-label={`Notifications ${unreadCount > 0 ? `${unreadCount} unread` : ''}`}
                disabled={!userId}
            >
                <Bell className={cn(
                    "h-5 w-5 transition-all duration-200",
                    unreadCount > 0 
                        ? "text-blue-600 fill-blue-600 animate-pulse" 
                        : userId 
                            ? "hover:fill-slate-800 dark:hover:fill-slate-50" 
                            : "text-gray-400",
                    hasError && "text-red-500"
                )} />
                
                {unreadCount > 0 && userId && (
                    <span className={cn(
                        "absolute -top-1 -right-1 min-w-[1.25rem] h-5 text-xs",
                        "bg-red-500 text-white rounded-full flex items-center justify-center",
                        "font-semibold animate-bounce transition-all duration-300",
                        "px-1 transform scale-100"
                    )}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
                
                {hasError && userId && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
            </button>
            
            <Notifications
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}  // ✅ FIXED
                />

        </div>
    );
}