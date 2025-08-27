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

  // Create overlay
  const mask = document.createElement("div");
  mask.classList.add("circle-mask");
  mask.style.setProperty("--circle-x", `${x}px`);
  mask.style.setProperty("--circle-y", `${y}px`);
  mask.style.setProperty("--next-theme-bg", `hsl(${nextBg.trim()})`);
  document.body.appendChild(mask);

  // Trigger animation
  requestAnimationFrame(() => {
    mask.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`;
  });

  // Switch theme once animation completes
  setTimeout(() => {
    setTheme(goingDark ? "dark" : "light");
    mask.remove();
  }, 700);
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
