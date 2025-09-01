"use client";

import React, { useState, useEffect } from "react";
import { RoomWithMembershipCount, useRoomContext } from "@/lib/store/RoomContext";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "./ui/button";

export default function LeftSidebar({
  user,
  isOpen,
  onClose, // 🔹 new prop for closing
}: {
  user: any;
  isOpen: boolean;
  onClose?: () => void;
}) {
  const { state, fetchAvailableRooms, setSelectedRoom } = useRoomContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [tabValue, setTabValue] = useState("rooms");
  const [directChats, setDirectChats] = useState<RoomWithMembershipCount[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchAvailableRooms();
    }
  }, [user, fetchAvailableRooms]);

  const filteredRooms = state.availableRooms.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredChats = directChats.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allItems = [...filteredRooms, ...filteredChats];

  const renderItem = (item: RoomWithMembershipCount) => (
    <div
      key={item.id}
      className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
        state.selectedRoom?.id === item.id
          ? "bg-primary/10 dark:bg-primary/20"
          : "hover:bg-muted dark:hover:bg-muted/50"
      }`}
      onClick={() => setSelectedRoom(item)}
    >
      <Avatar className="h-12 w-12">
        <AvatarImage src={`/avatars/${item.id}.png`} alt={item.name} />
      </Avatar>
      <div className="ml-4 flex-1">
        <div className="font-semibold text-foreground">{item.name}</div>
        <div className="text-sm text-muted-foreground">Members: {item.memberCount}</div>
        <div className="text-xs text-muted-foreground">
          Created: {new Date(item.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`fixed lg:static inset-y-0 left-0 w-full lg:w-1/4 p-[.5em] bg-card border-r border-border/40 h-screen flex flex-col transition-transform duration-300 transform ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } z-50 lg:z-0`}
    >
      <Tabs defaultValue="rooms" className="w-full mt-10 lg:mt-0 flex flex-col gap-[.1em]" onValueChange={setTabValue}>
        <div className="flex gap-[.2em] items-center">
          <TabsList className="grid w-full grid-cols-3 mb-1">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="chats">Chats</TabsTrigger>
        </TabsList>
        {/* 🔹 Close button (mobile only) */}
      {onClose && (
        <Button
          onClick={onClose}
          className="p-2 rounded-full bg-background/80 hover:bg-muted transition-colors lg:hidden"
          aria-label="Close sidebar"
            >
              <ChevronRight className="h-5 w-5 text-foreground rotate-90 duration-200 transition-all" />
        </Button>
      )}
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 mb-1 border border-input rounded-lg focus:ring-2 focus:ring-primary outline-none bg-background text-foreground placeholder-muted-foreground"
        />
        <TabsContent value="all">
          <div className="space-y-4 flex-1 overflow-y-auto scrollbar-thin">
            {allItems.length > 0 ? (
              allItems.map((item) => renderItem(item))
            ) : (
              <div className="text-muted-foreground text-center mt-10">
                No items found. Try creating one!
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="rooms">
          <div className="space-y-4 flex-1 overflow-y-auto scrollbar-thin">
            {state.isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-muted-foreground text-center mt-10">
                No rooms found. Try creating one!
              </div>
            ) : (
              filteredRooms.map((item) => renderItem(item))
            )}
          </div>
        </TabsContent>
        <TabsContent value="chats">
          <div className="space-y-4 flex-1 overflow-y-auto scrollbar-thin">
            {filteredChats.length > 0 ? (
              filteredChats.map((item) => renderItem(item))
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
}
