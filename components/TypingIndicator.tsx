// components/TypingIndicator.tsx
"use client";

import React from "react";
import { useRoomContext } from "@/lib/store/RoomContext";
import { AnimatePresence, motion } from "framer-motion";

export default function TypingIndicator() {
  const { state } = useRoomContext();
  const { typingDisplayText, typingUsers, selectedRoom } = state;

  const isTyping = selectedRoom?.id && typingUsers.length > 0 && typingDisplayText;

  // If not typing, this component renders null, which allows the parent motion.div
  // in ListMessages.tsx to collapse to h-0, occupying no space.
  return (
    <AnimatePresence>
      {isTyping && (
        <motion.div 
          key="typing-indicator"
          initial={{ opacity: 0, y: 10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: 10, height: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full px-4 py-2 mb-2" 
        >
          <div 
            role="status" 
            // UPDATED: bg-white for light mode
            className="bg-white dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1 flex-shrink-0">
                {[0, 150, 300].map(delay => (
                  <span 
                    key={delay} 
                    className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" 
                    style={{ animationDelay: `${delay}ms` }} 
                  />
                ))}
              </div>
              <span className="flex-1 truncate min-w-0">
                {typingDisplayText}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}