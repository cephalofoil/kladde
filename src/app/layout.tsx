import type React from "react";
import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieBanner } from "@/components/cookie-banner";
import "./globals.css";
import {
  Geist_Mono,
  Exo as V0_Font_Exo,
  Geist_Mono as V0_Font_Geist_Mono,
  Inter,
  Roboto,
  Playfair_Display,
  Merriweather,
  Fira_Code,
  Caveat,
  Lobster,
} from "next/font/google";

// Initialize fonts
const _exo = V0_Font_Exo({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});
const _geistMono = V0_Font_Geist_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

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
  return (
    <html lang="en" suppressHydrationWarning>
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
          <CookieBanner />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
