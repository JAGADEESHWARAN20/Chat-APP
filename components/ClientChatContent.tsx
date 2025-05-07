"use client";

import React, { useState, useEffect } from "react";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import ChatAbout from "@/components/ChatAbout";
import { useRoomStore } from "@/lib/store/roomstore";
import { useDirectChatStore } from "@/lib/store/directChatStore";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useRecentActions } from "@/lib/store/recentActions"; // Hypothetical store for recent actions
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { MessageSquare } from "lucide-react";

export default function ClientChatContent({ user }: { user: SupabaseUser | undefined }) {
     const selectedRoom = useRoomStore((state) => state.selectedRoom);
     const selectedChat = useDirectChatStore((state) => state.selectedChat);
     const [activeTab, setActiveTab] = useState<"home" | "rooms" | "activity">("home");
     const recentActions = useRecentActions((state) => state.recentActions); // Hypothetical store
     const availableRooms = useRoomStore((state) => state.rooms);
     const activityItems = useRecentActions((state) => state.activityItems); // Hypothetical store

     // Sync activeTab with ChatHeader (you might need to lift this state up or use a global store)
     useEffect(() => {
          const handleTabChange = (tab: "home" | "rooms" | "activity") => setActiveTab(tab);
          // Add event listener or use a store to sync tabs between components
     }, []);

     return (
          <div className="flex-1 flex flex-col bg-gray-900 text-white">
               {selectedRoom || selectedChat ? (
                    <>
                         <div className="flex-1 overflow-y-auto">
                              <ChatMessages />
                         </div>
                         <ChatInput />
                    </>
               ) : (
                    <div className="flex-1 p-4 overflow-y-auto">
                         {activeTab === "home" && (
                              <>
                                   <h2 className="text-xl font-bold mb-4">Recent Actions</h2>
                                   {recentActions.length === 0 ? (
                                        <p className="text-gray-400">No recent actions.</p>
                                   ) : (
                                        <ul className="space-y-3">
                                             {recentActions.map((action) => (
                                                  <li
                                                       key={action.id}
                                                       className="p-3 bg-gray-800 rounded-md hover:bg-gray-700 cursor-pointer"
                                                       onClick={() => {
                                                            if (action.type === "room") {
                                                                 const room = availableRooms.find((r) => r.name === action.name);
                                                                 if (room) useRoomStore.getState().setSelectedRoom(room);
                                                            } else {
                                                                 // Handle direct chat selection
                                                            }
                                                       }}
                                                  >
                                                       <div className="flex items-center gap-2">
                                                            <MessageSquare className="h-5 w-5 text-gray-400" />
                                                            <div>
                                                                 <p className="text-sm font-medium">{action.name}</p>
                                                                 <p className="text-xs text-gray-400">{action.lastMessage}</p>
                                                                 <p className="text-xs text-gray-500">
                                                                      {new Date(action.timestamp).toLocaleTimeString()}
                                                                 </p>
                                                            </div>
                                                       </div>
                                                  </li>
                                             ))}
                                        </ul>
                                   )}
                              </>
                         )}
                         {activeTab === "rooms" && (
                              <>
                                   <h2 className="text-xl font-bold mb-4">Rooms</h2>
                                   {availableRooms.length === 0 ? (
                                        <p className="text-gray-400">No rooms available.</p>
                                   ) : (
                                        <ul className="space-y-3">
                                             {availableRooms.map((room) => (
                                                  <li
                                                       key={room.id}
                                                       className="p-3 bg-gray-800 rounded-md hover:bg-gray-700 cursor-pointer"
                                                       onClick={() => useRoomStore.getState().setSelectedRoom(room)}
                                                  >
                                                       <div className="flex items-center gap-2">
                                                            <MessageSquare className="h-5 w-5 text-gray-400" />
                                                            <span className="text-sm font-medium">
                                                                 {room.name} {room.is_private && "🔒"}
                                                            </span>
                                                       </div>
                                                  </li>
                                             ))}
                                        </ul>
                                   )}
                              </>
                         )}
                         {activeTab === "activity" && (
                              <>
                                   <h2 className="text-xl font-bold mb-4">Activity</h2>
                                   {activityItems.length === 0 ? (
                                        <p className="text-gray-400">No activity available.</p>
                                   ) : (
                                        <ul className="space-y-3">
                                             {activityItems.map((item) =>
                                                  "name" in item ? (
                                                       <li
                                                            key={item.id}
                                                            className="p-3 bg-gray-800 rounded-md hover:bg-gray-700 cursor-pointer"
                                                            onClick={() => useRoomStore.getState().setSelectedRoom(item)}
                                                       >
                                                            <div className="flex items-center gap-2">
                                                                 <MessageSquare className="h-5 w-5 text-gray-400" />
                                                                 <span className="text-sm font-medium">
                                                                      {item.name} {item.is_private && "🔒"}
                                                                 </span>
                                                            </div>
                                                       </li>
                                                  ) : (
                                                       <li
                                                            key={item.id}
                                                            className="p-3 bg-gray-800 rounded-md hover:bg-gray-700 cursor-pointer"
                                                            onClick={() =>
                                                                 useDirectChatStore.getState().setSelectedChat({
                                                                      id: crypto.randomUUID(),
                                                                      other_user_id: item.id,
                                                                      users: item,
                                                                 })
                                                            }
                                                       >
                                                            <div className="flex items-center gap-2">
                                                                 <Avatar className="h-8 w-8">
                                                                      {item.avatar_url ? (
                                                                           <AvatarImage src={item.avatar_url} alt={item.username || "Avatar"} />
                                                                      ) : (
                                                                           <AvatarFallback className="bg-gray-600 text-white">
                                                                                {item.username?.charAt(0).toUpperCase() ||
                                                                                     item.display_name?.charAt(0).toUpperCase() ||
                                                                                     "?"}
                                                                           </AvatarFallback>
                                                                      )}
                                                                 </Avatar>
                                                                 <div>
                                                                      <p className="text-sm font-medium">{item.display_name}</p>
                                                                      <p className="text-xs text-gray-400">@{item.username}</p>
                                                                 </div>
                                                            </div>
                                                       </li>
                                                  )
                                             )}
                                        </ul>
                                   )}
                              </>
                         )}
                    </div>
               )}
          </div>
     );
}