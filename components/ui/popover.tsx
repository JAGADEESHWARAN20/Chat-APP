"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    wide?: boolean;
    withOverlay?: boolean;
  }
>(
  (
    {
      className,
      align = "center",
      sideOffset = 4,
      collisionPadding,
      wide = false,
      withOverlay = false,
      ...props
    },
    ref
  ) => (
    <PopoverPrimitive.Portal>
      <>
        {/* Optional Fullscreen Overlay */}
        {withOverlay && (
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" />
        )}

          <PopoverPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn(
            // ✅ Light vs Dark theme
            "z-50 w-64 sm:w-80 rounded-xl border p-4 shadow-lg outline-none",
            "border-gray-200 bg-white text-gray-900", // Light mode
            "dark:border-gray-700/50 dark:bg-gradient-to-br dark:from-gray-800/30 dark:to-gray-900/30 dark:text-white dark:backdrop-blur-md", // Dark mode gradient

            // Animations
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            "origin-[--radix-popover-content-transform-origin]",

            // Wide variant
            wide &&
              "!w-[min(32em,96vw)] mx-[2vw] mb-[2vh] !max-w-[98vw] !max-h-[90vh] rounded-2xl p-[1.25em]",

            className
          )}
          {...props}
        />
      </>
    </PopoverPrimitive.Portal>
  )
);

PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
