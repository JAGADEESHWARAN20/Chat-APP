"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [mounted, setMounted] = useState(false);
  const [circle, setCircle] = useState<{
    x: number;
    y: number;
    active: boolean;
  }>({ x: 0, y: 0, active: false });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        disabled
        className="invisible h-5 w-5"
      />
    );
  }

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    setCircle({ x, y, active: true });

    // wait until circle animation is done before switching theme
    setTimeout(() => {
      setTheme(isDark ? "light" : "dark");
      setCircle({ ...circle, active: false });
    }, 600);
  };

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        onClick={handleToggle}
        disabled={circle.active} // 🔥 prevents spam clicks
        className="relative flex items-center justify-center overflow-hidden"
      >

        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div
              key="sun"
              initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="absolute"
            >
              <Sun className="h-5 w-5 text-yellow-500" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="absolute"
            >
              <Moon className="h-5 w-5 text-blue-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      {/* Expanding Circle Overlay */}
      <AnimatePresence>
        {circle.active && (
          <motion.div
            key="circle"
            initial={{ scale: 0, opacity: 1 }}
            animate={{
              scale: 50, // enough to cover whole screen
              opacity: 1,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{
              position: "fixed",
              top: circle.y,
              left: circle.x,
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              backgroundColor: isDark ? "#ffffff" : "#0a0a0a",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 9999, // sits above everything, but temporary
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
