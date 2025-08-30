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

    // switch theme instantly so new bg is ready behind
    setTheme(isDark ? "light" : "dark");

    // cleanup circle after animation
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
      <AnimatePresence>
        {circle.active &&
          createPortal(
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 100, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: "fixed",
                top: circle.y,
                left: circle.x,
                width: "100vmax", // big enough to cover whole screen
                height: "100vmax",
                borderRadius: "50%",
                background:
                  circle.oldTheme === "dark"
                    ? "hsl(0, 0%, 10%)" // dark bg
                    : "hsl(0, 0%, 98%)", // light bg
                zIndex: 99998,
                transform: "translate(-50%, -50%)",
              }}
            />,
            document.body
          )}
      </AnimatePresence>
    </>
  );
}
