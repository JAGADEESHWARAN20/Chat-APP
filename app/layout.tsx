import { Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ResponsiveToaster } from "@/components/ResponsiveToaster";
import { RoomProvider } from "@/lib/store/RoomContext";
import { SearchHighlightProvider } from "@/lib/store/SearchHighlightContext";
import RoomInitializer from "@/lib/initialization/RoomInitializer";
// import { supabaseServer } from "@/lib/supabase/server";
import ThemeTransitionWrapper from "@/components/ThemeTransitionWrapper";
import "@/app/globals.css";
import ClientInitializer from "@/lib/initialization/clientinitializer";

const space_Grotesk = Space_Grotesk({ subsets: ["latin"] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const supabase = await supabaseServer();
  // const { data } = await supabase.auth.getSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
  className={`${space_Grotesk.className} min-h-screen overflow-x-hidden overflow-y-scroll bg-background text-foreground antialiased`}
>

        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ThemeTransitionWrapper>
              <RoomProvider>
                <SearchHighlightProvider>
                  <ClientInitializer /> {/* ✅ ensures Zustand store stays synced */}
                  <RoomInitializer />
                  {children}
                  <ResponsiveToaster />
                </SearchHighlightProvider>
              </RoomProvider>
            </ThemeTransitionWrapper>
          </ThemeProvider>
      </body>
    </html>
  );
}