// components/TypingIndicator.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useTypingStatus } from "@/hooks/useTypingStatus";

export default function TypingIndicator() {
  const { 
    typingUsers, 
    typingDisplayText, 
    canOperate,
    currentRoomId,
    currentUserId
  } = useTypingStatus();
  
  const [isVisible, setIsVisible] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  // Debug component render
  useEffect(() => {
    console.log("[TypingIndicator] 🎨 Component Render:", {
      typingUsersCount: typingUsers.length,
      typingDisplayText,
      isVisible,
      canOperate,
      currentRoomId,
      currentUserId,
      typingUsers: typingUsers.map(u => ({
        user_id: u.user_id,
        display_name: u.display_name,
        username: u.username,
        is_typing: u.is_typing
      }))
    });
  }, [typingUsers, typingDisplayText, isVisible, canOperate, currentRoomId, currentUserId]);

  // Handle visibility with animation
  useEffect(() => {
    const shouldBeVisible = typingUsers.length > 0 && canOperate;
    
    console.log("[TypingIndicator] 👀 Visibility Check:", {
      shouldBeVisible,
      typingUsersLength: typingUsers.length,
      canOperate,
      currentIsVisible: isVisible,
      roomId: currentRoomId,
      userId: currentUserId
    });

    if (shouldBeVisible && !isVisible) {
      console.log("[TypingIndicator] 🔄 Showing indicator");
      setIsVisible(true);
      setRenderKey(prev => prev + 1);
    } else if (!shouldBeVisible && isVisible) {
      console.log("[TypingIndicator] 🔄 Hiding indicator");
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [typingUsers.length, canOperate, isVisible, currentRoomId, currentUserId]);

  // Don't render anything if not visible
  if (!isVisible) {
    console.log("[TypingIndicator] 🚫 Not rendering - not visible");
    return null;
  }

  if (!canOperate) {
    console.log("[TypingIndicator] 🚫 Not rendering - cannot operate");
    return null;
  }

  console.log("[TypingIndicator] ✅ Rendering indicator:", {
    text: typingDisplayText,
    users: typingUsers.length,
    roomId: currentRoomId
  });

  return (
    <div 
      key={renderKey}
      className="sticky bottom-0 left-0 w-full bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-200 dark:border-indigo-800 px-4 py-3 text-indigo-700 dark:text-indigo-300 italic text-sm font-medium z-50 animate-in slide-in-from-bottom-full duration-300"
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
        
        {/* Debug badge - remove in production */}
        <span className="flex-shrink-0 text-xs bg-indigo-200 dark:bg-indigo-800 px-2 py-1 rounded-full text-indigo-600 dark:text-indigo-300 font-normal">
          {typingUsers.length} user{typingUsers.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      {/* Extended debug info - remove in production */}
      <div className="mt-1 text-xs text-indigo-500 dark:text-indigo-400 font-normal">
        <div>Room: {currentRoomId?.slice(-8)}...</div>
        <div>Users: {typingUsers.map(u => 
          u.display_name || u.username || u.user_id.slice(-8)
        ).join(', ')}</div>
      </div>
    </div>
  );
}