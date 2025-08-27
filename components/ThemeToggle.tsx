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

    // circle & overlay
    const circle = document.createElement("div");
    const overlay = document.createElement("div");

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(x, vw - x);
    const maxY = Math.max(y, vh - y);
    const radius = Math.sqrt(maxX * maxX + maxY * maxY);

    const goingDark = !isDark;
    const root = document.documentElement;

    // Grab the *next theme background*
    const nextBg = goingDark
      ? getComputedStyle(root).getPropertyValue("--background-dark")
      : getComputedStyle(root).getPropertyValue("--background-light");

    // Circle setup
    circle.classList.add("circle-effect");
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.width = circle.style.height = `${radius * 2}px`;
    circle.style.background = `hsl(${nextBg.trim()})`;

    // Overlay setup
    overlay.classList.add("theme-overlay");

    document.body.appendChild(overlay);
    document.body.appendChild(circle);

    // Animate circle expansion
    circle.animate(
      [
        { transform: "translate(-50%, -50%) scale(0)" },
        { transform: "translate(-50%, -50%) scale(1)" },
      ],
      { duration: 700, easing: "ease-in-out", fill: "forwards" }
    );

    // Fade overlay in slightly (to soften transition)
    overlay.animate([{ opacity: 0 }, { opacity: 0.4 }], {
      duration: 700,
      easing: "ease-in-out",
      fill: "forwards",
    });

    // Switch theme after circle expansion
    setTimeout(() => {
      setTheme(goingDark ? "dark" : "light");

      // Fade overlay back out
      overlay.animate([{ opacity: 0.4 }, { opacity: 0 }], {
        duration: 500,
        easing: "ease-in-out",
        fill: "forwards",
      });

      // Cleanup
      setTimeout(() => {
        circle.remove();
        overlay.remove();
      }, 500);
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
