"use client";

import React, { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import SearchComponent from "@/components/SearchComponent";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import NotificationsWrapper from "@/components/NotificationsWrapper";
import ChatLayout from "@/components/ChatLayout";
import { SidebarTrigger } from "@/components/sidebar";
import { Home, Search as SearchIcon, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import SecureInitUser from "@/lib/initialization/secureInitUser";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";

interface HomePageProps {
  sidebarState?: "expanded" | "collapsed";
}

export default function HomePage({ sidebarState = "collapsed" }: HomePageProps) {
  const [user, setUser] = useState<any>(null);
  const setRoomUser = useUnifiedRoomStore((state) => state.setUser);
  const [activeTab, setActiveTab] = useState<"home" | "search">("home");

  const tabs: { id: "home" | "search"; icon: any; label: string }[] = [
    { id: "home", icon: Home, label: "Home" },
    { id: "search", icon: SearchIcon, label: "Search" },
  ];

  const isSidebarOpen = sidebarState === "collapsed";

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
    <div className={cn(
      "h-screen w-full flex flex-col overflow-hidden bg-background transition-all duration-300 ease-in-out",
      // Let the sidebar handle the layout shifts naturally
      "lg:transition-all lg:duration-300 lg:ease-in-out"
    )}>
      {/* Header with sidebar-aware styling */}
      <header
        className={cn(
          "w-full px-4 py-3 border-b border-border/40",
          "bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80",
          "sticky top-0 z-40 shadow-sm transition-all duration-300",
          "flex-none",
          // Remove backdrop blur on mobile to fix transparency issues
          "max-lg:bg-background max-lg:backdrop-blur-0"
        )}
      >
        <div className="flex items-center justify-between w-full">
          {/* Left Section */}
          <div className="flex items-center gap-3 md:gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center shadow-inner">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <h1
                className={cn(
                  "text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-500 to-green-500",
                  "bg-clip-text text-transparent hidden sm:block transition-all duration-300",
                  isSidebarOpen && "lg:opacity-90 lg:scale-95"
                )}
              >
                FlyChat
              </h1>
            </div>

            {/* Desktop Tabs */}
            <div className="hidden md:flex items-center gap-2 p-1 rounded-2xl bg-[hsl(var(--muted))]/50 backdrop-blur-md">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                    activeTab === id
                      ? "bg-[hsl(var(--action-active))]/20 text-[hsl(var(--action-active))] shadow-inner"
                      : "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--muted))]/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Tabs */}
            <div
              className={cn(
                "relative flex md:hidden items-center justify-center gap-1 px-2 py-1 rounded-2xl",
                "bg-[hsl(var(--muted))] backdrop-blur-md shadow-inner overflow-hidden",
                // Solid background on mobile
                "max-lg:bg-[hsl(var(--muted))] max-lg:backdrop-blur-0"
              )}
            >
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={activeTab}
                  layoutId="tabGlow"
                  className="absolute rounded-xl backdrop-blur-xl"
                  style={{
                    inset:
                      activeTab === "home"
                        ? "4px 52% 4px 4px"
                        : "4px 4px 4px 52%",
                    background: "hsl(var(--action-active))",
                    filter: "blur(8px)",
                    opacity: 0.25,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 240,
                    damping: 20,
                    mass: 0.6,
                  }}
                />
              </AnimatePresence>

              {tabs.map(({ id, icon: Icon, label }) => {
                const isActive = activeTab === id;
                return (
                  <motion.button
                    key={id}
                    title={label}
                    onClick={() => setActiveTab(id)}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className={cn(
                      "relative z-10 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300",
                      isActive
                        ? "bg-[hsl(var(--action-active))]/25 text-[hsl(var(--action-active))] shadow-inner"
                        : "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--muted))]/40"
                    )}
                  >
                    <motion.div
                      animate={{
                        scale: isActive ? 1.2 : 1,
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    >
                      <Icon className="w-4 h-4" />
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              <CreateRoomDialog user={user} />
              <NotificationsWrapper />

              {/* Sidebar trigger */}
              <SidebarTrigger
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 hover:bg-[hsl(var(--muted))]/40 focus:ring-2 focus:ring-[hsl(var(--action-ring))]/50 active:scale-95",
                  isSidebarOpen && "bg-[hsl(var(--muted))]/30"
                )}
                aria-label="Toggle sidebar"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 h-full w-full overflow-hidden"
            >
              <ChatLayout user={user} isOpen={false} onClose={() => {}} />
            </motion.div>
          )}

          {activeTab === "search" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 h-full w-full flex flex-col overflow-hidden"
            >
              <div className="w-full h-full flex flex-col overflow-hidden">
                <SearchComponent user={user} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SecureInitUser />
    </div>
  );
}