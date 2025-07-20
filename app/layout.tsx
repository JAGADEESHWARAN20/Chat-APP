'use client';

import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import RoomInitializer from "@/lib/store/RoomInitializer";
import { ResponsiveToaster } from "@/components/ResponsiveToaster";

const space_Grotesk = Space_Grotesk({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={space_Grotesk.className + " glass-gradient-header"} style={{ minHeight: '100vh', fontSize: '1.1em', padding: '2vw' }}>

          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <RoomInitializer />
            <main style={{ width: '100vw', minHeight: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'transparent' }}>
              {children}
            </main>
            <ResponsiveToaster />
          </ThemeProvider>

      </body>
    </html>
  );
}