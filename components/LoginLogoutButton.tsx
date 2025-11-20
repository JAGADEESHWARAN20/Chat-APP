"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { motion, Variants } from "framer-motion";
import {
  LogOut,
  MenuSquare,
  User,
  Settings,
  X,
  LifeBuoy,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Database } from "@/database.types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
} from "@/components/ui/sheet";
import ThemeToggleButton from "@/components/ThemeToggle";
import { useUser } from "@/lib/store/user";
import { cn } from "@/lib/utils";
import { useThemeTransition } from "@/components/ThemeTransitionWrapper";

/* ==========================================================
   ANIMATION VARIANTS (typed correctly)
   ========================================================== */

const sheetContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: 20, y: 10, filter: "blur(5px)" },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
  exit: { opacity: 0, x: 20, filter: "blur(5px)", transition: { duration: 0.2 } },
};

interface LoginLogoutButtonProps {
  user?: SupabaseUser | null;
}

/* -----------------------
   Responsive style helpers
   ----------------------- */
const headFont = "clamp(1.1rem, 2.2vw, 1.45rem)";
const bodyFont = "clamp(0.95rem, 1.6vw, 1.05rem)";
const smallText = "clamp(0.7rem, 1.2vw, 0.85rem)";
const avatarSize = "clamp(3.2rem, 6.0vw, 4.6rem)";
const cardPadding = "1.05em";

/* ---------------------------
   Small presentational parts
   --------------------------- */

