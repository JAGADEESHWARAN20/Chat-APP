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
    newTheme: string;
  }>({
    x: 0,
    y: 0,
    active: false,
    oldTheme: "light",
    newTheme: "dark",
  });

  const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;

    // toggle theme instantly
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);

    // enable circle transition
    setCircle({
      x,
      y,
      active: true,
      oldTheme: theme || "light",
      newTheme: nextTheme,
    });

    // cleanup after animation
    setTimeout(() => {
      setCircle((prev) => ({ ...prev, active: false }));
    }, 1200);
  };

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={handleClick}
        className="relative flex items-center z-[999999] justify-center w-10 h-10 rounded-full bg-gray-700 dark:bg-white"
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

      {/* Clip-path Circle Reveal */}
      <AnimatePresence>
        {circle.active &&
          createPortal(
            <motion.div
              initial={{ clipPath: `circle(0% at ${circle.x}px ${circle.y}px)` }}
              animate={{ clipPath: `circle(150% at ${circle.x}px ${circle.y}px)` }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className={`fixed inset-0 z-[99998] ${
                circle.newTheme === "dark" ? "bg-neutral-900" : "bg-neutral-50"
              }`}
            />,
            document.body
          )}
      </AnimatePresence>
    </>
  );
}
