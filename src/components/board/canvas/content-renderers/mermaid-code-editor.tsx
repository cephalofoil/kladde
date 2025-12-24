"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
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

  const handleSave = () => {
    onSave(code);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleTemplateSelect = (templateCode: string) => {
    setCode(templateCode);
  };

  const editorHeight = Math.max(200, height - 100);
  const previewWidth = showPreview ? Math.floor(width * 0.5) : 0;
  const editorWidth = showPreview ? Math.floor(width * 0.5) : width;

  return (
    <div className={cn("flex flex-col h-full bg-slate-900 rounded", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 font-medium">Mermaid Editor</span>
          <select
            onChange={(e) => handleTemplateSelect(e.target.value)}
            value=""
            className="text-xs bg-slate-700 text-slate-200 rounded px-2 py-1 border-none outline-none"
          >
            <option value="" disabled>
              Insert Template...
            </option>
            {MERMAID_TEMPLATES.map((template) => (
              <option key={template.name} value={template.code}>
                {template.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded px-2 py-1 transition-colors"
          >
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            <Check className="h-3 w-3" />
            Save
          </button>
        </div>
      </div>

      {/* Editor and Preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* Code Editor */}
        <div className="flex flex-col border-r border-slate-700" style={{ width: editorWidth }}>
          <div className="px-3 py-1 bg-slate-800 border-b border-slate-700">
            <span className="text-xs text-slate-400">Code</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 bg-slate-900 text-slate-200 font-mono text-xs p-3 border-none outline-none resize-none"
            placeholder="Enter mermaid diagram code here..."
            spellCheck={false}
            style={{ height: editorHeight }}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="flex flex-col" style={{ width: previewWidth }}>
            <div className="px-3 py-1 bg-slate-800 border-b border-slate-700">
              <span className="text-xs text-slate-400">Preview</span>
            </div>
            <div className="flex-1 overflow-auto bg-white dark:bg-slate-950 p-4">
              {code ? (
                <MermaidRenderer chart={code} width={previewWidth - 32} height={editorHeight - 50} />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-500">
                  Type code to see preview
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="px-3 py-2 bg-slate-800 border-t border-slate-700 text-xs text-slate-400">
        Learn more about Mermaid syntax at{" "}
        <a
          href="https://mermaid.js.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          mermaid.js.org
        </a>
      </div>
    </div>
  );
}
