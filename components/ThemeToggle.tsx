"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { createPortal } from "react-dom";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const [circle, setCircle] = useState<{
    x: number;
    y: number;
    maxRadius: number;
    active: boolean;
  }>({ x: 0, y: 0, maxRadius: 0, active: false });

  const handleClick = (e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const maxRadius = Math.sqrt(
      Math.pow(Math.max(x, vw - x), 2) + Math.pow(Math.max(y, vh - y), 2)
    );

    setCircle({ x, y, maxRadius, active: true });
  };

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={handleClick}
        className="relative flex items-center z-[999999] justify-center w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <motion.div
          key={isDark ? "moon" : "sun"}
          initial={{ rotate: -90, opacity: 0, scale: 0 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0 }}
          transition={{ duration: 0.4 }}
        >
          {isDark ? <Moon size={20} /> : <Sun size={20} />}
        </motion.div>
      </Button>

      {/* Circle Reveal Animation (in portal above everything) */}
      {circle.active &&
        createPortal(
          <motion.div
            key="circle"
            className="circle-effect-reveal"
            initial={{ width: 0, height: 0, opacity: 1 }}
            animate={{
              width: circle.maxRadius * 2,
              height: circle.maxRadius * 2,
              opacity: 1,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{
              top: circle.y,
              left: circle.x,
            }}
            onAnimationComplete={() => {
              setTheme(isDark ? "light" : "dark");
              setCircle((prev) => ({ ...prev, active: false }));
            }}
          />,
          document.body
        )}
    </>
  );
}
