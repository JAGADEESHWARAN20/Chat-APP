"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, MenuSquare, User, Settings } from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Database } from "@/database.types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import ThemeToggleButton from "@/components/ThemeToggle";
import { useRoomContext } from "@/lib/store/RoomContext";
import { cn } from "@/lib/utils";

interface LoginLogoutButtonProps {
  user?: SupabaseUser | null;
}

export default function LoginLogoutButton({ user }: LoginLogoutButtonProps) {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const { user: contextUser } = useRoomContext();
  const currentUser = user || contextUser;
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const getDisplayName = useMemo(() => {
    if (!currentUser) return "User";
    return (
      currentUser.user_metadata?.display_name ||
      currentUser.user_metadata?.username ||
      currentUser.email ||
      "User"
    );
  }, [currentUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const navigate = (path: string) => {
    if (!currentUser?.id) return;
    setIsSheetOpen(false);
    router.push(path);
  };

  if (currentUser) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <motion.button
            title="Menu"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "relative w-9 h-9 flex items-center justify-center rounded-full group",
              "bg-gradient-to-b from-background/60 to-background/40 backdrop-blur-md",
              "border border-border/40 shadow-sm transition-all duration-300"
            )}
          >
            <motion.div
              animate={{ rotate: isSheetOpen ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <MenuSquare
                className={cn(
                  "h-5 w-5 transition-colors duration-300",
                  isSheetOpen
                    ? "stroke-blue-600 dark:stroke-blue-400"
                    : "stroke-muted-foreground group-hover:stroke-foreground"
                )}
              />
            </motion.div>
          </motion.button>
        </SheetTrigger>

        <AnimatePresence>
          {isSheetOpen && (
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <SheetContent
                side="right"
                className={cn(
                  "fixed z-[100] w-[320px] sm:w-[380px] p-6 overflow-hidden",
                  "bg-[hsl(var(--background))] border-l border-border/30 backdrop-blur-xl",
                  "transition-colors duration-500 shadow-2xl"
                )}
              >
                {/* 🔥 Live-synced theme transition overlay */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none will-change-[background,box-shadow,opacity]"
                  style={{
                    background: `
                      radial-gradient(
                        circle at var(--theme-trans-cx, 50%) var(--theme-trans-cy, 50%),
                        hsla(var(--theme-trans-color, 260 80% 60%) / calc(0.22 * var(--theme-trans-progress, 0))),
                        transparent calc(var(--theme-trans-r, 0px))
                      )
                    `,
                    boxShadow: `
                      0 0 30px 8px hsla(var(--theme-trans-color, 260 80% 60%) /
                      calc(0.12 + 0.08 * (1 - var(--theme-trans-progress, 0))))
                    `,
                    opacity: "var(--theme-trans-active, 0)",
                    mixBlendMode: "screen",
                    borderRadius: "12px",
                    transform: "translateZ(0)",
                  }}
                />

                <SheetHeader className="mb-6 relative z-10">
                  <SheetTitle className="flex justify-between items-center gap-3 text-lg font-semibold">
                    Menu
                    <ThemeToggleButton />
                  </SheetTitle>
                </SheetHeader>

                <section className="p-4 rounded-2xl bg-card/70 border border-border/30 shadow-md transition-all duration-300 relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-green-500 flex items-center justify-center text-white font-semibold text-lg shadow-inner">
                      {getDisplayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="font-semibold text-foreground truncate">
                        {getDisplayName}
                      </span>
                      <span className="text-sm text-muted-foreground truncate">
                        {currentUser.email}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => navigate(`/profile/${currentUser.id}`)}
                      variant="secondary"
                      size="sm"
                      className="w-full h-9 text-xs font-medium"
                    >
                      <User className="w-3 h-3 mr-1" />
                      Profile
                    </Button>
                    <Button
                      onClick={() =>
                        navigate(`/profile/${currentUser.id}/edit`)
                      }
                      variant="secondary"
                      size="sm"
                      className="w-full h-9 text-xs font-medium"
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Settings
                    </Button>
                  </div>
                </section>

                <div className="mt-8 relative z-10">
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    size="lg"
                    className="w-full h-12 text-red-600 dark:text-red-400 font-semibold border border-red-200/40 dark:border-red-800/40 hover:bg-red-100/30 dark:hover:bg-red-900/20 transition-all duration-300"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Sheet>
    );
  }

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <Button
        onClick={() => router.push("/auth/login")}
        variant="outline"
        size="sm"
        className={cn(
          "text-blue-600 dark:text-blue-400 border border-blue-300/50 dark:border-blue-700/50",
          "hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors duration-300"
        )}
      >
        Sign In
      </Button>
      <Button
        onClick={() => router.push("/auth/register")}
        variant="default"
        size="sm"
        className={cn(
          "bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-md",
          "hover:from-blue-600 hover:to-green-600 hover:shadow-lg transition-all duration-300"
        )}
      >
        Sign Up
      </Button>
    </motion.div>
  );
}
