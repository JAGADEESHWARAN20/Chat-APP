"use client";

// Essential imports from React, Next.js, and Supabase
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { User as SupabaseUser } from "@supabase/supabase-js";

// Import UI components from shadcn/ui - assuming this project structure
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Lucide React for icons
import { LogOut, Menu, ChevronsUpDown, User as UserIcon } from "lucide-react";

// Assuming these are your type definitions
import { Database } from "@/database.types";
import ThemeToggleButton from "./ThemeToggle";

// Component Props Interface
interface LoginLogoutButtonProps {
  user: SupabaseUser | null;
}

/**
 * A responsive and theme-aware component that displays login/signup buttons
 * for logged-out users, and a side menu with user actions for logged-in users.
 */
export default function LoginLogoutButton({ user }: LoginLogoutButtonProps) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Function to handle user logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsSheetOpen(false); // Close the sheet on logout
    router.refresh();
    router.push("/");
  };

  // Display user's name or a fallback
  const userName = user?.user_metadata?.username || user?.email || "My Account";

  // Render this part if the user is authenticated
  if (user) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent className="flex flex-col">
          <SheetHeader className="text-left">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>
              Manage your account, preferences, and more.
            </SheetDescription>
          </SheetHeader>

          {/* Main content area of the sheet */}
          <div className="flex-grow py-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                >
                  <span className="truncate">{userName}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel>
                  Signed in as
                  <span className="block truncate font-normal text-sm text-muted-foreground">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/profile/${user.id}`}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>View Profile</span>
                  </Link>
                </DropdownMenuItem>
                {/* Add other menu items here if needed */}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Footer section pushed to the bottom */}
          <SheetFooter className="mt-auto flex flex-col gap-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Theme</span>
              <ThemeToggleButton />
            </div>
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  // Render this part for logged-out users
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/auth/login">
          Sign In
        </Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/auth/register">
          Sign Up
        </Link>
      </Button>
    </div>
  );
}
