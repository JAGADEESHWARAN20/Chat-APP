"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";

import RightSidebarContent from "@/components/sidebar/RightSidebarContent";
import { SidebarProvider } from "@/components/sidebar";
import LeftSidebar from "@/components/LeftSidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import ChatAbout from "@/components/ChatAbout";
import ChatHeader from "@/components/ChatHeader";
import SearchComponent from "@/components/SearchComponent";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import NotificationsWrapper from "@/components/NotificationsWrapper";

import { Home, Search as SearchIcon, PanelLeft, Settings, X, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ThemeTransitionWrapper } from "./ThemeTransitionWrapper";
import { PresenceConnector } from "./PresenceConnector";
import { useUser } from "@/lib/store/user";
import { useMessage } from "@/lib/store/messages";


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

  // Keep roomstore.user synced with auth user


  // --- Search State ---
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);


  // --- 2. Layout Constants ---
  const isMobile = useMediaQuery("(max-width: 768px)");
  const SIDEBAR_WIDTH = isMobile ? 280 : 520;
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
      if (willOpen) setManualRightOpen(false);
      return willOpen;
    });
  }, []);

  const handleToggleRight = useCallback(() => {
    setManualRightOpen((prev) => {
      const willOpen = !prev;
      if (willOpen) setIsLeftSidebarOpen(false);
      return willOpen;
    });
  }, []);

  // --- 5. Search Handlers ---
  const handleSearchToggle = useCallback(() => {
    setIsSearchExpanded((prev) => {
      const willOpen = !prev;
      if (willOpen) {
        // When expanding search, close other sidebars and switch to home tab
        setIsLeftSidebarOpen(false);
        setManualRightOpen(false);
        setActiveTab("home");
      }
      return willOpen;
    });
  }, []);

  const handleSearchBack = useCallback(() => {
    setIsSearchExpanded(false);
    setSearchQuery("");
    setIsSearching(false);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim()) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery("");
    setIsSearching(false);
  }, []);

  // --- 6. Dynamic Styles ---
  const leftSidebarStyle: React.CSSProperties = useMemo(() => {
    if (isMobile) {
      return {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: `${SIDEBAR_WIDTH}px`,
        transform: isLeftSidebarOpen ? "translateX(0%)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 50,
      };
    }
    return {
      width: isLeftSidebarOpen ? `${SIDEBAR_WIDTH}px` : "0px",
      transform: "none",
      transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    };
  }, [isMobile, isLeftSidebarOpen, SIDEBAR_WIDTH]);

  const rightSidebarStyle: React.CSSProperties = useMemo(() => {
    if (isMobile) {
      return {
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: `${SIDEBAR_WIDTH}px`,
        transform: manualRightOpen ? "translateX(0%)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 50,
      };
    }
    return {
      width: manualRightOpen ? `${SIDEBAR_WIDTH - 20}px` : "0px",
      transform: "none",
      transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    };
  }, [isMobile, manualRightOpen, SIDEBAR_WIDTH]);

  const mainStyle: React.CSSProperties = useMemo(() => {
    if (isMobile) {
      const xOffset = isLeftSidebarOpen
        ? SIDEBAR_WIDTH
        : (manualRightOpen ? -SIDEBAR_WIDTH : 0);
      return {
        transform: `translateX(${xOffset}px)`,
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        width: "100%",
      };
    }
    return {
      marginLeft: isLeftSidebarOpen ? `${SIDEBAR_WIDTH - 520}px` : "0px",
      marginRight: manualRightOpen ? `${SIDEBAR_WIDTH - 520}px` : "0px",
      transition: "margin 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    };
  }, [isMobile, isLeftSidebarOpen, manualRightOpen, SIDEBAR_WIDTH]);

  const selectedRoomId = useUnifiedRoomStore((s) => s.selectedRoomId);
  const { setActiveRoom, loadInitialMessages, subscribeToRoom, unsubscribeFromRoom } =
    useMessage((s) => ({
      setActiveRoom: s.setActiveRoom,
      loadInitialMessages: s.loadInitialMessages,
      subscribeToRoom: s.subscribeToRoom,
      unsubscribeFromRoom: s.unsubscribeFromRoom,
    }));

  // when room changes → switch cache + (if needed) fetch once
  useEffect(() => {
    if (!selectedRoomId) {
      setActiveRoom(null);
      unsubscribeFromRoom();
      return;
    }

    setActiveRoom(selectedRoomId);
    loadInitialMessages(selectedRoomId); // cached after first time
    subscribeToRoom(selectedRoomId);

    return () => {
      // optional: don't unsubscribe here if you want persistent realtime
      unsubscribeFromRoom();
    };
  }, [selectedRoomId, setActiveRoom, loadInitialMessages, subscribeToRoom, unsubscribeFromRoom]);

  const currentUser = useUnifiedRoomStore((s) => s.user);

  // --- 7. Tabs Logic ---
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
          className="w-full border-b flex-none sticky top-0 z-20 bg-background/95 backdrop-blur-xl flex items-center justify-between px-4"
          style={{ height: HEADER_HEIGHT }}
        >
          {/* Normal Header Layout */}
          {!isSearchExpanded ? (
            <>
              {/* Left Section - Logo and Left Sidebar Toggle */}
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleLeft}
                  className="hover:bg-accent opacity-60 rounded-xl"
                >
                  <PanelLeft className="w-[2em] h-[2em]" />
                </Button>

                <h1 className="text-[2em] font-bold pl-2">FlyChat</h1>
              </div>

              {/* Center Section - Tabs */}
              <div className="flex items-center justify-center flex-1 max-w-2xl">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1 bg-muted/30 p-1 rounded-2xl"
                >
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
                </motion.div>
              </div>

              {/* Right Section - Actions */}
              <div className="flex items-center gap-1 flex-1 justify-end">
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
            </>
          ) : (
            <>
              <div className="flex items-center flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSearchBack}
                  className="hover:bg-accent rounded-xl mr-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              </div>

              {/* Center Section - Search Input */}
              <div className="flex items-center justify-center flex-[2] max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 w-[80vw] max-w-md"
                >
                  <div className="relative  flex-1">
                    <Input
                      placeholder="Search messages..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      autoFocus
                      className="w-full   rounded-xl py-2 px-4 pr-10 focus:border-none focus:outline-none transition-all duration-200"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSearchClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-muted/50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Right Section - Empty space for balance */}
              <div className="flex-1" />
            </>
          )}
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
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
                        <div className="w-full md:w-[50vw]  h-auto flex flex-col lg:flex-row">
                          {/* Chat Container */}
                          <div className="flex-1 flex flex-col">
                            <div className="flex-1 px-2">
                              <ChatMessages
                                searchQuery={searchQuery}
                                isSearching={isSearching}
                                onSearchStateChange={setIsSearching}
                                onSearchTrigger={handleSearchToggle}
                                isSearchExpanded={isSearchExpanded} // Add this line
                              />
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
                <SearchComponent />
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