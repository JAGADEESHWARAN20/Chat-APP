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
import ThemeToggle from "./ThemeToggle";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface LoginLogoutButtonProps {
  user: SupabaseUser | undefined | null;
}

export default function LoginLogoutButton({ user }: LoginLogoutButtonProps) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const { setTheme, resolvedTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    setIsDark(resolvedTheme === "dark");
  }, [resolvedTheme]);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Calculate center of the screen
    const x = vw / 2; // Center horizontally
    const y = vh / 2; // Center vertically

    // Calculate radius to cover the entire viewport
    const maxRadius = Math.sqrt(vw * vw + vh * vh); // Diagonal distance to cover screen

    const circle = document.createElement("div"); // Primary circle
    circle.className = "circle-effect-reveal";
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.width = "0px";
    circle.style.height = "0px";

    // Append and animate circle
    document.body.appendChild(circle);

    const animation = circle.animate(
      [
        { width: "0px", height: "0px", transform: "translate(-50%, -50%) scale(0)" },
        { width: `${maxRadius * 2}px`, height: `${maxRadius * 2}px`, transform: "translate(-50%, -50%) scale(1)" },
      ],
      {
        duration: 600,
        easing: "ease-in-out",
        fill: "forwards",
      }
    );

    // Apply theme change after animation
    const goingDark = !isDark;
    animation.onfinish = () => {
      setTheme(goingDark ? "dark" : "light");
      document.body.classList.toggle("dark", goingDark);
      document.body.classList.toggle("light", !goingDark);
      setIsDark(goingDark);
      circle.remove();
    };
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
            <SheetTitle className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user.user_metadata.avatar_url || ""}
                  alt={user.user_metadata.display_name || user.email}
                />
                <AvatarFallback>
                  {user.email?.[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{user.user_metadata.display_name || user.email}</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 mt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Theme</span>
              <ThemeToggle onToggle={handleToggle} isDark={isDark} />
            </div>
            <Link href={`/profile/${user.id}`}>
              <Button variant="outline" size="sm" className="w-full">
                View Profile
              </Button>
            </Link>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-100/10"
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