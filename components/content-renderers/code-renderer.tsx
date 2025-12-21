"use client";

import type React from "react";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-management-store";
import { useDebouncedTimer } from "@/hooks/use-debounced-timer";
import { DEBOUNCE_DELAYS } from "@/lib/constants";

interface CodeRendererProps {
  code: string;
  language: string;
  onFinish?: () => void;
  readOnly?: boolean;
  isEditing?: boolean;
  // Optional: store-backed editing
  draftKey?: string; // defaults to "code"
  commitPath?: string; // e.g. "/tiles/3/content/code"
  onChange?: (next: string) => void; // fallback if no commitPath
}

export function CodeRenderer({
  code,
  onFinish,
  readOnly = false,
  isEditing = false,
  draftKey = "code",
  commitPath,
  onChange,
}: CodeRendererProps) {
  const [currentCode, setCurrentCode] = useState(code);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const setDraft = useBoardStore((s) => s.setDraft);
  const commitDraft = useBoardStore((s) => s.commitDraft);
  const [isComposing, setIsComposing] = useState(false);
  const { schedule: scheduleCommit } = useDebouncedTimer(
    DEBOUNCE_DELAYS.EDITOR,
  );

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setCurrentCode(code);
  }, [code]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCurrentCode(newCode);
    if (commitPath) {
      setDraft(draftKey, newCode);
      if (!isComposing) {
        scheduleCommit(() => commitDraft(draftKey, commitPath));
      }
    } else {
      onChange?.(newCode);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onFinish?.();
      return;
    }

    // Handle tab indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue =
        currentCode.substring(0, start) + "  " + currentCode.substring(end);
      setCurrentCode(newValue);
      if (commitPath) {
        setDraft(draftKey, newValue);
        if (!isComposing) commitDraft(draftKey, commitPath);
      } else {
        onChange?.(newValue);
      }

      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }

    // Stop propagation to prevent canvas interactions
    e.stopPropagation();
  };

  const handleBlur = () => {
    onFinish?.();
  };

  const escapeHTML = (s: string) =>
    s.replace(
      /[&<>]/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch] as string,
    );

  const highlightSyntax = (code: string) => {
    if (!code) return "";
    // Escape first to prevent HTML injection
    let highlighted = escapeHTML(code);

    // Comments
    highlighted = highlighted.replace(
      /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
      '<span style="color: #6b7280; font-style: italic;">$1</span>',
    );

    // Strings
    highlighted = highlighted.replace(
      /(['"`])((?:(?!\1)[^\\]|\\.)*)(\1)/g,
      '<span style="color: #059669;">$1$2$3</span>',
    );

    // Keywords
    const keywords = [
      "function",
      "const",
      "let",
      "var",
      "if",
      "else",
      "for",
      "while",
      "return",
      "class",
      "import",
      "export",
      "from",
      "async",
      "await",
    ];
    keywords.forEach((keyword) => {
      highlighted = highlighted.replace(
        new RegExp(`\\b${keyword}\\b`, "g"),
        `<span style="color: #7c3aed; font-weight: 600;">${keyword}</span>`,
      );
    });

    return highlighted;
  };

  if (readOnly) {
    return (
      <div className="w-full h-full p-2 text-xs font-mono leading-relaxed overflow-auto bg-slate-900 text-slate-100 rounded whitespace-pre">
        <div
          dangerouslySetInnerHTML={{
            __html: highlightSyntax(code || "// Your code here"),
          }}
        />
      </div>
    );
  }

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={currentCode}
        onChange={handleChange}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={(e) => {
          setIsComposing(false);
          if (commitPath) {
            setDraft(draftKey, e.currentTarget.value);
            scheduleCommit(() => commitDraft(draftKey, commitPath));
          } else {
            onChange?.(e.currentTarget.value);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          "w-full h-full p-2 text-xs font-mono leading-relaxed resize-none border-none outline-none",
          "bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded",
        )}
        placeholder="Enter your code..."
        spellCheck={false}
      />
    );
  }

  return (
    <div className="w-full h-full p-2 text-xs font-mono leading-relaxed overflow-auto bg-slate-900 text-slate-100 rounded whitespace-pre">
      <div
        dangerouslySetInnerHTML={{
          __html: highlightSyntax(currentCode || "// Your code here"),
        }}
      />
    </div>
  );
}
