// components/sidebar/RightSidebarContent.tsx
"use client";

import React from "react";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  
} from "@/components/sidebar";
import {
  User,
  ChevronsUpDown,
  Settings,
  LifeBuoy,
  MessageCircle,
  AlertCircle,
  LogOut,
  LucideIcon,
 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggleButton from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/store/user";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client"; // Import this

type RightSidebarProps = {
  width: number;
  onClose?: () => void;
};

// const mainItems: { title: string; url: string; icon: LucideIcon }[] = [
//   { title: "Home", url: "#", icon: Home },
//   { title: "Inbox", url: "#", icon: Inbox },
//   { title: "Calendar", url: "#", icon: Calendar },
//   { title: "Search", url: "#", icon: Search },
//   { title: "Settings", url: "#", icon: Settings },
// ];

const supportItems: { label: string; url: string; icon: LucideIcon }[] = [
  { label: "Help Center", url: "/help", icon: LifeBuoy },
  { label: "Support", url: "/support", icon: MessageCircle },
  { label: "Report a problem", url: "/report", icon: AlertCircle },
];

export default function RightSidebarContent({ width, onClose }: RightSidebarProps) {
  const storeUser = useUser((s) => s.user);
  const displayName =
    storeUser?.user_metadata?.display_name ||
    storeUser?.user_metadata?.username ||
    storeUser?.email?.split("@")[0] ||
    "User";

  const router = useRouter();

  const handleItemClick = (href?: string) => {
    if (onClose) onClose();
    if (href) router.push(href);
  };

  const handleSignOut = async () => {
    // 1. Initialize client
    const supabase = getSupabaseBrowserClient();
    
    // 2. Actually sign out from Supabase (clears cookies)
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error("Error signing out:", error);
    }

    if (onClose) onClose();
    
    // 3. Refresh router to clear client cache and redirect
    router.refresh(); 
    router.replace("/auth/login");
  };

  return (
    <div
      className={cn("h-full", "bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]")}
      style={{
        width,
        background:
          "linear-gradient(145deg, hsl(var(--sidebar-background)) 0%, hsl(var(--sidebar-background)/0.95) 100%)",
       
        minHeight: "100vh",
      }}
    >
      <SidebarContent className="w-full border-none" style={{ height: "100%" }}>
        {/* Application Menu */}
        {/* <SidebarGroup className="px-3 ">
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
                        onClick={(e) => {
                          e.preventDefault();
                          handleItemClick(item.url);
                        }}
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
        </SidebarGroup> */}

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
                onClick={() => handleItemClick(`/profile`)}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all duration-300 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--sidebar-primary))] to-[hsl(var(--sidebar-primary)/0.7)] flex items-center justify-center text-[hsl(var(--room-text))] font-bold text-lg ">
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
                  { icon: User, label: "Profile", href: `/profile` },
                  { icon: Settings, label: "Settings", href: `/edit-profile` },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleItemClick(item.href);
                    }}
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
        <SidebarGroup className="mt-2 px-3">
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
                    onClick={(e) => {
                      e.preventDefault();
                      handleItemClick(item.url);
                    }}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 transition-all duration-200 group"
                  >
                    <Icon className="w-5 h-5 opacity-60 group-hover:opacity-100" />
                    <span className="text-sm">{item.label}</span>
                  </a>
                );
              })}
            </div>
            <ThemeToggleButton />
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </Button>
          </SidebarGroupContent>
        </SidebarGroup>

       
      </SidebarContent>
    </div>
  );
}
