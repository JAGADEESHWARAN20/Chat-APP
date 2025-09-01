"use client";

import React, { useState } from "react";
import LeftSidebar from "@/components/LeftSidebar";
import ClientChatContent from "@/components/ClientChatContent";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";

export default function ChatLayout({ user }: { user: SupabaseUser | undefined }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Start closed on mobile

  return (
    <div className="flex-1 w-full flex transition-all duration-300">
      <LeftSidebar user={user} isOpen={isSidebarOpen} />
      <div
        className={`flex-1 w-full lg:max-w-[75vw] mx-auto px-6 py-4 flex flex-col ${
          isSidebarOpen ? "lg:ml-[25%]" : "lg:ml-0"
        }`}
      >
        <ClientChatContent user={user} />
      </div>
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed top-1/2 left-4 p-2 rounded-md glass-button transition-transform duration-200 hover:scale-110 z-50"
        aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isSidebarOpen ? (
          <ChevronLeft className="w-6 h-6 text-foreground" />
        ) : (
          <ChevronRight className="w-6 h-6 text-foreground" />
        )}
      </button>
    </div>
  );
}