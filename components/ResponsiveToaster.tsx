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
               position={isMobile ? "top-center" : "bottom-right"}
               theme={theme === "system" ? "light" : (theme as any)}
               toastOptions={{
                    duration: 4000,
                    className: "glass-toast",
                    classNames: {
                         toast: `
            group glass-toast 
            backdrop-blur-lg 
            bg-opacity-80
            dark:bg-opacity-70
            border border-opacity-20
            dark:border-opacity-30
            shadow-lg
            ${isMobile ? "w-[90vw] mx-auto" : "w-auto"}
          `,
                         title: "font-semibold",
                         description: "opacity-90",
                         actionButton: "glass-button",
                         cancelButton: "glass-button",
                    },
               }}
               visibleToasts={isMobile ? 3 : 5}
               richColors
               closeButton
          />
     );
}