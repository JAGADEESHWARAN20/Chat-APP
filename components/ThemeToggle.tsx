"use client";

import { Sun, Moon } from "lucide-react";
import { useThemeTransition } from "./ThemeTransitionWrapper";
import {Button} from "@/components/ui/button"
import { Label } from "./ui/label";
export default function ThemeToggleButton() {
  const { triggerTransition, isDark } = useThemeTransition();

  return (
    <div className="w-full justify-evenly flex items-center">
    <Label>{ isDark?"Light":"Dark"}</Label>
    <Button
      onClick={(e) => {
        const nextTheme = isDark ? "light" : "dark";
        triggerTransition(e.clientX, e.clientY, nextTheme);
      }}
      className="p-2 rounded-full bg-violet-700 text-white shadow hover:scale-105 transition"
      >
      {isDark ? <Moon size={18} /> : <Sun size={18} />}
    </Button>
      </div>
  );
}
