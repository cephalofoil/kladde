"use client";

import React, {
    useCallback,
    useState,
    useRef,
    useEffect,
    useImperativeHandle,
    forwardRef,
} from "react";
import {
    $convertFromMarkdownString,
    $convertToMarkdownString,
    TRANSFORMERS,
    CHECK_LIST,
    ElementTransformer,
} from "@lexical/markdown";
import {
    $getRoot,
    $getSelection,
    $isRangeSelection,
    LexicalNode,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import {
    HorizontalRuleNode,
    $createHorizontalRuleNode,
    $isHorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import type {
    LexicalEditor as LexicalEditorInstance,
    EditorState,
} from "lexical";

import { SlashMenuPlugin } from "./slash-menu-plugin";
import { FloatingToolbar } from "./floating-toolbar";
import { FloatingToolbarPlugin } from "./floating-toolbar-plugin";
import { cn } from "@/lib/utils";

// Professional Notion-like theme with proper spacing and typography
// Headings use Switzer font (via font-heading), body uses Outfit (via font-sans)
const theme = {
    heading: {
        h1: "text-3xl font-bold mb-3 mt-6 first:mt-0 leading-tight font-[var(--font-heading)]",
        h2: "text-2xl font-semibold mb-2 mt-5 first:mt-0 leading-tight font-[var(--font-heading)]",
        h3: "text-xl font-semibold mb-2 mt-4 first:mt-0 leading-tight font-[var(--font-heading)]",
    },
    paragraph: "mb-3 leading-relaxed min-h-[1.5rem]",
    list: {
        ul: "list-disc ml-6 mb-3 space-y-1",
        ol: "list-decimal ml-6 mb-3 space-y-1",
        checklist: "lexical-checklist mb-3 space-y-1",
        listitem: "leading-relaxed",
        listitemChecked: "lexical-checkbox-item lexical-checkbox-checked",
        listitemUnchecked: "lexical-checkbox-item",
        nested: {
            listitem: "list-none",
        },
    },
    quote: "border-l-4 border-primary/30 pl-4 py-2 my-3 italic text-muted-foreground bg-muted/20 rounded-r",
    code: "font-mono text-sm bg-muted/50 dark:bg-muted/30 px-4 py-3 rounded-lg block my-3 overflow-x-auto leading-relaxed",
    codeHighlight: {
        atrule: "text-purple-600 dark:text-purple-400",
        attr: "text-blue-600 dark:text-blue-400",
        boolean: "text-red-600 dark:text-red-400",
        builtin: "text-purple-600 dark:text-purple-400",
        cdata: "text-gray-600 dark:text-gray-500",
        char: "text-green-600 dark:text-green-400",
        class: "text-blue-600 dark:text-blue-400",
        "class-name": "text-blue-600 dark:text-blue-400",
        comment: "text-gray-500 dark:text-gray-500 italic",
        constant: "text-red-600 dark:text-red-400",
        deleted: "text-red-600 dark:text-red-400 line-through",
        doctype: "text-gray-600 dark:text-gray-500",
        entity: "text-orange-600 dark:text-orange-400",
        function: "text-blue-600 dark:text-blue-400",
        important: "text-red-600 dark:text-red-400 font-bold",
        inserted: "text-green-600 dark:text-green-400",
        keyword: "text-purple-600 dark:text-purple-400 font-semibold",
        namespace: "text-blue-600 dark:text-blue-400",
        number: "text-red-600 dark:text-red-400",
        operator: "text-foreground/70",
        prolog: "text-gray-600 dark:text-gray-500",
        property: "text-blue-600 dark:text-blue-400",
        punctuation: "text-foreground/60",
        regex: "text-green-600 dark:text-green-400",
        selector: "text-blue-600 dark:text-blue-400",
        string: "text-green-600 dark:text-green-400",
        symbol: "text-red-600 dark:text-red-400",
        tag: "text-red-600 dark:text-red-400",
        url: "text-blue-600 dark:text-blue-400 underline",
        variable: "text-orange-600 dark:text-orange-400",
    },
    link: "text-primary hover:text-primary/80 underline underline-offset-2 transition-colors cursor-pointer",
    text: {
        bold: "font-bold",
        italic: "italic",
        underline: "underline underline-offset-2",
        strikethrough: "line-through",
        code: "font-mono bg-muted/70 dark:bg-muted/40 px-1.5 py-0.5 rounded text-[0.9em] border border-border/50",
    },
    hr: "my-4 border-t-2 border-border",
};

const nodes = [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    CodeNode,
    CodeHighlightNode,
    LinkNode,
    AutoLinkNode,
    HorizontalRuleNode,
];

// Custom transformer for horizontal rules (---, ***, ___)
// The regex expects a trailing space because that's how MarkdownShortcutPlugin triggers element transformers
const HORIZONTAL_RULE_TRANSFORMER: ElementTransformer = {
    dependencies: [HorizontalRuleNode],
    export: (node) => {
        return $isHorizontalRuleNode(node) ? "---" : null;
    },
    regExp: /^(---|___|\*\*\*)\s$/,
    replace: (parentNode, _children, _match, isImport) => {
        const line = $createHorizontalRuleNode();
        if (isImport || parentNode.getNextSibling() != null) {
            parentNode.replace(line);
        } else {
            parentNode.insertBefore(line);
        }
        line.selectNext();
    },
    type: "element",
};

// Combined transformers with HR and CHECK_LIST support
// CHECK_LIST is exported by @lexical/markdown but NOT included in default TRANSFORMERS
// It must come before UNORDERED_LIST to match "- [ ]" before "- " is matched
const CUSTOM_TRANSFORMERS = [
    CHECK_LIST,
    ...TRANSFORMERS,
    HORIZONTAL_RULE_TRANSFORMER,
];

// URL matchers for AutoLinkPlugin
const URL_MATCHERS = [
    (text: string) => {
        const match = /https?:\/\/[^\s<>]+(?<![.,;:!?])/.exec(text);
        if (match) {
            return {
                index: match.index,
                length: match[0].length,
                text: match[0],
                url: match[0],
            };
        }
        return null;
    },
];

// Plugin to handle markdown import
function MarkdownImportPlugin({
    markdown,
    lastMarkdownRef,
}: {
    markdown?: string;
    lastMarkdownRef: React.MutableRefObject<string | undefined>;
}) {
    const [editor] = useLexicalComposerContext();

    React.useEffect(() => {
        const contentToImport = markdown ?? "";
        if (contentToImport === lastMarkdownRef.current) return;

        editor.update(() => {
            if (contentToImport) {
                $convertFromMarkdownString(
                    contentToImport,
                    CUSTOM_TRANSFORMERS,
                );
            } else {
                const root = $getRoot();
                root.clear();
                root.selectEnd();
            }
        });
        lastMarkdownRef.current = contentToImport;
    }, [editor, markdown, lastMarkdownRef]);

    return null;
}

// Plugin to handle onChange with markdown conversion (debounced for performance)
function MarkdownOnChangePlugin({
    onChange,
    lastMarkdownRef,
    flushRef,
}: {
    onChange?: (markdown: string) => void;
    lastMarkdownRef: React.MutableRefObject<string | undefined>;
    flushRef?: React.MutableRefObject<(() => void) | null>;
}) {
    const [editor] = useLexicalComposerContext();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Flush function to immediately save any pending changes
    const flush = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
            editor.getEditorState().read(() => {
                const markdown = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
                if (markdown !== lastMarkdownRef.current) {
                    lastMarkdownRef.current = markdown;
                    onChange?.(markdown);
                }
            });
        }
    }, [editor, onChange, lastMarkdownRef]);

    // Expose flush function via ref
    useEffect(() => {
        if (flushRef) {
            flushRef.current = flush;
        }
        return () => {
            if (flushRef) {
                flushRef.current = null;
            }
        };
    }, [flush, flushRef]);

    const handleChange = useCallback(
        (editorState: EditorState) => {
            // Debounce the onChange callback to avoid too many updates
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                editorState.read(() => {
                    const markdown =
                        $convertToMarkdownString(CUSTOM_TRANSFORMERS);

                    // Only call onChange if markdown actually changed
                    if (markdown !== lastMarkdownRef.current) {
                        lastMarkdownRef.current = markdown;
                        onChange?.(markdown);
                    }
                });
            }, 300); // 300ms debounce
        },
        [onChange, lastMarkdownRef],
    );

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return <OnChangePlugin onChange={handleChange} ignoreSelectionChange />;
}

