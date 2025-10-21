"use client";

import React from "react";
import { useTypingStatus } from "@/hooks/useTypingStatus";

export default function TypingIndicator() {
  const { typingUsers, typingDisplayText } = useTypingStatus();

  const isActive = typingUsers.length > 0;

  if (!isActive) return null;

  return (
    <div className="sticky bottom-0 left-0 w-full bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-200 dark:border-indigo-800 px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium z-50">
      <span className="flex items-center gap-3 animate-pulse">
        <span className="flex gap-1">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
        {typingDisplayText}
      </span>
    </div>
  );
}
