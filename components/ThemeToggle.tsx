"use client";

import { Sun, Moon } from "lucide-react";
import { useThemeTransition } from "./ThemeTransitionwrapper";
import {Button} from "@/components/ui/button"
export default function ThemeToggleButton() {
  const { triggerTransition, isDark } = useThemeTransition();

  return (
    <Button
      onClick={(e) => {
        const nextTheme = isDark ? "light" : "dark";
        triggerTransition(e.clientX, e.clientY, nextTheme);
      }}
      className="p-2 rounded-full bg-violet-700 text-white shadow hover:scale-105 transition"
    >
      {isDark ? <Moon size={18} /> : <Sun size={18} />}
    </Button>
  );
}
