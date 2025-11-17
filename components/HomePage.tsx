"use client";

import React, { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import LoginLogoutButton from "@/components/LoginLogoutButton";
import SearchComponent from "@/components/SearchComponent";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import NotificationsWrapper from "@/components/NotificationsWrapper";
import ChatLayout from "@/components/ChatLayout";
import { ChevronRight, Home, Search, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRoomStore } from "@/lib/store/RoomContext";
import SecureInitUser from "@/lib/initialization/secureInitUser";

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const setRoomUser = useRoomStore((state) => state.setUser);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "search">("home");

  const tabs: { id: "home" | "search"; icon: any; label: string }[] = [
    { id: "home", icon: Home, label: "Home" },
    { id: "search", icon: Search, label: "Search" },
  ];

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
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <header
        className="
          w-full px-4 py-3 border-b border-border/40
          bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60
          sticky top-0 z-20 shadow-sm transition-colors duration-200
        "
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          
          {/* Left Section */}
          <div className="flex items-center gap-3 md:gap-6">
            {/* Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="
                lg:hidden w-10 h-10 flex items-center justify-center
                rounded-xl transition-all duration-300
                hover:bg-[hsl(var(--muted))]/40 focus:ring-2 focus:ring-[hsl(var(--action-ring))]/50
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
              <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center shadow-inner">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <h1
                className="
                  text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-500 to-green-500
                  bg-clip-text text-transparent hidden sm:block
                "
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
                "bg-[hsl(var(--muted))]/40 backdrop-blur-md shadow-inner overflow-hidden"
              )}
            >
              {/* Animated Morph Background */}
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={activeTab}
                  layoutId="tabGlow"
                  className="absolute rounded-xl backdrop-blur-xl"
                  style={{
                    inset: activeTab === "home" ? "4px 52% 4px 4px" : "4px 4px 4px 52%",
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
                        rotate: isActive ? 0 : 0,
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
              <LoginLogoutButton user={user} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - FIXED SCROLLING ISSUE */}
      <main className="flex-1 flex w-full overflow-hidden">
        <AnimatePresence mode="sync" initial={false}>
          {activeTab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="flex-1"
            >
              <ChatLayout
                user={user}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
              />
            </motion.div>
          )}

          {activeTab === "search" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="flex-1 overflow-hidden" 
            >
              {/* FIXED: This container should NOT scroll */}
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 overflow-hidden"> {/* ADDED: This prevents parent scrolling */}
                  <SearchComponent user={user} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SecureInitUser />
    </div>
  );
}