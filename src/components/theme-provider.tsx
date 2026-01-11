"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import { useEffect, useState } from "react";
import { isMac } from "@/lib/platform";


function ThemeHotkeys() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlKey = isMac() ? e.metaKey : e.ctrlKey;

      if (ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault();
        const activeTheme = (theme === "system" ? resolvedTheme : theme) ?? "light";
        setTheme(activeTheme === "dark" ? "light" : "dark");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [theme, resolvedTheme, setTheme]);

  return null;
}

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

  return (
    <NextThemesProvider {...props}>
      <ThemeHotkeys />
      {children}
    </NextThemesProvider>
  );
}
