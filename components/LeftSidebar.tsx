"use client";

import React, { useState, useEffect } from "react";
import { RoomWithMembershipCount, useRoomContext } from "@/lib/store/RoomContext";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

export default function LeftSidebar({ user, isOpen }: { user: any; isOpen: boolean }) {
  const { state, fetchAvailableRooms, setSelectedRoom } = useRoomContext();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user?.id) fetchAvailableRooms();
  }, [user, fetchAvailableRooms]);

  const filteredRooms = state.availableRooms.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderItem = (item: RoomWithMembershipCount) => (
    <div
      key={item.id}
      className={`flex items-center p-2 rounded cursor-pointer transition-colors duration-200 ${
        state.selectedRoom?.id === item.id
          ? "bg-blue-100 dark:bg-blue-900/50"
          : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
      onClick={() => setSelectedRoom(item)}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={`/avatars/${item.id}.png`} alt={item.name} />
      </Avatar>
      <div className="ml-2 flex-1">
        <div className="font-medium text-foreground">{item.name}</div>
        <div className="text-sm text-muted-foreground">Members: {item.memberCount}</div>
        <div className="text-xs text-muted-foreground">
          Created: {new Date(item.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`fixed lg:static inset-y-0 left-0 w-3/4 lg:w-1/4 p-4 bg-background border-r border-border/40 h-screen flex flex-col transition-transform duration-300 transform ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } z-50 lg:z-0`}
    >
      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search rooms..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 mb-4 border border-input rounded focus:ring-2 focus:ring-primary outline-none bg-background text-foreground placeholder-muted-foreground"
      />

      {/* Rooms List */}
      <div className="space-y-2 flex-1 overflow-y-auto scrollbar-thin">
        {state.isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-muted-foreground text-center mt-10">
            No rooms found. Try creating one!
          </div>
        ) : (
          filteredRooms.map((item) => renderItem(item))
        )}
      </div>
    </div>
  );
}