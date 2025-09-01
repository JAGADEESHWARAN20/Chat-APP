"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [animatingTheme, setAnimatingTheme] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });

  const toggleTheme = (e: React.MouseEvent) => {
    const newTheme = theme === "light" ? "dark" : "light";
    setAnimatingTheme(newTheme);

    const rect = document.body.getBoundingClientRect();
    setClickPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    // switch theme after short delay so Tailwind classes apply
    setTimeout(() => setTheme(newTheme), 0);

    // cleanup after animation
    setTimeout(() => setAnimatingTheme(null), 1200);
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

      {/* Circular theme reveal layer */}
      <AnimatePresence>
        {animatingTheme && (
          <motion.div
            key="theme-reveal"
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
            className="fixed inset-0 z-40 pointer-events-none"
          >
            {/* This child is a full-screen clone styled with the NEW theme */}
            <div
              className={
                animatingTheme === "light"
                  ? "bg-white text-black h-full w-full flex items-center justify-center"
                  : "bg-neutral-900 text-white h-full w-full flex items-center justify-center"
              }
            >
              <h1 className="text-3xl font-bold">
                {animatingTheme === "light"
                  ? "Light Mode Preview 🌞"
                  : "Dark Mode Preview 🌙"}
              </h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
