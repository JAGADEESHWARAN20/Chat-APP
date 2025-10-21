import { Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ResponsiveToaster } from "@/components/ResponsiveToaster";
import { RoomProvider } from "@/lib/store/RoomContext";
import { SearchHighlightProvider } from "@/lib/store/SearchHighlightContext";
import RoomInitializer from "@/lib/initialization/RoomInitializer";
import { supabaseServer } from "@/lib/supabase/server";
import ThemeTransitionWrapper from "@/components/ThemeTransitionWrapper";
import "@/app/globals.css";

const space_Grotesk = Space_Grotesk({ subsets: ["latin"] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getSession();

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
            <ThemeTransitionWrapper>
              <RoomProvider user={data.session?.user}>
                <SearchHighlightProvider>
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