// Plugin to handle markdown paste with smart detection
function MarkdownPastePlugin() {
    const [editor] = useLexicalComposerContext();

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return;

            const text = clipboardData.getData("text/plain");

            // Check if the pasted text looks like markdown
            const markdownIndicators = [
                /^#{1,6}\s/m, // Headers
                /^\*\s|\+\s|-\s/m, // Unordered lists
                /^\d+\.\s/m, // Ordered lists
                /\*\*.*?\*\*/, // Bold text
                /\*.*?\*/, // Italic text
                /\[.*?\]\(.*?\)/, // Links
                /```[\s\S]*?```/, // Code blocks
                /`.*?`/, // Inline code
                /^>\s/m, // Blockquotes
                /\|.*\|/m, // Tables
            ];

            const hasMarkdown = markdownIndicators.some((regex) =>
                regex.test(text),
            );

            if (hasMarkdown && text.length > 20) {
                // Only convert if it's substantial markdown content
                event.preventDefault();

                editor.update(() => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        // Clear current selection and insert markdown
                        selection.removeText();
                        $convertFromMarkdownString(text, CUSTOM_TRANSFORMERS);
                    }
                });
            }
        };

        const rootElement = editor.getRootElement();
        if (rootElement) {
            rootElement.addEventListener("paste", handlePaste);
            return () => {
                rootElement.removeEventListener("paste", handlePaste);
            };
        }
    }, [editor]);

    return null;
}

