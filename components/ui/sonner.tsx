// components/ui/sonner.tsx
"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

// Extend the Position type to include center options
type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center' | 'center';

type ToasterProps = Omit<React.ComponentProps<typeof Sonner>, 'position'> & {
  position?: Position;
};

const Toaster = ({ position = 'bottom-right', ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  // Map our custom 'center' position to 'top-center' and use CSS to center it
  const sonnerPosition = position === 'center' ? 'top-center' : position;

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className={`toaster group ${position === 'center' ? 'center-toaster' : ''}`}
      position={sonnerPosition}
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
            ${position === 'center' ? 'mx-auto my-auto' : ''}
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