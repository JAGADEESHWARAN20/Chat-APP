"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "./ui/button";
import { LogOut, Menu, ChevronsUpDown, User, Settings } from "lucide-react";
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
  const supabase = createClientComponentClient<Database>();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // Get user data from RoomContext - no need to refetch!
 
  const { user: contextUser } = useRoomContext();

  // Use the user from props or context (context is more reliable)
  const currentUser = user || contextUser;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  // Navigation handlers
  const handleProfileNavigation = () => {
    setIsSheetOpen(false);
    if (currentUser?.id) {
      router.push(`/profile/${currentUser.id}`);
    }
  };

  const handleEditProfileNavigation = () => {
    setIsSheetOpen(false);
    if (currentUser?.id) {
      router.push(`/profile/${currentUser.id}/edit`);
    }
  };

  const getDisplayName = () => {
    return currentUser?.user_metadata?.display_name || 
           currentUser?.user_metadata?.username || 
           currentUser?.email || 
           "User";
  };

  if (currentUser) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <button 
            title="menu" 
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-accent/50 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[320px] sm:w-[380px]">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              Menu
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col h-[calc(100vh-120px)] justify-between">
            <div className="space-y-6">
              {/* User Info Section */}
              <div className="p-4 rounded-xl bg-card border">
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

                {/* Profile Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={handleProfileNavigation}
                    variant="secondary" 
                    size="sm" 
                    className="w-full h-9 text-xs"
                  >
                    <User className="w-3 h-3 mr-1" />
                    Profile
                  </Button>
                  <Button 
                    onClick={handleEditProfileNavigation}
                    variant="secondary" 
                    size="sm" 
                    className="w-full h-9 text-xs"
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Settings
                  </Button>
                </div>
              </div>

              {/* Theme Toggle */}
              <div className="p-4 rounded-lg bg-card/50 border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Theme</span>
                  <ThemeToggleButton />
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="lg"
              className="w-full h-12 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20 border border-red-200/50 dark:border-red-800/50 font-medium"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => router.push("/auth/login")}
        variant="ghost"
        size="sm"
        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50"
      >
        Sign In
      </Button>
      <Button
        onClick={() => router.push("/auth/register")}
        variant="default"
        size="sm"
        className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white shadow-lg hover:shadow-xl"
      >
        Sign Up
      </Button>
    </div>
  );
}