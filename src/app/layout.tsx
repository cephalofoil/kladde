import type React from "react";
import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import {
    Inter,
    Roboto,
    Playfair_Display,
    Merriweather,
    Fira_Code,
    Caveat,
    Lobster,
} from "next/font/google";

// Initialize Google Fonts for text tool
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const roboto = Roboto({
    subsets: ["latin"],
    weight: ["400", "700"],
    variable: "--font-roboto",
});
const playfair = Playfair_Display({
    subsets: ["latin"],
    variable: "--font-playfair",
});
const merriweather = Merriweather({
    subsets: ["latin"],
    weight: ["400", "700"],
    variable: "--font-merriweather",
});
const firaCode = Fira_Code({
    subsets: ["latin"],
    variable: "--font-fira-code",
});
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });
const lobster = Lobster({
    subsets: ["latin"],
    weight: ["400"],
    variable: "--font-lobster",
});

export const metadata: Metadata = {
    title: "kladde",
    description: "Modular Working Canvas for your Ideas",
    icons: {
        icon: [
            {
                url: "/logo-sw-dark.svg",
                media: "(prefers-color-scheme: light)",
            },
            {
                url: "/logo-sw-white.svg",
                media: "(prefers-color-scheme: dark)",
            },
        ],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Script to prevent theme flash - runs before React hydration
    const themeScript = `
      (function() {
        try {
          var theme = localStorage.getItem('theme');
          if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
          }
        } catch (e) {}
      })();
    `;

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body
                className={`font-sans antialiased ${inter.variable} ${roboto.variable} ${playfair.variable} ${merriweather.variable} ${firaCode.variable} ${caveat.variable} ${lobster.variable}`}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem
                    disableTransitionOnChange
                >
                    {children}
                </ThemeProvider>
                <Analytics />
            </body>
        </html>
    );
}