export interface EditorProps {
    content?: string;
    onChange?: (content: string) => void;
    onFinish?: () => void;
    readOnly?: boolean;
    autoFocus?: boolean;
    className?: string;
    contentClassName?: string;
    contentStyle?: React.CSSProperties;
    showBorder?: boolean;
    showFloatingToolbar?: boolean;
    toolbarVariant?: "floating" | "inline";
    toolbarVisible?: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
}

export interface EditorRef {
    exportMarkdown: () => string;
    importMarkdown: (markdown: string) => void;
    focus: () => void;
    blur: () => void;
    dispatchCommand: (command: unknown, payload: unknown) => void;
}

export const LexicalEditor = forwardRef<EditorRef, EditorProps>(
    (
        {
            content = "",
            onChange,
            onFinish,
            readOnly = false,
            autoFocus = false,
            className,
            contentClassName,
            contentStyle,
            showBorder = true,
            showFloatingToolbar = false,
            toolbarVariant = "floating",
            toolbarVisible = true,
            onFocus,
            onBlur,
        },
        ref,
    ) => {
        const editorRef = useRef<LexicalEditorInstance | null>(null);
        const lastMarkdownRef = useRef<string | undefined>(undefined);
        const flushChangesRef = useRef<(() => void) | null>(null);
        const [markdownContent, setMarkdownContent] = useState(content || "");

        // Keep local markdown state in sync with content prop
        React.useEffect(() => {
            if (content !== markdownContent) {
                setMarkdownContent(content || "");
            }
        }, [content, markdownContent]);

        const initialConfig = {
            namespace: "RichTextEditor",
            theme,
            nodes,
            onError: (error: Error) => {
                console.error("Lexical error:", error);
            },
            editable: !readOnly,
        };

        // Expose methods via ref
        useImperativeHandle(
            ref,
            () => ({
                exportMarkdown: () => {
                    if (!editorRef.current) return "";
                    let markdown = "";
                    editorRef.current.read(() => {
                        markdown =
                            $convertToMarkdownString(CUSTOM_TRANSFORMERS);
                    });
                    lastMarkdownRef.current = markdown;
                    return markdown;
                },
                importMarkdown: (markdown: string) => {
                    setMarkdownContent(markdown);
                    lastMarkdownRef.current = markdown;
                },
                focus: () => {
                    if (editorRef.current) {
                        editorRef.current.focus();
                    }
                },
                blur: () => {
                    if (editorRef.current) {
                        editorRef.current.blur();
                    }
                },
                dispatchCommand: (command: unknown, payload: unknown) => {
                    if (editorRef.current) {
                        editorRef.current.dispatchCommand(
                            command as never,
                            payload as never,
                        );
                    }
                },
            }),
            [],
        );

        const showToolbar = showFloatingToolbar && !readOnly;
        const renderInlineToolbar =
            showFloatingToolbar && toolbarVariant === "inline";
        const contentEditableStyle: React.CSSProperties = {
            ...contentStyle,
            caretColor: readOnly ? "transparent" : "auto",
        };

        return (
            <div className={cn("w-full h-full", className)}>
                <LexicalComposer initialConfig={initialConfig}>
                    <EditableStatePlugin editable={!readOnly} />
                    <div
                        className={cn(
                            "h-full flex flex-col overflow-hidden",
                            showBorder &&
                                "border border-gray-200 dark:border-gray-700 rounded-lg",
                        )}
                    >
                        {renderInlineToolbar && (
                            <div
                                className={cn(
                                    "h-10 border-b border-border bg-card/95 transition-opacity flex-shrink-0",
                                    toolbarVisible
                                        ? "opacity-100"
                                        : "opacity-0 pointer-events-none",
                                )}
                            >
                                <div className="h-full flex items-center px-2">
                                    <FloatingToolbar variant="inline" />
                                </div>
                            </div>
                        )}
                        <div className="relative flex-1 min-h-0">
                            <RichTextPlugin
                                contentEditable={
                                    <div
                                        data-canvas-interactive="true"
                                        onMouseDownCapture={(e) =>
                                            e.stopPropagation()
                                        }
                                        onMouseMoveCapture={(e) =>
                                            e.stopPropagation()
                                        }
                                        onMouseUpCapture={(e) =>
                                            e.stopPropagation()
                                        }
                                        onPointerDownCapture={(e) =>
                                            e.stopPropagation()
                                        }
                                        onPointerMoveCapture={(e) =>
                                            e.stopPropagation()
                                        }
                                        onPointerUpCapture={(e) =>
                                            e.stopPropagation()
                                        }
                                        onWheel={(e) => e.stopPropagation()}
                                        className="h-full w-full"
                                    >
                                        <ContentEditable
                                            className={cn(
                                                "h-full w-full px-3 py-2 outline-none resize-none overflow-auto",
                                                "prose prose-sm dark:prose-invert max-w-none",
                                                "prose-headings:font-bold prose-p:leading-relaxed",
                                                "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
                                                "prose-strong:font-bold prose-em:italic",
                                                "prose-code:bg-muted/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
                                                "prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border",
                                                "focus:ring-0 focus:outline-none",
                                                showFloatingToolbar &&
                                                    toolbarVariant ===
                                                        "floating" &&
                                                    "pt-12",
                                                readOnly &&
                                                    "bg-transparent cursor-default",
                                                contentClassName,
                                            )}
                                            style={contentEditableStyle}
                                            spellCheck="false"
                                        />
                                    </div>
                                }
                                placeholder={
                                    <div
                                        className={cn(
                                            "absolute left-3 text-gray-400 dark:text-gray-500 pointer-events-none select-none",
                                            showFloatingToolbar &&
                                                toolbarVariant === "floating"
                                                ? "top-12"
                                                : "top-2",
                                        )}
                                    >
                                        {readOnly
                                            ? content || "No content"
                                            : "Start typing... Use / for commands or Markdown shortcuts like # for headings"}
                                    </div>
                                }
                                ErrorBoundary={LexicalErrorBoundary}
                            />

                            {!readOnly && <SlashMenuPlugin />}
                            {!readOnly && toolbarVariant === "floating" && (
                                <FloatingToolbarPlugin show={showToolbar} />
                            )}
                        </div>
                    </div>

                    <HistoryPlugin />
                    <ListPlugin />
                    <CheckListPlugin />
                    <LinkPlugin />
                    <AutoLinkPlugin matchers={URL_MATCHERS} />
                    <HorizontalRulePlugin />
                    <MarkdownShortcutPlugin
                        transformers={CUSTOM_TRANSFORMERS}
                    />
                    <MarkdownOnChangePlugin
                        onChange={onChange}
                        lastMarkdownRef={lastMarkdownRef}
                        flushRef={flushChangesRef}
                    />
                    <MarkdownImportPlugin
                        markdown={markdownContent}
                        lastMarkdownRef={lastMarkdownRef}
                    />
                    {!readOnly && <MarkdownPastePlugin />}

                    <EditorRefPlugin editorRef={editorRef} />
                    {!readOnly && <AutoFocusPlugin autoFocus={autoFocus} />}
                    <FocusBlurPlugin
                        onFocus={onFocus}
                        onBlur={onBlur}
                        onFinish={onFinish}
                        flushChanges={() => flushChangesRef.current?.()}
                    />
                </LexicalComposer>
            </div>
        );
    },
);

