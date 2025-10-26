// components/TypingIndicator.tsx
"use client";

import React from "react";
import { useRoomContext } from "@/lib/store/RoomContext";
// Note: We only need motion here for the inner fade if desired, but 
// we remove AnimatePresence since the parent controls the height/existence.
import { motion } from "framer-motion"; 

export default function TypingIndicator() {
  const { state } = useRoomContext();
  const { typingDisplayText, typingUsers, selectedRoom } = state;

  const isTyping = selectedRoom?.id && typingUsers.length > 0 && typingDisplayText;

  // Render the indicator only if typing is active
  if (!isTyping) {
    return null;
  }
  
  // The height transition is managed by the parent ListMessages.tsx motion.div

  return (
    // We keep the motion.div for a slight fade-in effect on the content itself
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1 }}
      className="w-full px-4 py-2 mb-2" 
    >
      <div 
        role="status" 
        // Background changed to white and padding set to match target height of 3em
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
  );
}