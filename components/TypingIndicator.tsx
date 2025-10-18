// components/TypingIndicator.tsx - FIXED VERSION
"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  const [loadingNames, setLoadingNames] = useState(false);
  
  const { typingUsers } = useTypingStatus(roomId, currentUserId || "");

  // Memoize the active typers calculation
  const uniqueTypers = useMemo(() => {
    const activeTypers = typingUsers
      .filter((u) => u.user_id !== currentUserId && u.is_typing)
      .map((u) => u.user_id);
    
    return [...new Set(activeTypers)];
  }, [typingUsers, currentUserId]);

  // Fetch display names for typing users
  useEffect(() => {
    let isActive = true;

    const fetchUserNames = async () => {
      if (uniqueTypers.length === 0) {
        setUserNames({});
        setLoadingNames(false);
        return;
      }

      setLoadingNames(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", uniqueTypers);

        if (error) {
          console.error("Error fetching user names:", error);
          setLoadingNames(false);
          return;
        }

        if (!Array.isArray(data)) {
          console.warn("Unexpected data format:", data);
          setLoadingNames(false);
          return;
        }

        const nameMap = data.reduce((acc, user) => {
          acc[user.id] = user.display_name || user.username || "Someone";
          return acc;
        }, {} as Record<string, string>);

        if (isActive) {
          setUserNames(nameMap);
          setLoadingNames(false);
        }
      } catch (error) {
        console.error("Unexpected error fetching user names:", error);
        if (isActive) setLoadingNames(false);
      }
    };

    fetchUserNames();
    
    return () => {
      isActive = false;
    };
  }, [uniqueTypers, supabase]);

  // Debug logging
  useEffect(() => {
    console.log("TypingIndicator Debug:", {
      roomId,
      currentUserId,
      allTypingUsers: typingUsers,
      activeTypers: uniqueTypers,
      userNames,
      loadingNames
    });
  }, [typingUsers, uniqueTypers, userNames, loadingNames, roomId, currentUserId]);

  // Don't show indicator if no one is typing
  if (uniqueTypers.length === 0 || loadingNames) {
    return null;
  }

  // Get display names for typing users
  const typingNames = uniqueTypers
    .map((id) => userNames[id] || "Someone")
    .filter(Boolean);

  if (typingNames.length === 0) {
    return null;
  }

  // Format the display text
  let displayText = "";
  if (typingNames.length === 1) {
    displayText = `${typingNames[0]} is typing...`;
  } else if (typingNames.length === 2) {
    displayText = `${typingNames[0]} and ${typingNames[1]} are typing...`;
  } else {
    const otherNames = typingNames.slice(0, -1).join(", ");
    const lastName = typingNames[typingNames.length - 1];
    displayText = `${otherNames}, and ${lastName} are typing...`;
  }

  return (
    <div className="text-gray-400 italic text-sm px-4 py-2 animate-pulse">
      {displayText}
    </div>
  );
}