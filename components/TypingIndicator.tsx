"use client";

import React from "react";
import { useSelectedRoom, useTypingUsers, useTypingDisplayText } from "@/lib/store/unified-roomstore";
import { motion, AnimatePresence } from "framer-motion";

export default function TypingIndicator() {
  const selectedRoom = useSelectedRoom();
  const typingUsers = useTypingUsers();
  const typingDisplayText = useTypingDisplayText();

  const shouldShow = selectedRoom?.id && typingUsers.length > 0 && typingDisplayText;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: 10 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full px-4 mb-2"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1 flex-shrink-0">
                {[0, 150, 300].map(delay => (
                  <motion.span
                    key={delay}
                    className="w-2 h-2 bg-indigo-500 rounded-full"
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 0.6,
                      delay: delay / 1000,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex-1 truncate min-w-0"
              >
                {typingDisplayText}
              </motion.span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}