"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const circle = document.createElement("div");

    // click position
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // max radius
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(x, vw - x);
    const maxY = Math.max(y, vh - y);
    const radius = Math.sqrt(maxX * maxX + maxY * maxY);

    // Grab next theme colors from CSS variables
    const root = document.documentElement;
    const nextBg = isDark
      ? getComputedStyle(root).getPropertyValue("--background-light")
      : getComputedStyle(root).getPropertyValue("--background-dark");
    const nextFg = isDark
      ? getComputedStyle(root).getPropertyValue("--foreground-light")
      : getComputedStyle(root).getPropertyValue("--foreground-dark");

    // Style overlay circle
    circle.className = "circle-effect";
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.width = circle.style.height = `${radius * 2}px`;
    circle.style.background = `hsl(${nextBg.trim()})`;
    circle.style.transform = "translate(-50%, -50%) scale(0)";
    circle.style.position = "fixed";
    circle.style.borderRadius = "50%";
    circle.style.pointerEvents = "none";
    circle.style.zIndex = "10000";
    document.body.appendChild(circle);

    // Animate expansion
    const anim = circle.animate(
      [
        { transform: "translate(-50%, -50%) scale(0)", opacity: 0.9 },
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      ],
      {
        duration: 700,
        easing: "ease-in-out",
        fill: "forwards",
      }
    );

    // Smoothly transition text color along the way
    document.documentElement.style.setProperty("--text-color", `hsl(${nextFg.trim()})`);

    // Switch theme during animation
    setTimeout(() => {
      setTheme(isDark ? "light" : "dark");
    }, 250);

    // Cleanup
    anim.onfinish = () => {
      document.documentElement.style.removeProperty("--text-color");
      circle.remove();
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
