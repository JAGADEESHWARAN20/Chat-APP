import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ResponsiveToaster } from "@/components/ResponsiveToaster";
import { RoomProvider } from "@/lib/store/RoomContext";
import RoomInitializer from "@/lib/initialization/RoomInitializer";
import type { Metadata } from "next";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  title: "FlychatApp",
  description: "Secured chatting with Others",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RoomProvider>
            {/* client-only logic here */}
            <RoomInitializer />
            {children}
            <ResponsiveToaster />
          </RoomProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
