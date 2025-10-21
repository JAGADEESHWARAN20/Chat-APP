// components/TypingIndicator.tsx (Fixed: Null guards for currentUserId, improved memoization, reduced console logs, better loading states)
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useRoomContext } from "@/lib/store/RoomContext";

interface TypingIndicatorProps {
  roomId: string;
}

export default function TypingIndicator({ roomId }: TypingIndicatorProps) {
  const supabase = supabaseBrowser();
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [isLoadingNames, setIsLoadingNames] = useState(false);
  const { state } = useRoomContext();
  const currentUserId = state.user?.id ?? null; // Fixed: Nullish coalescing for undefined/null
  const { typingUsers } = useTypingStatus({
    roomId,
    userId: currentUserId,
  });
  // Get unique typing user IDs (excluding current user) - Improved: Stable deps
  const uniqueTypers = useMemo(() => {
    return [...new Set(
      typingUsers
        .filter((u) => u.user_id !== currentUserId && u.is_typing)
        .map((u) => u.user_id)
    )];
  }, [typingUsers, currentUserId]);

  // Fetch display names (Improved: Debounce if needed, better error handling, cleanup)
  useEffect(() => {
    if (uniqueTypers.length === 0) {
      setUserNames({});
      setIsLoadingNames(false);
      return;
    }

    let isActive = true;
    setIsLoadingNames(true);

    const fetchUserNames = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", uniqueTypers);

        if (error) {
          console.error("[TypingIndicator] Error fetching user names:", error);
          if (isActive) setIsLoadingNames(false);
          return;
        }

        if (!Array.isArray(data)) {
          console.warn("[TypingIndicator] Unexpected data format:", data);
          if (isActive) setIsLoadingNames(false);
          return;
        }

        const nameMap = data.reduce((acc: Record<string, string>, user: any) => {
          const name = user.display_name || user.username || "Someone";
          acc[user.id] = name;
          return acc;
        }, {});

        if (isActive) {
          setUserNames(nameMap);
          setIsLoadingNames(false);
        }
      } catch (error) {
        console.error("[TypingIndicator] Unexpected error fetching user names:", error);
        if (isActive) setIsLoadingNames(false);
      }
    };

    fetchUserNames();

    return () => {
      isActive = false;
    };
  }, [uniqueTypers, supabase]); // Stable dep: uniqueTypers changes only when needed

  // Get display names (Improved: Memoized, filter non-null)
  const typingNames = useMemo(() => {
    return uniqueTypers
      .map((id) => userNames[id])
      .filter((name): name is string => Boolean(name));
  }, [uniqueTypers, userNames]);

  // Show loading if fetching names
  if (uniqueTypers.length > 0 && typingNames.length === 0 && isLoadingNames) {
    return (
      <div
        className="w-full bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 px-4 py-3 text-blue-600 dark:text-blue-300 italic text-sm"
        style={{
          minHeight: "44px",
          display: "flex",
          alignItems: "center",
          zIndex: 50,
          position: "relative",
        }}
      >
        <span className="animate-pulse">
          {uniqueTypers.length} user{uniqueTypers.length > 1 ? "s" : ""} typing...
        </span>
      </div>
    );
  }

  // Don't show if no typers or names resolved to empty
  if (typingNames.length === 0) {
    return null;
  }

  // Format display text (Improved: Cleaner logic)
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
    <div
      className="w-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-t border-indigo-200 dark:border-indigo-800 px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium"
      style={{
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
        zIndex: 50,
        position: "relative",
      }}
      role="status"
      aria-live="polite"
      aria-label="Users typing indicator"
    >
      <span className="animate-pulse flex items-center gap-2">
        <span className="inline-flex gap-1">
          <span
            className="inline-block w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          ></span>
          <span
            className="inline-block w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></span>
          <span
            className="inline-block w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></span>
        </span>
        {displayText}
      </span>
    </div>
  );
}