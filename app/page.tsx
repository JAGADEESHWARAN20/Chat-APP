"use client";

import React, { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import InitUser from "@/lib/initialization/InitUser";
import LoginLogoutButton from "@/components/LoginLogoutButton";
import SearchComponent from "@/components/SearchComponent";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import NotificationsWrapper from "@/components/NotificationsWrapper";
import { RoomProvider } from "@/lib/store/RoomContext";
import ChatLayout from "@/components/ChatLayout";
import { ChevronRight, Home, Search, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoomStore } from "@/lib/store/RoomContext";

export default function Page() {
  return (
    <RoomProvider>
      <PageContent />
    </RoomProvider>
  );
}

function PageContent() {
  const [user, setUser] = useState<any>(null);
  const setRoomUser = useRoomStore((state) => state.setUser);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "search">("home");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (user) setRoomUser(user);
  }, [user, setRoomUser]);

  return (
    <div className="min-h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="
        w-full px-4 py-3 
        border-b border-border/40 
        bg-background/95 backdrop-blur-xl
        supports-[backdrop-filter]:bg-background/60
        sticky top-0 z-50
        shadow-sm
      ">
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          
          {/* Left section */}
          <div className="flex items-center gap-3 md:gap-6">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="
                lg:hidden 
                w-10 h-10 
                flex items-center justify-center
                rounded-lg transition-all duration-200
                hover:bg-accent/50
                focus:outline-none focus:ring-2 focus:ring-primary/20
                active:scale-95
              "
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <ChevronRight 
                className={cn(
                  "w-5 h-5 transition-transform duration-300",
                  isSidebarOpen ? "rotate-180" : "rotate-0"
                )} 
              />
            </button>

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <h1 className="
                text-xl md:text-2xl font-bold 
                bg-gradient-to-r from-blue-500 to-green-500 
                bg-clip-text text-transparent
                hidden sm:block
              ">
                FlyChat
              </h1>
            </div>

            {/* Desktop Navigation Tabs */}
            <div className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-muted/50 border border-border/30">
              <button
                onClick={() => setActiveTab("home")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  activeTab === "home" 
                    ? "bg-background shadow-sm text-foreground border border-border/50" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Home className="w-4 h-4" />
                Home
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  activeTab === "search" 
                    ? "bg-background shadow-sm text-foreground border border-border/50" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile Navigation Tabs */}
            <div className="flex md:hidden items-center gap-1 p-1 rounded-2xl bg-muted/50 border border-border/30">
              <button
                title="Home"
                onClick={() => setActiveTab("home")}
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200",
                  activeTab === "home" 
                    ? "bg-background shadow-sm text-primary border border-border/50" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Home className="w-4 h-4" />
              </button>
              <button
                title="Search"
                onClick={() => setActiveTab("search")}
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200",
                  activeTab === "search" 
                    ? "bg-background shadow-sm text-primary border border-border/50" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-2">
              <CreateRoomDialog user={user} />
              <NotificationsWrapper />
              <LoginLogoutButton user={user} />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex w-full overflow-hidden">
        {/* Home Tab */}
        <div className={cn(
          "flex-1 w-full transition-opacity duration-300",
          activeTab === "home" ? "opacity-100 block" : "opacity-0 hidden"
        )}>
          <ChatLayout
            user={user}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>
        
        {/* Search Tab */}
        <div className={cn(
          "flex-1 w-full transition-opacity duration-300",
          activeTab === "search" ? "opacity-100 block" : "opacity-0 hidden"
        )}>
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  Discover Rooms
                </h2>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Find and join interesting conversations
                </p>
              </div>
              <SearchComponent user={user} />
            </div>
          </div>
        </div>
      </main>

      <InitUser user={user} />
    </div>
  );
}