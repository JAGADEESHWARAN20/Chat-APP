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
        <div className="h-[87vh] w-[98vw] lg:w-[50vw] flex flex-col mx-[1em]">
            <ChatHeader user={user} />
            <div className="flex-1 flex flex-col">
                {user && selectedRoom ? (
                    <>
                        {/* Messages area - scrollable */}
                        <div className="flex-1 overflow-y-auto transparent-scrollbar-track">
                            <ChatMessages />
                        </div>
                        {/* Input area - fixed at bottom */}
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