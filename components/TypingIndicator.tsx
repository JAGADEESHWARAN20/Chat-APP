// components/TypingIndicator.tsx - FULLY DEBUGGED VERSION
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
  
  const { typingUsers } = useTypingStatus(roomId, currentUserId || "");

  // Memoize the active typers calculation
  const uniqueTypers = useMemo(() => {
    const activeTypers = typingUsers
      .filter((u) => {
        const shouldInclude = u.user_id !== currentUserId && u.is_typing;
        console.log(`[TypingIndicator] Filter check for ${u.user_id}: is_typing=${u.is_typing}, currentUserId=${currentUserId}, shouldInclude=${shouldInclude}`);
        return shouldInclude;
      })
      .map((u) => u.user_id);
    
    const deduped = [...new Set(activeTypers)];
    console.log(`[TypingIndicator] uniqueTypers:`, deduped);
    return deduped;
  }, [typingUsers, currentUserId]);

  // Fetch display names for typing users
  useEffect(() => {
    let isActive = true;

    const fetchUserNames = async () => {
      if (uniqueTypers.length === 0) {
        console.log("[TypingIndicator] No typers, clearing names");
        setUserNames({});
        return;
      }

      console.log(`[TypingIndicator] Fetching names for ${uniqueTypers.length} users:`, uniqueTypers);

      try {
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("id, display_name, username")
          .in("id", uniqueTypers);

        if (error) {
          console.error("[TypingIndicator] Error fetching user names:", error);
          return;
        }

        if (!Array.isArray(data)) {
          console.warn("[TypingIndicator] Unexpected data format:", data);
          return;
        }

        const nameMap = data.reduce((acc, user) => {
          const name = user.display_name || user.username || "Someone";
          acc[user.id] = name;
          console.log(`[TypingIndicator] Mapped ${user.id} -> ${name}`);
          return acc;
        }, {} as Record<string, string>);

        if (isActive) {
          console.log("[TypingIndicator] Setting user names:", nameMap);
          setUserNames(nameMap);
        }
      } catch (error) {
        console.error("[TypingIndicator] Unexpected error fetching user names:", error);
      }
    };

    fetchUserNames();
    
    return () => {
      isActive = false;
    };
  }, [uniqueTypers, supabase]);

  // Debug logging
  useEffect(() => {
    console.log("[TypingIndicator] Render debug:", {
      roomId,
      currentUserId,
      typingUsers: typingUsers.length,
      uniqueTypers: uniqueTypers.length,
      userNames,
    });
  }, [typingUsers, uniqueTypers, userNames, roomId, currentUserId]);

  // Don't show if no one typing
  if (uniqueTypers.length === 0) {
    console.log("[TypingIndicator] Not rendering: no typers");
    return null;
  }

  // Get display names for typing users
  const typingNames = uniqueTypers
    .map((id) => {
      const name = userNames[id];
      console.log(`[TypingIndicator] Getting name for ${id}: ${name}`);
      return name;
    })
    .filter(Boolean);

  console.log("[TypingIndicator] typingNames:", typingNames);

  if (typingNames.length === 0) {
    console.log("[TypingIndicator] Not rendering: no names loaded yet");
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

  console.log("[TypingIndicator] Rendering with text:", displayText);

  return (
    <div className="text-gray-400 italic text-sm px-4 py-2 animate-pulse">
      {displayText}
    </div>
  );
}