// components/TypingIndicator.tsx
"use client";

import React from "react";
import { useRoomContext } from "@/lib/store/RoomContext";
import { AnimatePresence, motion } from "framer-motion"; // <-- ADDED: AnimatePresence and motion

export default function TypingIndicator() {
  const { state } = useRoomContext();
  const { typingDisplayText, typingUsers, selectedRoom } = state;

  const isTyping = selectedRoom?.id && typingUsers.length > 0 && typingDisplayText;

  return (
    <AnimatePresence>
      {isTyping && (
        <motion.div // <-- UPDATED: motion.div for animation
          key="typing-indicator"
          initial={{ opacity: 0, y: 10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: 10, height: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full px-4 py-2 mb-2" // <-- UPDATED: Adjusted wrapper class
        >
          <div 
            role="status" 
            className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium shadow-sm"
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