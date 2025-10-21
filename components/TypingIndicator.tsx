// components/TypingIndicator.tsx - UPDATED: Fully leverages RoomContext for user/room IDs (no props needed), improved Supabase integration for profiles, fallback names, and render logic
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useRoomContext } from "@/lib/store/RoomContext";

export default function TypingIndicator() {
  const supabase = supabaseBrowser();
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [isLoadingNames, setIsLoadingNames] = useState(false);

  // UPDATED: Get roomId and userId directly from RoomContext (no props needed)
  const { state } = useRoomContext();
  const { selectedRoom } = state;
  const currentUserId = state.user?.id ?? null;
  const roomId = selectedRoom?.id ?? null;

  // UPDATED: Pass from context to hook
  const { typingUsers } = useTypingStatus({
    roomId: roomId || "",
    userId: currentUserId,
  });

  // Get unique typing user IDs (excluding current user)
  const uniqueTypers = useMemo(() => {
    return [...new Set(
      typingUsers
        .filter((u) => u.user_id !== currentUserId && u.is_typing)
        .map((u) => u.user_id)
    )];
  }, [typingUsers, currentUserId]);

  // Fetch display names from Supabase profiles (using context user for auth)
  useEffect(() => {
    if (uniqueTypers.length === 0 || !roomId || !currentUserId) {
      setUserNames({});
      setIsLoadingNames(false);
      return;
    }

    let isActive = true;
    setIsLoadingNames(true);

    const fetchUserNames = async () => {
      try {
        // UPDATED: Use Supabase with context user auth (implicit via browser client)
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

        // UPDATED: Build nameMap with Supabase data + fallback
        const nameMap = data.reduce((acc: Record<string, string>, user: any) => {
          const name = user.display_name || user.username || `User ${user.id.slice(-4)}`;
          acc[user.id] = name;
          return acc;
        }, {});

        // Fallback for any missing users
        uniqueTypers.forEach(id => {
          if (!nameMap[id]) nameMap[id] = `User ${id.slice(-4)}`;
        });

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
  }, [uniqueTypers, supabase, roomId, currentUserId]); // UPDATED: Depend on context values

  // Get display names
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

  // Format display text
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