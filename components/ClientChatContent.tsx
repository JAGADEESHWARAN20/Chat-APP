// components/ClientChatContent.tsx
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
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header - Fixed height */}
      <div className="flex-shrink-0 h-16 border-b border-gray-200 dark:border-gray-700">
        <ChatHeader user={user} />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {user && selectedRoom ? (
          <>
            {/* ChatMessages Area - Takes remaining space */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatMessages />
            </div>
            {/* Input Area - Fixed height */}
            <div className="flex-shrink-0 h-16 border-t border-gray-200 dark:border-gray-700">
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