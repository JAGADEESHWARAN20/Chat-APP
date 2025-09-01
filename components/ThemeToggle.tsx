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

    setCircle({ x, y, active: true, nextTheme });

    setTimeout(() => {
      setTheme(nextTheme);
      setTimeout(() => {
        setCircle((prev) => ({ ...prev, active: false }));
      }, 1200);
    }, 10);
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

      {/* Masking Effect */}
      <AnimatePresence>
        {circle.active && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className={`fixed inset-0 z-[99998] pointer-events-none ${
              circle.nextTheme === "dark" ? "bg-[#09090b]" : "bg-white"
            }`}
            style={{
              WebkitMaskImage: `radial-gradient(circle at ${circle.x}px ${circle.y}px, black 0%, transparent 0%)`,
              maskImage: `radial-gradient(circle at ${circle.x}px ${circle.y}px, black 0%, transparent 0%)`,
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskSize: "200% 200%",
              maskSize: "200% 200%",
              WebkitMaskPosition: "center",
              maskPosition: "center",
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
