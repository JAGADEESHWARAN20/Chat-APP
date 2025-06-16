// components/ResponsiveToaster.tsx
"use client";

import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useMediaQuery } from "@/hooks/use-media-query";

export function ResponsiveToaster() {
     const isMobile = useMediaQuery("(max-width: 768px)");

     return (
          <SonnerToaster
               position={isMobile ? "top-center" : "bottom-right"}
               toastOptions={{
                    duration: 4000,
                    className: isMobile ? "w-[90vw]" : "w-auto",
               }}
               visibleToasts={isMobile ? 3 : 5}
               richColors
          />
     );
}