// components/TypingIndicator.tsx - FIXED: Render on typingUsers.length, enhanced logging, higher z-index, TS-safe, no props (RoomContext)
"use client";

import React, { useMemo } from "react";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useRoomContext } from "@/lib/store/RoomContext";

export default function TypingIndicator() {
  const { state } = useRoomContext();
  const { selectedRoom } = state;
  const roomId = selectedRoom?.id ?? "";

  // Use hook with roomId (userId internal via RoomContext)
  const { typingUsers, typingDisplayText } = useTypingStatus({ roomId });

  // Log typingUsers state for debugging
  console.log("[TypingIndicator] typingUsers:", typingUsers, "roomId:", roomId, "displayText:", typingDisplayText);

  // Only hide if no typers (looser condition for visibility)
  if (typingUsers.length === 0) return null;

  // Log render event
  console.log("[TypingIndicator] Rendering for", typingUsers.length, "typers:", typingDisplayText);

  return (
    <div
      className="w-full bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 border-t border-indigo-200 dark:border-indigo-800 px-4 py-2 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium z-20"
      style={{ position: "sticky", bottom: 0 }}
    >
      <span className="animate-pulse flex items-center gap-2">
        <span className="inline-flex gap-1">
          <span
            className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          ></span>
          <span
            className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></span>
          <span
            className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></span>
        </span>
        {typingDisplayText || `${typingUsers.length} user${typingUsers.length > 1 ? "s" : ""} typing...`}
      </span>
    </div>
  );
}