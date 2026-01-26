"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
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
import {
    CODE_THEMES,
    getThemeByName,
    type CodeThemeName,
} from "@/lib/code-themes";
import {
    CodeLanguageSelector,
    LANGUAGES,
} from "./code-language-selector";
import {
    formatCode,
    canFormatLanguage,
    downloadCodeAsFile,
} from "./code-export";
import { CodeMirrorEditor } from "./code-mirror-editor";

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
    const [isAnimating, setIsAnimating] = useState(false);
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
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

    // Refs
    const codeRef = useRef(code);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Copy state
    const [copied, setCopied] = useState(false);

    // Keep ref in sync
    useEffect(() => {
        codeRef.current = code;
    }, [code]);

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
                    setCurrentSearchIndex(0);
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

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) {
            return [];
        }

        const lines = code.split("\n");
        const results: number[] = [];
        const queryLower = searchQuery.toLowerCase();

        lines.forEach((line, index) => {
            if (line.toLowerCase().includes(queryLower)) {
                results.push(index + 1);
            }
        });

        return results;
    }, [searchQuery, code]);

    const activeSearchIndex = useMemo(() => {
        if (searchResults.length === 0) return -1;
        if (currentSearchIndex >= searchResults.length) return 0;
        if (currentSearchIndex < 0) return 0;
        return currentSearchIndex;
    }, [currentSearchIndex, searchResults.length]);

    const handleNextResult = () => {
        if (searchResults.length === 0) return;
        const next = (activeSearchIndex + 1) % searchResults.length;
        setCurrentSearchIndex(next);
    };

    const handlePrevResult = () => {
        if (searchResults.length === 0) return;
        const prev =
            (activeSearchIndex - 1 + searchResults.length) %
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

    const themeConfig = getThemeByName(theme);
    const lines = code.split("\n");

    return (
        <div
            className="fixed inset-0 z-[120] bg-black/20 flex items-center justify-center p-4"
            onClick={handleClose}
        >
            <div
                className={cn(
                    "w-[92%] max-w-[1600px] min-w-[700px] h-full",
                    "bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden",
                    "transition-all duration-300 ease-in-out",
                )}
                style={{
                    opacity: isAnimating ? 0 : 1,
                    transform: isAnimating ? "scale(0.95)" : "scale(1)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">
                            {codeElement.tileTitle || "Code Editor"}
                        </span>
                        <span className="text-xs text-muted-foreground">
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
                            className="px-2 py-1 text-xs rounded border border-border bg-background transition-colors text-foreground"
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
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-muted text-foreground",
                            )}
                            title="Search (Ctrl+F)"
                        >
                            <Search className="w-4 h-4" />
                        </button>

                        {/* Format Button */}
                        {canFormatLanguage(language) && (
                            <button
                                onClick={handleFormat}
                                className="p-1.5 rounded hover:bg-muted transition-colors text-foreground"
                                title="Format Code"
                            >
                                <Sparkles className="w-4 h-4" />
                            </button>
                        )}

                        {/* Copy Button */}
                        <button
                            onClick={handleCopy}
                            className="p-1.5 rounded hover:bg-muted transition-colors text-foreground"
                            title="Copy Code"
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
                            className="p-1.5 rounded hover:bg-muted transition-colors text-foreground"
                            title="Download Code"
                        >
                            <Download className="w-4 h-4" />
                        </button>

                        {/* Close Button */}
                        <button
                            onClick={handleClose}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-muted transition-colors text-foreground"
                        >
                            <span className="text-sm">Save & Close</span>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                {showSearch && (
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentSearchIndex(0);
                            }}
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
                            className="flex-1 bg-transparent text-sm outline-none text-foreground"
                        />
                        {searchResults.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                                {activeSearchIndex + 1} of{" "}
                                {searchResults.length}
                            </span>
                        )}
                        <button
                            onClick={handlePrevResult}
                            disabled={searchResults.length === 0}
                            className="p-1 rounded hover:bg-muted disabled:opacity-50 text-foreground"
                        >
                            <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleNextResult}
                            disabled={searchResults.length === 0}
                            className="p-1 rounded hover:bg-muted disabled:opacity-50 text-foreground"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                setShowSearch(false);
                                setSearchQuery("");
                                setCurrentSearchIndex(0);
                            }}
                            className="p-1 rounded hover:bg-muted text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Editor with Syntax Highlighting */}
                <div className="flex-1 overflow-hidden relative">
                    <CodeMirrorEditor
                        value={code}
                        language={language}
                        theme={theme}
                        readOnly={false}
                        wordWrap={false}
                        scale={1}
                        fontSize={14}
                        highlightedLines={highlightedLines}
                        searchLines={searchResults}
                        onChange={setCode}
                        onLineToggle={handleLineClick}
                        placeholderText="// Type your code here..."
                        className="h-full"
                    />
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-border text-xs flex items-center justify-between text-muted-foreground bg-muted/30">
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
