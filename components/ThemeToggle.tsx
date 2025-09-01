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

    // Trigger animation and add transitioning class to body
    setCircle({
      x,
      y,
      active: true,
      nextTheme,
    });

    // Delay theme change and class removal to match animation duration
    setTimeout(() => {
      document.body.classList.add("transitioning");
      setTheme(nextTheme);
      setTimeout(() => {
        document.body.classList.remove("transitioning");
        setCircle((prev) => ({ ...prev, active: false }));
      }, 600); // Matches body transition duration (0.6s)
    }, 1200); // Matches animation duration (1.2s)
  };

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={handleClick}
        className="relative flex items-center justify-center w-10 h-10 rounded-full text-white bg-violet-700 z-[999999]"
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

      {/* Circular animation effect without blocking content */}
      <AnimatePresence>
        {circle.active && (
          <motion.div
            initial={{ clipPath: `circle(0% at ${circle.x}px ${circle.y}px)` }}
            animate={{ clipPath: `circle(150% at ${circle.x}px ${circle.y}px)` }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="fixed inset-0 z-[99998] pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${circle.x}px ${circle.y}px, ${circle.nextTheme === "dark" ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.6)"
                } 0%)`,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}