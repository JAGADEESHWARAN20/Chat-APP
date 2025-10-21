// components/TypingIndicator.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useRoomContext } from "@/lib/store/RoomContext"; // Import RoomContext

interface TypingIndicatorProps {
  roomId: string;
  // Remove currentUserId prop - we'll get it from RoomContext
}

export default function TypingIndicator({ roomId }: TypingIndicatorProps) {
  const supabase = supabaseBrowser();
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [isLoadingNames, setIsLoadingNames] = useState(false);
  const { state } = useRoomContext(); // Get RoomContext
  const currentUserId = state.user?.id; // Get current user ID from RoomContext
  const { typingUsers } = useTypingStatus(roomId, currentUserId);


  console.log("[TypingIndicator] Render cycle:", {
    roomId,
    currentUserId,
    typingUsersCount: typingUsers.length,
    typingUserIds: typingUsers.map((u) => u.user_id),
  });

  // Get unique typing user IDs (excluding current user)
  const uniqueTypers = useMemo(() => {
    const filtered = typingUsers
      .filter((u) => {
        const isNotCurrent = u.user_id !== currentUserId;
        const isTyping = u.is_typing;
        console.log(
          `[TypingIndicator] Filter user ${u.user_id}: isTyping=${isTyping}, isNotCurrent=${isNotCurrent}`
        );
        return isNotCurrent && isTyping;
      })
      .map((u) => u.user_id);

    const deduped = [...new Set(filtered)];
    console.log("[TypingIndicator] Unique typers:", deduped);
    return deduped;
  }, [typingUsers, currentUserId]);

  // Fetch display names for typing users
  useEffect(() => {
    let isActive = true;

    const fetchUserNames = async () => {
      if (uniqueTypers.length === 0) {
        console.log("[TypingIndicator] No typers, clearing names");
        setUserNames({});
        setIsLoadingNames(false);
        return;
      }

      setIsLoadingNames(true);
      console.log(
        `[TypingIndicator] 🔍 Fetching names for ${uniqueTypers.length} users:`,
        uniqueTypers
      );

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", uniqueTypers);

        if (error) {
          console.error("[TypingIndicator] ❌ Error fetching user names:", error);
          if (isActive) {
            setIsLoadingNames(false);
          }
          return;
        }

        if (!Array.isArray(data)) {
          console.warn(
            "[TypingIndicator] ⚠️ Unexpected data format:",
            data
          );
          if (isActive) {
            setIsLoadingNames(false);
          }
          return;
        }

        console.log(
          `[TypingIndicator] ✅ Fetched ${data.length} profiles:`,
          data.map((p: any) => ({ id: p.id, name: p.display_name || p.username }))
        );

        const nameMap = data.reduce((acc: Record<string, string>, user: any) => {
          const name = user.display_name || user.username || "Someone";
          acc[user.id] = name;
          return acc;
        }, {});

        if (isActive) {
          console.log("[TypingIndicator] ✅ Setting user names:", nameMap);
          setUserNames(nameMap);
          setIsLoadingNames(false);
        }
      } catch (error) {
        console.error(
          "[TypingIndicator] ❌ Unexpected error fetching user names:",
          error
        );
        if (isActive) {
          setIsLoadingNames(false);
        }
      }
    };

    fetchUserNames();

    return () => {
      isActive = false;
    };
  }, [uniqueTypers, supabase]);

  // Get display names for typing users
  const typingNames = useMemo(() => {
    return uniqueTypers
      .map((id) => {
        const name = userNames[id];
        console.log(`[TypingIndicator] Getting name for ${id}: ${name}`);
        return name;
      })
      .filter(Boolean);
  }, [uniqueTypers, userNames]);

  console.log("[TypingIndicator] Final render check:", {
    typingUsersLength: typingUsers.length,
    uniqueTypersLength: uniqueTypers.length,
    typingNamesLength: typingNames.length,
    isLoadingNames,
    typingNames,
    shouldRender: typingNames.length > 0 || (uniqueTypers.length > 0 && isLoadingNames),
  });

  // Show fallback while loading names
  if (uniqueTypers.length > 0 && typingNames.length === 0 && isLoadingNames) {
    console.log("[TypingIndicator] Rendering: loading names...");
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

  // Don't show if no one typing
  if (typingNames.length === 0) {
    console.log("[TypingIndicator] Not rendering: no names or no typers");
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

  console.log("[TypingIndicator] RENDERING with text:", displayText);

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