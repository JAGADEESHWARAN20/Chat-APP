"use client";

import React from "react";
import { useUser } from "@/lib/store/user";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useMessage } from "@/lib/store/messages";

interface TypingIndicatorProps {
  roomId: string;
}

export default function TypingIndicator({ roomId }: TypingIndicatorProps) {
  const user = useUser((state) => state.user);
  const typingUsers = useTypingStatus(roomId, user?.id ?? "");
  const messages = useMessage((state) => state.messages);

  if (typingUsers.length === 0) return null;

  // Create userMap from messages
  const userMap = messages.reduce((acc, msg) => {
    if (msg.users && !acc[msg.users.id]) {
      acc[msg.users.id] = { display_name: msg.users.display_name };
    }
    return acc;
  }, {} as Record<string, { display_name: string }>);

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
