"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------
// MAIN ROOT — patched to prevent shifting, snapping, and resizing
// ------------------------------------------------------------
const Drawer = ({
  shouldScaleBackground = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={false}
    modal={false}                // ❗ prevent vaul repositioning logic
    dismissible={false}          // ❗ disable swipe-to-close, but manual close still works
    snapPoints={[]}              // ❗ disable snapping entirely
    activeSnapPoint={null}
    {...props}
  />
);
Drawer.displayName = "Drawer";

// ------------------------------------------------------------
// PORTAL / TRIGGER / CLOSE
// ------------------------------------------------------------
const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;

// ------------------------------------------------------------
// OVERLAY — (still needed but doesn’t interfere since modal=false)
// ------------------------------------------------------------
const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-40 bg-black/20", className)}
    {...props}
  />
));
DrawerOverlay.displayName = "DrawerOverlay";

// ------------------------------------------------------------
// CONTENT — ★ This is the most important patch ★
// ------------------------------------------------------------
const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />

    <DrawerPrimitive.Content
      ref={ref}
      // 🔥 Force drawer to stay at bottom, no keyboard shifting
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        transform: "translateY(0px)", // lock position
      }}
      className={cn(
        "z-50 flex flex-col rounded-t-[14px] border bg-background",
        "select-none touch-none", // prevent iOS bounce / drag
        className
      )}
      {...props}
    >
      {/* Optional top grabber */}
      <div className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-muted" />

      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

// ------------------------------------------------------------
// HEADER / FOOTER / TITLE / DESCRIPTION
// ------------------------------------------------------------
const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = "DrawerDescription";

// ------------------------------------------------------------
// EXPORTS
// ------------------------------------------------------------
export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
