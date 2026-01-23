"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy, ChevronRight, ChevronDown } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import hljs from "highlight.js";
import { getThemeByName, type CodeThemeName } from "@/lib/code-themes";
import { LANGUAGES } from "./code-language-selector";

interface FoldRange {
    start: number;
    end: number;
}

interface CodeRendererProps {
    code: string;
    language?: string;
    scale?: number;
    wordWrap?: boolean;
    theme?: CodeThemeName;
    highlightedLines?: number[];
    foldedRanges?: FoldRange[];
    onChange?: (code: string) => void;
    onLanguageChange?: (language: string) => void;
    onHighlightedLinesChange?: (lines: number[]) => void;
    onFoldedRangesChange?: (ranges: FoldRange[]) => void;
    onFinish?: () => void;
    isEditing?: boolean;
    readOnly?: boolean;
    className?: string;
}

// Detect foldable regions in code (functions, classes, blocks)
function detectFoldableRegions(code: string): FoldRange[] {
    const lines = code.split("\n");
    const regions: FoldRange[] = [];
    const stack: number[] = [];

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Count opening and closing braces
        const openBraces = (trimmed.match(/{/g) || []).length;
        const closeBraces = (trimmed.match(/}/g) || []).length;

        // Push opening brace positions
        for (let i = 0; i < openBraces; i++) {
            stack.push(index + 1); // 1-indexed
        }

        // Pop and create regions for closing braces
        for (let i = 0; i < closeBraces; i++) {
            const start = stack.pop();
            if (start !== undefined && index + 1 - start >= 2) {
                regions.push({ start, end: index + 1 });
            }
        }
    });

    return regions.sort((a, b) => a.start - b.start);
}

// Check if a line is within a folded range
function isLineFolded(lineNumber: number, foldedRanges: FoldRange[]): boolean {
    return foldedRanges.some(
        (range) => lineNumber > range.start && lineNumber <= range.end,
    );
}

// Check if a line starts a foldable region
function getFoldableAtLine(
    lineNumber: number,
    foldableRegions: FoldRange[],
): FoldRange | undefined {
    return foldableRegions.find((r) => r.start === lineNumber);
}

