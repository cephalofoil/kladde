"use client";

import { getFileExtension } from "./code-language-selector";
import { getThemeByName } from "@/lib/code-themes";

interface RenderCodeImageOptions {
    code: string;
    /** Language for syntax highlighting (not yet implemented) */
    language?: string;
    theme?: string;
    scale?: number;
    pixelRatio?: number;
    padding?: number;
    fontSize?: number;
    lineHeight?: number;
    showLineNumbers?: boolean;
}

/**
 * Renders code to a PNG blob by drawing on a canvas
 */
export async function renderCodeToImageBlob({
    code,
    language,
    theme = "atom-dark",
    scale = 1,
    pixelRatio = 2,
    padding = 32,
    fontSize = 14,
    lineHeight = 1.5,
    showLineNumbers = true,
}: RenderCodeImageOptions): Promise<Blob | null> {
    void language; // TODO: Implement syntax highlighting
    if (!code.trim()) return null;

    try {
        const themeConfig = getThemeByName(theme);
        const lines = code.split("\n");
        const lineNumberWidth = showLineNumbers
            ? String(lines.length).length * fontSize * 0.6 + 24
            : 0;

        // Calculate dimensions
        const lineHeightPx = fontSize * lineHeight;
        const contentHeight = lines.length * lineHeightPx;
        const maxLineLength = Math.max(...lines.map((l) => l.length));
        const charWidth = fontSize * 0.6; // Approximate monospace char width
        const contentWidth = maxLineLength * charWidth + lineNumberWidth;

        const width = Math.ceil((contentWidth + padding * 2) * scale);
        const height = Math.ceil((contentHeight + padding * 2) * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.scale(pixelRatio * scale, pixelRatio * scale);

        // Draw background
        ctx.fillStyle = themeConfig.previewColors.background;
        ctx.fillRect(0, 0, width / scale, height / scale);

        // Set font
        ctx.font = `${fontSize}px "Fira Code", "Monaco", "Consolas", monospace`;
        ctx.textBaseline = "top";

        // Draw each line
        lines.forEach((line, index) => {
            const y = padding + index * lineHeightPx;

            // Draw line number
            if (showLineNumbers) {
                ctx.fillStyle = themeConfig.previewColors.comment;
                ctx.textAlign = "right";
                ctx.fillText(
                    String(index + 1),
                    padding + lineNumberWidth - 12,
                    y,
                );
            }

            // Draw code (simple rendering without syntax highlighting)
            ctx.fillStyle = themeConfig.isDark ? "#e2e8f0" : "#1e1e1e";
            ctx.textAlign = "left";
            ctx.fillText(line, padding + lineNumberWidth, y);
        });

        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), "image/png");
        });
    } catch (error) {
        console.error("Failed to render code to image:", error);
        return null;
    }
}

/**
 * Downloads code as a file with the appropriate extension
 */
export function downloadCodeAsFile(options: {
    code: string;
    language: string;
    filename?: string;
}): void {
    const { code, language, filename } = options;
    const extension = getFileExtension(language);
    const finalFilename = filename || `code.${extension}`;

    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = finalFilename.endsWith(`.${extension}`)
        ? finalFilename
        : `${finalFilename}.${extension}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Copies code as an image to clipboard
 */
export async function copyCodeAsImage(
    options: RenderCodeImageOptions,
): Promise<boolean> {
    try {
        const blob = await renderCodeToImageBlob(options);
        if (!blob) return false;

        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
        ]);
        return true;
    } catch (error) {
        console.error("Failed to copy code as image:", error);
        return false;
    }
}

/**
 * Format code - currently supports JSON formatting only.
 * For full formatting support, install prettier: npm install prettier
 */
export async function formatCode(
    code: string,
    language: string,
): Promise<{ formatted: string; error?: string }> {
    // For JSON, use built-in formatting
    if (language === "json") {
        try {
            const parsed = JSON.parse(code);
            const formatted = JSON.stringify(parsed, null, 2);
            return { formatted };
        } catch {
            return { formatted: code, error: "Invalid JSON" };
        }
    }

    // For other languages, return as-is with a note
    // Full prettier support requires: npm install prettier
    return {
        formatted: code,
        error: `Formatting for ${language} requires prettier. Run: npm install prettier`,
    };
}

/**
 * Check if formatting is supported for a language
 * Currently only JSON is fully supported without additional dependencies
 */
export function canFormatLanguage(language: string): boolean {
    // Only show format button for JSON which we can format without prettier
    return language === "json";
}
