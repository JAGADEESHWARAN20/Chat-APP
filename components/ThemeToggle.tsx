"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { createPortal } from "react-dom";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const [circle, setCircle] = useState<{
    x: number;
    y: number;
    active: boolean;
    oldTheme: string;
  }>({ x: 0, y: 0, active: false, oldTheme: "light" });

  const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;

    // store old theme color for circle
    setCircle({ x, y, active: true, oldTheme: theme || "light" });

    // switch theme instantly (so new background is behind)
    setTheme(isDark ? "light" : "dark");

    // remove circle after animation ends
    setTimeout(() => {
      setCircle((prev) => ({ ...prev, active: false }));
    }, 1000);
  };

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={handleClick}
        className="relative flex items-center z-[999999] justify-center w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isDark ? "moon" : "sun"}
            initial={{ rotate: -90, opacity: 0, scale: 0 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0 }}
            transition={{ duration: 0.4 }}
          >
            {isDark ? <Moon size={20} /> : <Sun size={20} />}
          </motion.div>
        </AnimatePresence>
      </Button>

      {/* Circle Reveal */}
      {circle.active &&
        createPortal(
          <div
            className={`circle-effect-reveal active ${circle.oldTheme}`}
            style={{ top: circle.y, left: circle.x }}
          />,
          document.body
        )}
    </>
  );
}
