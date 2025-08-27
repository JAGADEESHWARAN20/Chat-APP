"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const animatingRef = useRef(false); // prevent multiple triggers

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (animatingRef.current) return; // 🚫 block double clicks
    animatingRef.current = true;

    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(x, vw - x);
    const maxY = Math.max(y, vh - y);
    const radius = Math.sqrt(maxX * maxX + maxY * maxY);

    const goingDark = !isDark;
    const root = document.documentElement;
    const nextBg = goingDark
      ? getComputedStyle(root).getPropertyValue("--background-dark")
      : getComputedStyle(root).getPropertyValue("--background-light");
    const nextText = goingDark
      ? getComputedStyle(root).getPropertyValue("--foreground-dark")
      : getComputedStyle(root).getPropertyValue("--foreground-light");

    // Set CSS vars for pseudo-element
    root.style.setProperty("--circle-x", `${x}px`);
    root.style.setProperty("--circle-y", `${y}px`);
    root.style.setProperty("--transition-bg", nextBg.trim());
    root.classList.add("transitioning");

    // Animate clip-path expansion
    const anim = root.animate(
      [
        { clipPath: `circle(0% at ${x}px ${y}px)` },
        { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
      ],
      {
        duration: 700,
        easing: "ease-in-out",
        fill: "forwards",
      }
    );

    // Smoothly transition text color
    document.body.animate(
      [
        { color: `hsl(var(--foreground))` },
        { color: `hsl(${nextText.trim()})` },
      ],
      { duration: 700, easing: "ease-in-out", fill: "forwards" }
    );

    anim.onfinish = () => {
      setTheme(goingDark ? "dark" : "light");

      // Cleanup
      root.classList.remove("transitioning");
      root.style.removeProperty("--circle-x");
      root.style.removeProperty("--circle-y");
      root.style.removeProperty("--transition-bg");

      animatingRef.current = false; // ✅ allow next toggle
    };
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={handleToggle}
      className="transition-colors"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
