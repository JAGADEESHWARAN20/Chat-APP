"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUnifiedRoomStore } from "@/lib/store/roomstore";

import LeftSidebar from "@/components/LeftSidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import ChatAbout from "@/components/ChatAbout";
import ChatHeader from "@/components/ChatHeader";
import SearchComponent from "@/components/SearchComponent";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import NotificationsWrapper from "@/components/NotificationsWrapper";
import { SidebarTrigger } from "@/components/sidebar";

import { Home, Search as SearchIcon, MessageCircle } from "lucide-react";
import SecureInitUser from "@/lib/initialization/secureInitUser";
import { Button } from "@/components/ui/button";

/**
 * UnifiedHome
 *
 * Single unified UI container:
 * - keeps all major UI elements in the same stacking context (z controlled via CSS vars)
 * - uses CSS variables for sizes, colors (reads --sidebar-width from globals.css)
 * - uses em/vw/vh for local sizing to keep proportions consistent
 *
 * Notes:
 * - ThemeTransitionWrapper sits above the document but underneath UI (it should be z < --z-ui).
 * - This component sets --z-ui locally so you can control z-ordering from globals as needed.
 */

interface UnifiedHomeProps {
  initialSidebarState?: "expanded" | "collapsed";
}

export default function UnifiedHome({ initialSidebarState = "collapsed" }: UnifiedHomeProps) {
  const [user, setUser] = useState<any>(null);
  const setRoomUser = useUnifiedRoomStore((s) => s.setUser);

  // local sidebar control (keeps LeftSidebar inside same stacking context)
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialSidebarState === "expanded");
  const toggleSidebar = () => setIsSidebarOpen((v) => !v);

  // tabs state
  const [activeTab, setActiveTab] = useState<"home" | "search">("home");
  const tabs = useMemo(
    () => [
      { id: "home" as const, icon: Home, label: "Home" },
      { id: "search" as const, icon: SearchIcon, label: "Search" },
    ],
    []
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

  // sizing variables (use em/vw/vh for consistent scaling)
  const headerHeight = "3.6em";
  const inputHeight = "4em";
  // fallback for var in inline styles — we'll read CSS var at runtime for width usage
  const sidebarWidthVar = "var(--sidebar-width, 20rem)";

  // z layers (expose these via inline style so you can tweak)
  const zUi = 10; // UI sits above background mask (mask should be < 10)

  return (
    <div
      className={cn(
        "min-h-screen w-full flex bg-[hsl(var(--background))] text-[hsl(var(--foreground))] overflow-hidden",
        "transition-all duration-300 ease-in-out"
      )}
      style={{
        // Expose CSS variables locally so this container remains the single stacking context.
        // You can override these variables in globals.css.
        // --z-ui is used to make sure theme mask (which you set to z lower than this) stays underneath.
        ["--z-ui" as any]: zUi,
        ["--header-h" as any]: headerHeight,
        ["--input-h" as any]: inputHeight,
        ["--sidebar-w" as any]: sidebarWidthVar,
        // font smoothing: use em-based sizing inside
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Left Sidebar (kept inside same stacking context) */}
      <div
        className="relative z-[var(--z-ui)]"
        style={{
          width: isSidebarOpen ? sidebarWidthVar : "0px",
          minWidth: isSidebarOpen ? sidebarWidthVar : "0px",
          transition: "width 280ms ease, min-width 280ms ease",
          overflow: "hidden",
        }}
      >
        {/* render LeftSidebar as a fixed/slide-in on small screens but visually inside same container */}
        <LeftSidebar user={user ? { id: user.id } : null} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main column (header + content) */}
      <div className="flex-1 min-w-0 flex flex-col relative z-[var(--z-ui)]">
        {/* Header */}
        <header
          className={cn(
            "w-full px-[1em] py-[0.5em] border-b",
            "bg-[hsl(var(--background))]/0.96 supports-[backdrop-filter]:bg-[hsl(var(--background))]/0.88",
            "backdrop-blur-md",
            "flex-none"
          )}
          style={{
            height: headerHeight,
            borderColor: "hsl(var(--border) / 0.12)",
            zIndex: zUi,
          }}
        >
          <div className="flex items-center justify-between w-full">
            {/* left: logo + tabs */}
            <div className="flex items-center gap-3 md:gap-6">
              <div
                className="rounded-xl flex items-center justify-center"
                style={{
                  width: "2.2em",
                  height: "2.2em",
                  background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
                }}
              >
                <MessageCircle className="w-4 h-4 text-white" />
              </div>

              <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent hidden sm:block" style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
                FlyChat
              </h1>

              {/* Desktop tabs */}
              <div className="hidden md:flex items-center gap-2 p-1 rounded-2xl bg-[hsl(var(--muted))]/0.5 backdrop-blur-md">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                      activeTab === id
                        ? "bg-[hsl(var(--action-active))]/20 text-[hsl(var(--action-active))] shadow-inner"
                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* right: actions + mobile tabs + sidebar trigger */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <CreateRoomDialog user={user} />
                <NotificationsWrapper />
              </div>

              {/* mobile tabs and trigger */}
              <div className="flex items-center gap-2">
                {/* mobile tabs (glow uses layoutId so framer animates it nicely) */}
                <div className="relative md:hidden">
                  <AnimatePresence>
                    <motion.div
                      key={activeTab}
                      layoutId="mobile-tab-glow"
                      className="absolute rounded-xl"
                      style={{
                        inset: activeTab === "home" ? "6px 52% 6px 6px" : "6px 6px 6px 52%",
                        background: "hsl(var(--action-active))",
                        filter: "blur(6px)",
                        opacity: 0.22,
                      }}
                      transition={{ type: "spring", stiffness: 220, damping: 20 }}
                    />
                  </AnimatePresence>

                  <div className="flex items-center gap-1 p-1 rounded-2xl bg-[hsl(var(--muted))] backdrop-blur-md">
                    {tabs.map(({ id, icon: Icon }) => {
                      const isActive = activeTab === id;
                      return (
                        <Button
                          key={id}
                          onClick={() => setActiveTab(id)}
                          className={cn(
                            "relative z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
                            isActive ? "bg-[hsl(var(--action-active))]/25 text-[hsl(var(--action-active))] shadow-inner" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/40"
                          )}
                          aria-pressed={isActive}
                          aria-label={id}
                        >
                          <Icon className="w-4 h-4" />
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* sidebar trigger sits here so it can toggle the left rail */}
                <SidebarTrigger
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-[hsl(var(--muted))]/40 focus:ring-2 focus:ring-[hsl(var(--action-ring))]/50 active:scale-95",
                    isSidebarOpen && "bg-[hsl(var(--muted))]/30"
                  )}
                  aria-label="Toggle sidebar"
                  onClick={(e: any) => {
                    e?.stopPropagation?.();
                    toggleSidebar();
                  }}
                />
              </div>
            </div>
          </div>
        </header>

        {/* main body */}
        <main className="flex-1 flex min-h-0 overflow-hidden relative" style={{ zIndex: zUi }}>
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "home" && (
              <motion.section
                key="home"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
                className="flex-1 flex min-h-0 overflow-hidden"
              >
                {/* content column: header (chat header) + messages + input */}
                <div className="flex-1 flex min-h-0 flex-col mx-auto w-full" style={{ maxWidth: "100vw" }}>
                  {/* chat header */}
                  <div style={{ height: headerHeight, borderBottom: "1px solid hsl(var(--border) / 0.12)" }} className="flex-shrink-0 z-[var(--z-ui)]">
                    <ChatHeader user={user} />
                  </div>

                  {/* messages + input */}
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {user && useUnifiedRoomStore.getState().selectedRoomId ? (
                      <div className="flex-1 min-h-0 flex flex-col">
                        <div className="flex-1 overflow-auto min-h-0">
                          <ChatMessages />
                        </div>

                        <div className="flex-shrink-0" style={{ height: "4em", borderTop: "1px solid hsl(var(--border) / 0.12)" }}>
                          <ChatInput />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
                        <ChatAbout />
                      </div>
                    )}
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
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <div className="w-full h-full flex flex-col overflow-hidden">
                  <SearchComponent user={user} />
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        <SecureInitUser />
      </div>
    </div>
  );
}
