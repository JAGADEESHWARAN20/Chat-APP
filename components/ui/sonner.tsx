// components/ui/sonner.tsx - ENHANCED
"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: `
            group toast 
            group-[.toaster]:bg-background/95
            group-[.toaster]:text-foreground
            group-[.toaster]:border-border
            group-[.toaster]:shadow-lg
            group-[.toaster]:backdrop-blur-md
            dark:group-[.toaster]:bg-background/90
            dark:group-[.toaster]:border-border/50
            border
            rounded-xl
            backdrop-saturate-150
          `,
          description: `
            group-[.toast]:text-muted-foreground
            group-[.toast]:text-sm
          `,
          actionButton: `
            group-[.toast]:bg-primary
            group-[.toast]:text-primary-foreground
            group-[.toast]:font-medium
            group-[.toast]:rounded-lg
            group-[.toast]:px-4
            group-[.toast]:py-2
            group-[.toast]:text-sm
            group-[.toast]:transition-colors
            group-[.toast]:hover:bg-primary/90
          `,
          cancelButton: `
            group-[.toast]:bg-muted
            group-[.toast]:text-muted-foreground
            group-[.toast]:font-medium
            group-[.toast]:rounded-lg
            group-[.toast]:px-4
            group-[.toast]:py-2
            group-[.toast]:text-sm
            group-[.toast]:transition-colors
            group-[.toast]:hover:bg-muted/80
          `,
          success: `
            group-[.toast]:border-green-200
            dark:group-[.toast]:border-green-800
            group-[.toast]:bg-green-50/80
            dark:group-[.toast]:bg-green-950/80
          `,
          error: `
            group-[.toast]:border-red-200
            dark:group-[.toast]:border-red-800
            group-[.toast]:bg-red-50/80
            dark:group-[.toast]:bg-red-950/80
          `,
          warning: `
            group-[.toast]:border-yellow-200
            dark:group-[.toast]:border-yellow-800
            group-[.toast]:bg-yellow-50/80
            dark:group-[.toast]:bg-yellow-950/80
          `,
          info: `
            group-[.toast]:border-blue-200
            dark:group-[.toast]:border-blue-800
            group-[.toast]:bg-blue-50/80
            dark:group-[.toast]:bg-blue-950/80
          `,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };