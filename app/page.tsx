"use client";

import React, { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import InitUser from "@/lib/initialization/InitUser";
import LoginLogoutButton from "@/components/LoginLogoutButton";
import SearchComponent from "@/components/SearchComponent";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import NotificationsWrapper from "@/components/NotificationsWrapper";
import { RoomProvider } from "@/lib/store/RoomContext";
import ChatLayout from "@/components/ChatLayout";
import { ChevronLeft, ChevronRight, Home, Search } from "lucide-react";

export default function Page() {
  const [user, setUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "search">("home");

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  return (
    <RoomProvider user={user}>
      <div className="min-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <header className="w-full px-4 py-3 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 glass-gradient-header">
          <div className="flex items-center justify-between max-w-[100vw] mx-auto w-full">
            
            {/* Left section (Sidebar toggle + Logo + Tabs) */}
            <div className="flex items-center gap-[.1em]">
              {/* Sidebar toggle (mobile only) */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden glass-button"
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                {isSidebarOpen ? (
                  <ChevronLeft className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>

              {/* Logo */}
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent">
                FlyChat
              </h1>

              
            </div>

            {/* Right section (Actions) */}
            <div className="flex items-center gap-2">
              {/* Tabs */}
              <div className="flex items-center gap-[.01em] ">
                <button
                  onClick={() => setActiveTab("home")}
                  className={`glass-button flex items-center gap-2 ${
                    activeTab === "home" ? "bg-primary/20" : ""
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Home</span>
                </button>
                <button
                  onClick={() => setActiveTab("search")}
                  className={`glass-button flex items-center gap-2 ${
                    activeTab === "search" ? "bg-primary/20" : ""
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              </div>
              <CreateRoomDialog user={user} />
              <NotificationsWrapper />
              <LoginLogoutButton user={user} />
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 w-full overflow-hidden">
          {activeTab === "home" ? (
            <ChatLayout
              user={user}
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />
          ) : (
            <div className="flex-1 w-full px-6 py-4 overflow-y-auto">
              <SearchComponent user={user} />
            </div>
          )}
        </div>

        <InitUser user={user} />
      </div>
    </RoomProvider>
  );
}
