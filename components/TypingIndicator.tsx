import React from "react";
import { useUser } from "@/lib/store/user";
import { useTypingStatus } from "@/lib/hooks/useTypingStatus"; // adjust path as needed

interface TypingIndicatorProps {
  roomId: string;
  // optionally you can pass a user map if you have usernames separately
  userMap?: Record<string, { display_name: string }>;
}

export default function TypingIndicator({ roomId, userMap = {} }: TypingIndicatorProps) {
  const user = useUser((state) => state.user);
  const typingUsers = useTypingStatus(roomId, user?.id || "");

  if (typingUsers.length === 0) return null;

  // Map user IDs to display names or fallback to "Someone"
  const names = typingUsers.map((id) => userMap[id]?.display_name || "Someone");

  const namesDisplay =
    names.length === 1
      ? names[0]
      : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];

  return (
    <div className="text-gray-400 italic text-sm p-2">
      {namesDisplay} {typingUsers.length === 1 ? "is" : "are"} typing...
    </div>
  );
}
