"use client";

import dynamic from "next/dynamic";
import type React from "react";
import { useRef, forwardRef, useImperativeHandle } from "react";
import type { EditorRef } from "./Editor";
import { useBoardStore } from "@/stores/board-management-store";

// Dynamic import to avoid SSR issues with Lexical
const Editor = dynamic(
  () => import("./Editor").then((mod) => ({ default: mod.Editor })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[200px] flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50">
        <div className="text-gray-500">Loading editor...</div>
      </div>
    ),
  },
);

interface RichTextRendererProps {
  content: string;
  onChange?: (content: string) => void;
  onFinish?: () => void;
  readOnly?: boolean;
  autoFocus?: boolean;
  showBorder?: boolean;
  showToolbar?: boolean;
  showFloatingToolbar?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  boardId?: string;
  tileId?: string;
}

export const RichTextRenderer = forwardRef<EditorRef, RichTextRendererProps>(
  (
    {
      content,
      onChange,
      onFinish,
      readOnly = false,
      autoFocus = false,
      showBorder = true,
      showToolbar = true,
      showFloatingToolbar = false,
      onFocus,
      onBlur,
      boardId,
      tileId,
    },
    ref,
  ) => {
    const editorRef = useRef<EditorRef>(null);
    const status = useBoardStore((s) => s.status);

    // Forward the ref to the Editor component
    useImperativeHandle(
      ref,
      () => ({
        exportMarkdown: () => editorRef.current?.exportMarkdown() || "",
        importMarkdown: (markdown: string) =>
          editorRef.current?.importMarkdown(markdown),
        focus: () => editorRef.current?.focus(),
        blur: () => editorRef.current?.blur(),
      }),
      [],
    );

    // Initialize with content if provided and not in readOnly mode
    const initialContent = content || "";
    // Gate logging to avoid PII leakage in production
    if (process.env.NODE_ENV !== "production") {
      console.debug("RichTextRenderer init", {
        contentLength: content?.length ?? 0,
        initialContentLength: initialContent.length,
      });
    }

    // Always show editor in edit mode, no double-click required
    return (
      <div className="w-full h-full">
        <Editor
          ref={editorRef}
          content={initialContent}
          onChange={(text) => {
            onChange?.(text);
          }}
          onFinish={onFinish}
          readOnly={readOnly}
          autoFocus={autoFocus && !readOnly}
          showBorder={showBorder}
          showToolbar={showToolbar}
          showFloatingToolbar={showFloatingToolbar}
          onFocus={onFocus}
          onBlur={onBlur}
          boardId={boardId}
          tileId={tileId}
        />
        <div
          aria-live="polite"
          role="status"
          className="text-xs text-gray-500 mt-1"
        >
          {status === "syncing"
            ? "Saving..."
            : status === "saving-local"
              ? "Saving locally..."
              : status === "queued-remote"
                ? "Saved locally"
                : status === "error"
                  ? "Sync failed — retrying…"
                  : "Synced"}
        </div>
      </div>
    );
  },
);

RichTextRenderer.displayName = "RichTextRenderer";
