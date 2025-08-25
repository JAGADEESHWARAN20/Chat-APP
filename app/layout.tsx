import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ResponsiveToaster } from "@/components/ResponsiveToaster";
import { RoomProvider } from "@/lib/store/RoomContext";
import RoomInitializer from "@/lib/initialization/RoomInitializer";

const space_Grotesk = Space_Grotesk({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={space_Grotesk.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RoomProvider>
            <RoomInitializer />
            {children}
            <ResponsiveToaster />
          </RoomProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
