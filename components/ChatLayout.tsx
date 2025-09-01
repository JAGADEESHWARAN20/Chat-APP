"use client";

import React from "react";
import LeftSidebar from "@/components/LeftSidebar";
import ClientChatContent from "@/components/ClientChatContent";
import { User as SupabaseUser } from "@supabase/supabase-js";

export default function ChatLayout({
  user,
  isOpen,
  onClose,
}: {
  user: SupabaseUser | undefined;
  isOpen: boolean;
  onClose?: () => void; 
}) {
  return (
    <div className="flex-1 w-full flex transition-all duration-300">
      <LeftSidebar user={user} isOpen={isOpen} onClose={onClose} /> {/* 🔹 pass it down */}
      <div
        className={`flex-1 w-full lg:max-w-[75vw] mx-auto px-6 py-4 h-[90%] flex flex-col ${
          isOpen ? "lg:ml-[25%]" : "lg:ml-0"
        }`}
      >
        <ClientChatContent user={user} />
      </div>
    </div>
  );
}
