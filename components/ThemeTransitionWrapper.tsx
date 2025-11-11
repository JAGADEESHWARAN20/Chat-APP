"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import React, {
  useState,
  createContext,
  useContext,
  useRef,
  useEffect,
} from "react";

interface ThemeTransitionState {
  active: boolean;
  nextTheme: string;
  cx: number;
  cy: number;
  radius: number;
  progress: number; // 0..1
  colorHsl: string; // e.g., "260 80% 60%"
}

interface ThemeTransitionContextValue {
  triggerTransition: (x: number, y: number, nextTheme: string) => void;
  isDark: boolean;
  transition: ThemeTransitionState;
}

const ThemeTransitionContext =
  createContext<ThemeTransitionContextValue | null>(null);

export function useThemeTransition() {
  const ctx = useContext(ThemeTransitionContext);
  if (!ctx)
    throw new Error(
      "useThemeTransition must be used inside ThemeTransitionWrapper"
    );
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const transitionRef = useRef<ThemeTransitionState>({
    active: false,
    nextTheme: "light",
    cx: 0,
    cy: 0,
    radius: 0,
    progress: 0,
    colorHsl: "0 0% 100%",
  });
  const [transition, setTransition] = useState<ThemeTransitionState>(
    transitionRef.current
  );

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setTransition((s) => ({
        ...s,
        cx: window.innerWidth / 2,
        cy: window.innerHeight / 2,
      }));
    }
  }, []);

  const getHSLVar = (name: string) => {
    if (typeof window === "undefined") return "0 0% 100%";
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return val || "0 0% 100%";
  };

  const getTransitionColor = (nextTheme: string) =>
    nextTheme === "dark" ? "260 80% 60%" : "45 95% 55%";

  // =============================
  // Canvas animation loop
  // =============================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawLoop = () => {
      const t = transitionRef.current;
      if (!t.active) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = null;
        return;
      }

      // Resize-safe
      if (
        canvas.width !== window.innerWidth ||
        canvas.height !== window.innerHeight
      ) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const chars = "01";
      const fontSize = 16;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      const safeR = Math.max(0, t.radius);
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, safeR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // binary digits swirl
      const digits = 60;
      for (let i = 0; i < digits; i++) {
        const angle = (i / digits) * Math.PI * 2;
        const x = t.cx + Math.cos(angle) * (safeR - 10);
        const y = t.cy + Math.sin(angle) * (safeR - 10);
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = `hsla(${t.colorHsl} / ${Math.max(
          0.05,
          1 - t.progress * 0.75
        )})`;
        ctx.font = `${fontSize}px monospace`;
        ctx.fillText(char, x, y);
      }

      // radial glow
      const gradient = ctx.createRadialGradient(
        t.cx,
        t.cy,
        Math.max(1, safeR * 0.2),
        t.cx,
        t.cy,
        Math.max(1, safeR)
      );
      gradient.addColorStop(
        0,
        `hsla(${t.colorHsl} / ${0.22 * (1 - t.progress * 0.6)})`
      );
      gradient.addColorStop(1, `hsla(${t.colorHsl} / 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // rim edge
      ctx.strokeStyle = `hsl(${t.colorHsl})`;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 22;
      ctx.shadowColor = `hsl(${t.colorHsl})`;
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, safeR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      rafRef.current = requestAnimationFrame(drawLoop);
    };

    if (transitionRef.current.active && !rafRef.current) {
      rafRef.current = requestAnimationFrame(drawLoop);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [transition.active]);

  // =============================
  // CSS variable broadcaster
  // =============================
  const writeCSSVars = (t: ThemeTransitionState, elapsed = 0) => {
    const root = document.documentElement;
    root.style.setProperty("--theme-trans-active", t.active ? "1" : "0");
    root.style.setProperty("--theme-trans-cx", `${t.cx}px`);
    root.style.setProperty("--theme-trans-cy", `${t.cy}px`);
    root.style.setProperty("--theme-trans-r", `${Math.round(t.radius)}px`);
    root.style.setProperty("--theme-trans-color", t.colorHsl);
    root.style.setProperty("--theme-trans-progress", `${t.progress}`);
    root.style.setProperty("--theme-trans-elapsed", `${elapsed}`);
  };

  // =============================
  // Main trigger
  // =============================
  const triggerTransition = (cx: number, cy: number, nextTheme: string) => {
    const duration = 1200;
    const start = performance.now();
    const maxRadius = Math.sqrt(
      window.innerWidth ** 2 + window.innerHeight ** 2
    );
    const colorHsl = getTransitionColor(nextTheme);

    const base: ThemeTransitionState = {
      active: true,
      nextTheme,
      cx,
      cy,
      radius: 0,
      progress: 0,
      colorHsl,
    };

    transitionRef.current = base;
    setTransition(base);
    writeCSSVars(base);

    const step = (now: number) => {
      const elapsed = now - start;
      const prog = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - prog, 3);
      const radius = eased * maxRadius;

      const t = {
        active: true,
        nextTheme,
        cx,
        cy,
        radius,
        progress: prog,
        colorHsl,
      };

      transitionRef.current = t;
      writeCSSVars(t, elapsed);

      if (prog < 1) {
        requestAnimationFrame(step);
      } else {
        requestAnimationFrame(() => {
          setTheme(nextTheme);
          setTimeout(() => {
            transitionRef.current = {
              ...t,
              active: false,
              radius: 0,
              progress: 0,
            };
            setTransition(transitionRef.current);
            const root = document.documentElement;
            [
              "--theme-trans-active",
              "--theme-trans-cx",
              "--theme-trans-cy",
              "--theme-trans-r",
              "--theme-trans-color",
              "--theme-trans-progress",
              "--theme-trans-elapsed",
            ].forEach((v) => root.style.removeProperty(v));
          }, 180);
        });
      }
    };

    requestAnimationFrame(step);
  };

  const themeToApply = mounted ? currentTheme || systemTheme || "light" : "light";

  return (
    <ThemeTransitionContext.Provider
      value={{ triggerTransition, isDark, transition }}
    >
      <div className={`transition-colors duration-500 ${themeToApply}`}>
        {children}
      </div>

      <AnimatePresence>
        {transition.active && (
          <motion.div
            className="fixed inset-0 z-[99999] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full bg-transparent"
            />
            <div
              style={{
                position: "absolute",
                left: `${transition.cx}px`,
                top: `${transition.cy}px`,
                transform: "translate(-50%, -50%)",
                width: `${transition.radius * 2}px`,
                height: `${transition.radius * 2}px`,
                borderRadius: "50%",
                pointerEvents: "none",
                background: `radial-gradient(circle, hsla(${transition.colorHsl} / 0.12) 0%, transparent 60%)`,
                mixBlendMode: "normal",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </ThemeTransitionContext.Provider>
  );
}
