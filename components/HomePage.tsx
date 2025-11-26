"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {  useUnifiedRoomStore } from "@/lib/store/roomstore";

import RightSidebarContent from "@/components/sidebar/RightSidebarContent";
import {  SidebarProvider } from "@/components/sidebar";
import LeftSidebar from "@/components/LeftSidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import ChatAbout from "@/components/ChatAbout";
import ChatHeader from "@/components/ChatHeader";
import SearchComponent from "@/components/SearchComponent";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import NotificationsWrapper from "@/components/NotificationsWrapper";
import SecureInitUser from "@/lib/initialization/secureInitUser";
import { Home, Search as SearchIcon,  PanelLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ThemeTransitionWrapper } from "./ThemeTransitionWrapper";
import { PresenceConnector } from "./PresenceConnector";
import { useUser } from "@/lib/store/user";
interface UnifiedHomeProps {
  initialSidebarState?: "expanded" | "collapsed";
  onSidebarToggle?: () => void;
  sidebarState?: any;
  onSettingsSidebarToggle?: () => void;
}

function UnifiedHomeContent({
  initialSidebarState = "collapsed",
  sidebarState,
}: UnifiedHomeProps) {
  const { user } = useUser();

  const setRoomUser = useUnifiedRoomStore((s) => s.setUser);

  // --- 1. Init Data ---


  useEffect(() => {
    if (user) setRoomUser(user);
  }, [user, setRoomUser]);

  // --- 2. Layout Constants ---
  const isMobile = useMediaQuery("(max-width: 768px)");
  const SIDEBAR_WIDTH = isMobile ? 280 : 520; // 280px is standard mobile sidebar width
  const HEADER_HEIGHT = "60px";

  // --- 3. State Management ---
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(initialSidebarState === "expanded");
  const [manualRightOpen, setManualRightOpen] = useState(false);
  
  // Sync prop state if provided
  useEffect(() => {
    if (sidebarState !== undefined) {
      setIsLeftSidebarOpen(sidebarState === "expanded");
    }
  }, [sidebarState]);

  // --- 4. Toggles (Strict Mutual Exclusion) ---
  
  const handleToggleLeft = useCallback(() => {
    setIsLeftSidebarOpen((prev) => {
      const willOpen = !prev;
      // If opening left, MUST close right to prevent collision
      if (willOpen) setManualRightOpen(false);
      return willOpen;
    });
  }, []);

  const handleToggleRight = useCallback(() => {
    setManualRightOpen((prev) => {
      const willOpen = !prev;
      // If opening right, MUST close left to prevent collision
      if (willOpen) setIsLeftSidebarOpen(false);
      return willOpen;
    });
  }, []);

  // --- 5. Dynamic Styles (The Refactor) ---

  // LEFT SIDEBAR STYLE
  const leftSidebarStyle: React.CSSProperties = useMemo(() => {
    if (isMobile) {
      // Mobile: Absolute positioning + Translate
      return {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: `${SIDEBAR_WIDTH}px`,
        transform: isLeftSidebarOpen ? "translateX(0%)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 50, // Above header
        
      };
    }
    // Desktop: Flex resizing
    return {
      width: isLeftSidebarOpen ? `${SIDEBAR_WIDTH}px` : "0px",
      transform: "none",
      transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    };
  }, [isMobile, isLeftSidebarOpen, SIDEBAR_WIDTH]);

  // RIGHT SIDEBAR STYLE
  const rightSidebarStyle: React.CSSProperties = useMemo(() => {
    if (isMobile) {
      // Mobile: Absolute positioning + Translate
      return {
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: `${SIDEBAR_WIDTH}px`,
        transform: manualRightOpen ? "translateX(0%)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 50, // Above header
        
      };
    }
    // Desktop: Flex resizing
    return {
      width: manualRightOpen ? `${SIDEBAR_WIDTH - 20}px` : "0px",
      transform: "none",
      transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    };
  }, [isMobile, manualRightOpen, SIDEBAR_WIDTH]);

  const selectedRoomId = useUnifiedRoomStore((s) => s.selectedRoomId);
const currentUser = useUnifiedRoomStore((s) => s.user);




  // MAIN CONTENT STYLE
  const mainStyle: React.CSSProperties = useMemo(() => {
    if (isMobile) {
      // Mobile: Translate the WHOLE content area based on which sidebar is open.
      // If Left is open -> Move Right (+Width)
      // If Right is open -> Move Left (-Width)
      // If Closed -> Stay at 0
      const xOffset = isLeftSidebarOpen 
        ? SIDEBAR_WIDTH 
        : (manualRightOpen ? -SIDEBAR_WIDTH : 0);

      return {
        transform: `translateX(${xOffset}px)`,
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        width: "100%", // Ensure content maintains full width even when pushed off-screen
      };
    }

    // Desktop: Push content using Margins (layout reflow)
    return {
      marginLeft: isLeftSidebarOpen ? `${SIDEBAR_WIDTH-520}px` : "0px",
      marginRight: manualRightOpen ? `${SIDEBAR_WIDTH - 520}px` : "0px",
      transition: "margin 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    };
  }, [isMobile, isLeftSidebarOpen, manualRightOpen, SIDEBAR_WIDTH]);

  // --- 6. Tabs Logic ---
  const [activeTab, setActiveTab] = useState<"home" | "search">("home");
  const tabs = useMemo(
    () => [
      { id: "home" as const, icon: Home, label: "Home", onClick: () => setActiveTab("home") },
      { id: "search" as const, icon: SearchIcon, label: "Search", onClick: () => setActiveTab("search") },
    ],
    []
  );

  return (
    <div className="flex h-[100vh] w-screen overflow-hidden bg-background text-foreground relative">
      <PresenceConnector 
  roomId={selectedRoomId} 
  userId={currentUser?.id ?? null} 
/>

      <SecureInitUser />

      {/* --- LEFT SIDEBAR --- */}
      <aside
        className={cn(
          "flex-shrink-0 flex flex-col bg-background border-r overflow-hidden",
          !isMobile && "relative h-full"
        )}
        style={leftSidebarStyle}
      >
        <div className="h-full w-full flex flex-col">
          <LeftSidebar
            user={user ? { id: user.id } : null}
            isOpen={isLeftSidebarOpen}
            onClose={() => setIsLeftSidebarOpen(false)}
            handleToggleLeft={handleToggleLeft}
          />
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main
        style={mainStyle}
        className="flex-1 flex flex-col min-w-0 relative z-0 bg-background transition-all duration-300"
      >
        {/* Header */}
        <header
          className="w-full border-b flex-none sticky top-0 z-20 bg-background/95 backdrop-blur-xl flex items-center justify-between"
          style={{ height: HEADER_HEIGHT }}
        >
          <div className="flex items-center gap-3">
            {activeTab !== "search" && <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleLeft}
              className={cn("hover:bg-accent opacity-60 rounded-xl")}
            >
              {isLeftSidebarOpen ? "" : <PanelLeft className={`w-[2em] h-[2em] `} />}
            </Button>
            }
            <h1 className="text-[2em] font-bold block pl-2">FlyChat</h1>
          </div>

          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-2xl">
            {tabs.map(({ id, icon: Icon, label, onClick }) => (
              <button
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200",
                  activeTab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="w-[2em] h-[2em]" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 pr-3">
            <CreateRoomDialog user={user} />
            <NotificationsWrapper />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleRight}
              className={cn("flex", manualRightOpen && "bg-accent/50")}
            >
              <Settings className="w-[2em] h-[2em]" />
            </Button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden  relative flex flex-col">
         
          

          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "home" && (
              <motion.section
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col h-full w-full"
              >
                <div className="flex-1 flex flex-col h-[95dvh] pb-[3em] w-full">
                  <div className="flex-none px-4 pb-[1em] border-b bg-background/50">
                    <ChatHeader user={user} />
                  </div>
                  <div className="flex-1 flex flex-col w-full relative">
                    <div className="absolute inset-0 flex flex-col">
                    {user && selectedRoomId ? (
                        <div className="w-full h-auto flex flex-col lg:flex-row">
                          {/* Chat Container */}
                          <div className="flex-1  flex flex-col ">
                            <div className="flex-1 px-2  ">
                              <ChatMessages />
                            </div>
                            <div className="flex-none border-t bg-background">
                              <ChatInput />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center p-8">
                          <ChatAbout />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.section>
            )}

            {activeTab === "search" && (
              <motion.section
                key="search"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col overflow-hidden p-4"
              >
                <SearchComponent user={user} />
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* --- RIGHT SIDEBAR --- */}
      <aside
        className={cn(
          "flex-shrink-0 flex flex-col bg-background border-l overflow-hidden",
          !isMobile && "relative h-full"
        )}
        style={rightSidebarStyle}
      >
        <div className="h-full w-full flex flex-col">
          <RightSidebarContent width={SIDEBAR_WIDTH} onClose={handleToggleRight} />
        </div>
      </aside>
    </div>
  );
}

export default function UnifiedHome(props: UnifiedHomeProps) {
  return (
    <ThemeTransitionWrapper>
      <SidebarProvider defaultOpen={false}>
        <UnifiedHomeContent {...props} />
      </SidebarProvider>
    </ThemeTransitionWrapper>
  );
}