function InterfacesLogoSquare() {
  // tiny logo used in your sheet — same minimal markup as before
  return (
    <div className="aspect-[24/24] grow min-h-px min-w-px overflow-clip relative shrink-0">
      <div className="absolute aspect-[24/16] left-0 right-0 top-1/2 -translate-y-1/2">
        <svg className="block size-full" fill="none" viewBox="0 0 24 16" aria-hidden>
          <g>
            <path d="M0.32 0C0.20799 0 0.151984 0 0.109202 0.0217987C0.0715695 0.0409734 0.0409734 0.0715695 0.0217987 0.109202C0 0.151984 0 0.20799 0 0.32V6.68C0 6.79201 0 6.84801 0.0217987 6.8908C0.0409734 6.92843 0.0715695 6.95902 0.109202 6.9782C0.151984 7 0.207989 7 0.32 7L3.68 7C3.79201 7 3.84802 7 3.8908 6.9782C3.92843 6.95903 3.95903 6.92843 3.9782 6.8908C4 6.84801 4 6.79201 4 6.68V4.32C4 4.20799 4 4.15198 4.0218 4.1092C4.04097 4.07157 4.07157 4.04097 4.1092 4.0218C4.15198 4 4.20799 4 4.32 4L19.68 4C19.792 4 19.848 4 19.8908 4.0218C19.9284 4.04097 19.959 4.07157 19.9782 4.1092C20 4.15198 20 4.20799 20 4.32V6.68C20 6.79201 20 6.84802 20.0218 6.8908C20.041 6.92843 20.0716 6.95903 20.1092 6.9782C20.152 7 20.208 7 20.32 7L23.68 7C23.792 7 23.848 7 23.8908 6.9782C23.9284 6.95903 23.959 6.92843 23.9782 6.8908C24 6.84802 24 6.79201 24 6.68V0.32C24 0.20799 24 0.151984 23.9782 0.109202C23.959 0.0715695 23.9284 0.0409734 23.8908 0.0217987C23.848 0 23.792 0 23.68 0H0.32Z" fill="#FAFAFA" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function AvatarInitial({ name }: { name: string }) {
  return (
    <div
      style={{
        width: avatarSize,
        height: avatarSize,
        minWidth: avatarSize,
        minHeight: avatarSize,
        borderRadius: "50%",
        padding: "0.14em",
        display: "grid",
        placeItems: "center",
        boxShadow: "0 10px 24px rgba(2,6,23,0.12)",
        background: "linear-gradient(135deg, var(--sheet-tint, rgba(59,130,246,0.12)), rgba(59,130,246,0.08))",
        border: "1px solid rgba(255,255,255,0.02)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "var(--background, #fff)",
          color: "var(--foreground, #0f172a)",
          fontWeight: 700,
          fontSize: "1.05em",
        }}
        aria-hidden
      >
        <span>{/* initial letter inserted by parent */}</span>
      </div>
    </div>
  );
}

/* ---------------------------
   Reusable menu row (Button)
   - keeps same visuals, but uses Button primitive for focus/keyboard
   --------------------------- */

function MenuRow({
  onClick,
  icon,
  title,
  subtitle,
  iconBg,
  iconColor,
  rightMeta,
}: {
  onClick?: () => void;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  iconBg?: string;
  iconColor?: string;
  rightMeta?: React.ReactNode;
}) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size="default"
      className={cn(
        "w-full text-left flex items-center gap-4 px-0 py-0",
        // remove default inline padding to use the custom padding below
      )}
      asChild
    >
      <button
        type="button"
        className="w-full text-left"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.9em",
          padding: "0.78em 1em",
          width: "100%",
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: "2.2em",
            height: "2.2em",
            borderRadius: "0.6em",
            background: iconBg ?? "rgba(59,130,246,0.06)",
            color: iconColor ?? "var(--primary, #3b82f6)",
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1em", fontWeight: 600 }}>{title}</div>
          {subtitle && <div style={{ fontSize: smallText, color: "var(--muted-foreground, rgba(15,23,42,0.6))" }}>{subtitle}</div>}
        </div>

        {rightMeta && <div style={{ fontSize: smallText, color: "var(--muted-foreground, rgba(15,23,42,0.45))" }}>{rightMeta}</div>}
      </button>
    </Button>
  );
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

  const storeUser = useUser((s) => s.user);
  const currentUser = user || storeUser;
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const displayName = useMemo(() => {
    if (!currentUser) return "User";
    return (
      (currentUser.user_metadata as any)?.display_name ||
      (currentUser.user_metadata as any)?.username ||
      currentUser.email?.split("@")[0] ||
      "User"
    );
  }, [currentUser]);

  const handleLogout = async () => {
    setIsSheetOpen(false);
    await supabase.auth.signOut();
    router.replace("/");
  };

  const navigate = (path: string) => {
    if (!currentUser?.id) return;
    setIsSheetOpen(false);
    router.push(path);
  };

  const { isTransitioning } = useThemeTransition();

  if (currentUser) {
    return (
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <button
            title="Menu"
            aria-label="Open user menu"
            className={cn(
              "relative flex items-center justify-center rounded-xl group",
              "w-10 h-10 transition-colors duration-300",
              "bg-secondary/50 border border-border/50 backdrop-blur-sm",
              "hover:bg-primary/10 hover:border-primary/30 hover:shadow-[0_0_15px_rgba(var(--primary),0.3)]"
            )}
            onClick={() => setIsSheetOpen(true)}
            style={{ fontSize: "1em" }}
          >
            <motion.div
              animate={{ rotate: isSheetOpen ? 90 : 0 }}
              transition={{ type: "spring" as const, stiffness: 200, damping: 15 }}
            >
              <MenuSquare
                className={cn(
                  "w-5 h-5 transition-colors duration-300",
                  isSheetOpen ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
                aria-hidden
              />
            </motion.div>
          </button>
        </SheetTrigger>

        <SheetContent
          side="right"
          className="p-0 border-l border-border/40 bg-white/80  shadow-2xl sm:max-w-sm w-full overflow-hidden"
        >
          <motion.div
            className="h-full w-full bg-background/80 backdrop-blur-2xl flex flex-col p-6 shadow-[-10px_0_30px_-10px_rgba(0,0,0,0.1)] dark:shadow-[-10px_0_30px_-10px_rgba(0,0,0,0.3)] relative overflow-hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring" as const, stiffness: 300, damping: 30, mass: 0.8 }}
            style={{
              backgroundColor: `hsla(var(--theme-trans-color, 0 0% 0%) / calc(var(--theme-trans-progress, 0) * 0.18))`,
              transition: "background-color 120ms linear",
              fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
              color: "var(--foreground, #0f172a)",
              fontSize: bodyFont,
              lineHeight: "1.35",
            }}
          >
            {/* radial overlay */}
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: isTransitioning ? 1 : 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                background: `radial-gradient(
                  circle at var(--theme-trans-cx, 50%) var(--theme-trans-cy, 50%),
                  hsla(var(--theme-trans-color, 45 95% 55%) / calc(0.95 * var(--theme-trans-progress, 0))),
                  transparent 35%
                )`,
                boxShadow: `inset 0 0 140px -38px hsla(var(--theme-trans-color, 45 95% 55%) / calc(0.35 * var(--theme-trans-progress, 0)))`,
                mixBlendMode: "screen",
                transition: "background 100ms linear, box-shadow 120ms linear",
              }}
            />

            <div style={{ display: "none" }}>
              {/* @ts-ignore */}
              <div style={{ ["--sheet-tint" as any]: "hsla(var(--theme-trans-color, 45 95% 55%) / calc(0.9 * var(--theme-trans-progress, 0)))" }} />
            </div>

            {/* content */}
            <div className="relative z-10 flex flex-col h-full" style={{ gap: "0.9em" }}>
              {/* Header */}
              <motion.div variants={itemVariants} className="flex justify-between items-center mb-3" style={{ padding: `0 ${cardPadding}` }}>
                <SheetTitle
                  className="font-extrabold"
                  style={{
                    fontSize: headFont,
                    letterSpacing: "-0.015em",
                    margin: 0,
                    color: "color-mix(in srgb, var(--sheet-tint, var(--foreground, #0f172a)) 85%, var(--foreground, #0f172a))",
                  }}
                >
                  Menu
                </SheetTitle>

                <div style={{ display: "flex", gap: "0.6em", alignItems: "center" }}>
                  <ThemeToggleButton />
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                      style={{ width: "2.4em", height: "2.4em", padding: "0.2em" }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </SheetClose>
                </div>
              </motion.div>

              {/* Profile Card */}
              <motion.div variants={itemVariants} className="mb-4" style={{ padding: `0 ${cardPadding}` }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1em",
                    padding: cardPadding,
                    borderRadius: "1.2em",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.02))",
                    border: "1px solid rgba(100,100,110,0.06)",
                    fontSize: "1em",
                    backdropFilter: "saturate(1.08) blur(6px)",
                  }}
                >
                  <div
                    style={{
                      width: avatarSize,
                      height: avatarSize,
                      minWidth: avatarSize,
                      minHeight: avatarSize,
                      borderRadius: "50%",
                      padding: "0.14em",
                      display: "grid",
                      placeItems: "center",
                      boxShadow: "0 10px 24px rgba(2,6,23,0.12)",
                      background: "linear-gradient(135deg, var(--sheet-tint, rgba(59,130,246,0.12)), rgba(59,130,246,0.08))",
                      border: "1px solid rgba(255,255,255,0.02)",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: "var(--background, #fff)",
                        color: "var(--foreground, #0f172a)",
                        fontWeight: 700,
                        fontSize: "1.05em",
                      }}
                    >
                      <span aria-hidden>{displayName.charAt(0).toUpperCase()}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.18em", minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: "1.02em",
                        fontWeight: 700,
                        color: "color-mix(in srgb, var(--sheet-tint, var(--foreground, #0f172a)) 75%, var(--foreground, #0f172a))",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {displayName}
                    </span>

                    <span
                      style={{
                        fontSize: smallText,
                        color: "var(--muted-foreground, rgba(15,23,42,0.6))",
                        opacity: 0.88,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {currentUser.email}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* ===========================
                  GROUPED LISTS (no spacing)
                 =========================== */}
              <div  style={{ padding: `0 ${cardPadding}`, display: "flex", flexDirection: "column", gap: 0, flex: 1 }}>
                {/* Main actions group (Profile / Settings) */}
                <motion.ul

                  variants={itemVariants}
                  role="list"
                  aria-label="Main actions"
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                    borderRadius: "0.9em",
                    overflow: "hidden",
                    border: "1px solid rgba(120,120,130,0.04)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(0,0,0,0.01))",
                  }}
                >
                  <li>
                    <MenuRow
                      onClick={() => navigate(`/profile/${currentUser.id}`)}
                      icon={<User className="w-4 h-4" />}
                      title="Profile"
                      subtitle="View and edit your profile"
                      iconBg="rgba(59,130,246,0.06)"
                      iconColor="var(--primary, #3b82f6)"
                    />
                    <div style={{ height: 1, background: "rgba(0,0,0,0.04)" }} />
                  </li>

                  <li>
                    <MenuRow
                      onClick={() => navigate(`/profile/${currentUser.id}/edit`)}
                      icon={<Settings className="w-4 h-4" />}
                      title="Settings"
                      subtitle="Account & preferences"
                      iconBg="rgba(59,130,246,0.06)"
                      iconColor="var(--primary, #3b82f6)"
                    />
                  </li>
                </motion.ul>

                {/* small gap */}
                <div style={{ height: "0.6em" }} />

                {/* Support group */}
                <motion.ul
                  variants={itemVariants}
                  role="list"
                  aria-label="Support options"
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                    borderRadius: "0.9em",
                    overflow: "hidden",
                    border: "1px solid rgba(120,120,130,0.04)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(0,0,0,0.01))",
                  }}
                >
                  <li>
                    <MenuRow
                      onClick={() => {
                        router.push("/help");
                        setIsSheetOpen(false);
                      }}
                      icon={<LifeBuoy className="w-4 h-4" />}
                      title="Help Center"
                      subtitle="Docs & FAQs"
                      iconBg="rgba(16,185,129,0.06)"
                      iconColor="var(--success, #10b981)"
                    />
                    <div style={{ height: 1, background: "rgba(0,0,0,0.04)" }} />
                  </li>

                  <li>
                    <MenuRow
                      onClick={() => {
                        setIsSheetOpen(false);
                        router.push("/support");
                      }}
                      icon={<MessageCircle className="w-4 h-4" />}
                      title="Support"
                      subtitle="Contact our team"
                      iconBg="rgba(59,130,246,0.06)"
                      iconColor="var(--primary, #3b82f6)"
                    />
                    <div style={{ height: 1, background: "rgba(0,0,0,0.04)" }} />
                  </li>

                  <li>
                    <MenuRow
                      onClick={() => {
                        setIsSheetOpen(false);
                        router.push("/report");
                      }}
                      icon={<AlertCircle className="w-4 h-4" />}
                      title="Report a problem"
                      subtitle="Send feedback or bug report"
                      iconBg="rgba(239,68,68,0.06)"
                      iconColor="var(--danger, #ef4444)"
                    />
                  </li>
                </motion.ul>

                {/* tiny spacer */}
                <div style={{ height: "0.6em" }} />

                {/* Other / Extras group */}
                <motion.ul
                  variants={itemVariants}
                  role="list"
                  aria-label="Other options"
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                    borderRadius: "0.9em",
                    overflow: "hidden",
                    border: "1px solid rgba(120,120,130,0.04)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(0,0,0,0.01))",
                    marginBottom: "0.4em",
                  }}
                >
                  <li>
                    <MenuRow
                      onClick={() => {
                        setIsSheetOpen(false);
                        router.push("/shortcuts");
                      }}
                      title="Shortcuts"
                      subtitle="Keyboard & quick actions"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M3 12h18M12 3v18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                      iconBg="rgba(120,120,130,0.04)"
                      iconColor="currentColor"
                    />
                    <div style={{ height: 1, background: "rgba(0,0,0,0.04)" }} />
                  </li>

                  <li>
                    <MenuRow
                      onClick={() => {
                        setIsSheetOpen(false);
                        router.push("/privacy");
                      }}
                      title="Privacy"
                      subtitle="Settings & data"
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                      iconBg="rgba(120,120,130,0.04)"
                      iconColor="currentColor"
                    />
                  </li>
                </motion.ul>

                {/* Account group (Sign Out) */}
                <motion.div variants={itemVariants} style={{ borderRadius: "0.9em", overflow: "hidden" }}>
                  <button
                    onClick={handleLogout}
                    className="w-full"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.9em",
                      padding: "0.78em 1em",
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderRadius: "0.9em",
                      borderTop: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-grid",
                        placeItems: "center",
                        width: "2.2em",
                        height: "2.2em",
                        borderRadius: "0.6em",
                        background: "rgba(239,68,68,0.06)",
                        color: "var(--danger, #ef4444)",
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "1em", fontWeight: 700 }}>Sign Out</div>
                      <div style={{ fontSize: smallText, color: "var(--muted-foreground, rgba(15,23,42,0.6))" }}>End session</div>
                    </div>
                  </button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </SheetContent>
      </Sheet>
    );
  }

  // Unauthenticated view
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      style={{ fontSize: bodyFont }}
    >
      <Button
        onClick={() => router.push("/auth/login")}
        variant="ghost"
        size="sm"
        className="font-medium"
        style={{ fontSize: "1em", padding: "0.5em 0.9em" }}
      >
        Sign In
      </Button>

      <div>
        <Button
          onClick={() => router.push("/auth/register")}
          variant="default"
          size="sm"
          className="bg-gradient-to-r from-primary to-blue-600 transition-all duration-300 border-0"
          style={{ fontSize: "1em", padding: "0.5em 1em" }}
        >
          Sign Up
        </Button>
      </div>
    </motion.div>
  );
}
