"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "./ui/button";
import { LogOut, Menu } from "lucide-react";
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
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import ThemeToggleButton from "./ThemeToggle";

interface LoginLogoutButtonProps {
  user: SupabaseUser | undefined | null;
}

export default function LoginLogoutButton({ user }: LoginLogoutButtonProps) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  if (user) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 z-[99999]">
              <Avatar className="h-8 w-8 z-[99999]">
                <AvatarImage
                  className=""
                  src={user.user_metadata.avatar_url || ""}
                  alt={user.user_metadata.display_name || user.email}
                />
              </Avatar>
              
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 mt-6">
            <div className="flex items-center justify-center z-[999999]">
              <ThemeToggleButton />
            </div>
            <Link href={`/profile/${user.id}`}>
              <Button variant="outline" size="sm" className="w-full z-[999999]">
                View Profile
              </Button>
            </Link>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-100/10 z-[999999]"
            >
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/auth/login">
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-500 hover:text-blue-600 hover:bg-blue-100/10"
        >
          Sign In
        </Button>
      </Link>
      <Link href="/auth/register">
        <Button
          variant="ghost"
          size="sm"
          className="text-green-500 hover:text-green-600 hover:bg-green-100/10"
        >
          Sign Up
        </Button>
      </Link>
    </div>
  );
}
