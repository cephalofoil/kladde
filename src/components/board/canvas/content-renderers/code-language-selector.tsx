"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LanguageOption {
  value: string;
  label: string;
  category: "web" | "systems" | "scripting" | "data" | "other";
}

export const LANGUAGES: LanguageOption[] = [
  // Web
  { value: "javascript", label: "JavaScript", category: "web" },
  { value: "typescript", label: "TypeScript", category: "web" },
  { value: "html", label: "HTML", category: "web" },
  { value: "css", label: "CSS", category: "web" },
  { value: "jsx", label: "JSX", category: "web" },
  { value: "tsx", label: "TSX", category: "web" },
  // Systems
  { value: "c", label: "C", category: "systems" },
  { value: "cpp", label: "C++", category: "systems" },
  { value: "csharp", label: "C#", category: "systems" },
  { value: "go", label: "Go", category: "systems" },
  { value: "rust", label: "Rust", category: "systems" },
  { value: "java", label: "Java", category: "systems" },
  // Scripting
  { value: "python", label: "Python", category: "scripting" },
  { value: "ruby", label: "Ruby", category: "scripting" },
  { value: "php", label: "PHP", category: "scripting" },
  { value: "bash", label: "Bash", category: "scripting" },
  { value: "powershell", label: "PowerShell", category: "scripting" },
  // Data
  { value: "json", label: "JSON", category: "data" },
  { value: "yaml", label: "YAML", category: "data" },
  { value: "sql", label: "SQL", category: "data" },
  { value: "graphql", label: "GraphQL", category: "data" },
  { value: "xml", label: "XML", category: "data" },
  // Other
  { value: "markdown", label: "Markdown", category: "other" },
  { value: "dockerfile", label: "Dockerfile", category: "other" },
  { value: "swift", label: "Swift", category: "other" },
  { value: "kotlin", label: "Kotlin", category: "other" },
  { value: "scala", label: "Scala", category: "other" },
];

const CATEGORY_LABELS: Record<LanguageOption["category"], string> = {
  web: "Web",
  systems: "Systems",
  scripting: "Scripting",
  data: "Data & Config",
  other: "Other",
};

interface CodeLanguageSelectorProps {
  value: string;
  onChange: (language: string) => void;
  className?: string;
  compact?: boolean;
}

export function CodeLanguageSelector({
  value,
  onChange,
  className,
  compact = false,
}: CodeLanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentLanguage = LANGUAGES.find((l) => l.value === value);

  const filteredLanguages = useMemo(() => {
    if (!search.trim()) return LANGUAGES;
    const searchLower = search.toLowerCase();
    return LANGUAGES.filter(
      (l) =>
        l.label.toLowerCase().includes(searchLower) ||
        l.value.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const groupedLanguages = useMemo(() => {
    const groups: Record<string, LanguageOption[]> = {};
    for (const lang of filteredLanguages) {
      if (!groups[lang.category]) {
        groups[lang.category] = [];
      }
      groups[lang.category].push(lang);
    }
    return groups;
  }, [filteredLanguages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (language: string) => {
    onChange(language);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 rounded transition-colors",
          compact
            ? "px-2 py-1 text-xs hover:bg-muted"
            : "px-3 py-1.5 text-sm border border-border hover:bg-muted"
        )}
      >
        <span className="font-medium">
          {currentLanguage?.label || value || "Select Language"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 mt-1 z-50",
            "w-56 bg-popover border border-border rounded-lg shadow-lg",
            "overflow-hidden"
          )}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search languages..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Language List */}
          <div className="max-h-64 overflow-auto p-1">
            {Object.entries(groupedLanguages).map(([category, langs]) => (
              <div key={category}>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {CATEGORY_LABELS[category as LanguageOption["category"]]}
                </div>
                {langs.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => handleSelect(lang.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md transition-colors",
                      value === lang.value
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <span>{lang.label}</span>
                    {value === lang.value && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            ))}
            {filteredLanguages.length === 0 && (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                No languages found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Get file extension for a language
export function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    javascript: "js",
    typescript: "ts",
    jsx: "jsx",
    tsx: "tsx",
    python: "py",
    java: "java",
    cpp: "cpp",
    c: "c",
    csharp: "cs",
    go: "go",
    rust: "rs",
    ruby: "rb",
    php: "php",
    html: "html",
    css: "css",
    json: "json",
    yaml: "yaml",
    markdown: "md",
    sql: "sql",
    bash: "sh",
    powershell: "ps1",
    dockerfile: "dockerfile",
    xml: "xml",
    graphql: "graphql",
    swift: "swift",
    kotlin: "kt",
    scala: "scala",
  };
  return extensions[language] || "txt";
}
