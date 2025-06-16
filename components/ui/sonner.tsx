// components/ui/sonner.tsx
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
            group-[.toaster]:bg-background 
            group-[.toaster]:text-foreground 
            group-[.toaster]:border-border 
            group-[.toaster]:shadow-lg
            backdrop-blur-lg
            bg-opacity-80
            dark:bg-opacity-70
          `,
          description: "group-[.toast]:text-muted-foreground",
          actionButton: `
            group-[.toast]:bg-primary 
            group-[.toast]:text-primary-foreground
            backdrop-blur-sm
          `,
          cancelButton: `
            group-[.toast]:bg-muted 
            group-[.toast]:text-muted-foreground
            backdrop-blur-sm
          `,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };