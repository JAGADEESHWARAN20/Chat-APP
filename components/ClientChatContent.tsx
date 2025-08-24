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
        <div className="h-[90vh] w-[98vw] lg:w-[50vw] mx-[1em] flex flex-col">
            {user ? (
                selectedRoom ? (
                    <>
                        {/* Messages area - scrollable */}
                        <div className="flex-1 overflow-y-auto">
                            <ChatMessages />
                        </div>
                        {/* Input area - fixed at bottom */}
                        <div className="flex-shrink-0">
                            <ChatInput />
                        </div>
                    </>
                ) : (
                    <ChatAbout />
                )
            ) : (
                <ChatAbout />
            )}
        </div>
    );
}