"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  Copy,
  Eraser,
  LayoutGrid,
  RotateCcw,
  X,
} from "lucide-react";
import {
  MERMAID_PROMPT_GENERAL,
  MERMAID_PROMPT_VARIANTS,
  MermaidPromptVariantKey,
} from "@/lib/mermaid-prompts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [templateValue, setTemplateValue] = useState<string | undefined>(undefined);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canRestore, setCanRestore] = useState(false);
  const clearSnapshotRef = useRef<string>("");

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

  const handleTemplateSelect = (templateName: string, forceApply = false) => {
    setTemplateValue(templateName);
    const template = MERMAID_TEMPLATES.find((item) => item.name === templateName);
    if (template) {
      const shouldApply = forceApply || !code.trim();
      if (shouldApply) {
        setCode(template.code);
        if (canRestore) {
          setCanRestore(false);
          clearSnapshotRef.current = "";
        }
      }
    }
  };

  const templatePromptMap: Record<string, MermaidPromptVariantKey> = {
    Flowchart: "flowchart",
    "Sequence Diagram": "sequence",
  };

  const getPromptText = (variant?: MermaidPromptVariantKey) => {
    if (variant) {
      return `${MERMAID_PROMPT_GENERAL}\n\n${MERMAID_PROMPT_VARIANTS[variant]}`;
    }
    if (!templateValue) {
      return MERMAID_PROMPT_GENERAL;
    }
    const variantKey = templatePromptMap[templateValue];
    if (!variantKey) {
      return MERMAID_PROMPT_GENERAL;
    }
    return `${MERMAID_PROMPT_GENERAL}\n\n${MERMAID_PROMPT_VARIANTS[variantKey]}`;
  };

  const handleCopyPrompt = async (variant?: MermaidPromptVariantKey) => {
    try {
      await navigator.clipboard.writeText(getPromptText(variant));
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

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    if (canRestore && nextValue.trim()) {
      setCanRestore(false);
      clearSnapshotRef.current = "";
    }
    setCode(nextValue);
  };

  const handleClear = () => {
    if (!code.trim()) return;
    clearSnapshotRef.current = code;
    setCode("");
    setCanRestore(true);
  };

  const handleRestore = () => {
    if (!canRestore || !clearSnapshotRef.current) return;
    setCode(clearSnapshotRef.current);
    clearSnapshotRef.current = "";
    setCanRestore(false);
  };

  const editorHeight = Math.max(200, height - 100);
  const previewWidth = showPreview ? Math.floor(width * 0.5) : 0;
  const editorWidth = showPreview ? Math.floor(width * 0.5) : width;

  return (
    <div className={cn("flex flex-col h-full bg-transparent", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 pt-4 pb-2 text-foreground">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Mermaid Editor</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="h-7 px-2.5 text-xs rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors"
          >
            {showPreview ? "Hide" : "Show"} Preview
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1 h-7 px-2.5 text-xs rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors"
              >
                <Copy className="h-3 w-3" />
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "error"
                    ? "Copy failed"
                    : "Copy Prompt"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onClick={() => handleCopyPrompt()}>
                General prompt
              </DropdownMenuItem>
              {templateValue && templatePromptMap[templateValue] && (
                <DropdownMenuItem
                  onClick={() =>
                    handleCopyPrompt(templatePromptMap[templateValue])
                  }
                >
                  Selected template prompt
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleCopyPrompt("flowchart")}>
                Flowchart prompt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyPrompt("sequence")}>
                Sequence prompt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyPrompt("er")}>
                ER prompt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={canRestore ? handleRestore : handleClear}
            className="flex items-center gap-1 h-7 px-2.5 text-xs rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors"
            disabled={!code.trim() && !canRestore}
          >
            {canRestore ? (
              <>
                <RotateCcw className="h-3 w-3" />
                Restore
              </>
            ) : (
              <>
                <Eraser className="h-3 w-3" />
                Clear
              </>
            )}
          </button>
          {onCancel && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 h-7 px-2.5 text-xs text-muted-foreground hover:bg-muted rounded-md transition-colors"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1 h-7 px-2.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
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
            onChange={handleCodeChange}
            className="flex-1 w-full p-3 text-sm font-mono bg-background text-foreground rounded-md border border-border outline-none resize-none focus:border-ring focus:ring-0 scrollbar-thin scrollbar-thumb-muted-foreground/40 scrollbar-track-transparent"
            placeholder="Enter mermaid diagram code here..."
            spellCheck={false}
            style={{ height: editorHeight }}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="flex flex-col flex-1 min-w-0" style={{ width: previewWidth }}>
            <ScrollArea
              className="flex-1 bg-background rounded-md border border-border"
              showHorizontal
              scrollbarClassName="w-2 h-2"
              scrollbarThumbClassName="bg-muted-foreground/30 hover:bg-muted-foreground/50"
            >
              <div className="p-4">
                {code ? (
                  <MermaidRenderer
                    chart={code}
                    width={previewWidth - 32}
                    height={editorHeight - 50}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                      {MERMAID_TEMPLATES.map((template) => (
                        <button
                          key={template.name}
                          onClick={() => handleTemplateSelect(template.name, true)}
                          className="group flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-background/80 px-3 py-4 text-center text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                        >
                          <span className="flex items-center justify-center w-9 h-9 rounded-md border border-border bg-background">
                            <LayoutGrid className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {template.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Start with a {template.name.toLowerCase()} template
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground">
        Learn more about Mermaid syntax at{" "}
        <a
          href="https://mermaid.js.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          mermaid.js.org
        </a>
      </div>
    </div>
  );
}
