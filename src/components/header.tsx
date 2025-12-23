import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  rightContent?: React.ReactNode;
}

export function Header({ rightContent }: HeaderProps = {}) {
  return (
    <header className="border-b border-transparent sticky top-0 z-50 relative isolate backdrop-blur supports-backdrop-filter:bg-black/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-black/90 via-black/60 to-transparent" />
      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <nav className="flex items-center justify-between gap-10 h-16">
          <div className="flex items-center gap-10">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/logo-text-sw-white.svg"
                alt="kladde"
                width={160}
                height={32}
                className="h-8 w-auto"
                priority
              />
            </Link>

            {/* Navigation */}
            <div className="hidden md:flex items-center gap-6 pt-px">
              <Button asChild size="sm" variant="ghost">
                <Link href="/dashboard">Workspaces</Link>
              </Button>

              <a
                href="/about"
                className="text-sm font-medium transition-colors hover:text-accent"
              >
                About
              </a>

              <Link
                href="/components"
                className="text-sm font-medium transition-colors hover:text-accent"
              >
                Components
              </Link>
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
