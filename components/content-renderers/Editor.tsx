"use client";

import React, {
  useCallback,
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { DEBOUNCE_DELAYS } from "@/lib/constants";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { $getRoot, $getSelection, $isRangeSelection } from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import type { LexicalEditor } from "lexical";

import { SlashMenuPlugin } from "./SlashMenuPlugin";
import { FloatingToolbarPlugin } from "./FloatingToolbarPlugin";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-management-store";

const theme = {
  heading: {
    h1: "text-3xl font-bold mb-2 min-h-[3rem]",
    h2: "text-2xl font-semibold mb-2 min-h-[2.5rem]",
    h3: "text-xl font-semibold mb-2 min-h-[2rem]",
  },
  paragraph: "mb-2 min-h-[1.5rem]",
  list: {
    ul: "list-disc ml-6 min-h-[2rem]",
    ol: "list-decimal ml-6 min-h-[2rem]",
    listitem: "my-1 min-h-[1.5rem]",
  },
  quote: "border-l-4 border-gray-300 pl-3 italic opacity-90 my-2 min-h-[2rem]",
  code: "font-mono text-sm bg-neutral-100 p-2 rounded block my-2 min-h-[3rem]",
  codeHighlight: {
    atrule: "text-purple-600",
    attr: "text-blue-600",
    boolean: "text-red-600",
    builtin: "text-purple-600",
    cdata: "text-gray-600",
    char: "text-green-600",
    class: "text-blue-600",
    "class-name": "text-blue-600",
    comment: "text-gray-500",
    constant: "text-red-600",
    deleted: "text-red-600",
    doctype: "text-gray-600",
    entity: "text-orange-600",
    function: "text-blue-600",
    important: "text-red-600",
    inserted: "text-green-600",
    keyword: "text-purple-600",
    namespace: "text-blue-600",
    number: "text-red-600",
    operator: "text-gray-700",
    prolog: "text-gray-600",
    property: "text-blue-600",
    punctuation: "text-gray-700",
    regex: "text-green-600",
    selector: "text-blue-600",
    string: "text-green-600",
    symbol: "text-red-600",
    tag: "text-red-600",
    url: "text-blue-600",
    variable: "text-orange-600",
  },
  link: "text-blue-600 underline",
  text: {
    bold: "font-semibold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "font-mono bg-neutral-100 px-1 rounded",
  },
};

const nodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
];

// Plugin to handle autosave
function AutoSavePlugin({
  draftKey = "editor",
  targetPath = "/content",
  lastMarkdownRef,
  isComposing,
  onChange,
}: {
  draftKey?: string;
  targetPath?: string;
  lastMarkdownRef: React.MutableRefObject<string | undefined>;
  isComposing: boolean;
  onChange?: (content: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const setDraft = useBoardStore((s) => s.setDraft);
  const commitDraft = useBoardStore((s) => s.commitDraft);
  const workerRef = useRef<Worker | null>(null);
  const composingRef = useRef(isComposing);

  useEffect(() => {
    composingRef.current = isComposing;
  }, [isComposing]);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../../workers/autosave-worker.ts", import.meta.url),
    );
    workerRef.current.onmessage = (e: MessageEvent) => {
      if (e.data.type === "markdown") {
        const markdown = e.data.content as string;
        lastMarkdownRef.current = markdown;

        // Call onChange callback for tile content updates
        if (onChange && !composingRef.current) {
          onChange(markdown);
        }

        // Use the board management store for drafts
        setDraft(draftKey, markdown);
        if (!composingRef.current) commitDraft(draftKey, targetPath);
      }
    };
    return () => workerRef.current?.terminate();
  }, [draftKey, targetPath, setDraft, commitDraft, lastMarkdownRef, onChange]);

  const handleChange = useCallback(() => {
    const run = () => {
      const json = editor.getEditorState().toJSON();
      workerRef.current?.postMessage({ type: "markdownExport", payload: json });
    };
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(run);
    } else {
      setTimeout(run, 0);
    }
  }, [editor]);

  return <OnChangePlugin onChange={handleChange} />;
}

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
    // Handle both undefined/null and string content (including empty strings)
    const contentToImport = markdown ?? "";
    if (contentToImport === lastMarkdownRef.current) return;

    editor.update(() => {
      if (contentToImport) {
        // Import markdown content
        $convertFromMarkdownString(contentToImport, TRANSFORMERS);
      } else {
        // Clear editor for empty content
        const root = $getRoot();
        root.clear();
        root.selectEnd();
      }
    });
    lastMarkdownRef.current = contentToImport;
  }, [editor, markdown, lastMarkdownRef]);

  return null;
}

