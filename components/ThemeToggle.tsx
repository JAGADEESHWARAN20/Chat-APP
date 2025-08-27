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

    // Where the toggle button is
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Expanding radius = distance to farthest corner
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(x, vw - x);
    const maxY = Math.max(y, vh - y);
    const radius = Math.sqrt(maxX * maxX + maxY * maxY);

    // Going dark or light
    const goingDark = !isDark;
    const root = document.documentElement;
    const nextBg = goingDark
      ? getComputedStyle(root).getPropertyValue("--background-dark")
      : getComputedStyle(root).getPropertyValue("--background-light");
    const nextText = goingDark
      ? getComputedStyle(root).getPropertyValue("--foreground-dark")
      : getComputedStyle(root).getPropertyValue("--foreground-light");

    // Style circle
    circle.classList.add("circle-effect");
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.width = circle.style.height = `${radius * 2}px`;
    circle.style.background = `hsl(${nextBg.trim()})`;
    circle.style.transform = "translate(-50%, -50%) scale(0)";

    document.body.appendChild(circle);

    // Animate circle expansion
    circle.animate(
      [
        { transform: "translate(-50%, -50%) scale(0)" },
        { transform: "translate(-50%, -50%) scale(1)" },
      ],
      {
        duration: 700,
        easing: "ease-in-out",
        fill: "forwards",
      }
    );

    // 🔥 Update text color immediately along the way
    document.documentElement.style.setProperty("--text-color", `hsl(${nextText.trim()})`);

    setTimeout(() => {
      setTheme(goingDark ? "dark" : "light");
      document.documentElement.style.removeProperty("--text-color");
      circle.remove();
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
