"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const [circle, setCircle] = useState<{
    x: number;
    y: number;
    active: boolean;
    nextTheme: string;
  }>({
    x: 0,
    y: 0,
    active: false,
    nextTheme: "light",
  });

  const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;

    const nextTheme = isDark ? "light" : "dark";

    // Trigger overlay animation first
    setCircle({
      x,
      y,
      active: true,
      nextTheme,
    });

    // Delay theme change until animation finishes
    setTimeout(() => {
      setTheme(nextTheme);
      setCircle((prev) => ({ ...prev, active: false }));
    }, 1200); // matches transition duration
  };

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={handleClick}
        className="relative flex items-center z-[999999] hover:bg-none  justify-center w-10 h-10 rounded-full bg-gray-900 dark:bg-white  text-violet-600 dark:text-violet-800"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isDark ? "moon" : "sun"}
            initial={{ rotate: -90, opacity: 0, scale: 0 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0 }}
            transition={{ duration: 0.4 }}
          >
            {isDark ? <Moon className="text-black" size={20} /> : <Sun size={20}  />}
          </motion.div>
        </AnimatePresence>
      </Button>

      {/* Circular clip-path animation overlay */}
      <AnimatePresence>
        {circle.active && (
          <motion.div
            initial={{ clipPath: `circle(0% at ${circle.x}px ${circle.y}px)` }}
            animate={{ clipPath: `circle(150% at ${circle.x}px ${circle.y}px)` }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className={`fixed inset-0 z-[99998] pointer-events-none ${
              circle.nextTheme === "dark" ? "bg-neutral-900 mix-blend-screen" : "bg-white  mix-blend-overlay"
            }`}
          />
        )}
      </AnimatePresence>
    </>
  );
}
