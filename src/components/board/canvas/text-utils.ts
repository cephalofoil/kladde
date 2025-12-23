let textMeasureCanvas: HTMLCanvasElement | null = null;
export function measureTextWidthPx(text: string, font: string): number {
    if (typeof document === "undefined") return text.length * 8;
    textMeasureCanvas ??= document.createElement("canvas");
    const ctx = textMeasureCanvas.getContext("2d");
    if (!ctx) return text.length * 8;
    ctx.font = font;
    return ctx.measureText(text).width;
}

export function getTextFontString(fontSize: number, fontFamily: string) {
    return `500 ${fontSize}px ${fontFamily}`;
}

// Get the minimum width needed to display a single character without clipping
// Measures the widest character in the text, or falls back to 'W' if text is empty
export function getMinSingleCharWidth(
    text: string,
    fontSize: number,
    fontFamily: string,
    letterSpacing: number,
): number {
    const font = getTextFontString(fontSize, fontFamily);
    // Find the widest character in the actual text
    let maxCharWidth = 0;
    const chars = text.replace(/\s/g, ""); // Remove whitespace
    if (chars.length > 0) {
        for (const char of chars) {
            const charWidth = measureTextWidthPx(char, font);
            if (charWidth > maxCharWidth) {
                maxCharWidth = charWidth;
            }
        }
    } else {
        // Fallback to 'W' if no non-whitespace characters
        maxCharWidth = measureTextWidthPx("W", font);
    }
    // Add letter-spacing and buffer for glyph overhangs
    return Math.max(2, maxCharWidth + Math.abs(letterSpacing) + 12);
}

let textMeasureDiv: HTMLDivElement | null = null;
export function measureWrappedTextHeightPx({
    text,
    width,
    fontSize,
    lineHeight,
    fontFamily,
    letterSpacing,
    textAlign,
}: {
    text: string;
    width: number;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    letterSpacing: number;
    textAlign: "left" | "center" | "right";
}) {
    if (typeof document === "undefined") {
        const lineHeightPx = fontSize * lineHeight;
        const lineCount = Math.max(1, (text || "").split("\n").length);
        return lineCount * lineHeightPx;
    }

    textMeasureDiv ??= (() => {
        const el = document.createElement("div");
        el.setAttribute("data-role", "text-measure");
        Object.assign(el.style, {
            position: "absolute",
            left: "-99999px",
            top: "0px",
            visibility: "hidden",
            pointerEvents: "none",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            padding: "0px",
            margin: "0px",
            border: "0px",
            boxSizing: "content-box",
        } as CSSStyleDeclaration);
        document.body.appendChild(el);
        return el;
    })();

    Object.assign(textMeasureDiv.style, {
        width: `${Math.max(0, width)}px`,
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}`,
        fontFamily,
        letterSpacing: `${letterSpacing}px`,
        textAlign,
    });

    // Use a single space to avoid empty content measuring to 0 height in some browsers.
    // Add a zero-width space after trailing newlines to ensure they are measured
    let textToMeasure = text.length ? text : " ";
    if (textToMeasure.endsWith("\n")) {
        textToMeasure += "\u200b"; // Zero-width space to force trailing newline height
    }
    textMeasureDiv.textContent = textToMeasure;
    return textMeasureDiv.scrollHeight;
}

// Wrap text to fit within a given width
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    if (!text) return [""];

    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    // More accurate character width estimation for typical fonts
    const avgCharWidth = fontSize * 0.6;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? currentLine + " " + word : word;
        const estimatedWidth = testLine.length * avgCharWidth;

        if (estimatedWidth > maxWidth && currentLine) {
            // Current line is too long, push it and start new line
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }

    // Add the last line
    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [""];
}

export function wrapTextBreakWord(
    text: string,
    maxWidth: number,
    fontSize: number,
): string[] {
    if (text === "") return [""];
    const avgCharWidth = fontSize * 0.6;
    const maxChars = Math.max(1, Math.floor(maxWidth / avgCharWidth));

    const result: string[] = [];
    const paragraphs = text.split("\n");

    for (const paragraph of paragraphs) {
        if (paragraph === "") {
            result.push("");
            continue;
        }

        const tokens = paragraph.split(/(\s+)/).filter((t) => t.length > 0);
        let line = "";

        const pushLine = () => {
            result.push(line);
            line = "";
        };

        for (const token of tokens) {
            // If token itself is too long, break it into chunks (down to 1 char/line).
            const appendToken = (t: string) => {
                if (line.length === 0) {
                    if (t.length <= maxChars) {
                        line = t;
                        return;
                    }
                    for (let i = 0; i < t.length; i += maxChars) {
                        result.push(t.slice(i, i + maxChars));
                    }
                    return;
                }

                if (line.length + t.length <= maxChars) {
                    line += t;
                    return;
                }

                pushLine();
                appendToken(t);
            };

            // Skip whitespace at line start (matches typical wrapping behavior).
            if (line.length === 0 && /^\s+$/.test(token)) continue;
            appendToken(token);
        }

        if (line.length > 0) {
            result.push(line);
        }
    }

    return result.length ? result : [""];
}

export function wrapTextBreakWordMeasured(
    text: string,
    maxWidth: number,
    font: string,
): string[] {
    if (text === "") return [""];
    const effectiveMaxWidth = Math.max(0, maxWidth);

    const result: string[] = [];
    const paragraphs = text.split("\n");

    for (const paragraph of paragraphs) {
        if (paragraph === "") {
            result.push("");
            continue;
        }

        const tokens = paragraph.split(/(\s+)/).filter((t) => t.length > 0);
        let line = "";

        const pushLine = () => {
            result.push(line);
            line = "";
        };

        const fits = (candidate: string) =>
            measureTextWidthPx(candidate, font) <= effectiveMaxWidth ||
            candidate.length <= 1 ||
            effectiveMaxWidth <= 0;

        const appendChunked = (chunk: string) => {
            if (chunk === "") return;
            if (line.length === 0) {
                if (fits(chunk)) {
                    line = chunk;
                    return;
                }

                // Break by characters, making sure we always progress.
                let remaining = chunk;
                while (remaining.length) {
                    if (remaining.length === 1) {
                        result.push(remaining);
                        break;
                    }

                    let lo = 1;
                    let hi = remaining.length;
                    while (lo < hi) {
                        const mid = Math.ceil((lo + hi) / 2);
                        const part = remaining.slice(0, mid);
                        if (fits(part)) lo = mid;
                        else hi = mid - 1;
                    }
                    const take = Math.max(1, lo);
                    result.push(remaining.slice(0, take));
                    remaining = remaining.slice(take);
                }
                return;
            }

            const candidate = `${line}${chunk}`;
            if (fits(candidate)) {
                line = candidate;
                return;
            }

            pushLine();
            appendChunked(chunk);
        };

        for (const token of tokens) {
            if (line.length === 0 && /^\s+$/.test(token)) continue;
            appendChunked(token);
        }

        if (line.length) {
            result.push(line);
        }
    }

    return result.length ? result : [""];
}
