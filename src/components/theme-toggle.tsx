"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState, memo } from "react";

// Memoize the ThemeToggle component to prevent unnecessary re-renders
export const ThemeToggle = memo(function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Only render the component once mounted on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Return a minimal placeholder during SSR
  if (!mounted) {
    return <div className="w-20 h-8"></div>;
  }

  const isDark = theme === "dark";

  return (
    <div className="flex items-center space-x-2">
      <Sun
        className={`h-[1.2rem] w-[1.2rem] transition-all duration-200 ${
          isDark
            ? "text-gray-500 scale-75 rotate-12"
            : "text-amber-500 scale-100 rotate-0"
        }`}
      />
      <Switch
        checked={isDark}
        onCheckedChange={toggleTheme}
        aria-label="Toggle theme"
      />
      <Moon
        className={`h-[1.2rem] w-[1.2rem] transition-all duration-200 ${
          !isDark
            ? "text-gray-500 scale-75 rotate-12"
            : "text-blue-400 scale-100 rotate-0"
        }`}
      />
    </div>
  );
});
