"use client";

import React from "react";
import { useUser } from "@/lib/store/user";
import { useTypingStatus } from "@/hooks/useTypingStatus";

interface TypingIndicatorProps {
  roomId: string;
  userMap?: Record<string, { display_name: string }>;
  currentUserId?: string;
}


export default function TypingIndicator({ 
  roomId, 
  userMap = {}, 
  currentUserId 
}: TypingIndicatorProps) {
  const user = useUser((state) => state.user);
   const { typingUsers } = useTypingStatus(roomId, currentUserId || "");


  const filteredTypers = typingUsers.filter(id => id !== currentUserId);
  if (filteredTypers.length === 0) return null;
  // Map userIds to display names, excluding current user
  const names = typingUsers
    .filter(id => id !== user?.id)
    .map((id) => userMap[id]?.display_name || "Someone");

  if (names.length === 0) return null;

  const displayNames =
    names.length === 1
      ? names[0]
      : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];

  return (
    <div className="text-gray-400 italic text-sm px-4 py-2 animate-pulse">
      {displayNames} {names.length === 1 ? "is" : "are"} typing...
    </div>
  );
}