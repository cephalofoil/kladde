"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import hljs from "highlight.js";

// Custom theme with darker line numbers
const customTheme = {
    ...vscDarkPlus,
    linenumber: {
        color: "#3b4252",
        opacity: 1,
    },
};

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
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalCode(code);
    }, [code]);

    useEffect(() => {
        setLocalLanguage(language);
    }, [language]);

    // Auto-detect language from code
    const detectedLanguage = useMemo(() => {
        if (!localCode || localCode.trim().length === 0) {
            return localLanguage;
        }

        try {
            const result = hljs.highlightAuto(localCode);
            const detected = result.language;

            // Map common highlight.js language names to our supported languages
            const languageMap: Record<string, string> = {
                js: "javascript",
                ts: "typescript",
                py: "python",
                sh: "bash",
                shell: "bash",
                c: "c",
                cpp: "cpp",
                "c++": "cpp",
                cs: "csharp",
                rb: "ruby",
            };

            const mappedLanguage = detected
                ? languageMap[detected] || detected
                : localLanguage;

            // Only use detected language if it's in our supported list
            const isSupported = LANGUAGES.some(
                (lang) => lang.value === mappedLanguage,
            );
            return isSupported ? mappedLanguage : localLanguage;
        } catch (err) {
            return localLanguage;
        }
    }, [localCode, localLanguage]);

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
            const newValue =
                localCode.substring(0, start) + "  " + localCode.substring(end);
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

    // Prevent wheel events from propagating to canvas
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
    };

    if (isEditing || !readOnly) {
        return (
            <div
                className={cn(
                    "w-full h-full flex flex-col rounded-b-lg overflow-hidden",
                    className,
                )}
            >
                {/* Minimalist Header - Edit Mode */}
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/50">
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider select-none">
                        {LANGUAGES.find((l) => l.value === detectedLanguage)
                            ?.label || "Code"}
                    </span>
                    <span className="text-[10px] text-slate-500">
                        Press Esc to save
                    </span>
                </div>

                {/* Code Editor */}
                <textarea
                    value={localCode}
                    onChange={handleCodeChange}
                    onKeyDown={handleKeyDown}
                    onBlur={onFinish}
                    onWheel={handleWheel}
                    className={cn(
                        "flex-1 bg-slate-800 text-slate-200 font-mono text-xs",
                        "border-none outline-none resize-none p-3 rounded-b-lg",
                        "placeholder:text-slate-500",
                    )}
                    placeholder="// Type your code here..."
                    autoFocus
                    spellCheck={false}
                />
            </div>
        );
    }

    return (
        <div
            className={cn(
                "w-full h-full flex flex-col overflow-hidden rounded-b-lg",
                className,
            )}
        >
            {/* Minimalist Header */}
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#0f172a]">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider select-none pointer-events-none">
                    {LANGUAGES.find((l) => l.value === detectedLanguage)
                        ?.label || "Code"}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCopy();
                    }}
                    className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-700/50"
                    title="Copy code"
                >
                    {copied ? (
                        <Check className="h-3 w-3" />
                    ) : (
                        <Copy className="h-3 w-3" />
                    )}
                </button>
            </div>

            {/* Code Display with Syntax Highlighting */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-auto code-line-numbers-dark rounded-b-lg"
                onWheel={handleWheel}
                style={{
                    ["--line-number-color" as string]: "#2d3748",
                }}
            >
                <style jsx>{`
                    .code-line-numbers-dark .linenumber {
                        color: #2d3748 !important;
                    }
                `}</style>
                <SyntaxHighlighter
                    language={detectedLanguage}
                    style={customTheme}
                    showLineNumbers={true}
                    wrapLines={true}
                    customStyle={{
                        margin: 0,
                        padding: "12px",
                        fontSize: "12px",
                        height: "100%",
                        background: "#1e293b",
                        borderRadius: "0 0 0.5rem 0.5rem",
                    }}
                    lineNumberStyle={{
                        minWidth: "2.5em",
                        paddingRight: "1em",
                        color: "#2d3748",
                        userSelect: "none",
                    }}
                >
                    {localCode || "// No code"}
                </SyntaxHighlighter>
            </div>
        </div>
    );
}
