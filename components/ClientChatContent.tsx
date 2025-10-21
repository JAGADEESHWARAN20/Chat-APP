// components/ClientChatContent.tsx - FIXED LAYOUT: Ensure no double-scroll, full height constraints, overflow-hidden on flex items
"use client";

import React from "react";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import ChatAbout from "@/components/ChatAbout";
import { useRoomContext } from "@/lib/store/RoomContext";
import { User as SupabaseUser } from "@supabase/supabase-js";
import ChatHeader from "@/components/ChatHeader";

export default function ClientChatContent({ user }: { user: SupabaseUser | undefined }) {
  const { state } = useRoomContext();
  const { selectedRoom } = state;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden"> {/* FIXED: overflow-hidden on root to prevent double-scroll */}
      {/* Header - Fixed height, no scroll */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <ChatHeader user={user} />
      </div>
      
      {/* Main Content Area - FIXED: flex-1 with overflow-hidden, min-h-0 for proper flex behavior */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {user && selectedRoom ? (
          <>
            {/* Messages Area - FIXED: flex-1 with overflow-hidden; internal scroll via ListMessages */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatMessages />
            </div>
            {/* Input Area - Fixed height, no scroll */}
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
              <ChatInput />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <ChatAbout />
          </div>
        )}
      </div>
    </div>
  );
}