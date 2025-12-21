/// <reference lib="WebWorker" />
export {};
declare const self: DedicatedWorkerGlobalScope;

import { createHeadlessEditor } from "@lexical/headless";
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { LinkNode, AutoLinkNode } from "@lexical/link";

// Create editor once and reuse for better performance
const editor = createHeadlessEditor({
  namespace: "kladde",
  nodes: [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    CodeNode,
    CodeHighlightNode,
    LinkNode,
    AutoLinkNode,
  ],
  onError: (error) => {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
      // Include stack in development for better debugging
      stack: error instanceof Error ? error.stack : undefined,
    });
  },
});

self.onmessage = (e: MessageEvent) => {
  const { type, payload, id } = e.data ?? {};
  if (type !== "markdownExport") return;
  if (payload == null) {
    self.postMessage({ type: "error", id, message: "Missing payload" });
    return;
  }
  try {
    const state = editor.parseEditorState(payload);
    editor.setEditorState(state);
    const markdown = editor.read(() => $convertToMarkdownString(TRANSFORMERS));
    self.postMessage({ type: "markdown", id, content: markdown });
  } catch (err) {
    self.postMessage({
      type: "error",
      id,
      message: (err as Error)?.message ?? "Unknown worker error",
    });
  }
};

// Handle structured-clone/message errors
self.onmessageerror = (ev: MessageEvent) => {
  self.postMessage({ type: "error", message: String(ev) });
};
