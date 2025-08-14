"use client";

import { cn } from "@/lib/utils";
import { IRoom } from "@/lib/types/rooms";
import { Button } from "./button";
import { Lock, Users } from "lucide-react";

interface RoomCardProps {
  room: IRoom;
  isSelected: boolean;
  onJoin: () => void;
  onLeave: () => void;
  participationStatus: string | null;
  userCount: number;
}

export function RoomCard({
  room,
  isSelected,
  onJoin,
  onLeave,
  participationStatus,
  userCount,
}: RoomCardProps) {
  return (
    <div
      className={cn(
        "relative p-4 mb-2 rounded-lg transition-all",
        "backdrop-blur-sm bg-opacity-10 bg-white dark:bg-opacity-10",
        "border border-gray-200 dark:border-gray-800",
        "hover:bg-opacity-20 dark:hover:bg-opacity-20",
        "shadow-lg",
        isSelected && "bg-opacity-30 dark:bg-opacity-30 border-purple-500"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{room.name}</span>
          {room.is_private && <Lock className="w-4 h-4 text-gray-500" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center text-sm text-gray-500">
            <Users className="w-4 h-4 mr-1" />
            {userCount}
          </span>
          {participationStatus === "accepted" ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={onLeave}
            >
              Leave
            </Button>
          ) : participationStatus === "pending" ? (
            <Button
              variant="secondary"
              size="sm"
              disabled
            >
              Pending
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={onJoin}
            >
              Join
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
