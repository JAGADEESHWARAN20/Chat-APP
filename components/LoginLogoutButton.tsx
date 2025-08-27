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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const circle1 = document.createElement("div"); // Primary circle

    const x = rect.left + window.scrollX + rect.width / 2;
    const y = rect.top + window.scrollY + rect.height / 2;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxRadius = Math.min(vw, vh) / 2; // Cap radius to half the smaller dimension

    circle1.className = "circle-effect-reveal";
    circle1.style.left = `${x}px`;
    circle1.style.top = `${y}px`;
    circle1.style.width = circle1.style.height = "0px";
    document.body.style.setProperty('--circle-x', `${x}px`);
    document.body.style.setProperty('--circle-y', `${y}px`);

    const goingDark = !isDark;

    // Append and animate circle
    document.body.appendChild(circle1);

    const animation1 = circle1.animate(
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
    animation1.onfinish = () => {
      setTheme(goingDark ? "dark" : "light");
      document.body.classList.toggle("dark", goingDark);
      document.body.classList.toggle("light", !goingDark);
      setIsDark(goingDark);
      circle1.remove();
      document.body.style.removeProperty('--circle-x');
      document.body.style.removeProperty('--circle-y');
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