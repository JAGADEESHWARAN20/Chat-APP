// components/TypingIndicator.tsx - UPDATED: Fully self-contained with RoomContext (no props), pulls roomId/userId/state directly, integrated Supabase fetch with context auth, fallback names, enhanced logs for debug
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useRoomContext } from "@/lib/store/RoomContext";

export default function TypingIndicator() {
  const supabase = supabaseBrowser();
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [isLoadingNames, setIsLoadingNames] = useState(false);

  // UPDATED: Pull all data directly from RoomContext (no props needed)
  const { state } = useRoomContext();
  const { selectedRoom } = state;
  const currentUserId = state.user?.id ?? null;
  const roomId = selectedRoom?.id ?? null;

  // UPDATED: Pass context values to hook
  const { typingUsers } = useTypingStatus({
    roomId: roomId || "",
    userId: currentUserId,
  });

  console.log("[TypingIndicator] Context data:", { roomId, currentUserId, typingUsersLength: typingUsers.length });

  // Get unique typing user IDs (excluding current user)
  const uniqueTypers = useMemo(() => {
    const filtered = typingUsers.filter((u) => u.user_id !== currentUserId && u.is_typing);
    console.log("[TypingIndicator] uniqueTypers after filter:", filtered.map(u => ({ id: u.user_id, typing: u.is_typing })));
    return [...new Set(filtered.map(u => u.user_id))];
  }, [typingUsers, currentUserId]);

  // Fetch display names from Supabase (using context user for auth)
  useEffect(() => {
    if (uniqueTypers.length === 0 || !roomId || !currentUserId) {
      console.log("[TypingIndicator] Skipping fetch: no typers/context");
      setUserNames({});
      setIsLoadingNames(false);
      return;
    }

    let isActive = true;
    setIsLoadingNames(true);
    console.log("[TypingIndicator] Fetching names for:", uniqueTypers);

    const fetchUserNames = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", uniqueTypers);

        if (error) {
          console.error("[TypingIndicator] Supabase error:", error);
          if (isActive) setIsLoadingNames(false);
          return;
        }

        if (!Array.isArray(data)) {
          console.warn("[TypingIndicator] Invalid data:", data);
          if (isActive) setIsLoadingNames(false);
          return;
        }

        const nameMap = data.reduce((acc: Record<string, string>, user: any) => {
          const name = user.display_name || user.username || `User ${user.id.slice(-4)}`;
          acc[user.id] = name;
          return acc;
        }, {});

        // Fallback for missing profiles
        uniqueTypers.forEach(id => {
          if (!nameMap[id]) nameMap[id] = `User ${id.slice(-4)}`;
        });

        console.log("[TypingIndicator] nameMap:", nameMap);
        if (isActive) {
          setUserNames(nameMap);
          setIsLoadingNames(false);
        }
      } catch (error) {
        console.error("[TypingIndicator] Fetch error:", error);
        if (isActive) setIsLoadingNames(false);
      }
    };

    fetchUserNames();
    return () => { isActive = false; };
  }, [uniqueTypers, supabase, roomId, currentUserId]);

  // Get display names
  const typingNames = useMemo(() => {
    const names = uniqueTypers
      .map((id) => userNames[id])
      .filter((name): name is string => Boolean(name));
    console.log("[TypingIndicator] typingNames:", names);
    return names;
  }, [uniqueTypers, userNames]);

  // Loading state
  if (uniqueTypers.length > 0 && typingNames.length === 0 && isLoadingNames) {
    console.log("[TypingIndicator] Rendering loading");
    return (
      <div className="w-full bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 px-4 py-3 text-blue-600 dark:text-blue-300 italic text-sm">
        <span className="animate-pulse">{uniqueTypers.length} user{uniqueTypers.length > 1 ? "s" : ""} typing...</span>
      </div>
    );
  }

  // No render if empty
  if (typingNames.length === 0) {
    console.log("[TypingIndicator] No names/typers, not rendering");
    return null;
  }

  // Format text
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

  console.log("[TypingIndicator] Rendering:", displayText);

  return (
    <div className="w-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-t border-indigo-200 dark:border-indigo-800 px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium">
      <span className="animate-pulse flex items-center gap-2">
        <span className="inline-flex gap-1">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
        </span>
        {displayText}
      </span>
    </div>
  );
}