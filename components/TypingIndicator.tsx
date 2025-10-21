// components/TypingIndicator.tsx
"use client";

import React from "react";
import { useTypingStatus } from "@/hooks/useTypingStatus";

export default function TypingIndicator() {
  const { 
    typingUsers, 
    typingDisplayText, 
    canOperate
  } = useTypingStatus();

  console.log("[TypingIndicator] Render:", {
    typingUsers: typingUsers.length,
    displayText: typingDisplayText,
    canOperate,
    shouldShow: typingUsers.length > 0 && canOperate
  });

  // Don't render if no typing users or not in a room
  if (typingUsers.length === 0 || !canOperate) {
    return null;
  }

  return (
    <div className="sticky bottom-16 left-0 right-0 px-4 py-2 z-40">
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium shadow-sm">
        <div className="flex items-center gap-3">
          {/* Animated dots */}
          <div className="flex gap-1 flex-shrink-0">
            <span 
              className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" 
              style={{ animationDelay: "0ms" }} 
            />
            <span 
              className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" 
              style={{ animationDelay: "150ms" }} 
            />
            <span 
              className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" 
              style={{ animationDelay: "300ms" }} 
            />
          </div>
          
          {/* Typing text */}
          <span className="flex-1 truncate min-w-0">
            {typingDisplayText}
          </span>
        </div>
      </div>
    </div>
  );
}