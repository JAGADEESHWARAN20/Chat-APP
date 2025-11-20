"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import React, {
  useState,
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
} from "react";

// Types
interface ThemeTransitionContextValue {
  triggerTransition: (x: number, y: number, nextTheme: string) => void;
  isDark: boolean;
  isTransitioning: boolean;
}

const ThemeTransitionContext = createContext<ThemeTransitionContextValue | null>(null);

export function useThemeTransition() {
  const ctx = useContext(ThemeTransitionContext);
  if (!ctx) {
    throw new Error("useThemeTransition must be used inside ThemeTransitionWrapper");
  }
  return ctx;
}

export default function ThemeTransitionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme: currentTheme, setTheme, systemTheme } = useTheme();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Refs for animation state and RAF
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Store animation values in ref to avoid state updates during RAF loop
  const animState = useRef({
    cx: 0,
    cy: 0,
    maxRadius: 0,
    progress: 0,
    colorHsl: "0 0% 100%",
    active: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = (currentTheme || "light") === "dark";

  const getTransitionColor = (nextTheme: string) =>
    nextTheme === "dark" ? "260 80% 60%" : "45 95% 55%";

  // Helper: resize canvas to device pixel ratio
  const resizeCanvasToDisplaySize = useCallback((canvas: HTMLCanvasElement) => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const displayWidth = width;
    const displayHeight = height;
    if (canvas.width !== Math.floor(displayWidth * dpr) || canvas.height !== Math.floor(displayHeight * dpr)) {
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing operations back to CSS pixels
    }
  }, []);

  // =============================
  // Optimized Canvas Drawer (no self-scheduling)
  // =============================
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeCanvasToDisplaySize(canvas);

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const state = animState.current;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Defensive: ensure progress/maxRadius are finite numbers
    const progress = Number.isFinite(state.progress) ? state.progress : 0;
    const maxRadius = Number.isFinite(state.maxRadius) ? state.maxRadius : Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);

    // Custom easing: easeOutQuart
    const ease = 1 - Math.pow(1 - progress, 4);
    let currentRadius = ease * maxRadius;

    // Clamp to non-negative finite number
    if (!Number.isFinite(currentRadius) || currentRadius < 0) currentRadius = 0;

    // If radius is zero, we can skip arc/clip and particle placement (prevents arc negative error)
    if (currentRadius > 0.0001) {
      // 1. Clipping Path (The expanding circle)
      ctx.save();
      ctx.beginPath();
      // guard again with Math.max to ensure arc gets non-negative radius
      ctx.arc(state.cx, state.cy, Math.max(0, currentRadius), 0, Math.PI * 2);
      ctx.clip();

      // 2. The "Matrix" Binary Effect
      const fontSize = 16;
      const digits = 60; // Number of floating characters
      const chars = "01";

      for (let i = 0; i < digits; i++) {
        const angle = (i / digits) * Math.PI * 2 + state.progress; // Rotate slightly
        // Particles move outward with the radius
        // ensure particle radius is not negative
        const r = Math.max(0, currentRadius - (Math.random() * 20));
        if (r <= 0) continue;

        const x = state.cx + Math.cos(angle) * r;
        const y = state.cy + Math.sin(angle) * r;

        const char = chars[Math.floor(Math.random() * chars.length)];

        // Fade out text as it expands
        const alpha = Math.max(0, 1 - state.progress);

        ctx.fillStyle = `hsla(${state.colorHsl} / ${alpha})`;
        ctx.font = `${fontSize}px monospace`;
        ctx.fillText(char, x, y);
      }

      // 3. Radial Glow/Fill
      const gradient = ctx.createRadialGradient(
        state.cx, state.cy, Math.max(0, currentRadius * 0.5),
        state.cx, state.cy, currentRadius
      );

      // Gradient opacity logic
      gradient.addColorStop(0, `hsla(${state.colorHsl} / ${0.1 * (1 - state.progress)})`);
      gradient.addColorStop(1, `hsla(${state.colorHsl} / ${0.05 * (1 - state.progress)})`);

      ctx.fillStyle = gradient;
      // fill full canvas (clipped)
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 4. The Rim (Edge of the circle)
      ctx.strokeStyle = `hsla(${state.colorHsl} / ${1 - state.progress})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 15;
      ctx.shadowColor = `hsla(${state.colorHsl} / 0.8)`;
      // stroke the circle path (we already began path earlier, but safe to draw fresh)
      ctx.beginPath();
      ctx.arc(state.cx, state.cy, Math.max(0, currentRadius), 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    } else {
      // If radius is essentially zero, optionally draw nothing (safe no-op)
    }
  }, [resizeCanvasToDisplaySize]);

  // =============================
  // CSS Variable Sync (Optional - for HTML overlays)
  // =============================
  const updateCSSVars = (progress: number, cx: number, cy: number, color: string) => {
    const root = document.documentElement;
    root.style.setProperty("--theme-trans-progress", progress.toString());
    root.style.setProperty("--theme-trans-cx", `${cx}px`);
    root.style.setProperty("--theme-trans-cy", `${cy}px`);
    root.style.setProperty("--theme-trans-color", color);
  };

  // =============================
  // Trigger Logic (single RAF loop)
  // =============================
  const triggerTransition = useCallback((x: number, y: number, nextTheme: string) => {
    const duration = 800; // Faster, snappier
    const startTime = performance.now();
    const maxRadius = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
    const colorHsl = getTransitionColor(nextTheme);

    // Mount the canvas
    setIsTransitioning(true);

    // Initialize Animation State
    animState.current = {
      active: true,
      cx: x,
      cy: y,
      maxRadius,
      progress: 0,
      colorHsl,
    };

    // Cancel any previous RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Single RAF loop that updates progress and draws
    const loop = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(Math.max(elapsed / duration, 0), 1);

      animState.current.progress = progress;

      // Update CSS vars for any HTML elements listening
      updateCSSVars(progress, x, y, colorHsl);

      // draw current frame
      draw();

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        // Animation Complete
        // Switch Theme
        setTheme(nextTheme);

        // Cleanup after a brief timeout to allow theme to paint
        setTimeout(() => {
          setIsTransitioning(false);
          animState.current.active = false;

          // Cleanup CSS vars
          const root = document.documentElement;
          ["--theme-trans-progress", "--theme-trans-cx", "--theme-trans-cy", "--theme-trans-color"]
            .forEach(v => root.style.removeProperty(v));
        }, 50);

        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [draw, setTheme]);

  // Cancel RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const themeClass = mounted ? (currentTheme || systemTheme || "light") : "light";

  return (
    <ThemeTransitionContext.Provider value={{ triggerTransition, isDark, isTransitioning }}>
      <div className={`min-h-screen w-full transition-colors duration-500 ${themeClass}`}>
        {children}
      </div>

      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full block"
              style={{ mixBlendMode: "plus-lighter" }} // Better blending
            />
          </motion.div>
        )}
      </AnimatePresence>
    </ThemeTransitionContext.Provider>
  );
}
