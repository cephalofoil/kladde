"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Copy, X } from "lucide-react";
import {
  MERMAID_PROMPT_GENERAL,
  MERMAID_PROMPT_VARIANTS,
  MermaidPromptVariantKey,
} from "@/lib/mermaid-prompts";
import { MermaidRenderer } from "./mermaid-renderer";

interface MermaidCodeEditorProps {
  initialCode: string;
  onSave: (code: string) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
  className?: string;
}

const MERMAID_TEMPLATES = [
  {
    name: "Flowchart",
    code: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
  },
  {
    name: "Sequence Diagram",
    code: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B->>A: Hello Alice!`,
  },
  {
    name: "Class Diagram",
    code: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog`,
  },
  {
    name: "State Diagram",
    code: `stateDiagram-v2
    [*] --> Still
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
  },
];

export function MermaidCodeEditor({
  initialCode,
  onSave,
  onCancel,
  width = 800,
  height = 600,
  className,
}: MermaidCodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [showPreview, setShowPreview] = useState(true);
  const [templateValue, setTemplateValue] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = () => {
    onSave(code);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleTemplateSelect = (templateName: string) => {
    setTemplateValue(templateName);
    const template = MERMAID_TEMPLATES.find((item) => item.name === templateName);
    if (template) {
      setCode(template.code);
    }
  };

  const templatePromptMap: Record<string, MermaidPromptVariantKey> = {
    Flowchart: "flowchart",
    "Sequence Diagram": "sequence",
  };

  const getPromptText = () => {
    const variantKey = templatePromptMap[templateValue];
    if (!variantKey) {
      return MERMAID_PROMPT_GENERAL;
    }
    return `${MERMAID_PROMPT_GENERAL}\n\n${MERMAID_PROMPT_VARIANTS[variantKey]}`;
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(getPromptText());
      setCopyState("copied");
    } catch {
      setCopyState("error");
    } finally {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopyState("idle");
      }, 2000);
    }
  };

  const editorHeight = Math.max(200, height - 100);
  const previewWidth = showPreview ? Math.floor(width * 0.5) : 0;
  const editorWidth = showPreview ? Math.floor(width * 0.5) : width;

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-transparent",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Mermaid Editor</span>
          <select
            onChange={(e) => handleTemplateSelect(e.target.value)}
            value={templateValue}
            className="h-7 text-xs bg-white text-gray-700 rounded-md px-2 border border-gray-200 outline-none focus:border-gray-300 focus:ring-0"
          >
            <option value="" disabled>
              Insert Template...
            </option>
            {MERMAID_TEMPLATES.map((template) => (
              <option key={template.name} value={template.name}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="h-7 px-2.5 text-xs rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-gray-100 transition-colors"
          >
            {showPreview ? "Hide" : "Show"} Preview
          </button>
          <button
            onClick={handleCopyPrompt}
            className="flex items-center gap-1 h-7 px-2.5 text-xs rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-gray-100 transition-colors"
          >
            <Copy className="h-3 w-3" />
            {copyState === "copied"
              ? "Copied"
              : copyState === "error"
                ? "Copy failed"
                : "Copy Prompt"}
          </button>
          {onCancel && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 h-7 px-2.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1 h-7 px-2.5 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-md transition-colors"
          >
            <Check className="h-3 w-3" />
            Save
          </button>
        </div>
      </div>

      {/* Editor and Preview */}
      <div className="flex flex-1 gap-3 px-3 pb-3 overflow-hidden">
        {/* Code Editor */}
        <div
          className="flex flex-col flex-1 min-w-0"
          style={{ width: editorWidth }}
        >
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 w-full p-3 text-sm font-mono text-gray-900 bg-white rounded-md border border-gray-200 outline-none resize-none focus:border-gray-300 focus:ring-0"
            placeholder="Enter mermaid diagram code here..."
            spellCheck={false}
            style={{ height: editorHeight }}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="flex flex-col flex-1 min-w-0" style={{ width: previewWidth }}>
            <div className="flex-1 overflow-auto bg-white rounded-md border border-gray-200 p-4">
              {code ? (
                <MermaidRenderer
                  chart={code}
                  width={previewWidth - 32}
                  height={editorHeight - 50}
                  className="w-full h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-500">
                  Type code to see preview
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="px-3 py-2 border-t border-gray-200 text-xs text-gray-500">
        Learn more about Mermaid syntax at{" "}
        <a
          href="https://mermaid.js.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:underline"
        >
          mermaid.js.org
        </a>
      </div>
    </div>
  );
}
