"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Bell } from "lucide-react";
import Notifications from "./Notifications";

export default function NotificationsWrapper() {
     const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

     return (
          <div className="relative">
               <button
                    title="notification"
                    onClick={() => setIsNotificationsOpen(true)}
                    className="w-[2em] h-[2em] flex items-center p-[.35em]"
               >
                    <Bell className="h-5 w-5" />
               </button>
               <Notifications
                    isOpen={isNotificationsOpen}
                    onClose={() => setIsNotificationsOpen(false)}
               />
          </div>
     );
}
