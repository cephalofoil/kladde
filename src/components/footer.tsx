export function Footer() {
  return (
    <footer className="border-t py-12 border-transparent">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <a href="/legal" className="hover:text-foreground transition-colors">
            Legal Notice
          </a>
          <span className="w-1 h-1 bg-border rounded-full" />
          <a
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>
          <span className="w-1 h-1 bg-border rounded-full" />
          <span className="italic">made out of boredom</span>
          <span className="w-1 h-1 bg-border rounded-full" />
          <span>© {new Date().getFullYear()} kladde. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
