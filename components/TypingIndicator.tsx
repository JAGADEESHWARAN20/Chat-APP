"use client";

import React from "react";
import { useUser } from "@/lib/store/user";
import { useTypingStatus } from "@/lib/hooks/useTypingStatus";

interface TypingIndicatorProps {
  roomId: string;
  userMap?: Record<string, { display_name: string }>;
}

export default function TypingIndicator({ roomId, userMap = {} }: TypingIndicatorProps) {
  const user = useUser((state) => state.user);
  const typingUsers = useTypingStatus(roomId, user?.id ?? "");

  if (typingUsers.length === 0) return null;

  // Map userIds to display names, fallback to 'Someone'
  const names = typingUsers.map((id) => userMap[id]?.display_name || "Someone");

  const displayNames =
    names.length === 1
      ? names[0]
      : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];

  return (
    <div className="text-gray-400 italic text-sm px-4 py-2">
      {displayNames} {typingUsers.length === 1 ? "is" : "are"} typing...
    </div>
  );
}
