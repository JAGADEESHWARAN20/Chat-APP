// components/TypingIndicator.tsx - FIXED: Log typingUsers state, render if any active, fallback text, higher z-index, debug uniqueTypers
"use client";

import React, { useMemo } from "react";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useRoomContext } from "@/lib/store/RoomContext";

export default function TypingIndicator() {
  const { state } = useRoomContext();
  const { selectedRoom } = state;
  const roomId = selectedRoom?.id ?? "";

  const { typingUsers, typingDisplayText } = useTypingStatus({ roomId });

  console.log("[TypingIndicator] typingUsers state:", typingUsers, "displayText:", typingDisplayText);

  // FIXED: Render if any users (even if !roomId, but log)
  if (typingUsers.length === 0) {
    console.log("[TypingIndicator] No typers, not rendering");
    return null;
  }

  console.log("[TypingIndicator] Rendering for", typingUsers.length, "typers");

  return (
    <div
      className="w-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-t border-indigo-200 dark:border-indigo-800 px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium z-50"
      style={{ position: "sticky", bottom: 0, zIndex: 50 }}
    >
      <span className="animate-pulse flex items-center gap-2">
        <span className="inline-flex gap-1">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
        </span>
        {typingDisplayText || `${typingUsers.length} user${typingUsers.length > 1 ? "s" : ""} typing...`}
      </span>
    </div>
  );
}