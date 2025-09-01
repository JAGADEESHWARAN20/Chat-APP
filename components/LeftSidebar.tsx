"use client";

import React, { useState, useEffect } from "react";
import { RoomWithMembershipCount, useRoomContext } from "@/lib/store/RoomContext";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

export default function LeftSidebar({ user }: { user: any }) {
  const { state, fetchAvailableRooms, setSelectedRoom } = useRoomContext(); // ✅ destructure setSelectedRoom here
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
      className={`flex items-center p-2 rounded cursor-pointer transition ${
        state.selectedRoom?.id === item.id ? "bg-blue-100" : "hover:bg-gray-100"
      }`}
      onClick={() => setSelectedRoom(item)} // ✅ call it directly
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={`/avatars/${item.id}.png`} alt={item.name} />
      </Avatar>
      <div className="ml-2 flex-1">
        <div className="font-medium">{item.name}</div>
        <div className="text-sm text-gray-500">Members: {item.memberCount}</div>
        <div className="text-xs text-gray-400">
          Created: {new Date(item.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full lg:w-1/4 p-4 bg-gray-50 border-r h-screen flex flex-col">
      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search rooms..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 mb-4 border rounded focus:ring-2 focus:ring-blue-400 outline-none"
      />

      {/* Rooms List */}
      <div className="space-y-2 flex-1 overflow-y-auto">
        {state.isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-gray-500 text-center mt-10">
            No rooms found. Try creating one!
          </div>
        ) : (
          filteredRooms.map((item) => renderItem(item))
        )}
      </div>
    </div>
  );
}
