"use client";

import React, { useEffect } from "react";
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
  const { typingUsers } = useTypingStatus( // Remove setIsTyping since we don't use it here
    roomId, 
    currentUserId || user?.id || ""
  );

  // Debugging - log typing users
  useEffect(() => {
    console.log('Typing users:', typingUsers);
  }, [typingUsers]);

  // Filter out current user and empty states
  const filteredTypers = typingUsers.filter(id => id !== (currentUserId || user?.id));
  
  if (filteredTypers.length === 0) {
    console.log('No typers to display after filtering');
    return null;
  }

  // Map userIds to display names
  const names = filteredTypers.map((id) => 
    userMap[id]?.display_name || "Someone"
  );

  const displayNames = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return (
    <div className="text-gray-400 italic text-sm px-4 py-2 animate-pulse">
      {displayNames} {names.length === 1 ? "is" : "are"} typing...
    </div>
  );
}