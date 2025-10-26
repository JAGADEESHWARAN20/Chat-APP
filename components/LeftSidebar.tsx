"use client";

import React, { useState, useEffect, useMemo, memo } from "react";
import { RoomWithMembershipCount, useRoomContext } from "@/lib/store/RoomContext";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ChevronRight, MessageSquare, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "./ui/button";

const LeftSidebar = memo(function LeftSidebar({
  user,
  isOpen,
  onClose,
}: {
  user: any;
  isOpen: boolean;
  onClose?: () => void;
}) {
  const { state, fetchAvailableRooms, setSelectedRoom } = useRoomContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [directChats] = useState<RoomWithMembershipCount[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchAvailableRooms();
    }
  }, [user, fetchAvailableRooms]);

  const filteredRooms = useMemo(() => 
    state.availableRooms.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [state.availableRooms, searchTerm]
  );

  const filteredChats = useMemo(() => 
    directChats.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [directChats, searchTerm]
  );

  const allItems = useMemo(() => 
    [...filteredRooms, ...filteredChats], 
    [filteredRooms, filteredChats]
  );

  const renderItem = (item: RoomWithMembershipCount) => (
    <div
      key={item.id}
      className={`flex items-start p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
        state.selectedRoom?.id === item.id
          ? "bg-primary/10 dark:bg-primary/20"
          : "hover:bg-muted dark:hover:bg-muted/50"
      }`}
      onClick={() => setSelectedRoom(item)}
    >
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarImage 
          src={`/avatars/${item.id}.png`} 
          alt={item.name} 
        />
      </Avatar>
      
      <div className="ml-3 flex-1 min-w-0">
        {/* Room name and notification count */}
        <div className="flex items-center justify-between mb-1">
          <div className="font-semibold text-foreground truncate">
            #{item.name}
          </div>
          {(item.unreadCount ?? 0) > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-1 min-w-5 h-5 flex items-center justify-center">
                {(item.unreadCount ?? 0) > 99 ? '99+' : item.unreadCount}
              </span>
            </div>
          )}
        </div>

        {/* Latest message */}
        <div className="text-sm text-muted-foreground truncate mb-2">
          {item.latestMessage || "No messages yet"}
        </div>

        {/* User count and status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>
              {item.totalUsers || 0} {item.totalUsers === 1 ? 'user' : 'users'}
              {item.onlineUsers && item.onlineUsers > 0 && (
                <span className="text-green-600 ml-1">
                  ({item.onlineUsers} online)
                </span>
              )}
            </span>
          </div>
          
          {/* Membership status badge */}
          {item.isMember && (
            <div className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full px-2 py-1">
              Joined
            </div>
          )}
          {item.participationStatus === 'pending' && (
            <div className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 rounded-full px-2 py-1">
              Pending
            </div>
          )}
        </div>

        {/* Creation date */}
        <div className="text-xs text-muted-foreground mt-1">
          Created: {new Date(item.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`fixed lg:static inset-y-0 left-0 w-full lg:w-1/4 px-4 py-3 bg-card border-r border-border/40 h-screen flex flex-col transition-transform duration-300 transform ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } z-50 lg:z-0`}
    >
      <Tabs defaultValue="rooms" className="w-full mt-0 lg:mt-0 flex flex-col gap-[.1em]">
        <div className="flex gap-[.2em] items-center">
          <TabsList className="grid w-full grid-cols-3 mb-1">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>
          {onClose && (
            <Button
              onClick={onClose}
              className="p-2 rounded-full bg-background/80 hover:bg-muted transition-colors lg:hidden"
              aria-label="Close sidebar"
            >
              <ChevronRight className="h-5 w-5 text-foreground rotate-180 duration-200 transition-all" />
            </Button>
          )}
        </div>
        <input
          type="text"
          placeholder="Search rooms..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 mb-1 border border-input rounded-lg focus:ring-2 focus:ring-primary outline-none bg-background text-foreground placeholder-muted-foreground"
        />
        
        <TabsContent value="all">
          <div className="space-y-2 flex-1 overflow-y-auto scrollbar-thin">
            {allItems.length > 0 ? (
              allItems.map(renderItem)
            ) : (
              <div className="text-muted-foreground text-center mt-10">
                No items found. Try creating one!
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="rooms">
          <div className="space-y-2 flex-1 overflow-y-auto scrollbar-thin">
            {state.isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-muted-foreground text-center mt-10">
                No rooms found. Try creating one!
              </div>
            ) : (
              filteredRooms.map(renderItem)
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="chats">
          <div className="space-y-2 flex-1 overflow-y-auto scrollbar-thin">
            {filteredChats.length > 0 ? (
              filteredChats.map(renderItem)
            ) : (
              <div className="text-muted-foreground text-center mt-10">
                No chats found. Start a new chat!
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

LeftSidebar.displayName = "LeftSidebar";

export default LeftSidebar;