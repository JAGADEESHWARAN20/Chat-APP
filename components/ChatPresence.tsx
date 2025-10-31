"use client";
import React from "react";
import { useRoomContext } from "@/lib/store/RoomContext";
import { Users, Wifi, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ChatPresence() {
  const { state, getOnlineCount, getOnlineUsers } = useRoomContext();
  const { selectedRoom, presence } = state;

  // Get presence data directly from context
  const onlineCount = selectedRoom ? getOnlineCount(selectedRoom.id) : 0;
  const roomOnlineUsers = selectedRoom ? getOnlineUsers(selectedRoom.id) : [];

  if (!selectedRoom) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Wifi className="h-3 w-3" />
        <span>Select a room</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-4">
        {/* Online Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Wifi className={`h-3.5 w-3.5 ${
                  onlineCount > 0 ? 'text-green-500' : 'text-muted-foreground'
                }`} />
                {onlineCount > 0 && (
                  <Circle className="absolute -top-0.5 -right-0.5 h-2 w-2 fill-green-500 text-green-500" />
                )}
              </div>
              <span className={`text-xs font-medium ${
                onlineCount > 0 ? 'text-green-600' : 'text-muted-foreground'
              }`}>
                {onlineCount} online
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Active users in this room</p>
          </TooltipContent>
        </Tooltip>

        {/* Total Members */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {selectedRoom.memberCount || 0} total
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total room members</p>
          </TooltipContent>
        </Tooltip>

        {/* Online Users List */}
        {roomOnlineUsers.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs h-5">
                {roomOnlineUsers.length} active now
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="space-y-2 max-w-[200px]">
                <p className="text-xs font-semibold text-foreground">Online Now:</p>
                <div className="space-y-1">
                  {roomOnlineUsers.slice(0, 10).map((user) => (
                    <div key={user.user_id} className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                      <span className="truncate text-muted-foreground">
                        {user.display_name || user.username || 'Anonymous User'}
                      </span>
                    </div>
                  ))}
                  {roomOnlineUsers.length > 10 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      +{roomOnlineUsers.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Presence Error */}
        {presence.error && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="text-xs h-5">
                Presence offline
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Unable to connect to presence service</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}