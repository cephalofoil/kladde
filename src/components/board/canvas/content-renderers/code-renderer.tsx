"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";

interface CodeRendererProps {
  code: string;
  language?: string;
  onChange?: (code: string) => void;
  onLanguageChange?: (language: string) => void;
  onFinish?: () => void;
  isEditing?: boolean;
  readOnly?: boolean;
  className?: string;
}

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
];

export function CodeRenderer({
  code,
  language = "javascript",
  onChange,
  onLanguageChange,
  onFinish,
  isEditing = false,
  readOnly = false,
  className,
}: CodeRendererProps) {
  const [localCode, setLocalCode] = useState(code);
  const [localLanguage, setLocalLanguage] = useState(language);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLocalCode(code);
  }, [code]);

  useEffect(() => {
    setLocalLanguage(language);
  }, [language]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalCode(newValue);
    onChange?.(newValue);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLocalLanguage(newLang);
    onLanguageChange?.(newLang);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onFinish?.();
    }
    // Allow Tab key to insert tabs
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = localCode.substring(0, start) + "  " + localCode.substring(end);
      setLocalCode(newValue);
      onChange?.(newValue);

      // Set cursor position after the inserted tab
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  if (isEditing || !readOnly) {
    return (
      <div className={cn("w-full h-full flex flex-col", className)}>
        {/* Language Selector */}
        <div className="flex items-center justify-between px-2 py-1 bg-slate-700 border-b border-slate-600">
          <select
            value={localLanguage}
            onChange={handleLanguageChange}
            className="bg-slate-600 text-slate-200 text-xs rounded px-2 py-1 border-none outline-none"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">Press Esc to save</span>
        </div>

        {/* Code Editor */}
        <textarea
          value={localCode}
          onChange={handleCodeChange}
          onKeyDown={handleKeyDown}
          onBlur={onFinish}
          className={cn(
            "flex-1 bg-slate-800 text-slate-200 font-mono text-xs",
            "border-none outline-none resize-none p-3",
            "placeholder:text-slate-500"
          )}
          placeholder="// Type your code here..."
          autoFocus
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full flex flex-col bg-slate-800 rounded", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-700 border-b border-slate-600 rounded-t">
        <span className="text-xs text-slate-300 font-medium">
          {LANGUAGES.find((l) => l.value === localLanguage)?.label || "Code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code Display */}
      <pre className="flex-1 overflow-auto p-3 text-xs">
        <code className="text-slate-200 font-mono">{localCode || "// No code"}</code>
      </pre>
    </div>
  );
}
