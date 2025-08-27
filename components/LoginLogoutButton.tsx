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
import { useState, useEffect, useRef } from "react";

interface LoginLogoutButtonProps {
  user: SupabaseUser | undefined | null;
}

export default function LoginLogoutButton({ user }: LoginLogoutButtonProps) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const { setTheme, resolvedTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const animationContainerRef = useRef<HTMLDivElement>(null);

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
    const container = animationContainerRef.current;
    if (!container) return;

    const circle1 = document.createElement("div"); // Primary circle
    const circle2 = document.createElement("div"); // Duplicate behind circle

    // Get the button's position relative to the container
    const containerRect = container.getBoundingClientRect();
    const x = rect.left - containerRect.left + rect.width / 2;
    const y = rect.top - containerRect.top + rect.height / 2;

    // Use container dimensions for animation bounds
    const vw = containerRect.width;
    const vh = containerRect.height;
    const maxX = Math.min(x, vw - x); // Cap maxX to container width
    const maxY = Math.min(y, vh - y); // Cap maxY to container height
    const radius = Math.sqrt(maxX * maxX + maxY * maxY); // Adjusted radius

    circle1.className = "circle-effect-reveal";
    circle1.style.left = `${x}px`;
    circle1.style.top = `${y}px`;
    circle1.style.width = circle1.style.height = "0px";

    circle2.className = "circle-effect-reveal duplicate";
    circle2.style.left = `${x + 10}px`;
    circle2.style.top = `${y + 10}px`;
    circle2.style.width = circle2.style.height = "0px";

    const goingDark = !isDark;

    // Append and animate circles within the container
    container.appendChild(circle2);
    container.appendChild(circle1);

    const animation1 = circle1.animate(
      [
        { width: "0px", height: "0px", transform: "translate(-50%, -50%) scale(0)" },
        { width: `${radius * 2}px`, height: `${radius * 2}px`, transform: "translate(-50%, -50%) scale(1)" },
      ],
      {
        duration: 600,
        easing: "ease-in-out",
        fill: "forwards",
      }
    );

    const animation2 = circle2.animate(
      [
        { width: "0px", height: "0px", transform: "translate(-50%, -50%) scale(0)" },
        { width: `${radius * 2}px`, height: `${radius * 2}px`, transform: "translate(-50%, -50%) scale(1)" },
      ],
      {
        duration: 600,
        easing: "ease-in-out",
        fill: "forwards",
      }
    );

    // Apply theme change and cleanup after animation
    animation1.onfinish = animation2.onfinish = () => {
      setTheme(goingDark ? "dark" : "light");
      document.body.classList.toggle("dark", goingDark);
      document.body.classList.toggle("light", !goingDark);
      setIsDark(goingDark);
      circle1.remove();
      circle2.remove();
    };
  };

  if (user) {
    return (
      <div ref={animationContainerRef} style={{ position: "relative", overflow: "hidden", width: "100%", height: "100%" }}>
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
      </div>
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