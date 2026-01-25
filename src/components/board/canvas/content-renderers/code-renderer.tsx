"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { getThemeByName, type CodeThemeName } from "@/lib/code-themes";
import { LANGUAGES } from "./code-language-selector";
import { CodeMirrorEditor } from "@/components/board/code-mirror-editor";

interface CodeRendererProps {
    code: string;
    language?: string;
    scale?: number;
    wordWrap?: boolean;
    theme?: CodeThemeName;
    highlightedLines?: number[];
    onChange?: (code: string) => void;
    onHighlightedLinesChange?: (lines: number[]) => void;
    onFinish?: () => void;
    isEditing?: boolean;
    readOnly?: boolean;
    isSelected?: boolean;
    className?: string;
}

const areNumberArraysEqual = (a: number[], b: number[]) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
};

const areCodeRendererPropsEqual = (
    prev: CodeRendererProps,
    next: CodeRendererProps,
) => {
    return (
        prev.code === next.code &&
        prev.language === next.language &&
        prev.scale === next.scale &&
        prev.wordWrap === next.wordWrap &&
        prev.theme === next.theme &&
        prev.isEditing === next.isEditing &&
        prev.readOnly === next.readOnly &&
        prev.isSelected === next.isSelected &&
        prev.className === next.className &&
        prev.onChange === next.onChange &&
        prev.onHighlightedLinesChange === next.onHighlightedLinesChange &&
        prev.onFinish === next.onFinish &&
        areNumberArraysEqual(
            prev.highlightedLines ?? [],
            next.highlightedLines ?? [],
        )
    );
};

export const CodeRenderer = memo(function CodeRenderer({
    code,
    language = "javascript",
    scale = 1,
    wordWrap = false,
    theme = "atom-dark",
    highlightedLines = [],
    onChange,
    onHighlightedLinesChange,
    onFinish,
    isEditing = false,
    readOnly = false,
    isSelected = false,
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

    // Get theme configuration
    const themeConfig = useMemo(() => getThemeByName(theme), [theme]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(localCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy code:", err);
        }
    };

    const handleLineToggle = (lineNumber: number) => {
        if (!onHighlightedLinesChange) return;
        const newHighlighted = highlightedLines.includes(lineNumber)
            ? highlightedLines.filter((l) => l !== lineNumber)
            : [...highlightedLines, lineNumber];
        onHighlightedLinesChange(newHighlighted);
    };

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
                        {LANGUAGES.find((l) => l.value === localLanguage)
                            ?.label || "Code"}
                    </span>
                    <span
                        className="text-[10px]"
                        style={{ color: themeConfig.previewColors.comment }}
                    >
                        Press Esc to save
                    </span>
                </div>

                <div
                    className="flex-1 min-h-0 overflow-auto"
                    data-code-editor="true"
                    data-tile-selected={isSelected ? "true" : "false"}
                    onWheelCapture={(e) => {
                        if (isSelected) e.stopPropagation();
                    }}
                >
                    <CodeMirrorEditor
                        value={localCode}
                        language={localLanguage}
                        theme={theme}
                        readOnly={false}
                        wordWrap={wordWrap}
                        scale={scale}
                        fontSize={12}
                        highlightedLines={highlightedLines}
                        onChange={(nextValue) => {
                            setLocalCode(nextValue);
                            onChange?.(nextValue);
                        }}
                        onLineToggle={handleLineToggle}
                        onEscape={onFinish}
                        placeholderText="// Type your code here..."
                        className="h-full cursor-text"
                    />
                </div>
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
                    {LANGUAGES.find((l) => l.value === localLanguage)?.label ||
                        "Code"}
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
                className="flex-1 min-h-0 overflow-auto rounded-b-lg relative"
                data-code-editor="true"
                data-tile-selected={isSelected ? "true" : "false"}
                onWheelCapture={(e) => {
                    if (isSelected) e.stopPropagation();
                }}
            >
                <CodeMirrorEditor
                    value={localCode || "// No code"}
                    language={localLanguage}
                    theme={theme}
                    readOnly
                    wordWrap={wordWrap}
                    scale={scale}
                    fontSize={12}
                    highlightedLines={highlightedLines}
                    onLineToggle={
                        onHighlightedLinesChange ? handleLineToggle : undefined
                    }
                    className="h-full"
                />
            </div>
        </div>
    );
}, areCodeRendererPropsEqual);
