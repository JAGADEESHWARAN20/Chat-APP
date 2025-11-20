"use client";

import React, { ReactNode, useMemo } from "react";
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
};

const mainItems = [
  { title: "Home", url: "#", icon: Home },
  { title: "Inbox", url: "#", icon: Inbox },
  { title: "Calendar", url: "#", icon: Calendar },
  { title: "Search", url: "#", icon: Search },
  { title: "Settings", url: "#", icon: Settings },
];

function LayoutContents({ children, side = "right" }: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const storeUser = useUser((s) => s.user);
  const displayName = storeUser
    ? (storeUser.user_metadata as any)?.display_name ||
      (storeUser.user_metadata as any)?.username ||
      storeUser.email?.split("@")[0]
    : "User";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const { state, toggleSidebar } = useSidebar();

  return (
    <div className={cn(
      "min-h-screen flex bg-background flex-row-reverse",
      "transition-all duration-300 ease-in-out"
    )}>
      {/* Sidebar */}
      <Sidebar side={side}>
        <SidebarContent className="w-[var(--sidebar-width)]">
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <a
                        href={item.url}
                        className="flex items-center gap-3 py-2 px-3 rounded-md transition-colors duration-200 hover:bg-[hsl(var(--muted))]/40"
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="text-sm">{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Account</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex flex-col gap-2 px-3">
               
<div
  role="button"
  tabIndex={0}
  onClick={() => router.push(`/profile/${storeUser?.id}`)}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/profile/${storeUser?.id}`);
    }
  }}
  className="flex items-center gap-3 p-3 w-full rounded-md hover:bg-[hsl(var(--muted))]/40 transition-colors duration-200 cursor-pointer"
>
  <div className="flex items-center justify-between gap-2 w-full">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full ...">
        {displayName?.charAt(0)?.toUpperCase()}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{displayName}</span>
        <span className="text-xs text-muted-foreground">{storeUser?.email}</span>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          // existing behavior for that button
        }}
      >
        <ChevronsUpDown className="w-4 h-4" />
      </Button>
    </div>
  </div>
</div>


                <div className="border-t border-border/30 mt-1" />

                <nav className="flex flex-col gap-1">
                  <a
                    className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[hsl(var(--muted))]/40 transition-colors duration-200"
                    href={`/profile/${storeUser?.id}`}
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm">Profile</span>
                  </a>

                  <a
                    className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[hsl(var(--muted))]/40 transition-colors duration-200"
                    href={`/profile/${storeUser?.id}/edit`}
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Settings</span>
                  </a>
                </nav>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Support</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex flex-col gap-1 px-2">
                <a
                  className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[hsl(var(--muted))]/40 transition-colors duration-200"
                  href="/help"
                >
                  <LifeBuoy className="w-4 h-4" />
                  <span className="text-sm">Help Center</span>
                </a>

                <a
                  className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[hsl(var(--muted))]/40 transition-colors duration-200"
                  href="/support"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm">Support</span>
                </a>

                <a
                  className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[hsl(var(--muted))]/40 transition-colors duration-200"
                  href="/report"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Report a problem</span>
                </a>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Theme Toggle in Sidebar Footer */}
          <SidebarFooter>
            <div className="px-3 py-2">
              <div className="mb-3">
                <ThemeToggleButton />
              </div>
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 transition-colors duration-200"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </div>
          </SidebarFooter>
        </SidebarContent>
      </Sidebar>

      {/* Main area */}
      <SidebarInset className="flex-1 min-w-0 flex flex-col transition-all duration-300 ease-in-out">
        <div className="flex-1 overflow-hidden flex flex-col">
          {React.isValidElement(children)
            ? React.cloneElement(children as any, { 
                sidebarState: state,
                onSidebarToggle: toggleSidebar
              })
            : children}
        </div>
      </SidebarInset>
    </div>
  );
}

export default function SidebarLayout({ children, side = "right" }: Props) {
  return (
    <ThemeTransitionWrapper>
      <SidebarProvider>
        <LayoutContents side={side}>
          {children}
        </LayoutContents>
      </SidebarProvider>
    </ThemeTransitionWrapper>
  );
}
