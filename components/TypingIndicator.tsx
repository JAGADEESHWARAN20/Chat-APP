"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Database } from "@/lib/types/supabase";
import { useTypingStatus } from "@/hooks/useTypingStatus";

interface TypingIndicatorProps {
  roomId: string;
  currentUserId?: string;
}

export default function TypingIndicator({ roomId, currentUserId }: TypingIndicatorProps) {
  const supabase = supabaseBrowser();
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const { typingUsers } = useTypingStatus(roomId, currentUserId || "");

  // Filter out current user and ensure is_typing is true
  const filteredTypers = typingUsers
    .filter((u) => u.user_id !== currentUserId && u.is_typing)
    .map((u) => u.user_id);

  // Fetch display names for typing users
  useEffect(() => {
    let isActive = true;

    if (filteredTypers.length === 0) {
      setUserNames({});
      return;
    }

    const fetchUserNames = async () => {
      try {
        const userIds = [...new Set(filteredTypers)]; // Remove duplicates
        if (userIds.length === 0) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        if (error) {
          console.error("Error fetching user names:", error);
          return;
        }

        const safeData = Array.isArray(data) ? data : [];
        const nameMap = safeData.reduce((acc, user) => {
          acc[user.id] = user.display_name || "Someone";
          return acc;
        }, {} as Record<string, string>);

        if (isActive) setUserNames(nameMap);
      } catch (error) {
        console.error("Unexpected error fetching user names:", error);
      }
    };

    fetchUserNames();
    
    return () => {
      isActive = false;
    };
  }, [filteredTypers, supabase]);

  // Enhanced debugging
  useEffect(() => {
    console.log("Typing Indicator Debug:", {
      roomId,
      currentUserId,
      allTypingUsers: typingUsers,
      filteredTypers,
      userNames
    });
  }, [typingUsers, filteredTypers, userNames, roomId, currentUserId]);

  if (filteredTypers.length === 0) {
    return null;
  }

  // Map user IDs to display names
  const names = filteredTypers.map((id) => userNames[id] || "Someone");
  
  let displayText = "";
  if (names.length === 1) {
    displayText = `${names[0]} is typing...`;
  } else if (names.length === 2) {
    displayText = `${names[0]} and ${names[1]} are typing...`;
  } else {
    displayText = `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} are typing...`;
  }

  return (
    <div className="text-gray-400 italic text-sm px-4 py-2 animate-pulse">
      {displayText}
    </div>
  );
}