// Plugin to store editor reference
function EditorRefPlugin({
    editorRef,
}: {
    editorRef: React.MutableRefObject<LexicalEditorInstance | null>;
}) {
    const [editor] = useLexicalComposerContext();

    React.useEffect(() => {
        editorRef.current = editor;
    }, [editor, editorRef]);

    return null;
}

function EditableStatePlugin({ editable }: { editable: boolean }) {
    const [editor] = useLexicalComposerContext();

    React.useEffect(() => {
        editor.setEditable(editable);
    }, [editor, editable]);

    return null;
}

// Plugin to handle auto-focus
function AutoFocusPlugin({ autoFocus }: { autoFocus: boolean }) {
    const [editor] = useLexicalComposerContext();

    React.useEffect(() => {
        if (autoFocus) {
            const timeoutId = setTimeout(() => {
                editor.focus();
            }, 100);

            return () => clearTimeout(timeoutId);
        }
    }, [editor, autoFocus]);

    return null;
}

// Plugin to handle focus and blur events
function FocusBlurPlugin({
    onFocus,
    onBlur,
    onFinish,
    flushChanges,
}: {
    onFocus?: () => void;
    onBlur?: () => void;
    onFinish?: () => void;
    flushChanges?: () => void;
}) {
    const [editor] = useLexicalComposerContext();

    React.useEffect(() => {
        const rootElement = editor.getRootElement();
        if (!rootElement) return;

        const handleFocus = () => {
            onFocus?.();
        };

        const handleBlur = () => {
            // Flush any pending debounced changes before triggering blur callbacks
            flushChanges?.();
            onBlur?.();
            onFinish?.();
        };

        rootElement.addEventListener("focus", handleFocus);
        rootElement.addEventListener("blur", handleBlur);

        return () => {
            rootElement.removeEventListener("focus", handleFocus);
            rootElement.removeEventListener("blur", handleBlur);
        };
    }, [editor, onFocus, onBlur, onFinish, flushChanges]);

    return null;
}

LexicalEditor.displayName = "LexicalEditor";
