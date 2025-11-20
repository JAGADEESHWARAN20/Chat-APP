// components/theme-provider.tsx
"use client";

import * as React from "react";

/**
 * Passive ThemeProvider.
 *
 * IMPORTANT: this provider intentionally does NOT toggle the <html>.dark class.
 * Theme changes are handled by ThemeTransitionWrapper which calls setTheme(...) when it
 * wants the theme to actually flip (so the transition overlay can control timing).
 *
 * Keep this component as a pass-through to avoid breaking imports that expect a ThemeProvider.
 */

export type ThemeProviderProps = {
  children: React.ReactNode;
  // any props are accepted but ignored — keep API stable
  [k: string]: any;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <>{children}</>;
}


// "use client";

// import * as React from "react";
// import { ThemeProvider as NextThemesProvider } from "next-themes";
// import { type ThemeProviderProps } from "next-themes/dist/types";

// export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
//   return (
//     <NextThemesProvider
//       attribute="class"
//       defaultTheme="light"
//       enableSystem={false}
//       {...props}
//     >
//       {children}
//     </NextThemesProvider>
//   );
// }
