// components/UnifiedHome.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
import {
  useRoomActions,
  useUnifiedRealtime,
  startUnifiedBackgroundJobs,
  stopUnifiedBackgroundJobs,
  useUnifiedStore
} from "@/lib/store/unified-roomstore";


/**
 * UnifiedHomeContent
 *
 * Lifecycle responsibilities:
 *  - when auth user becomes available: set userId in store, fetchAll, start background jobs
 *  - call useUnifiedRealtime(userId) once (hook) so realtime attaches/detaches safely
 *  - stop background jobs and clear store userId when user logs out or on unmount
 *
 * Important: useUnifiedRealtime MUST be called at top-level of the component body (not conditionally).
 */

interface UnifiedHomeProps {
  initialSidebarState?: "expanded" | "collapsed";
  sidebarState?: any;
}

function UnifiedHomeContent({ initialSidebarState = "collapsed", sidebarState }: UnifiedHomeProps) {
  const { user } = useUser(); // your auth store
  // user?.id shape may vary; your original code showed user?.user?.id
  const userId = (user && (user.id ?? (user.user && user.user.id))) ?? null;

  // Call the realtime hook exactly once (safe). Hook will init/teardown channels for the userId.
  useUnifiedRealtime(userId);

  // unified store accessors and actions
  const setUserId = useUnifiedStore((s) => s.setUserId);
  const fetchAll = useUnifiedStore((s) => s.fetchAll);
  const setActiveTab = useUnifiedStore((s) => s.setActiveTab);
  const selectedRoomId = useUnifiedStore((s) => s.selectedRoomId);

  // NOTE: some code referenced selectedRoom earlier. unified store exposes selectedRoomId,
  // so compute selectedRoom from rooms if available.
  const rooms = useUnifiedStore((s) => (s.rooms ?? []));
  const selectedRoom = useMemo(
    () => rooms.find((r: any) => r?.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const { setActiveRoom, loadInitialMessages, subscribeToRoom, unsubscribeFromRoom } = useMessage((s) => ({
    setActiveRoom: s.setActiveRoom,
    loadInitialMessages: s.loadInitialMessages,
    subscribeToRoom: s.subscribeToRoom,
    unsubscribeFromRoom: s.unsubscribeFromRoom,
  }));

  const { setSelectedRoomId } = useRoomActions();

  // UI state
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // layout helpers
  const isMobile = useMediaQuery("(max-width: 768px)");
  const SIDEBAR_WIDTH = isMobile ? 280 : 520;

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(initialSidebarState === "expanded");
  const [manualRightOpen, setManualRightOpen] = useState(false);

  useEffect(() => {
    if (sidebarState !== undefined) setIsLeftSidebarOpen(sidebarState === "expanded");
  }, [sidebarState]);

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

  const handleSearchToggle = useCallback(() => {
    setIsSearchExpanded((prev) => {
      const willOpen = !prev;
      if (willOpen) {
        setIsLeftSidebarOpen(false);
        setManualRightOpen(false);
        setActiveTab("home");
      }
      return willOpen;
    });
  }, [setActiveTab]);

  const handleSearchBack = useCallback(() => {
    setIsSearchExpanded(false);
    setSearchQuery("");
    setIsSearching(false);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsSearching(Boolean(value && value.trim()));
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery("");
    setIsSearching(false);
  }, []);

  /* --------------------------------------------------------------------------
     CSS VARIABLES FOR INSTANT THEME SWITCHING
  -------------------------------------------------------------------------- */
  const layoutStyles = useMemo(
    () => ({
      backgroundColor: 'hsl(var(--background))',
      foregroundColor: 'hsl(var(--foreground))',
      accentColor: 'hsl(var(--accent))',
      mutedBackground: 'hsl(var(--muted))',
      borderColor: 'hsl(var(--border))',

      fontSizeBase: 'var(--fs-body)',
      fontSizeLarge: 'var(--fs-subtitle)',
      fontFamily: 'var(--font-family-base)',

      headerHeight: 'var(--header-height)',
      spacingUnit: 'var(--spacing-unit)',
      gap: 'var(--layout-gap)',
      borderRadius: 'var(--radius-unit)',

      glassOpacity: 'var(--glass-opacity)',
      glassBlur: 'var(--glass-blur)',
      borderOpacity: 'var(--border-opacity)',

      transitionDuration: 'var(--motion-duration)',
      transitionEasing: 'var(--motion-easing)',

      // FIXED → MUST include px
      sidebarWidthMobile: '280px',
      sidebarWidthDesktop: '520px',
    }),
    []
  );

  const leftSidebarStyle: React.CSSProperties = useMemo(() => {
    if (isMobile) {
      return {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: layoutStyles.sidebarWidthMobile,
        transform: isLeftSidebarOpen ? "translateX(0%)" : "translateX(-100%)",
        transition: `transform ${layoutStyles.transitionDuration} ${layoutStyles.transitionEasing}`,
        zIndex: 50,
        backgroundColor: layoutStyles.backgroundColor,
      };
    }
    return {
      width: isLeftSidebarOpen ? layoutStyles.sidebarWidthDesktop : "0px",
      transform: "none",
      transition: `width ${layoutStyles.transitionDuration} ${layoutStyles.transitionEasing}`,
      backgroundColor: layoutStyles.backgroundColor,
    };
  }, [isMobile, isLeftSidebarOpen, layoutStyles]);

  const rightSidebarStyle: React.CSSProperties = useMemo(() => {
    if (isMobile) {
      return {
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: layoutStyles.sidebarWidthMobile,
        transform: manualRightOpen ? "translateX(0%)" : "translateX(100%)",
        transition: `transform ${layoutStyles.transitionDuration} ${layoutStyles.transitionEasing}`,
        zIndex: 50,
        backgroundColor: layoutStyles.backgroundColor,
      };
    }
    return {
      width: manualRightOpen ? `${parseInt(layoutStyles.sidebarWidthDesktop) - 20}px` : "0px",
      transform: "none",
      transition: `width ${layoutStyles.transitionDuration} ${layoutStyles.transitionEasing}`,
      backgroundColor: layoutStyles.backgroundColor,
    };
  }, [isMobile, manualRightOpen, layoutStyles]);

  const mainStyle: React.CSSProperties = useMemo(() => {
    const sidebarWidth = isMobile ? parseInt(layoutStyles.sidebarWidthMobile) : parseInt(layoutStyles.sidebarWidthDesktop);

    if (isMobile) {
      const xOffset = isLeftSidebarOpen ? sidebarWidth : manualRightOpen ? -sidebarWidth : 0;
      return {
        transform: `translateX(${xOffset}px)`,
        transition: `transform ${layoutStyles.transitionDuration} ${layoutStyles.transitionEasing}`,
        width: "100%",
        backgroundColor: layoutStyles.backgroundColor,
      };
    }
    return {
      marginLeft: isLeftSidebarOpen ? `${sidebarWidth - 520}px` : "0px",
      marginRight: manualRightOpen ? `${sidebarWidth - 520}px` : "0px",
      transition: `margin ${layoutStyles.transitionDuration} ${layoutStyles.transitionEasing}`,
      backgroundColor: layoutStyles.backgroundColor,
    };
  }, [isMobile, isLeftSidebarOpen, manualRightOpen, layoutStyles]);

  /* ----------------------------
     Initialization: when userId appears, set store and fetch data
     Also start background jobs. When user signs out -> stop background jobs, clear store userId.
     The realtime hook above will take care of creating/removing channels.
     ---------------------------- */
  useEffect(() => {
    if (userId) {
      // 1. set userId on the unified store (so RPCs and handlers know)
      setUserId(userId);

      // 2. fetch initial data
      fetchAll().catch((e) => {
        console.error("fetchAll error", e);
      });

      // 3. start background jobs
      startUnifiedBackgroundJobs(userId);
    } else {
      // user signed out: clear and stop background jobs
      setUserId(null);
      stopUnifiedBackgroundJobs();
    }

    // cleanup on unmount: stop background jobs (but don't clear store if other tabs may rely on it)
    return () => {
      stopUnifiedBackgroundJobs();
    };
    // intentionally only depend on userId and stable setters
  }, [userId, setUserId, fetchAll]);

  /* ----------------------------
     Wire messages subsystem when selectedRoomId changes
     ---------------------------- */
  useEffect(() => {
    if (!selectedRoomId) {
      setActiveRoom(null);
      unsubscribeFromRoom();
      return;
    }

    setActiveRoom(selectedRoomId);
    loadInitialMessages(selectedRoomId);
    subscribeToRoom(selectedRoomId);

    return () => {
      unsubscribeFromRoom();
    };
  }, [selectedRoomId, setActiveRoom, loadInitialMessages, subscribeToRoom, unsubscribeFromRoom]);

  // Render
  return (
    <div
      className="flex h-[100vh] w-screen overflow-hidden relative"
      style={{
        backgroundColor: layoutStyles.backgroundColor,
        color: layoutStyles.foregroundColor,
        fontFamily: layoutStyles.fontFamily,
        fontSize: layoutStyles.fontSizeBase,
        transition: `background-color ${layoutStyles.transitionDuration}, color ${layoutStyles.transitionDuration}`,
      }}
    >
      {/* PresenceConnector reads userId and selectedRoomId from store */}
      <PresenceConnector roomId={selectedRoomId} userId={useUnifiedStore.getState().userId ?? null} />

      {/* LEFT SIDEBAR */}
      <aside
        className={cn("flex-shrink-0 flex flex-col border-r overflow-hidden", !isMobile && "relative h-full")}
        style={leftSidebarStyle}
      >
        <div className="h-full w-full flex flex-col">
          <LeftSidebar
            user={user ? { id: user.id ?? (user.user && user.user.id) } : null}
            isOpen={isLeftSidebarOpen}
            onClose={() => setIsLeftSidebarOpen(false)}
            handleToggleLeft={handleToggleLeft}
          />
        </div>
      </aside>

      {/* MAIN */}
      <main style={mainStyle} className="flex-1 flex flex-col min-w-0 relative z-0 transition-all">
        {/* TOP HEADER */}
        <header
          className="w-full  flex-none sticky top-0 z-20 flex items-center justify-between px-4 backdrop-blur-xl"
          style={{
            height: "var(--header-height)",
            backgroundColor: `${layoutStyles.backgroundColor} / 0.95`,
            borderColor: `${layoutStyles.borderColor} / ${layoutStyles.borderOpacity}`,
          }}
        >
          {!isSearchExpanded ? (
            <>
              {/* LEFT AREA */}
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleLeft}
                  className={`hover:bg-accent ${isLeftSidebarOpen || useUnifiedStore.getState().activeTab === "search" ?"hidden":"block"} opacity-60`}
                  style={{
                    borderRadius: `calc(${layoutStyles.borderRadius} * 1.5)`,
                    backgroundColor: `${layoutStyles.mutedBackground} / 0.3`,
                  }}
                >
                  <PanelLeft
                    style={{
                      width: `calc(${layoutStyles.spacingUnit} * 2)`,
                      height: `calc(${layoutStyles.spacingUnit} * 2)`,
                    }}
                  />
                </Button>

                <h1
                  className="font-bold pl-2"
                  style={{
                    fontSize: `calc(${layoutStyles.fontSizeBase} * 2)`,
                    color: layoutStyles.foregroundColor,
                  }}
                >
                  FlyChat
                </h1>
              </div>

              {/* TAB SWITCH */}
              <div className="flex items-center justify-center flex-1 max-w-2xl">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1 p-1"
                  style={{
                    backgroundColor: `${layoutStyles.mutedBackground} / 0.3`,
                    borderRadius: `calc(${layoutStyles.borderRadius} * 1.5)`,
                  }}
                >
                  {/* HOME TAB */}
                  <button
                    onClick={() => setActiveTab("home")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 rounded-xl font-medium transition-all",
                      useUnifiedStore.getState().activeTab === "home"
                        ? "text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    style={{
                      backgroundColor:
                        useUnifiedStore.getState().activeTab === "home"
                          ? layoutStyles.backgroundColor
                          : "transparent",
                      fontSize: layoutStyles.fontSizeBase,
                    }}
                  >
                    <Home
                      style={{
                        width: `calc(${layoutStyles.spacingUnit} * 2)`,
                        height: `calc(${layoutStyles.spacingUnit} * 2)`,
                      }}
                    />
                    <span className="hidden sm:inline">Home</span>
                  </button>

                  {/* SEARCH TAB */}
                  <button
                    onClick={() => setActiveTab("search")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 rounded-xl font-medium transition-all",
                      useUnifiedStore.getState().activeTab === "search"
                        ? "text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    style={{
                      backgroundColor:
                        useUnifiedStore.getState().activeTab === "search"
                          ? layoutStyles.backgroundColor
                          : "transparent",
                      fontSize: layoutStyles.fontSizeBase,
                    }}
                  >
                    <SearchIcon
                      style={{
                        width: `calc(${layoutStyles.spacingUnit} * 2)`,
                        height: `calc(${layoutStyles.spacingUnit} * 2)`,
                      }}
                    />
                    <span className="hidden sm:inline">Search</span>
                  </button>
                </motion.div>
              </div>

              {/* RIGHT ACTIONS */}
              <div className="flex items-center gap-1 flex-1 justify-end">
                <CreateRoomDialog user={user} />
                <NotificationsWrapper />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleRight}
                  className={cn("flex", manualRightOpen && "bg-accent/50")}
                  style={{
                    backgroundColor: manualRightOpen ? `${layoutStyles.accentColor} / 0.5` : "transparent",
                  }}
                >
                  <Settings
                    style={{
                      width: `calc(${layoutStyles.spacingUnit} * 2)`,
                      height: `calc(${layoutStyles.spacingUnit} * 2)`,
                    }}
                  />
                </Button>
              </div>
            </>
          ) : (
            /* SEARCH HEADER VIEW */
            <>
              <div className="flex items-center flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSearchBack}
                  className="hover:bg-accent mr-2 text-muted-foreground hover:text-foreground transition-colors"
                  style={{
                    borderRadius: `calc(${layoutStyles.borderRadius} * 1.5)`,
                    backgroundColor: `${layoutStyles.mutedBackground} / 0.3`,
                  }}
                >
                  <ChevronLeft
                    style={{
                      width: `calc(${layoutStyles.spacingUnit} * 1.5)`,
                      height: `calc(${layoutStyles.spacingUnit} * 1.5)`,
                    }}
                  />
                </Button>
              </div>

              <div className="flex items-center justify-center flex-[2] max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 w-[80vw] max-w-md"
                >
                  <div className="relative flex-1">
                    <Input
                      placeholder="Search messages..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      autoFocus
                      className="w-full py-2 px-4 pr-10 focus:border-none focus:outline-none transition-all"
                      style={{
                        borderRadius: `calc(${layoutStyles.borderRadius} * 1.5)`,
                        borderColor: layoutStyles.borderColor,
                        fontSize: layoutStyles.fontSizeBase,
                      }}
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSearchClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-muted/50 rounded-lg transition-colors"
                        style={{
                          width: `calc(${layoutStyles.spacingUnit} * 1.75)`,
                          height: `calc(${layoutStyles.spacingUnit} * 1.75)`,
                        }}
                      >
                        <X
                          style={{
                            width: `calc(${layoutStyles.spacingUnit} * 1)`,
                            height: `calc(${layoutStyles.spacingUnit} * 1)`,
                            color: layoutStyles.foregroundColor,
                          }}
                        />
                      </Button>
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="flex-1" />
            </>
          )}
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {useUnifiedStore.getState().activeTab === "home" ? (
              <motion.section
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col h-full w-full"
              >
                {/* HOME CONTENT */}
                <div className="flex-1 flex flex-col w-full" style={{ height: "var(--messages-area-height)" }}>
                  {/* CHAT HEADER */}
                  <div
                    className="flex-none  px-4 py-[.2em] border-b"
                    style={{
                      height: "var(--chat-header-height)",
                      backgroundColor: `${layoutStyles.backgroundColor} / 0.5`,
                      borderColor: layoutStyles.borderColor,
                    }}
                  >
                    <ChatHeader user={user} />
                  </div>

                  {/* CHAT BODY */}
                  <div className="flex-1 flex flex-col w-full relative">
                    <div className="absolute inset-0 flex flex-col">
                      {user && selectedRoomId ? (
                        <div className="w-full md:w-[50vw] h-auto flex flex-col lg:flex-row">
                          <div className="flex-1 flex flex-col">
                            {/* MESSAGES */}
                            <div className="flex-1 px-2 overflow-hidden">
                              <ChatMessages
                                searchQuery={searchQuery}
                                isSearching={isSearching}
                                onSearchStateChange={setIsSearching}
                                onSearchTrigger={handleSearchToggle}
                                isSearchExpanded={isSearchExpanded}
                              />
                            </div>

                            {/* INPUT AREA */}
                            <div
                              className="flex-none border-t"
                              style={{
                                height: "var(--chat-input-height)",
                                backgroundColor: layoutStyles.backgroundColor,
                                borderColor: layoutStyles.borderColor,
                              }}
                            >
                              <ChatInput />
                            </div>
                          </div>
                        </div>
                      ) : (
                        // EMPTY CHAT ABOUT
                        <div className="flex-1 flex items-center justify-center" style={{ padding: `calc(${layoutStyles.spacingUnit} * 2)` }}>
                          <ChatAbout />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.section>
            ) : (
              /* SEARCH TAB VIEW */
              <motion.section
                key="search"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col overflow-hidden"
                style={{ padding: layoutStyles.spacingUnit }}
              >
                <SearchComponent />
              </motion.section>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* RIGHT SIDEBAR */}
      <aside
        className={cn("flex-shrink-0 flex flex-col border-l overflow-hidden", !isMobile && "relative h-full")}
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
