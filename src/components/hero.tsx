import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative py-32 md:py-48 overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />

      <div className="max-w-6xl mx-auto px-4 relative">
        <div className="text-center">
          {/* Badge */}

          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-balance font-mono">
            For <span className="text-accent"> ideas </span>
            that don’t fit documents yet
          </h1>
          {/* Description */}
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto text-pretty">
            A visual canvas for turning information into structured knowledge.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              variant="default"
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2 rounded-lg"
            >
              <Link href="/dashboard">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="rounded-lg" size="lg" variant="outline">
              <Link href="https://github.com/cephalofoil/kladde">
                View on GitHub
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
