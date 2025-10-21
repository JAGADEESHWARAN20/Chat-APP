// components/TypingIndicator.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useTypingStatus } from "@/hooks/useTypingStatus";

export default function TypingIndicator() {
  const { 
    typingUsers, 
    typingDisplayText, 
    canOperate
  } = useTypingStatus();
  
  const [isVisible, setIsVisible] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  // Handle visibility with animation
  useEffect(() => {
    const shouldBeVisible = typingUsers.length > 0 && canOperate;

    if (shouldBeVisible && !isVisible) {
      setIsVisible(true);
      setRenderKey(prev => prev + 1); // Force re-render for animation
    } else if (!shouldBeVisible && isVisible) {
      // Add a small delay before hiding for smooth animation
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [typingUsers.length, canOperate, isVisible]);

  // Don't render anything if not visible
  if (!isVisible) return null;
  if (!canOperate) return null;

  return (
    <div 
      key={renderKey}
      className="sticky bottom-0 left-0 w-full bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-200 dark:border-indigo-800 px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium z-50 transition-all duration-300 ease-in-out animate-in slide-in-from-bottom-full"
      style={{
        animationDuration: '0.3s'
      }}
    >
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
  );
}