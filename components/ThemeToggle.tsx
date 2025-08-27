"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [clickCount, setClickCount] = useState(0); // 👈 track clicks

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    setClickCount((prev) => prev + 1); // 👈 increment clicks

    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const circle = document.createElement("div");

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(x, vw - x);
    const maxY = Math.max(y, vh - y);
    const radius = Math.sqrt(maxX * maxX + maxY * maxY);

    circle.className = "circle-effect";
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.width = circle.style.height = `${radius * 2}px`;

    // ✅ Background based on next theme
    const goingDark = !isDark;
    const root = document.documentElement;
    const nextBg = getComputedStyle(root).getPropertyValue(
      goingDark ? "--background-dark" : "--background-light"
    );
    circle.style.background = `hsl(${nextBg.trim()})`;

    circle.style.position = "fixed";
    circle.style.transform = "translate(-50%, -50%) scale(0)";
    document.body.appendChild(circle);

    circle.animate(
      [
        { transform: "translate(-50%, -50%) scale(0)" },
        { transform: "translate(-50%, -50%) scale(1)" },
      ],
      {
        duration: 600,
        easing: "ease-in-out",
        fill: "forwards",
      }
    );

    setTimeout(() => {
      setTheme(goingDark ? "dark" : "light");
    }, 300);

    setTimeout(() => circle.remove(), 650);
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
