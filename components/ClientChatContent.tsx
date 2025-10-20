// components/ClientChatContent.tsx - UPDATED
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
    <div className="h-full w-full flex flex-col">
      {/* Header - Fixed height, no scroll */}
      <div className="flex-shrink-0">
        <ChatHeader user={user} />
      </div>
      
      {/* Main Content Area - Flex container */}
      <div className="flex-1 flex flex-col min-h-0">
        {user && selectedRoom ? (
          <>
            {/* Messages Area - This will scroll internally via ListMessages */}
            <div className="flex-1 min-h-0">
              <ChatMessages />
            </div>
            {/* Input Area - Fixed height, no scroll */}
            <div className="flex-shrink-0">
              <ChatInput />
            </div>
          </>
        ) : (
          <ChatAbout />
        )}
      </div>
    </div>
  );
}