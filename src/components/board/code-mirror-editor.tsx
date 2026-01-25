"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorState, type Extension } from "@codemirror/state";
import {
    EditorView,
    keymap,
    lineNumbers,
    highlightActiveLine,
    highlightActiveLineGutter,
    drawSelection,
    dropCursor,
    placeholder,
} from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { getCodeMirrorLanguage } from "@/lib/codemirror-language";
import { getCodeMirrorTheme } from "@/lib/codemirror-themes";
import type { CodeThemeName } from "@/lib/code-themes";
import { cn } from "@/lib/utils";

interface CodeMirrorEditorProps {
    value: string;
    language: string;
    theme: CodeThemeName;
    readOnly?: boolean;
    wordWrap?: boolean;
    scale?: number;
    fontSize?: number;
    placeholderText?: string;
    onChange?: (value: string) => void;
    onLineToggle?: (lineNumber: number) => void;
    onEscape?: () => void;
    className?: string;
}

function createGutterClickHandler(
    onLineToggle: (lineNumber: number) => void,
): Extension {
    return EditorView.domEventHandlers({
        mousedown(event, view) {
            const target = event.target as HTMLElement | null;
            if (!target?.closest(".cm-gutterElement")) return false;
            const pos = view.posAtCoords({
                x: event.clientX,
                y: event.clientY,
            });
            if (pos == null) return false;
            const line = view.state.doc.lineAt(pos).number;
            onLineToggle(line);
            event.preventDefault();
            return true;
        },
    });
}

export function CodeMirrorEditor({
    value,
    language,
    theme,
    readOnly = false,
    wordWrap = false,
    scale = 1,
    fontSize = 12,
    placeholderText,
    onChange,
    onLineToggle,
    onEscape,
    className,
}: CodeMirrorEditorProps) {
    const languageExtension = useMemo(
        () => getCodeMirrorLanguage(language),
        [language],
    );

    const baseTheme = useMemo(
        () =>
            EditorView.theme({
                "&": {
                    fontFamily: "var(--font-mono)",
                    fontSize: `${fontSize * scale}px`,
                    lineHeight: "1.6",
                },
                ".cm-content": {
                    fontFamily: "var(--font-mono)",
                    lineHeight: "1.6",
                },
                ".cm-line": {
                    padding: "0 12px",
                },
                ".cm-gutters": {
                    fontFamily: "var(--font-mono)",
                    fontSize: `${fontSize * scale}px`,
                    lineHeight: "1.6",
                },
            }),
        [fontSize, scale],
    );

    const themeExtension = useMemo(() => getCodeMirrorTheme(theme), [theme]);

    const extensions = useMemo(() => {
        const parts: Extension[] = [
            lineNumbers(),
            highlightActiveLineGutter(),
            highlightActiveLine(),
            drawSelection(),
            dropCursor(),
            keymap.of([indentWithTab]),
            baseTheme,
        ];

        if (languageExtension) parts.push(languageExtension);
        if (onLineToggle) parts.push(createGutterClickHandler(onLineToggle));
        if (onEscape) {
            parts.push(
                keymap.of([
                    {
                        key: "Escape",
                        run: () => {
                            onEscape();
                            return true;
                        },
                    },
                ]),
            );
        }
        if (readOnly) {
            parts.push(EditorState.readOnly.of(true));
            parts.push(EditorView.editable.of(false));
        }
        if (wordWrap) parts.push(EditorView.lineWrapping);
        if (placeholderText) parts.push(placeholder(placeholderText));

        return parts;
    }, [
        baseTheme,
        languageExtension,
        onLineToggle,
        onEscape,
        placeholderText,
        readOnly,
        wordWrap,
    ]);

    return (
        <div className={cn("h-full", className)}>
            <CodeMirror
                value={value}
                height="100%"
                basicSetup={false}
                extensions={extensions}
                theme={themeExtension}
                onChange={(nextValue) => onChange?.(nextValue)}
                className="h-full"
            />
        </div>
    );
}
