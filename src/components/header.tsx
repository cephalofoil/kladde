import Image from "next/image";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Pencil } from "lucide-react";

interface HeaderProps {
  rightContent?: React.ReactNode;
}

export function Header({ rightContent }: HeaderProps = {}) {
  return (
    <header className="border-b border-transparent sticky top-0 z-50 relative isolate backdrop-blur supports-[backdrop-filter]:bg-black/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/90 via-black/60 to-transparent" />
      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <nav className="flex items-center justify-between gap-10 h-16">
          <div className="flex items-center gap-10">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/logo-text-sw-white.svg"
                alt="shadeworks"
                width={160}
                height={32}
                className="h-8 w-auto"
                priority
              />
            </Link>

            {/* Navigation */}
            <div className="hidden md:flex items-center gap-6 pt-[1px]">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium transition-colors hover:text-accent focus:outline-none">
                  Tools
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem asChild>
                    <Link href="/board" className="flex items-center gap-2">
                      <Pencil className="h-4 w-4" />
                      Whiteboard
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
