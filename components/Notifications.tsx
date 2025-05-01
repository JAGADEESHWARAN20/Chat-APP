"use client";

import { useEffect, useState } from "react";
import { useNotification } from "@/lib/store/notifications";
import { useUser } from "@/lib/store/user";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { useRouter } from "next/navigation";

interface NotificationsProps {
     isOpen: boolean;
     onClose: () => void;
}

export default function Notifications({ isOpen, onClose }: NotificationsProps) {
     const user = useUser((state) => state.user);
     const { notifications, setNotifications, markAsRead, subscribeToNotifications, unsubscribeFromNotifications } = useNotification();
     const router = useRouter();

     const fetchNotifications = async () => {
          try {
               const response = await fetch("/api/notifications");
               if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to fetch notifications");
               }
               const { notifications: fetchedNotifications } = await response.json();
               setNotifications(fetchedNotifications);
          } catch (error) {
               toast.error(error instanceof Error ? error.message : "Failed to fetch notifications");
               console.error("Error fetching notifications:", error);
          }
     };

     const handleAccept = async (notificationId: string, roomId: string) => {
          try {
               const response = await fetch(`/api/notifications/${notificationId}/accept`, {
                    method: "POST",
               });
               if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to accept invitation");
               }
               markAsRead(notificationId);
               router.push(`/rooms/${roomId}`);
               onClose();
          } catch (error) {
               toast.error(error instanceof Error ? error.message : "Failed to accept invitation");
               console.error("Error accepting invitation:", error);
          }
     };

     const handleMarkAsRead = async (notificationId: string) => {
          try {
               const response = await fetch(`/api/notifications/${notificationId}/read`, {
                    method: "POST",
               });
               if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to mark as read");
               }
               markAsRead(notificationId);
          } catch (error) {
               toast.error(error instanceof Error ? error.message : "Failed to mark as read");
               console.error("Error marking as read:", error);
          }
     };

     useEffect(() => {
          if (user?.id) {
               fetchNotifications();
               subscribeToNotifications(user.id);
          }
          return () => {
               unsubscribeFromNotifications();
          };
     }, [user?.id, fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications]);

     return (
          <Dialog open={isOpen} onOpenChange={onClose}>
               <DialogContent className="bg-gray-800 text-white">
                    <DialogHeader>
                         <DialogTitle>Notifications</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                         {notifications.length === 0 ? (
                              <p>No notifications</p>
                         ) : (
                              notifications.map((notif) => (
                                   <div key={notif.id} className={`p-2 rounded flex items-center gap-3 ${notif.is_read ? "bg-gray-800" : "bg-gray-700"}`}>
                                        <Avatar>
                                             <AvatarImage src={notif.users?.avatar_url} />
                                             <AvatarFallback>{notif.users?.display_name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                             <p>{notif.content}</p>
                                             <p className="text-sm text-gray-400">{new Date(notif.created_at).toLocaleString()}</p>
                                        </div>
                                        {notif.type === "room_invite" && !notif.is_read && (
                                             <Button onClick={() => handleAccept(notif.id, notif.room_id!)}>Accept</Button>
                                        )}
                                        {!notif.is_read && (
                                             <Button variant="outline" onClick={() => handleMarkAsRead(notif.id)}>
                                                  Mark as Read
                                             </Button>
                                        )}
                                   </div>
                              ))
                         )}
                    </div>
               </DialogContent>
          </Dialog>
     );
}