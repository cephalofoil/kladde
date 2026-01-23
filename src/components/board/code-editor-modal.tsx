"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
    X,
    Search,
    ChevronUp,
    ChevronDown,
    Sparkles,
    Copy,
    Download,
    Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardElement } from "@/lib/board-types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
    CODE_THEMES,
    getThemeByName,
    type CodeThemeName,
} from "@/lib/code-themes";
import {
    CodeLanguageSelector,
    LANGUAGES,
} from "./canvas/content-renderers/code-language-selector";
import {
    formatCode,
    canFormatLanguage,
    downloadCodeAsFile,
} from "./canvas/utils/code-export";

interface CodeEditorModalProps {
    codeElement: BoardElement;
    onClose: () => void;
    onUpdateCode: (updates: Partial<BoardElement>) => void;
}

export function CodeEditorModal({
    codeElement,
    onClose,
    onUpdateCode,
}: CodeEditorModalProps) {
    const [isAnimating, setIsAnimating] = useState(true);
    const [code, setCode] = useState(codeElement.tileContent?.code || "");
    const [language, setLanguage] = useState(
        codeElement.tileContent?.language || "javascript",
    );
    const [theme, setTheme] = useState<CodeThemeName>(
        (codeElement.tileContent?.codeTheme as CodeThemeName) || "atom-dark",
    );
    const [highlightedLines, setHighlightedLines] = useState<number[]>(
        codeElement.tileContent?.codeHighlightedLines || [],
    );

    // Search state
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<number[]>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

    // Refs
    const codeRef = useRef(code);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    // Copy state
    const [copied, setCopied] = useState(false);

    // Keep ref in sync
    useEffect(() => {
        codeRef.current = code;
    }, [code]);

    // Animation
    useEffect(() => {
        const timer = setTimeout(() => setIsAnimating(false), 50);
        return () => clearTimeout(timer);
    }, []);

    // Save on unmount
    const saveContent = useCallback(() => {
        const currentCode = codeRef.current;
        if (currentCode !== codeElement.tileContent?.code) {
            onUpdateCode({
                tileContent: {
                    ...codeElement.tileContent,
                    code: currentCode,
                    language,
                    codeTheme: theme,
                    codeHighlightedLines: highlightedLines,
                },
            });
        }
    }, [
        codeElement.tileContent,
        onUpdateCode,
        language,
        theme,
        highlightedLines,
    ]);

    const handleClose = useCallback(() => {
        saveContent();
        setIsAnimating(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose, saveContent]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showSearch) {
                    setShowSearch(false);
                    setSearchQuery("");
                    setSearchResults([]);
                } else {
                    handleClose();
                }
            }
            // Cmd/Ctrl + F for search
            if ((e.metaKey || e.ctrlKey) && e.key === "f") {
                e.preventDefault();
                setShowSearch(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
            // Cmd/Ctrl + S for save
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                saveContent();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleClose, showSearch, saveContent]);

    // Search functionality
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setCurrentSearchIndex(0);
            return;
        }

        const lines = code.split("\n");
        const results: number[] = [];
        const queryLower = searchQuery.toLowerCase();

        lines.forEach((line, index) => {
            if (line.toLowerCase().includes(queryLower)) {
                results.push(index + 1);
            }
        });

        setSearchResults(results);
        setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    }, [searchQuery, code]);

    const handleNextResult = () => {
        if (searchResults.length === 0) return;
        const next = (currentSearchIndex + 1) % searchResults.length;
        setCurrentSearchIndex(next);
    };

    const handlePrevResult = () => {
        if (searchResults.length === 0) return;
        const prev =
            (currentSearchIndex - 1 + searchResults.length) %
            searchResults.length;
        setCurrentSearchIndex(prev);
    };

    // Handle format
    const handleFormat = async () => {
        const { formatted, error } = await formatCode(code, language);
        if (!error) {
            setCode(formatted);
        }
    };

    // Handle copy
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    // Handle download
    const handleDownload = () => {
        const title = codeElement.tileTitle || "code";
        downloadCodeAsFile({
            code,
            language,
            filename: title,
        });
    };

    // Handle line click to toggle highlight
    const handleLineClick = (lineNumber: number) => {
        setHighlightedLines((prev) =>
            prev.includes(lineNumber)
                ? prev.filter((l) => l !== lineNumber)
                : [...prev, lineNumber],
        );
    };

    // Handle tab key in textarea
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const target = e.currentTarget;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const newValue =
                code.substring(0, start) + "  " + code.substring(end);
            setCode(newValue);
            setTimeout(() => {
                target.selectionStart = target.selectionEnd = start + 2;
            }, 0);
        }
    };

    const themeConfig = getThemeByName(theme);
    const lines = code.split("\n");

    return (
        <div
            className="fixed inset-0 z-[120] bg-black/20 flex items-center justify-center p-4"
            onClick={handleClose}
        >
            <div
                className={cn(
                    "w-[92%] max-w-[1200px] min-w-[600px] h-[85vh]",
                    "rounded-2xl shadow-2xl flex flex-col overflow-hidden",
                    "transition-all duration-300 ease-in-out",
                )}
                style={{
                    opacity: isAnimating ? 0 : 1,
                    transform: isAnimating ? "scale(0.95)" : "scale(1)",
                    backgroundColor: themeConfig.previewColors.background,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{
                        borderColor: themeConfig.isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.1)",
                        backgroundColor: themeConfig.isDark
                            ? "rgba(0,0,0,0.3)"
                            : "rgba(255,255,255,0.5)",
                    }}
                >
                    <div className="flex items-center gap-3">
                        <span
                            className="text-sm font-medium"
                            style={{
                                color: themeConfig.isDark ? "#fff" : "#000",
                            }}
                        >
                            {codeElement.tileTitle || "Code Editor"}
                        </span>
                        <span
                            className="text-xs"
                            style={{
                                color: themeConfig.previewColors.comment,
                            }}
                        >
                            {lines.length} lines
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Language Selector */}
                        <CodeLanguageSelector
                            value={language}
                            onChange={setLanguage}
                            compact
                        />

                        {/* Theme Selector */}
                        <select
                            value={theme}
                            onChange={(e) =>
                                setTheme(e.target.value as CodeThemeName)
                            }
                            className="px-2 py-1 text-xs rounded border bg-transparent transition-colors"
                            style={{
                                borderColor: themeConfig.isDark
                                    ? "rgba(255,255,255,0.2)"
                                    : "rgba(0,0,0,0.2)",
                                color: themeConfig.isDark ? "#fff" : "#000",
                            }}
                        >
                            {CODE_THEMES.map((t) => (
                                <option
                                    key={t.name}
                                    value={t.name}
                                    style={{
                                        backgroundColor:
                                            t.previewColors.background,
                                        color: t.isDark ? "#fff" : "#000",
                                    }}
                                >
                                    {t.label}
                                </option>
                            ))}
                        </select>

                        {/* Search Toggle */}
                        <button
                            onClick={() => {
                                setShowSearch(!showSearch);
                                if (!showSearch) {
                                    setTimeout(
                                        () => searchInputRef.current?.focus(),
                                        50,
                                    );
                                }
                            }}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                showSearch
                                    ? "bg-white/20"
                                    : "hover:bg-white/10",
                            )}
                            title="Search (Ctrl+F)"
                            style={{
                                color: themeConfig.isDark ? "#fff" : "#000",
                            }}
                        >
                            <Search className="w-4 h-4" />
                        </button>

                        {/* Format Button */}
                        {canFormatLanguage(language) && (
                            <button
                                onClick={handleFormat}
                                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                                title="Format Code"
                                style={{
                                    color: themeConfig.isDark ? "#fff" : "#000",
                                }}
                            >
                                <Sparkles className="w-4 h-4" />
                            </button>
                        )}

                        {/* Copy Button */}
                        <button
                            onClick={handleCopy}
                            className="p-1.5 rounded hover:bg-white/10 transition-colors"
                            title="Copy Code"
                            style={{
                                color: themeConfig.isDark ? "#fff" : "#000",
                            }}
                        >
                            {copied ? (
                                <Check className="w-4 h-4" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                        </button>

                        {/* Download Button */}
                        <button
                            onClick={handleDownload}
                            className="p-1.5 rounded hover:bg-white/10 transition-colors"
                            title="Download Code"
                            style={{
                                color: themeConfig.isDark ? "#fff" : "#000",
                            }}
                        >
                            <Download className="w-4 h-4" />
                        </button>

                        {/* Close Button */}
                        <button
                            onClick={handleClose}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-white/10 transition-colors"
                            style={{
                                color: themeConfig.isDark ? "#fff" : "#000",
                            }}
                        >
                            <span className="text-sm">Save & Close</span>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                {showSearch && (
                    <div
                        className="flex items-center gap-2 px-4 py-2 border-b"
                        style={{
                            borderColor: themeConfig.isDark
                                ? "rgba(255,255,255,0.1)"
                                : "rgba(0,0,0,0.1)",
                            backgroundColor: themeConfig.isDark
                                ? "rgba(0,0,0,0.2)"
                                : "rgba(255,255,255,0.3)",
                        }}
                    >
                        <Search
                            className="w-4 h-4"
                            style={{
                                color: themeConfig.previewColors.comment,
                            }}
                        />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    if (e.shiftKey) {
                                        handlePrevResult();
                                    } else {
                                        handleNextResult();
                                    }
                                }
                            }}
                            placeholder="Search in code..."
                            className="flex-1 bg-transparent text-sm outline-none"
                            style={{
                                color: themeConfig.isDark ? "#fff" : "#000",
                            }}
                        />
                        {searchResults.length > 0 && (
                            <span
                                className="text-xs"
                                style={{
                                    color: themeConfig.previewColors.comment,
                                }}
                            >
                                {currentSearchIndex + 1} of{" "}
                                {searchResults.length}
                            </span>
                        )}
                        <button
                            onClick={handlePrevResult}
                            disabled={searchResults.length === 0}
                            className="p-1 rounded hover:bg-white/10 disabled:opacity-50"
                            style={{
                                color: themeConfig.isDark ? "#fff" : "#000",
                            }}
                        >
                            <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleNextResult}
                            disabled={searchResults.length === 0}
                            className="p-1 rounded hover:bg-white/10 disabled:opacity-50"
                            style={{
                                color: themeConfig.isDark ? "#fff" : "#000",
                            }}
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                setShowSearch(false);
                                setSearchQuery("");
                                setSearchResults([]);
                            }}
                            className="p-1 rounded hover:bg-white/10"
                            style={{
                                color: themeConfig.isDark ? "#fff" : "#000",
                            }}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Editor with Syntax Highlighting */}
                <div
                    ref={editorContainerRef}
                    className="flex-1 overflow-auto relative"
                >
                    {/* Syntax Highlighted Display */}
                    <div className="absolute inset-0 pointer-events-none">
                        <SyntaxHighlighter
                            language={language}
                            style={themeConfig.style}
                            showLineNumbers
                            wrapLines
                            lineProps={(lineNumber) => ({
                                style: {
                                    display: "block",
                                    backgroundColor: highlightedLines.includes(
                                        lineNumber,
                                    )
                                        ? "rgba(255, 255, 0, 0.15)"
                                        : searchResults.includes(lineNumber)
                                          ? "rgba(255, 165, 0, 0.1)"
                                          : undefined,
                                },
                                onClick: () => handleLineClick(lineNumber),
                            })}
                            customStyle={{
                                margin: 0,
                                padding: "16px",
                                paddingLeft: "60px",
                                fontSize: "14px",
                                lineHeight: "1.6",
                                minHeight: "100%",
                                background: "transparent",
                            }}
                            lineNumberStyle={{
                                minWidth: "3em",
                                paddingRight: "1em",
                                color: themeConfig.previewColors.comment,
                                userSelect: "none",
                            }}
                        >
                            {code || " "}
                        </SyntaxHighlighter>
                    </div>

                    {/* Editable Textarea Overlay */}
                    <textarea
                        ref={textareaRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="absolute inset-0 w-full h-full font-mono text-transparent caret-white bg-transparent outline-none resize-none"
                        style={{
                            padding: "16px",
                            paddingLeft: "60px",
                            fontSize: "14px",
                            lineHeight: "1.6",
                            caretColor: themeConfig.isDark ? "#fff" : "#000",
                        }}
                        spellCheck={false}
                        autoFocus
                    />
                </div>

                {/* Footer */}
                <div
                    className="px-4 py-2 border-t text-xs flex items-center justify-between"
                    style={{
                        borderColor: themeConfig.isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.1)",
                        color: themeConfig.previewColors.comment,
                    }}
                >
                    <div>
                        <kbd
                            className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{
                                backgroundColor: themeConfig.isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.1)",
                            }}
                        >
                            Ctrl+F
                        </kbd>{" "}
                        Search
                        <span className="mx-2">|</span>
                        <kbd
                            className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{
                                backgroundColor: themeConfig.isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.1)",
                            }}
                        >
                            Ctrl+S
                        </kbd>{" "}
                        Save
                        <span className="mx-2">|</span>
                        <kbd
                            className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{
                                backgroundColor: themeConfig.isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.1)",
                            }}
                        >
                            Tab
                        </kbd>{" "}
                        Indent
                    </div>
                    <div>
                        {LANGUAGES.find((l) => l.value === language)?.label ||
                            language}
                    </div>
                </div>
            </div>
        </div>
    );
}
