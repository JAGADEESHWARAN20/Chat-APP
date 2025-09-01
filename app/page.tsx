"use client";

import React, { useState } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import InitUser from "@/lib/initialization/InitUser";
import ClientChatContent from "@/components/ClientChatContent";
import LoginLogoutButton from "@/components/LoginLogoutButton";
import SearchComponent from "@/components/SearchComponent";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import NotificationsWrapper from "@/components/NotificationsWrapper";
import { RoomProvider } from "@/lib/store/RoomContext";
import LeftSidebar from "@/components/LeftSidebar";

export default function Page() {
  // Use client-side state for sidebar toggle since this is now a client component
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <RoomProvider user={undefined}>
      <div className="min-h-screen flex flex-col overflow-hidden">
        {/* Header section with full width */}
        <header className="w-full px-4 py-2 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 glass-gradient-header">
          <div className="flex items-center justify-between max-w-[100vw] mx-auto w-full">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 rounded-md glass-button"
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                {isSidebarOpen ? (
                  <svg
                    className="w-5 h-5 text-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent">
                FlyChat
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <SearchComponent user={undefined} />
              <CreateRoomDialog user={undefined} />
              <NotificationsWrapper />
              <LoginLogoutButton user={undefined} />
            </div>
          </div>
        </header>

        {/* Main content area */}
        <div className="flex flex-1 w-full overflow-hidden">
          <LeftSidebar user={undefined} isOpen={isSidebarOpen} />
          <div
            className={`flex-1 transition-all duration-300 ${
              isSidebarOpen ? "lg:ml-[25%]" : "lg:ml-0"
            } w-full lg:max-w-[75vw] mx-auto px-4 flex flex-col`}
          >
            <ClientChatContent user={undefined} />
          </div>
        </div>

        <InitUser user={undefined} />
      </div>
    </RoomProvider>
  );
}