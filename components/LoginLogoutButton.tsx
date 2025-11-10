"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Button } from "./ui/button";
import { LogOut, Menu, User, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Database } from "@/database.types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";
import ThemeToggleButton from "./ThemeToggle";
import { useRoomContext } from "@/lib/store/RoomContext";

interface LoginLogoutButtonProps {
  user: SupabaseUser | undefined | null;
}

export default function LoginLogoutButton({ user }: LoginLogoutButtonProps) {
  const router = useRouter();
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { user: contextUser } = useRoomContext();
  const currentUser = user || contextUser;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  const handleProfileNavigation = () => {
    setIsSheetOpen(false);
    if (currentUser?.id) router.push(`/profile/${currentUser.id}`);
  };

  const handleEditProfileNavigation = () => {
    setIsSheetOpen(false);
    if (currentUser?.id) router.push(`/profile/${currentUser.id}/edit`);
  };

  const getDisplayName = () => {
    return (
      currentUser?.user_metadata?.display_name ||
      currentUser?.user_metadata?.username ||
      currentUser?.email ||
      "User"
    );
  };

  if (currentUser) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <button
            title="menu"
            className={`
              relative w-9 h-9 flex items-center justify-center rounded-lg
              border border-transparent
              transition-all duration-300 ease-out
              group
              bg-[hsl(var(--primary)/0.15)] hover:bg-transparent
              hover:border-[hsl(var(--primary))]
              shadow-sm
            `}
          >
            <Menu
              className={`
                h-5 w-5 transition-all duration-300 ease-in-out
                fill-[hsl(var(--primary))] stroke-[hsl(var(--primary))]
                group-hover:fill-transparent
                group-hover:stroke-[hsl(var(--primary))]
              `}
            />
          </button>
        </SheetTrigger>

        <SheetContent
          side="right"
          className="w-[320px] sm:w-[380px] p-5 bg-background border-l border-border/30"
        >
          <SheetHeader className="mb-5">
            <SheetTitle className="flex justify-between items-center gap-3 text-lg font-semibold">
              Menu
              <ThemeToggleButton />
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col h-[calc(100vh-140px)] justify-between">
            <div className="space-y-6">
              {/* User Info Card */}
              <div className="p-4 rounded-xl bg-card border border-border/30 shadow-sm transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center text-white font-semibold text-lg">
                    {getDisplayName().charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {getDisplayName()}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleProfileNavigation}
                    variant="secondary"
                    size="sm"
                    className="w-full h-9 text-xs font-medium shadow-sm"
                  >
                    <User className="w-3 h-3 mr-1" />
                    Profile
                  </Button>
                  <Button
                    onClick={handleEditProfileNavigation}
                    variant="secondary"
                    size="sm"
                    className="w-full h-9 text-xs font-medium shadow-sm"
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Settings
                  </Button>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="lg"
              className="w-full h-12 mt-6 text-red-600 dark:text-red-400 font-semibold border border-red-200/50 dark:border-red-800/40 hover:bg-red-100/30 dark:hover:bg-red-900/20 transition-all duration-300"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Non-logged-in state
  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={() => router.push("/auth/login")}
        variant="outline"
        size="sm"
        className="text-blue-600 dark:text-blue-400 border border-blue-300/50 dark:border-blue-700/50 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-all"
      >
        Sign In
      </Button>
      <Button
        onClick={() => router.push("/auth/register")}
        variant="default"
        size="sm"
        className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white shadow-md hover:shadow-lg transition-all"
      >
        Sign Up
      </Button>
    </div>
  );
}
