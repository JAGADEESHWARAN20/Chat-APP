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
    <div className="h-[90vh] w-full mx-auto flex flex-col">
      <ChatHeader user={user} />
      <div className="flex-1 flex flex-col">
        {user && selectedRoom ? (
          <>
            <div className="flex-1 overflow-y-scroll h-[90%]  transparent-scrollbar-track">
              <ChatMessages />
            </div>
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