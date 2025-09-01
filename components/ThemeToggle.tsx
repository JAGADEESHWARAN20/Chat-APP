"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });

  const toggleTheme = (e: React.MouseEvent) => {
    const rect = document.body.getBoundingClientRect();
    setClickPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsAnimating(true);
    setTheme(theme === "light" ? "dark" : "light");
    setTimeout(() => setIsAnimating(false), 1200); // match animation duration
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 shadow-lg transition-colors"
      >
        {theme === "light" ? (
          <Sun className="w-6 h-6 text-yellow-500" />
        ) : (
          <Moon className="w-6 h-6 text-blue-400" />
        )}
      </button>

      {/* Circular expanding overlay */}
      <AnimatePresence>
        {isAnimating && (
          <motion.div
            key="circle-overlay"
            initial={{
              clipPath: `circle(0% at ${clickPos.x}px ${clickPos.y}px)`,
            }}
            animate={{
              clipPath: `circle(150% at ${clickPos.x}px ${clickPos.y}px)`,
            }}
            exit={{
              opacity: 0,
              transition: { duration: 0.3 },
            }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className={`fixed inset-0 z-40 ${
              theme === "light" ? "bg-white" : "bg-neutral-900"
            }`}
          />
        )}
      </AnimatePresence>
    </>
  );
}
