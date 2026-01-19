"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  Eraser,
  Eye,
  ExternalLink,
  GitBranch,
  MessagesSquare,
  Boxes,
  Activity,
  Maximize2,
  RotateCcw,
  Sparkles,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MermaidRenderer } from "./mermaid-renderer";

interface MermaidCodeEditorProps {
  initialCode: string;
  onSave: (code: string) => void;
  onCancel?: () => void;
  onExpand?: () => void;
  width?: number;
  height?: number;
  tileTitle?: string;
  isEditingTitle?: boolean;
  onStartTitleEdit?: () => void;
  onTitleChange?: (value: string) => void;
  onFinishTitleEdit?: () => void;
  className?: string;
}

const MERMAID_TEMPLATES = [
  {
    name: "Flowchart",
    icon: <GitBranch className="w-4 h-4" />,
    description: "Create flow diagrams with decisions and processes",
    code: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
  },
  {
    name: "Sequence",
    icon: <MessagesSquare className="w-4 h-4" />,
    description: "Show interactions between participants over time",
    code: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B->>A: Hello Alice!`,
  },
  {
    name: "Class",
    icon: <Boxes className="w-4 h-4" />,
    description: "Define classes and their relationships",
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
    name: "State",
    icon: <Activity className="w-4 h-4" />,
    description: "Model state transitions and behaviors",
    code: `stateDiagram-v2
    [*] --> Still
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
  },
];

const PROMPT_OPTIONS: Array<{ key: MermaidPromptVariantKey | "general"; label: string }> = [
  { key: "general", label: "General" },
  { key: "flowchart", label: "Flowchart" },
  { key: "sequence", label: "Sequence" },
  { key: "er", label: "ER Diagram" },
];

export function MermaidCodeEditor({
  initialCode,
  onSave,
  onCancel,
  onExpand,
  height = 600,
  tileTitle,
  isEditingTitle = false,
  onStartTitleEdit,
  onTitleChange,
  onFinishTitleEdit,
  className,
}: MermaidCodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [showPreview, setShowPreview] = useState(true);
  const [templateValue, setTemplateValue] = useState<string | undefined>(
    undefined,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
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
    Sequence: "sequence",
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

  const editorHeight = Math.max(200, height - 120);

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex flex-col h-full bg-background", className)}>
        <div className="flex items-center justify-between px-3 h-12 border-b-2 border-border bg-card/95">
          <div className="flex items-center gap-3 min-w-0">
            {tileTitle ? (
              isEditingTitle ? (
                <input
                  type="text"
                  value={tileTitle}
                  onChange={(e) => onTitleChange?.(e.target.value)}
                  onBlur={onFinishTitleEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onFinishTitleEdit?.();
                    if (e.key === "Escape") onFinishTitleEdit?.();
                    e.stopPropagation();
                  }}
                  className="flex-1 bg-transparent text-base font-semibold border-none outline-none"
                  placeholder="Enter title..."
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={onStartTitleEdit}
                  className="text-base font-semibold text-foreground truncate hover:text-foreground/80 transition-colors"
                >
                  {tileTitle}
                </button>
              )
            ) : (
              <span className="text-sm font-semibold text-foreground">
                Mermaid Editor
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center p-0.5 rounded-lg bg-muted/50 mr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowPreview(false)}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-md transition-all",
                      !showPreview
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Code2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Code only</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowPreview(true)}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-md transition-all",
                      showPreview
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Split view</TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={canRestore ? handleRestore : handleClear}
                  disabled={!code.trim() && !canRestore}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                    "text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {canRestore ? (
                    <RotateCcw className="w-4 h-4" />
                  ) : (
                    <Eraser className="w-4 h-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {canRestore ? "Restore code" : "Clear code"}
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                        "text-muted-foreground hover:text-foreground hover:bg-muted",
                        copyState === "copied" && "text-emerald-500",
                      )}
                    >
                      {copyState === "copied" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Copy AI prompt</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-44">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Copy prompt for
                </div>
                {PROMPT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.key}
                    onClick={() =>
                      option.key === "general"
                        ? handleCopyPrompt()
                        : handleCopyPrompt(option.key)
                    }
                    className="text-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {onExpand && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onExpand}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Fullscreen</TooltipContent>
              </Tooltip>
            )}

            <div className="w-px h-6 bg-border mx-1" />

            {onCancel && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 h-8 px-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}

            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 h-8 px-4 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div
            className={cn(
              "flex flex-col min-w-0 transition-all duration-300",
              showPreview ? "w-1/2" : "w-full",
            )}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Code
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Templates
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {MERMAID_TEMPLATES.map((template) => (
                    <DropdownMenuItem
                      key={template.name}
                      onClick={() => handleTemplateSelect(template.name, true)}
                      className="text-sm"
                    >
                      <span className="w-5 text-center mr-2 text-muted-foreground">
                        {template.icon}
                      </span>
                      {template.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <textarea
              value={code}
              onChange={handleCodeChange}
              className="flex-1 w-full p-4 text-sm font-mono bg-card text-foreground outline-none resize-none placeholder:text-muted-foreground/50"
              placeholder="Enter mermaid diagram code..."
              spellCheck={false}
              style={{ height: editorHeight }}
            />
          </div>

          {showPreview && <div className="w-px bg-border" />}

          {showPreview && (
            <div className="flex flex-col w-1/2 min-w-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Preview
                </span>
                <a
                  href="https://mermaid.js.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Docs
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ScrollArea className="flex-1 bg-card">
                <div className="p-4 min-h-full" style={{ minHeight: editorHeight }}>
                  {code ? (
                    <MermaidRenderer
                      chart={code}
                      className="w-full h-full min-h-[200px]"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4">
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground mb-1">
                          No diagram yet
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Start typing or pick a template
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 w-full max-w-sm">
                        {MERMAID_TEMPLATES.map((template) => (
                          <Tooltip key={template.name}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() =>
                                  handleTemplateSelect(template.name, true)
                                }
                                className="w-full text-left px-3 py-2.5 rounded-md border border-dashed border-border bg-background/80 hover:bg-muted/60 transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex-shrink-0 w-8 h-8 rounded-md border border-border bg-background flex items-center justify-center">
                                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                                      {template.icon}
                                    </span>
                                  </div>
                                  <div className="text-sm font-medium text-foreground">
                                    {template.name}
                                  </div>
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              {template.description}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
