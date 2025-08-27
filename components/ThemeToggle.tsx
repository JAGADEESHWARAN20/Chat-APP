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

    // Style overlay circle
    circle.className = "circle-effect";
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.width = circle.style.height = `${radius * 2}px`;
    circle.style.background = isDark ? "#fff" : "#000"; // contrast color
    circle.style.transform = "translate(-50%, -50%) scale(0)";
    circle.style.position = "fixed";
    circle.style.borderRadius = "50%";
    circle.style.pointerEvents = "none";
    circle.style.zIndex = "9999"; // ensure above all
    document.body.appendChild(circle);

    // Animate it
    const anim = circle.animate(
      [
        { transform: "translate(-50%, -50%) scale(0)", opacity: 0.8 },
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      ],
      {
        duration: 600,
        easing: "ease-in-out",
        fill: "forwards",
      }
    );

    // Switch theme **during** animation, not after
    setTimeout(() => {
      setTheme(isDark ? "light" : "dark");
    }, 200); // small delay so effect feels synced

    // Cleanup after animation
    anim.onfinish = () => {
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
