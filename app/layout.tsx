// app/layout.tsx (your RootLayout)
import { Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ResponsiveToaster } from "@/components/ResponsiveToaster";
import { SearchHighlightProvider } from "@/lib/store/SearchHighlightContext";

import "@/app/globals.css";
import {AuthProvider} from "./providers/AuthProvider";


const space_Grotesk = Space_Grotesk({ subsets: ["latin"] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  return (
    <html lang="en" suppressHydrationWarning className="h-full w-full">
      <head />
      <body
        className={`${space_Grotesk.className} h-full w-full overflow-hidden bg-background text-foreground antialiased`}
      >
       
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >

            <SearchHighlightProvider>
            <AuthProvider> 
                {children}
              <ResponsiveToaster />
                </AuthProvider>
            </SearchHighlightProvider>

        </ThemeProvider>
      </body>
    </html>
  );
}
