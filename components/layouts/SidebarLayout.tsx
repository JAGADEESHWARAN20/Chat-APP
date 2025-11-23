// components/sidebar/SidebarLayout.tsx
"use client";

import React, { ReactNode, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  useSidebar,
} from "@/components/sidebar";

import {
  User,
  ChevronsUpDown,
  Calendar,
  Home,
  Inbox,
  Search,
  Settings,
  LifeBuoy,
  MessageCircle,
  AlertCircle,
  LogOut,
  LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/store/user";
import type { Database } from "@/database.types";
import { cn } from "@/lib/utils";
import ThemeToggleButton from "@/components/ThemeToggle";
import { ThemeTransitionWrapper } from "@/components/ThemeTransitionWrapper";

type Props = {
  children: ReactNode;
  side?: "left" | "right";
  onSidebarToggle?: () => void;
  sidebarState?: any;
};

// Fully typed arrays
const mainItems: { title: string; url: string; icon: LucideIcon }[] = [
  { title: "Home", url: "#", icon: Home },
  { title: "Inbox", url: "#", icon: Inbox },
  { title: "Calendar", url: "#", icon: Calendar },
  { title: "Search", url: "#", icon: Search },
  { title: "Settings", url: "#", icon: Settings },
];

const supportItems: { label: string; url: string; icon: LucideIcon }[] = [
  { label: "Help Center", url: "/help", icon: LifeBuoy },
  { label: "Support", url: "/support", icon: MessageCircle },
  { label: "Report a problem", url: "/report", icon: AlertCircle },
];

function LayoutContents({ children, side = "right", onSidebarToggle }: Props) {
  const router = useRouter();

  const isMobile =
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px)").matches
      : false;

  const sidebarWidth = isMobile ? 260 : 320;

  const supabase = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const storeUser = useUser((s) => s.user);

  const displayName =
    storeUser?.user_metadata?.display_name ||
    storeUser?.user_metadata?.username ||
    storeUser?.email?.split("@")[0] ||
    "User";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const { state, toggleSidebar } = useSidebar();

  useEffect(() => {
    const toggle = () => toggleSidebar();
    window.addEventListener("toggle-settings-sidebar", toggle);
    return () =>
      window.removeEventListener("toggle-settings-sidebar", toggle);
  }, [toggleSidebar]);

  const handleToggle = () => {
    if (onSidebarToggle) onSidebarToggle();
    else toggleSidebar();
  };

  // Compute CSS transform for simple slide-in/out behaviour
  // For right sidebars: collapsed -> translated right by width (offscreen)
  // For left sidebars: collapsed -> translated left by width (offscreen)
  const collapsed = state !== "expanded";
  const transformStyle =
    side === "right"
      ? `translateX(${collapsed ? sidebarWidth : 0}px)`
      : `translateX(${collapsed ? -sidebarWidth : 0}px)`;

  return (
    <div
      className={cn(
        "min-h-screen flex",
        side === "right" ? "flex-row-reverse" : "flex-row",
        "bg-[hsl(var(--background))]"
      )}
    >
      <Sidebar
        side={side}
        className={cn(
          "fixed top-0 bottom-0 z-[500] pointer-events-none", // pointer-events toggled below per state
          side === "right" ? "right-0" : "left-0"
        )}
      >
        {/* Overlay for mobile / small screens when sidebar open */}
        {/* Overlay sits before the sidebar element visually, but inside the Sidebar component tree */}
        <div
          className={cn(
            "fixed inset-0 z-[490] transition-opacity duration-200",
            collapsed ? "opacity-0 pointer-events-none" : "opacity-60 pointer-events-auto"
          )}
          style={{
            background: "rgba(0,0,0,0.45)",
            display: isMobile ? "block" : "none",
          }}
          onClick={handleToggle}

        />

        <div
          // slide with CSS transform; transition handled by classes
          style={{
            width: sidebarWidth,
            transform: transformStyle,
            transition: "transform 260ms cubic-bezier(.2,.9,.2,1)",
          }}
          className={cn(
            "h-full pointer-events-auto",
            "will-change-transform",
            // when collapsed on non-mobile we want no pointer interactions
            collapsed ? "pointer-events-none" : "pointer-events-auto"
          )}
        >
          <SidebarContent
            className="w-full bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] border-none"
            style={{
              background:
                "linear-gradient(145deg, hsl(var(--sidebar-background)) 0%, hsl(var(--sidebar-background)/0.95) 100%)",
              backdropFilter: "blur(20px)",
              height: "100%",
            }}
          >
            {/* Application Menu */}
            <SidebarGroup className="px-3 ">
              <SidebarGroupLabel className="text-xs uppercase tracking-wider opacity-70 px-3 mb-1">
                Application
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <a
                            href={item.url}
                            onClick={handleToggle}
                            className={cn(
                              "flex items-center gap-4 px-4 py-[1.4em] rounded-xl text-base font-medium transition-all duration-300 group",
                              "hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]",
                              "hover:shadow-lg ",
                              "[&.active]:bg-[hsl(var(--sidebar-primary)/0.15)] [&.active]:text-[hsl(var(--sidebar-primary))]"
                            )}
                          >
                            <div className="relative">
                              <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                              <span className="absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-30 bg-current" />
                            </div>
                            <span>{item.title}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Account Section */}
            <SidebarGroup className="mt-2 px-3">
              <SidebarGroupLabel className="text-xs uppercase tracking-wider opacity-70 px-3 mb-3">
                Account
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="space-y-3">
                  {/* Profile Card */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      router.push(`/profile/${storeUser?.id}`);
                      handleToggle();
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all duration-300 group cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--sidebar-primary))] to-[hsl(var(--sidebar-primary)/0.7)] flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{displayName}</p>
                      <p className="text-xs opacity-70">{storeUser?.email}</p>
                    </div>
                    <ChevronsUpDown className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <div className="flex flex-col gap-1 pt-2">
                    {[
                      { icon: User, label: "Profile", href: `/profile/${storeUser?.id}` },
                      { icon: Settings, label: "Settings", href: `/profile/${storeUser?.id}/edit` },
                    ].map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        onClick={handleToggle}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 transition-all duration-200 group"
                      >
                        <item.icon className="w-5 h-5 opacity-70 group-hover:opacity-100" />
                        <span className="text-sm">{item.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Support */}
            <SidebarGroup className="mt-8 px-3">
              <SidebarGroupLabel className="text-xs uppercase tracking-wider opacity-70 px-3 mb-2">
                Support
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="space-y-1">
                  {supportItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.label}
                        href={item.url}
                        onClick={handleToggle}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 transition-all duration-200 group"
                      >
                        <Icon className="w-5 h-5 opacity-60 group-hover:opacity-100" />
                        <span className="text-sm">{item.label}</span>
                      </a>
                    );
                  })}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Footer */}
            <SidebarFooter className="mt-auto p-4 space-y-4 border-t border-white/10">
              <ThemeToggleButton />
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={handleSignOut}
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </Button>
            </SidebarFooter>
          </SidebarContent>
        </div>
      </Sidebar>

      <SidebarInset className="flex-1">
        <div className="flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </div>
  );
}

export default function SidebarLayout({ children, side = "right", onSidebarToggle }: Props) {
  return (
    <ThemeTransitionWrapper>
      <SidebarProvider defaultOpen={false}>
        <LayoutContents side={side} onSidebarToggle={onSidebarToggle}>
          {children}
        </LayoutContents>
      </SidebarProvider>
    </ThemeTransitionWrapper>
  );
}
