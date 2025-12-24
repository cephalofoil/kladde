import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  rightContent?: React.ReactNode;
}

export function Header({ rightContent }: HeaderProps = {}) {
  return (
    <header className="border-b border-transparent sticky top-0 z-50 relative isolate backdrop-blur supports-backdrop-filter:bg-white/10 dark:supports-backdrop-filter:bg-black/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-white/90 via-white/60 to-transparent dark:from-black/90 dark:via-black/60 dark:to-transparent" />
      <Link
        href="/"
        aria-label="Go to homepage"
        className="absolute left-6 top-0 z-20 flex h-16 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:opacity-90 lg:left-8"
      >
        <Image
          src="/kladde-logo.svg"
          alt="kladde"
          width={160}
          height={32}
          className="h-8 w-auto dark:hidden"
          priority
        />
        <Image
          src="/kladde-logo-bright-540.svg"
          alt="kladde"
          width={160}
          height={32}
          className="h-8 w-auto hidden dark:block"
          priority
        />
      </Link>
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <nav className="flex items-center justify-between gap-10 h-16">
          <div className="flex items-center gap-10">
            {/* Logo */}
            <div className="w-[160px]" aria-hidden="true" />

            {/* Navigation */}
            <div className="hidden md:flex items-center gap-6 pt-px">
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="text-gray-900 dark:text-white"
              >
                <Link href="/dashboard">Workspaces</Link>
              </Button>

              <Button
                asChild
                size="sm"
                variant="ghost"
                className="text-gray-900 dark:text-white"
              >
                <Link href="/about">About</Link>
              </Button>

              <Button
                asChild
                size="sm"
                variant="ghost"
                className="text-gray-900 dark:text-white"
              >
                <Link href="/components">Components</Link>
              </Button>
            </div>
          </div>

          {/* Right content slot */}
          {rightContent && (
            <div className="flex items-center">{rightContent}</div>
          )}
        </nav>
      </div>
    </header>
  );
}
