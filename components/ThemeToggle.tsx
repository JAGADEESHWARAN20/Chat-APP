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
    const mask = document.getElementById("circle-mask");
    if (!mask) return;

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Compute max radius to cover sheet
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

    // apply target theme background to mask
    mask.style.setProperty("--next-theme-bg", `hsl(${nextBg.trim()})`);
    mask.style.setProperty("--circle-x", `${x}px`);
    mask.style.setProperty("--circle-y", `${y}px`);

    // expand circle
    mask.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`;

    // update text color immediately
    document.documentElement.style.setProperty("--text-color", `hsl(${nextText.trim()})`);

    setTimeout(() => {
      setTheme(goingDark ? "dark" : "light");
      document.documentElement.style.removeProperty("--text-color");
      mask.style.clipPath = "circle(0 at var(--circle-x) var(--circle-y))"; // reset
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
