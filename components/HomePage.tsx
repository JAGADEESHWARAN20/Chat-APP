"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";
import { useSidebar } from "@/components/sidebar"; // ⭐ NEW: detect right sidebar state

import LeftSidebar from "@/components/LeftSidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import ChatAbout from "@/components/ChatAbout";
import ChatHeader from "@/components/ChatHeader";
import SearchComponent from "@/components/SearchComponent";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import NotificationsWrapper from "@/components/NotificationsWrapper";

import { Home, Search as SearchIcon, Menu, PanelLeft } from "lucide-react";
import SecureInitUser from "@/lib/initialization/secureInitUser";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";

interface UnifiedHomeProps {
  initialSidebarState?: "expanded" | "collapsed";
  onSidebarToggle?: () => void;
  sidebarState?: any;
  onSettingsSidebarToggle?: () => void;
}

export default function UnifiedHome({
  initialSidebarState = "collapsed",
  sidebarState,
  onSettingsSidebarToggle,
}: UnifiedHomeProps) {
  const [user, setUser] = useState<any>(null);
  const setRoomUser = useUnifiedRoomStore((s) => s.setUser);
  
  // ⭐ LEFT SIDEBAR STATE
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(
    initialSidebarState === "expanded"
  );

  const toggleLeftSidebar = useCallback(() => {
    setIsLeftSidebarOpen((prev) => !prev);
  }, []);

  // ⭐ Detect RIGHT SIDEBAR (SidebarLayout)
  const { state: rightSidebarState } = useSidebar();
  const isRightSidebarOpen = rightSidebarState === "expanded";
  
  const toggleSettingsSidebar = () => {
    if (onSettingsSidebarToggle) onSettingsSidebarToggle();
    else window.dispatchEvent(new CustomEvent("toggle-settings-sidebar"));
  };
  
  useEffect(() => {
    if (sidebarState !== undefined) {
      setIsLeftSidebarOpen(sidebarState === "expanded");
    }
  }, [sidebarState]);
  
  const [activeTab, setActiveTab] = useState<"home" | "search" | "settings">(
    "home"
  );
  
  const tabs = useMemo(
    () => [
      { id: "home" as const, icon: Home, label: "Home", onClick: () => setActiveTab("home") },
      { id: "search" as const, icon: SearchIcon, label: "Search", onClick: () => setActiveTab("search") },
      { id: "settings" as const, icon: PanelLeft, label: "Settings", onClick: toggleSettingsSidebar },
    ],
    [toggleSettingsSidebar]
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);
  
  useEffect(() => {
    if (user) setRoomUser(user);
  }, [user, setRoomUser]);
  
  const headerHeight = "3.6em";
  const inputHeight = "4em";
  
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  
  const sidebarWidth = isMobile ? 260 : 420;
  const shiftX = useMemo(() => {
    if (isLeftSidebarOpen) return sidebarWidth;
    if (isRightSidebarOpen) return -sidebarWidth;
    return 0;
  }, [isLeftSidebarOpen, isRightSidebarOpen, sidebarWidth]);
  
  return (
    <div className="min-h-screen w-full flex bg-[hsl(var(--background))] text-[hsl(var(--foreground))] overflow-hidden">

      {/* ========== LEFT SIDEBAR ========== */}
      <motion.div
        className={cn(
          "fixed top-0 left-0 bottom-0",
          "bg-[hsl(var(--background))] border-r border-[hsl(var(--border))] shadow-2xl",
          "flex flex-col will-change-transform",
          "z-[300]"
        )}
        initial={false}
        animate={{
          x: isLeftSidebarOpen ? 0 : -sidebarWidth,
        }}
        style={{
          width: sidebarWidth,
        }}
        
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 30,
        }}
      
      >
        <LeftSidebar
          user={user ? { id: user.id } : null}
          isOpen={isLeftSidebarOpen}
          onClose={toggleLeftSidebar}
        />
      </motion.div>

      {/* ========== MAIN CONTENT (NOW RESPONDS TO BOTH SIDEBARS) ========== */}
      <motion.div
        className="flex-1 flex flex-col min-w-0 relative z-[0]"
        animate={{ x: shiftX }}

        transition={{
          type: "spring",
          stiffness: 260,
          damping: 30,
        }}
      >

        {/* ========== HEADER ========== */}
        <header
          className={cn(
            "w-full px-4 py-3 border-b flex-none sticky top-0 z-[200]",
            "bg-[hsl(var(--background))]/90 backdrop-blur-xl"
          )}
          style={{
            height: headerHeight,
            borderColor: "hsl(var(--border)/0.12)",
          }}
        >
          <div className="flex items-center justify-between h-full w-full">

            {/* Left Menu Button + Logo */}
            <h1 className="text-lg md:text-xl font-bold text-[hsl(var(--text-color))] flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleLeftSidebar}
                className="w-10 h-10 rounded-xl hover:bg-[hsl(var(--muted))]/40 active:scale-95 transition"
              >
                <Menu className="w-5 h-5" />
              </Button>
              FlyChat
            </h1>

            {/* Desktop Tabs */}
            <div className="hidden md:flex items-center gap-2 p-1 rounded-2xl backdrop-blur-md mx-4 flex-1 max-w-2xl justify-center">
              {tabs.map(({ id, icon: Icon, label, onClick }) => (
                <button
                  key={id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    activeTab === id && id !== "settings"
                      ? "bg-[hsl(var(--action-active))]/20 text-[hsl(var(--action-active))]"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2">
                <CreateRoomDialog user={user} />
                <NotificationsWrapper />
              </div>

              {/* Mobile Action Tabs */}
              <div className="flex items-center gap-1 lg:hidden">
                <div className="flex items-center gap-1 p-1 rounded-2xl bg-[hsl(var(--muted))] backdrop-blur-md">
                  {tabs.map(({ id, icon: Icon, onClick }) => {
                    const isActive = activeTab === id && id !== "settings";
                    return (
                      <Button
                        key={id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClick();
                        }}
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "w-9 h-9 rounded-xl transition-all duration-200",
                          isActive
                            ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                            : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]/60"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ========== MAIN AREA ========== */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "home" && (
              <motion.section
                key="home"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
                className="flex-1 flex w-full"
              >
                <div className="flex-1 flex flex-col h-[90vh] md:h-full md:w-[60vw] w-full">
                  <div
                    style={{ height: headerHeight }}
                    className="flex-shrink-0 px-4 border-b border-[hsl(var(--border)/0.12)]"
                  >
                    <ChatHeader user={user} />
                  </div>

                  <div className="flex-1 flex flex-col md:w-[60vw] w-full">
                    {user && useUnifiedRoomStore.getState().selectedRoomId ? (
                      <>
                        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 sm:px-4">
                          <ChatMessages />
                        </div>
                        <div
                          style={{ height: inputHeight }}
                          className="flex-shrink-0 px-2 sm:px-4 border-t border-[hsl(var(--border)/0.12)]"
                        >
                          <ChatInput />
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <ChatAbout />
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative md:w-[40vw] w-full hidden md:block">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                    <span className="text-custom-color text-custom-size font-bold opacity-80">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </motion.section>
            )}

            {activeTab === "search" && (
              <motion.section
                key="search"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <SearchComponent user={user} />
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        <SecureInitUser />
      </motion.div>
    </div>
  );
}