export function CodeRenderer({
    code,
    language = "javascript",
    scale = 1,
    wordWrap = false,
    theme = "atom-dark",
    highlightedLines = [],
    foldedRanges = [],
    onChange,
    onLanguageChange,
    onHighlightedLinesChange,
    onFoldedRangesChange,
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

    // Get theme configuration
    const themeConfig = useMemo(() => getThemeByName(theme), [theme]);

    // Detect foldable regions
    const foldableRegions = useMemo(
        () => detectFoldableRegions(localCode),
        [localCode],
    );

    // Auto-detect language from code
    const detectedLanguage = useMemo(() => {
        if (!localCode || localCode.trim().length === 0) {
            return localLanguage;
        }

        try {
            const result = hljs.highlightAuto(localCode);
            const detected = result.language;

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

            const isSupported = LANGUAGES.some(
                (lang) => lang.value === mappedLanguage,
            );
            return isSupported ? mappedLanguage : localLanguage;
        } catch {
            return localLanguage;
        }
    }, [localCode, localLanguage]);

    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setLocalCode(newValue);
        onChange?.(newValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Escape") {
            e.preventDefault();
            onFinish?.();
        }
        if (e.key === "Tab") {
            e.preventDefault();
            const target = e.currentTarget;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const newValue =
                localCode.substring(0, start) + "  " + localCode.substring(end);
            setLocalCode(newValue);
            onChange?.(newValue);
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

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
    };

    // Handle line number click to toggle highlight
    const handleLineClick = useCallback(
        (lineNumber: number) => {
            if (!onHighlightedLinesChange) return;
            const newHighlighted = highlightedLines.includes(lineNumber)
                ? highlightedLines.filter((l) => l !== lineNumber)
                : [...highlightedLines, lineNumber];
            onHighlightedLinesChange(newHighlighted);
        },
        [highlightedLines, onHighlightedLinesChange],
    );

    // Handle fold toggle
    const handleFoldToggle = useCallback(
        (range: FoldRange) => {
            if (!onFoldedRangesChange) return;
            const isFolded = foldedRanges.some(
                (r) => r.start === range.start && r.end === range.end,
            );
            if (isFolded) {
                onFoldedRangesChange(
                    foldedRanges.filter(
                        (r) =>
                            !(r.start === range.start && r.end === range.end),
                    ),
                );
            } else {
                onFoldedRangesChange([...foldedRanges, range]);
            }
        },
        [foldedRanges, onFoldedRangesChange],
    );

    // Process code for folding
    const processedCode = useMemo(() => {
        if (foldedRanges.length === 0) return localCode;

        const lines = localCode.split("\n");
        const visibleLines: string[] = [];

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            if (!isLineFolded(lineNumber, foldedRanges)) {
                // Check if this line starts a folded region
                const foldedRange = foldedRanges.find(
                    (r) => r.start === lineNumber,
                );
                if (foldedRange) {
                    visibleLines.push(line + " ... }");
                } else {
                    visibleLines.push(line);
                }
            }
        });

        return visibleLines.join("\n");
    }, [localCode, foldedRanges]);

    // Edit mode
    if (isEditing || !readOnly) {
        return (
            <div
                className={cn(
                    "w-full h-full flex flex-col rounded-b-lg overflow-hidden",
                    className,
                )}
            >
                <div
                    className="flex items-center justify-between px-2.5 py-1.5"
                    style={{
                        backgroundColor: themeConfig.previewColors.background,
                    }}
                >
                    <span
                        className="text-[10px] font-mono uppercase tracking-wider select-none"
                        style={{ color: themeConfig.previewColors.comment }}
                    >
                        {LANGUAGES.find((l) => l.value === detectedLanguage)
                            ?.label || "Code"}
                    </span>
                    <span
                        className="text-[10px]"
                        style={{ color: themeConfig.previewColors.comment }}
                    >
                        Press Esc to save
                    </span>
                </div>

                <textarea
                    value={localCode}
                    onChange={handleCodeChange}
                    onKeyDown={handleKeyDown}
                    onBlur={onFinish}
                    onWheel={handleWheel}
                    className={cn(
                        "flex-1 font-mono text-xs",
                        "border-none outline-none resize-none p-3 rounded-b-lg",
                    )}
                    style={{
                        backgroundColor: themeConfig.previewColors.background,
                        color: themeConfig.isDark ? "#e2e8f0" : "#1e1e1e",
                    }}
                    placeholder="// Type your code here..."
                    autoFocus
                    spellCheck={false}
                />
            </div>
        );
    }

    // Display mode with all features
    return (
        <div
            className={cn(
                "w-full h-full flex flex-col overflow-hidden rounded-b-lg",
                className,
            )}
        >
            {/* Minimalist Header */}
            <div
                className="flex items-center justify-between px-2.5 py-1.5"
                style={{
                    backgroundColor: themeConfig.previewColors.background,
                }}
            >
                <span
                    className="text-[10px] font-mono uppercase tracking-wider select-none pointer-events-none"
                    style={{ color: themeConfig.previewColors.comment }}
                >
                    {LANGUAGES.find((l) => l.value === detectedLanguage)
                        ?.label || "Code"}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCopy();
                    }}
                    className="transition-colors p-1 rounded hover:opacity-80"
                    style={{ color: themeConfig.previewColors.comment }}
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
                className="flex-1 overflow-auto rounded-b-lg relative"
                onWheel={handleWheel}
                style={{
                    transform: scale !== 1 ? `scale(${scale})` : undefined,
                    transformOrigin: "top left",
                }}
            >
                {/* Fold indicators overlay */}
                {foldableRegions.length > 0 && onFoldedRangesChange && (
                    <div
                        className="absolute left-0 top-0 w-4 z-10"
                        style={{ paddingTop: "12px" }}
                    >
                        {foldableRegions.map((region) => {
                            const isFolded = foldedRanges.some(
                                (r) =>
                                    r.start === region.start &&
                                    r.end === region.end,
                            );
                            // Don't show fold indicator if this line is inside another folded region
                            if (isLineFolded(region.start, foldedRanges))
                                return null;

                            return (
                                <button
                                    key={`${region.start}-${region.end}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFoldToggle(region);
                                    }}
                                    className="absolute w-4 h-4 flex items-center justify-center hover:bg-white/10 rounded"
                                    style={{
                                        top: `${(region.start - 1) * 1.5}em`,
                                        color: themeConfig.previewColors
                                            .comment,
                                    }}
                                    title={isFolded ? "Expand" : "Collapse"}
                                >
                                    {isFolded ? (
                                        <ChevronRight className="h-3 w-3" />
                                    ) : (
                                        <ChevronDown className="h-3 w-3" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                <SyntaxHighlighter
                    language={detectedLanguage}
                    style={themeConfig.style}
                    showLineNumbers
                    wrapLines
                    wrapLongLines={wordWrap}
                    lineProps={(lineNumber) => ({
                        style: {
                            display: "block",
                            backgroundColor: highlightedLines.includes(
                                lineNumber,
                            )
                                ? "rgba(255, 255, 0, 0.15)"
                                : undefined,
                            cursor: onHighlightedLinesChange
                                ? "pointer"
                                : undefined,
                            paddingLeft:
                                foldableRegions.length > 0 ? "20px" : undefined,
                        },
                        onClick: () => handleLineClick(lineNumber),
                    })}
                    customStyle={{
                        margin: 0,
                        padding: "12px",
                        paddingLeft:
                            foldableRegions.length > 0 ? "24px" : "12px",
                        fontSize: "12px",
                        height: "100%",
                        background: themeConfig.previewColors.background,
                        borderRadius: "0 0 0.5rem 0.5rem",
                    }}
                    lineNumberStyle={{
                        minWidth: "2.5em",
                        paddingRight: "1em",
                        color: themeConfig.previewColors.comment,
                        userSelect: "none",
                    }}
                >
                    {processedCode || "// No code"}
                </SyntaxHighlighter>
            </div>

            {/* Minimap for long code */}
            {localCode.split("\n").length > 50 && (
                <div
                    className="absolute right-0 top-8 bottom-0 w-16 opacity-30 pointer-events-none overflow-hidden rounded-br-lg"
                    style={{
                        backgroundColor: themeConfig.previewColors.background,
                    }}
                >
                    <div
                        className="text-[1.5px] font-mono leading-[2px] p-0.5 whitespace-pre overflow-hidden"
                        style={{ color: themeConfig.isDark ? "#888" : "#666" }}
                    >
                        {localCode.slice(0, 3000)}
                    </div>
                </div>
            )}
        </div>
    );
}
