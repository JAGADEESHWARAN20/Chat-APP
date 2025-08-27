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

  // Get the button's position relative to the viewport
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxX = Math.max(x, vw - x);
  const maxY = Math.max(y, vh - y);
  const radius = Math.sqrt(maxX * maxX + maxY * maxY);

  // Set circle properties
  circle.className = "circle-effect-reveal";
  circle.style.left = `${x}px`;
  circle.style.top = `${y}px`;
  // Initial size is 0, will scale to cover the radius
  circle.style.width = circle.style.height = "0px";
  document.body.style.setProperty('--circle-x', `${x}px`);
  document.body.style.setProperty('--circle-y', `${y}px`);

  const goingDark = !isDark;
  const root = document.documentElement;

  // Apply new theme immediately
  setTheme(goingDark ? "dark" : "light");
  document.body.classList.toggle("dark", goingDark);
  document.body.classList.toggle("light", !goingDark);

  // Append circle to trigger the reveal effect
  document.body.appendChild(circle);

  // Animate the circle to grow to the full radius
  const animation = circle.animate(
    [
      { width: "0px", height: "0px", transform: "translate(-50%, -50%) scale(0)" },
      { width: `${radius * 2}px`, height: `${radius * 2}px`, transform: "translate(-50%, -50%) scale(1)" },
    ],
    {
      duration: 600,
      easing: "ease-in-out",
      fill: "forwards",
    }
  );

  // Clean up circle after animation
  animation.onfinish = () => {
    circle.remove();
    document.body.style.removeProperty('--circle-x');
    document.body.style.removeProperty('--circle-y');
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