"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/database.types";
import { useTypingStatus } from "@/hooks/useTypingStatus";

interface TypingIndicatorProps {
  roomId: string;
  currentUserId?: string;
}

export default function TypingIndicator({ roomId, currentUserId }: TypingIndicatorProps) {
  const supabase = createClientComponentClient<Database>();
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const { typingUsers } = useTypingStatus(roomId, currentUserId || "");

  // Fetch display names for typing users
  useEffect(() => {
    if (typingUsers.length === 0) {
      setUserNames({});
      return;
    }

    const fetchUserNames = async () => {
      try {
        const userIds = typingUsers.map((u) => u.user_id);
        const { data, error } = await supabase
          .from("users")
          .select("id, display_name")
          .in("id", userIds);

        if (error) {
          console.error("Error fetching user names:", error);
          return;
        }

        const nameMap = data.reduce((acc, user) => {
          acc[user.id] = user.display_name || "Someone";
          return acc;
        }, {} as Record<string, string>);

        setUserNames(nameMap);
      } catch (error) {
        console.error("Unexpected error fetching user names:", error);
      }
    };

    fetchUserNames();
  }, [typingUsers, supabase]);

  // Debugging
  useEffect(() => {
    console.log("Typing users:", typingUsers, "User names:", userNames);
  }, [typingUsers, userNames]);

  // Filter out current user
  const filteredTypers = typingUsers
    .filter((u) => u.user_id !== currentUserId)
    .map((u) => u.user_id);

  if (filteredTypers.length === 0) {
    return null;
  }

  // Map user IDs to display names
  const names = filteredTypers.map((id) => userNames[id] || "Someone");
  const displayNames =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return (
    <div className="text-gray-400 italic text-sm px-4 py-2 animate-pulse">
      {displayNames} {names.length === 1 ? "is" : "are"} typing...
    </div>
  );
}
