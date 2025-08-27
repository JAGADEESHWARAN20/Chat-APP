"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const circle = document.createElement("div");

    circle.classList.add("circle-effect");
    circle.style.left = `${rect.left + rect.width / 2}px`;
    circle.style.top = `${rect.top + rect.height / 2}px`;
    circle.style.width = "200vmax";
    circle.style.height = "200vmax";
    circle.style.marginLeft = "-100vmax";
    circle.style.marginTop = "-100vmax";

    // Circle bg = next theme
    const goingDark = !isDark;
// NEW: use your CSS variables
const root = document.documentElement;
const nextBg = goingDark
  ? getComputedStyle(root).getPropertyValue("--background-dark") || "hsl(224 71.4% 4.1%)"
  : getComputedStyle(root).getPropertyValue("--background") || "hsl(0 0% 100%)";

circle.style.background = `hsl(${nextBg.trim()})`;

    document.body.appendChild(circle);

    // Animate expansion
    circle.animate(
      [{ transform: "scale(0)" }, { transform: "scale(1)" }],
      { duration: 700, easing: "ease-in-out", fill: "forwards" }
    );

    // Immediately adjust text color during transition
      document.documentElement.style.setProperty(
      "--text-color",
      goingDark ? "hsl(210 20% 98%)" : "hsl(224 71.4% 4.1%)"
    );


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
