"use client";
import React, { useEffect, useState } from "react";
import { useRoomContext } from "@/lib/store/RoomContext";
import { motion } from "framer-motion"; 

export default function TypingIndicator() {
  const { state } = useRoomContext();
  const { typingDisplayText, typingUsers, selectedRoom } = state;
  const [displayText, setDisplayText] = useState("");

  const isTyping = selectedRoom?.id && typingUsers.length > 0;

  // Use the computed text from RoomContext directly
  useEffect(() => {
    if (!isTyping) {
      setDisplayText("");
      return;
    }

    // RoomContext already computes this, so we can use it directly
    if (typingDisplayText) {
      setDisplayText(typingDisplayText);
    }
  }, [typingUsers, typingDisplayText, isTyping]);

  if (!isTyping || !displayText) {
    return null;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full px-4 py-2" 
    >
      <div 
        role="status" 
        className="bg-white dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1 flex-shrink-0">
            {[0, 150, 300].map(delay => (
              <motion.span 
                key={delay} 
                className="w-2 h-2 bg-indigo-500 rounded-full"
                animate={{ y: [0, -4, 0] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: delay / 1000,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          <span className="flex-1 truncate min-w-0">
            {displayText}
          </span>
        </div>
      </div>
    </motion.div>
  );
}