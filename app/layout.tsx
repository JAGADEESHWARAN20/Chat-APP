import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import RoomInitializer from "@/lib/store/RoomInitializer";
import { ResponsiveToaster } from "@/components/ResponsiveToaster";

const space_Grotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Daily Chat",
  description: "A real-time chat application powered by Supabase",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={space_Grotesk.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <RoomInitializer />
          {children}
          <ResponsiveToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}