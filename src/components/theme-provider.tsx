"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Add this state to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);

  // Only render the provider once the component is mounted on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Return null during SSR to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
