// components/ResponsiveToaster.tsx
"use client";

import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTheme } from "next-themes";

export function ResponsiveToaster() {
     const isMobile = useMediaQuery("(max-width: 768px)");
     const { theme = "system" } = useTheme();

     return (
          <SonnerToaster
               position={isMobile ? "center" : "bottom-right"}
               theme={theme === "system" ? "light" : (theme as any)}
               toastOptions={{
                    duration: 4000,
                    className: "glass-toast",
                    classNames: {
                         toast: `
            group glass-toast 
            backdrop-blur-xl
            bg-opacity-20
            dark:bg-opacity-30
            border border-white/20
            dark:border-white/10
            shadow-lg
            rounded-xl
            ${isMobile ? "w-[90vw]" : "w-auto max-w-md"}
          `,
                         title: "font-semibold text-foreground text-center",
                         description: "text-foreground/80 text-center",
                         actionButton: `
            glass-button
            bg-white/20
            hover:bg-white/30
            text-foreground
            border-white/30
            mx-1
          `,
                         cancelButton: `
            glass-button
            bg-white/10
            hover:bg-white/20
            text-foreground
            border-white/20
            mx-1
          `,
                    },
               }}
               visibleToasts={5}
               richColors={false}
               closeButton
          />
     );
}