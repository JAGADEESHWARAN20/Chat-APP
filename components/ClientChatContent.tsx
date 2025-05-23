"use client";

import React from "react";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import ChatAbout from "@/components/ChatAbout";
import { useRoomStore } from "@/lib/store/roomstore";
import { User as SupabaseUser } from "@supabase/supabase-js";

export default function ClientChatContent({ user }: { user: SupabaseUser | undefined }) {
     const selectedRoom = useRoomStore((state) => state.selectedRoom);

     return (
          <>
               {user ? (
                    selectedRoom ? (
                         <>
                              <ChatMessages />
                              <ChatInput />
                         </>
                    ) : (
                         <ChatAbout />
                    )
               ) : (
                    <ChatAbout />
               )}
          </>
     );
}