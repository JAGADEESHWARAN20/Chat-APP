"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // useEffect runs only on the client, ensuring the component is mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Return a placeholder or null to prevent hydration errors on the server
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

    // Position the circle at the center of the button
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Calculate the radius needed to cover the entire screen from the click point
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(x, vw - x);
    const maxY = Math.max(y, vh - y);
    const radius = Math.sqrt(maxX * maxX + maxY * maxY);

    // Set up the circle element
    circle.className = "circle-effect";
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.width = circle.style.height = `${radius * 2}px`;

    // Determine the background color of the next theme to be revealed
    const goingDark = !isDark;
    const root = document.documentElement;
    const nextBg = getComputedStyle(root).getPropertyValue(
      goingDark ? "--background-dark" : "--background-light"
    );
    circle.style.background = `hsl(${nextBg.trim()})`;

    // Append the circle to the body
    document.body.appendChild(circle);

    // Animate the circle to scale up from 0
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

    // Delay the actual theme change until the animation is halfway
    setTimeout(() => {
      setTheme(goingDark ? "dark" : "light");
    }, 300);

    // Clean up the circle element after the animation is complete
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
