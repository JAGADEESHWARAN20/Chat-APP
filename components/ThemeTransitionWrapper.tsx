"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useState, createContext, useContext, useRef, useEffect } from "react";

interface ThemeTransitionContextValue {
  triggerTransition: (x: number, y: number, nextTheme: string) => void;
  isDark: boolean;
}

const ThemeTransitionContext =
  createContext<ThemeTransitionContextValue | null>(null);

export function useThemeTransition() {
  const ctx = useContext(ThemeTransitionContext);
  if (!ctx)
    throw new Error("useThemeTransition must be used inside ThemeTransitionWrapper");
  return ctx;
}

export default function ThemeTransitionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme: currentTheme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = (currentTheme || "light") === "dark";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Safe SSR defaults
  const [transitionState, setTransitionState] = useState({
    active: false,
    nextTheme: "light",
    cx: 0,
    cy: 0,
  });

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setTransitionState((prev) => ({
        ...prev,
        cx: window.innerWidth / 2,
        cy: window.innerHeight / 2,
      }));
    }
  }, []);

  const getHSL = (name: string): string => {
    if (typeof window === "undefined") return "0 0% 100%";
    const root = document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    return value || "0 0% 100%";
  };

  const bgColor = mounted ? `hsl(${getHSL("--background")})` : "hsl(0 0% 100%)";

  // Detect target color tone to match ThemeToggleButton
  const getTransitionColor = (nextTheme: string) => {
    if (nextTheme === "dark") {
      // Light → Dark transition (match yellowish glow)
      return "260 80% 60%";
    } else {
      // Dark → Light transition (match violet-blue tone)
      return "45 95% 55%";
    }
  };

  // Animate the circular theme reveal
  useEffect(() => {
    if (!transitionState.active || !canvasRef.current || typeof window === "undefined") return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = "01";
    const fontSize = 16;
    const startTime = performance.now();
    const maxRadius = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
    const { nextTheme, cx, cy } = transitionState;

    const themeColor = getTransitionColor(nextTheme);

    const draw = (time: number) => {
      const elapsed = time - startTime;
      const duration = 1200;
      const progress = Math.min(elapsed / duration, 1);
      const radius = Math.max(0, progress * maxRadius);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw animated digits
      const digits = 60;
      for (let i = 0; i < digits; i++) {
        const angle = (i / digits) * Math.PI * 2;
        const x = cx + Math.cos(angle) * (radius - 10);
        const y = cy + Math.sin(angle) * (radius - 10);
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = `hsla(${themeColor} / ${1 - progress * 0.6})`;
        ctx.font = `${fontSize}px monospace`;
        ctx.fillText(char, x, y);
      }

      // Radial glow based on target theme color
      const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
      gradient.addColorStop(0, `hsla(${themeColor} / 0.25)`);
      gradient.addColorStop(1, `hsla(${themeColor} / 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Rim edge glow
      ctx.strokeStyle = `hsl(${themeColor})`;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 25;
      ctx.shadowColor = `hsl(${themeColor})`;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      if (progress < 1) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    requestAnimationFrame(draw);
  }, [transitionState]);

  const triggerTransition = (x: number, y: number, nextTheme: string) => {
    setTransitionState({ active: true, nextTheme, cx: x, cy: y });
    setTimeout(() => {
      setTheme(nextTheme);
      setTransitionState((prev) => ({ ...prev, active: false }));
    }, 1200);
  };

  const themeToApply = mounted ? currentTheme || systemTheme || "light" : "light";

  return (
    <ThemeTransitionContext.Provider value={{ triggerTransition, isDark }}>
      <div className={`transition-colors duration-500 ${themeToApply}`}>
        {children}
      </div>

      <AnimatePresence>
        {transitionState.active && (
          <motion.div
            className="fixed inset-0 z-[99999] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Transparent Canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full bg-transparent" />

            {/* Expanding Circle synced with background */}
            <motion.div
              className="absolute rounded-full mix-blend-normal"
              style={{
                background: `radial-gradient(circle, ${bgColor} 45%, transparent 80%)`,
                left: transitionState.cx,
                top: transitionState.cy,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ width: 0, height: 0, scale: 0 }}
              animate={{ width: "200vmax", height: "200vmax", scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </ThemeTransitionContext.Provider>
  );
}
