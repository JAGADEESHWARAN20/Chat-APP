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

/**
 * LoginLogoutButton
 * ------------------------------------------------------
 * - Unified design system for menu trigger
 * - Same theme as CreateRoomDialog & NotificationsWrapper
 * - Full light/dark adaptive
 * - Motion, blur, glow consistency
 */
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

  // ========================================================
  // ✅ AUTHENTICATED VIEW
  // ========================================================
  if (currentUser) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        {/* ========== MENU TRIGGER BUTTON ========== */}
        <SheetTrigger asChild>
          <motion.button
            title="Menu"
            aria-label="Open user menu"
            whileHover={{ scale: 1 }}
            whileTap={{ scale: 1 }}
            className={cn(
              "relative flex items-center justify-center rounded-full group",
              "w-[2.6em] h-[2.6em] transition-all duration-300 shadow-sm",
              "bg-[var(--action-bg)] border border-[var(--action-ring)] hover:bg-[var(--action-hover)] hover:shadow-lg"
            )}
          >
            <motion.div
              animate={{ rotate: isSheetOpen ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <MenuSquare
                className={cn(
                  "h-[1.4em] w-[1.4em] stroke-[var(--action-active)]  transition-colors  duration-300",
                  isSheetOpen
                    ? "stroke-[var(--action-active)] fill-[var(--action-active)]"
                    : " group-hover:stroke-[var(--action-active)]"
                )}
              />
            </motion.div>
          </motion.button>
        </SheetTrigger>

        {/* ========== SHEET PANEL ========== */}
        <AnimatePresence>
          {isSheetOpen && (
            <motion.div
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ duration: 0.01, ease: "easeInOut" }}
            >
              <SheetContent
                side="right"
                className={cn(
                  "fixed z-[100] w-[320px] sm:w-[380px] p-6 overflow-hidden",
                  "bg-[hsl(var(--background))] border-l border-border/30 backdrop-blur-xl",
                  "transition-colors duration-500 shadow-2xl"
                )}
              >
                {/* 🔮 Smooth Theme Transition Glow */}
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

                {/* 👤 Profile section */}
                <section className="p-4 rounded-2xl bg-card/70 border border-border/30 shadow-md relative z-10 transition-all duration-300">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-green-500 flex items-center justify-center text-white font-semibold text-lg shadow-inner">
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
                      className="w-full h-9 text-xs font-medium hover:bg-[var(--action-hover)]"
                    >
                      <User className="w-3 h-3 mr-1" />
                      Profile
                    </Button>
                    <Button
                      onClick={() => navigate(`/profile/${currentUser.id}/edit`)}
                      variant="secondary"
                      size="sm"
                      className="w-full h-9 text-xs font-medium hover:bg-[var(--action-hover)]"
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Settings
                    </Button>
                  </div>
                </section>

                {/* 🚪 Logout */}
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

  // ========================================================
  // ✅ UNAUTHENTICATED VIEW
  // ========================================================
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
          "border border-[var(--action-ring)] text-[var(--action-active)] font-medium",
          "hover:bg-[var(--action-hover)] hover:text-[var(--action-text)] transition-all duration-300"
        )}
      >
        Sign In
      </Button>

      <Button
        onClick={() => router.push("/auth/register")}
        variant="default"
        size="sm"
        className={cn(
          "bg-[var(--action-active)] text-white font-medium shadow-md",
          "hover:bg-[var(--action-ring)] hover:shadow-lg transition-all duration-300"
        )}
      >
        Sign Up
      </Button>
    </motion.div>
  );
}
