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
import { Button } from "@/components/ui/button";

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
        {/* Header section with full width */}
        <header className="w-full px-6 py-3 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 glass-gradient-header">
          <div className="flex items-center justify-between max-w-[100vw] mx-auto w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden rounded-md glass-button transition-transform duration-200 hover:scale-110"
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                {isSidebarOpen ? (
                  <ChevronLeft className="w-6 h-6 text-foreground" />
                ) : (
                  <ChevronRight className="w-6 h-6 text-foreground" />
                )}
              </button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent">
                FlyChat
              </h1>
            </div>

            <div className="flex items-center gap-[.01em]">
              {/* Tab Triggers */}
              <button
                onClick={() => setActiveTab("home")}
                className={` p-1 rounded-md glass-button transition-colors ${
                  activeTab === "home" ? "bg-primary/20" : "hover:bg-accent"
                }`}
                aria-label="Home Tab"
              >
                <Home className="w-5 h-5" />
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`p-1 rounded-md glass-button transition-colors ${
                  activeTab === "search" ? "bg-primary/20" : "hover:bg-accent"
                }`}
                aria-label="Search Tab"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Other actions */}
              <CreateRoomDialog user={user} />
              <NotificationsWrapper />
              <LoginLogoutButton user={user} />
            </div>
          </div>
        </header>

        {/* Main content area */}
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
