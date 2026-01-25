"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";

interface MarkdownEditorProps {
  content: string;
  onChange?: (content: string) => void;
  onFinish?: () => void;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function MarkdownEditor({
  content,
  onChange,
  onFinish,
  readOnly = false,
  autoFocus = false,
  className,
}: MarkdownEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const [showToolbar, setShowToolbar] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const parseMarkdown = (text: string): string => {
    if (!text) return "";

    // Split by lines to handle block-level elements
    const lines = text.split("\n");
    const parsed = lines.map((line) => {
      let html = line;

      // Headers (must be at start of line)
      if (html.match(/^### /)) {
        html = html.replace(
          /^### (.+)$/,
          '<h3 class="text-lg font-bold">$1</h3>',
        );
      } else if (html.match(/^## /)) {
        html = html.replace(
          /^## (.+)$/,
          '<h2 class="text-xl font-bold">$1</h2>',
        );
      } else if (html.match(/^# /)) {
        html = html.replace(
          /^# (.+)$/,
          '<h1 class="text-2xl font-bold">$1</h1>',
        );
      }
      // Unordered list
      else if (html.match(/^[-*] /)) {
        html = html.replace(/^[-*] (.+)$/, '<li class="ml-4">• $1</li>');
      }
      // Ordered list
      else if (html.match(/^\d+\. /)) {
        html = html.replace(/^(\d+)\. (.+)$/, '<li class="ml-4">$1. $2</li>');
      }
      // Empty line - preserve as line break
      else if (!html.trim()) {
        html = "<br />";
      }
      // Regular paragraph
      else {
        html = `<p>${html}</p>`;
      }

      // Inline formatting (works anywhere in the line)
      // Bold
      html = html.replace(
        /\*\*(.+?)\*\*/g,
        '<strong class="font-bold">$1</strong>',
      );
      html = html.replace(
        /__(.+?)__/g,
        '<strong class="font-bold">$1</strong>',
      );

      // Italic
      html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
      html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>');

      // Strikethrough
      html = html.replace(/~~(.+?)~~/g, '<del class="line-through">$1</del>');

      // Inline code
      html = html.replace(
        /`(.+?)`/g,
        '<code class="bg-gray-200 dark:bg-neutral-700 px-1 rounded text-sm">$1</code>',
      );

      return html;
    });

    return parsed.join("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalContent(newValue);
    onChange?.(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onFinish?.();
      return;
    }

    // Handle Tab for indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue =
        localContent.substring(0, start) + "  " + localContent.substring(end);
      setLocalContent(newValue);
      onChange?.(newValue);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const insertMarkdown = (prefix: string, suffix: string = "") => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localContent.substring(start, end);

    let newValue: string;
    let newCursorPos: number;

    if (selectedText) {
      // Wrap selected text
      newValue =
        localContent.substring(0, start) +
        prefix +
        selectedText +
        suffix +
        localContent.substring(end);
      newCursorPos =
        start + prefix.length + selectedText.length + suffix.length;
    } else {
      // Insert at cursor
      newValue =
        localContent.substring(0, start) +
        prefix +
        suffix +
        localContent.substring(end);
      newCursorPos = start + prefix.length;
    }

    setLocalContent(newValue);
    onChange?.(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    }, 0);
  };

  const insertHeading = (level: number) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const lines = localContent.split("\n");
    let currentLine = 0;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= start) {
        currentLine = i;
        break;
      }
      charCount += lines[i].length + 1; // +1 for newline
    }

    const line = lines[currentLine];
    const headingPrefix = "#".repeat(level) + " ";

    // Remove existing heading if any
    const cleanedLine = line.replace(/^#+\s/, "");
    lines[currentLine] = headingPrefix + cleanedLine;

    const newValue = lines.join("\n");
    setLocalContent(newValue);
    onChange?.(newValue);

    setTimeout(() => {
      textarea.focus();
    }, 0);
  };

  if (readOnly) {
    return (
      <div
        className={cn(
          "w-full h-full overflow-auto prose prose-sm dark:prose-invert max-w-none",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Floating Toolbar */}
      {showToolbar && (
        <div
          className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-1 w-fit"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => insertHeading(1)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertHeading(2)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertHeading(3)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <button
            onClick={() => insertMarkdown("**", "**")}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown("*", "*")}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown("~~", "~~")}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown("`", "`")}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            title="Inline Code"
          >
            <Code className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <button
            onClick={() => insertMarkdown("- ")}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown("1. ")}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor and Preview Side by Side */}
      <div className="flex flex-col h-full">
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onFocus={() => setShowToolbar(true)}
          onBlur={(e) => {
            // Don't hide toolbar if clicking on toolbar buttons
            if (e.relatedTarget?.closest(".absolute.top-2")) {
              return;
            }
            setShowToolbar(false);
            onFinish?.();
          }}
          className={cn(
            "w-full flex-1 bg-transparent border-none outline-none resize-none p-2",
            "text-sm text-gray-900 dark:text-gray-100 font-mono",
            "placeholder:text-gray-400 dark:placeholder:text-gray-500",
            showToolbar && "pt-14", // Add padding when toolbar is visible
            className,
          )}
          placeholder="Type markdown here... (e.g., # Heading, **bold**, *italic*)"
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
}