// Plugin to handle markdown paste
function MarkdownPastePlugin() {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      const text = clipboardData.getData('text/plain');
      
      // Check if the pasted text looks like markdown
      const markdownIndicators = [
        /^#{1,6}\s/m,           // Headers
        /^\*\s|\+\s|-\s/m,      // Unordered lists
        /^\d+\.\s/m,            // Ordered lists
        /\*\*.*?\*\*/,          // Bold text
        /\*.*?\*/,              // Italic text
        /\[.*?\]\(.*?\)/,       // Links
        /```[\s\S]*?```/,       // Code blocks
        /`.*?`/,                // Inline code
        /^>\s/m,                // Blockquotes
        /\|.*\|/m,              // Tables
      ];

      const hasMarkdown = markdownIndicators.some(regex => regex.test(text));
      
      if (hasMarkdown && text.length > 20) { // Only convert if it's substantial markdown content
        event.preventDefault();
        
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            // Clear current selection and insert markdown
            selection.removeText();
            $convertFromMarkdownString(text, TRANSFORMERS);
          }
        });
      }
    };

    const rootElement = editor.getRootElement();
    if (rootElement) {
      rootElement.addEventListener('paste', handlePaste);
      return () => {
        rootElement.removeEventListener('paste', handlePaste);
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
  showBorder?: boolean;
  showToolbar?: boolean;
  showFloatingToolbar?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  boardId?: string;
  tileId?: string;
}

export interface EditorRef {
  exportMarkdown: () => string;
  importMarkdown: (markdown: string) => void;
  focus: () => void;
  blur: () => void;
}

export const Editor = forwardRef<EditorRef, EditorProps>(
  (
    {
      content = "",
      onChange,
      readOnly = false,
      autoFocus = false,
      className,
      showBorder = true,
      showFloatingToolbar = false,
      onFocus,
      onBlur,
      boardId,
      tileId,
    },
    ref,
  ) => {
    const [isMarkdownMode, setIsMarkdownMode] = useState(false);
    const [markdownContent, setMarkdownContent] = useState(content || "");
    const editorRef = useRef<LexicalEditor | null>(null);
    const lastMarkdownRef = useRef<string | undefined>(undefined);
    const [isComposing, setIsComposing] = useState(false);

    // Keep local markdown state in sync with content prop so updates from
    // persistence are loaded into the editor.
    React.useEffect(() => {
      if (!isMarkdownMode && content !== markdownContent) {
        setMarkdownContent(content || "");
      }
    }, [content, isMarkdownMode, markdownContent]);

    if (process.env.NODE_ENV !== "production") {
      console.debug("Editor init", {
        contentLength: content?.length ?? 0,
        markdownContentLength: markdownContent.length,
      });
    }

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
            markdown = $convertToMarkdownString(TRANSFORMERS);
          });
          lastMarkdownRef.current = markdown;
          return markdown;
        },
        importMarkdown: (markdown: string) => {
          setMarkdownContent(markdown);
          lastMarkdownRef.current = markdown;
          setIsMarkdownMode(true);
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
      }),
      [],
    );

    const handleMarkdownSubmit = useCallback(() => {
      setIsMarkdownMode(false);
      // The markdown will be imported via the MarkdownImportPlugin
    }, []);

    if (isMarkdownMode) {
      return (
        <div className={cn("w-full h-full p-4 bg-white", className)}>
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Import Markdown</h3>
            <textarea
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              className="w-full h-64 p-2 border border-gray-300 rounded font-mono text-sm"
              placeholder="Paste your Markdown content here..."
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleMarkdownSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Import
              </button>
              <button
                onClick={() => setIsMarkdownMode(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("w-full h-full", className)}>
        <LexicalComposer initialConfig={initialConfig}>
          <div
            className={cn(
              "h-full flex flex-col overflow-hidden",
              showBorder && "border border-gray-200 rounded-lg",
            )}
          >
            <div className="relative flex-1 min-h-0">
              <RichTextPlugin
                contentEditable={
                  <div
                    onWheel={(e) => e.stopPropagation()}
                    className="h-full w-full"
                  >
                    <ContentEditable
                      className={cn(
                        "h-full w-full p-4 outline-none resize-none overflow-auto",
                        "prose prose-sm max-w-none",
                        "focus:ring-0 focus:outline-none",
                        showFloatingToolbar && "pt-12", // Add top padding when floating toolbar is shown
                        readOnly && "bg-gray-50 cursor-default",
                      )}
                      style={{
                        caretColor: readOnly ? "transparent" : "auto",
                      }}
                      spellCheck="false"
                      onCompositionStart={() => setIsComposing(true)}
                      onCompositionEnd={() => setIsComposing(false)}
                    />
                  </div>
                }
                placeholder={
                  <div
                    className={cn(
                      "absolute left-4 text-gray-400 pointer-events-none select-none",
                      showFloatingToolbar ? "top-12" : "top-4",
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
              {!readOnly && (
                <FloatingToolbarPlugin show={showFloatingToolbar} />
              )}
            </div>
          </div>

          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <AutoSavePlugin
            draftKey={boardId && tileId ? `${boardId}:${tileId}` : "editor"}
            targetPath={
              boardId && tileId ? `/tiles/${tileId}/content/text` : "/content"
            }
            lastMarkdownRef={lastMarkdownRef}
            isComposing={isComposing}
            onChange={onChange}
          />
          <MarkdownImportPlugin
            markdown={markdownContent}
            lastMarkdownRef={lastMarkdownRef}
          />
          {!readOnly && <MarkdownPastePlugin />}

          {/* Store editor ref */}
          <EditorRefPlugin editorRef={editorRef} />
          {/* Auto-focus when not in readOnly mode */}
          {!readOnly && <AutoFocusPlugin autoFocus={autoFocus} />}
          {/* Handle focus and blur events */}
          <FocusBlurPlugin onFocus={onFocus} onBlur={onBlur} />
        </LexicalComposer>
      </div>
    );
  },
);

// Plugin to store editor reference
function EditorRefPlugin({
  editorRef,
}: {
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);

  return null;
}

// Plugin to handle auto-focus
function AutoFocusPlugin({ autoFocus }: { autoFocus: boolean }) {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    if (autoFocus) {
      // Delay focus to ensure the editor is fully mounted
      const timeoutId = setTimeout(() => {
        editor.focus();
      }, DEBOUNCE_DELAYS.AUTO_FOCUS);

      return () => clearTimeout(timeoutId);
    }
  }, [editor, autoFocus]);

  return null;
}

// Plugin to handle focus and blur events
function FocusBlurPlugin({
  onFocus,
  onBlur,
}: {
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleFocus = () => {
      onFocus?.();
    };

    const handleBlur = () => {
      onBlur?.();
    };

    rootElement.addEventListener("focus", handleFocus);
    rootElement.addEventListener("blur", handleBlur);

    return () => {
      rootElement.removeEventListener("focus", handleFocus);
      rootElement.removeEventListener("blur", handleBlur);
    };
  }, [editor, onFocus, onBlur]);

  return null;
}

Editor.displayName = "Editor";
