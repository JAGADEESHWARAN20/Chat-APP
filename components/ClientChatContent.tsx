// components/ClientChatContent.tsx - FIXED LAYOUT
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
    <div className="h-screen flex flex-col overflow-hidden"> {/* FIXED: Use h-screen for full viewport height */}
      {/* Header - Fixed height */}
      <div className="flex-shrink-0 h-16 border-b border-gray-200 dark:border-gray-700"> {/* FIXED: Use h-16 instead of [4em] */}
        <ChatHeader user={user} />
      </div>
      
      {/* Main Content Area - FIXED: flex-1 with proper constraints */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {user && selectedRoom ? (
          <>
            {/* Messages Area - FIXED: flex-1 with overflow-hidden */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatMessages />
            </div>
            {/* Input Area - Fixed height */}
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
              <ChatInput />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
            <ChatAbout />
          </div>
        )}
      </div>
    </div>
  );
}