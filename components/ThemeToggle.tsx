"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        disabled
        className="invisible h-5 w-5"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const circle = document.createElement("div");
    const overlay = document.createElement("div");

    // Get the button's position relative to the viewport
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(x, vw - x);
    const maxY = Math.max(y, vh - y);
    const radius = Math.sqrt(maxX * maxX + maxY * maxY);

    // Circle setup
    circle.className = "circle-effect-reveal";
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.width = circle.style.height = `${radius * 2}px`;

    // Overlay to handle the reveal effect
    overlay.className = "theme-overlay";
    document.body.appendChild(overlay);

    const goingDark = !isDark;
    const root = document.documentElement;
    const currentBg = getComputedStyle(root).getPropertyValue("--background").trim();
    const nextBg = getComputedStyle(root).getPropertyValue(
      goingDark ? "--background-dark" : "--background-light"
    ).trim();
    const currentFg = getComputedStyle(root).getPropertyValue("--foreground").trim();
    const nextFg = getComputedStyle(root).getPropertyValue(
      goingDark ? "--foreground-dark" : "--foreground-dark"
    ).trim();

    // Set initial overlay styles
    overlay.style.background = `hsl(${currentBg})`;
    document.body.style.transition = "none"; // Disable body transition temporarily

    // Append circle after setting up overlay
    document.body.appendChild(circle);

    // Animate circle and overlay together
    const animation = circle.animate(
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

    // Synchronize theme change with animation
    animation.onfinish = () => {
      setTheme(goingDark ? "dark" : "light");
      document.body.classList.toggle("dark", goingDark);
      document.body.classList.toggle("light", !goingDark);
      overlay.remove();
      document.body.style.transition = "background-color 0.6s ease-in-out, color 0.6s ease-in-out";
    };

    // Clean up circle
    setTimeout(() => {
      circle.remove();
    }, 650);
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