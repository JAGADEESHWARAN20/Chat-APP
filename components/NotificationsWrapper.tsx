"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Bell } from "lucide-react";
import Notifications from "./Notifications";

export default function NotificationsWrapper() {
     const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

     return (
          <div className="relative">
               <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsNotificationsOpen(true)}
                    className="relative"
               >
                    <Bell className="h-5 w-5" />
               </Button>
               <Notifications
                    isOpen={isNotificationsOpen}
                    onClose={() => setIsNotificationsOpen(false)}
               />
          </div>
     );
}
