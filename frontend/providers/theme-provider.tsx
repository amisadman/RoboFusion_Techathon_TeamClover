"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

// SCS-RG ships one fixed dark instrument-panel theme -- forcedTheme keeps
// next-themes (and anything reading it, e.g. the Sonner toaster) resolved
// to "dark" rather than following OS preference.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
