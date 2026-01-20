"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { X, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardElement } from "@/lib/board-types";
import { ScrollArea } from "@/components/ui/scroll-area";

// Simple preview component without size constraints
function MermaidPreview({ chart }: { chart: string }) {
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chart) return;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "loose",
          htmlLabels: true,
        });
        const id = `mermaid-modal-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvgContent(svg);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to render diagram");
        setSvgContent("");
      }
    };

    renderMermaid();
  }, [chart, isDarkMode]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded text-center">
        <div className="text-red-600 dark:text-red-400 font-medium mb-2">Mermaid Error</div>
        <div className="text-xs text-red-500 dark:text-red-300">{error}</div>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Rendering diagram...
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

interface MermaidEditorModalProps {
  mermaidElement: BoardElement;
  onClose: () => void;
  onUpdateMermaid: (updates: Partial<BoardElement>) => void;
}

const MERMAID_TEMPLATES = [
  {
    name: "Flowchart",
    description: "Create flow diagrams with decisions and processes",
    code: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
  },
  {
    name: "Sequence Diagram",
    description: "Show interactions between participants over time",
    code: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B->>A: Hello Alice!`,
  },
  {
    name: "Class Diagram",
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
    name: "State Diagram",
    description: "Model state transitions and behaviors",
    code: `stateDiagram-v2
    [*] --> Still
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
  },
  {
    name: "ER Diagram",
    description: "Entity-relationship diagrams for databases",
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER {
        string name
        string email
    }
    ORDER {
        int orderNumber
        date created
    }`,
  },
  {
    name: "Gantt Chart",
    description: "Project timelines and scheduling",
    code: `gantt
    title Project Schedule
    dateFormat YYYY-MM-DD
    section Planning
    Research      :a1, 2024-01-01, 7d
    Design        :a2, after a1, 5d
    section Development
    Implementation :a3, after a2, 14d
    Testing       :a4, after a3, 7d`,
  },
  {
    name: "Pie Chart",
    description: "Display proportional data",
    code: `pie title Distribution
    "Category A" : 40
    "Category B" : 30
    "Category C" : 20
    "Category D" : 10`,
  },
  {
    name: "Mindmap",
    description: "Organize ideas hierarchically",
    code: `mindmap
  root((Central Topic))
    Branch 1
      Sub-topic 1
      Sub-topic 2
    Branch 2
      Sub-topic 3
      Sub-topic 4
    Branch 3
      Sub-topic 5`,
  },
];

export function MermaidEditorModal({
  mermaidElement,
  onClose,
  onUpdateMermaid,
}: MermaidEditorModalProps) {
  const [isAnimating, setIsAnimating] = useState(true);
  const [showTemplates, setShowTemplates] = useState(true);
  const [code, setCode] = useState(mermaidElement.tileContent?.chart || "");
  const codeRef = useRef(code);

  // Keep ref in sync with state
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // Swipe-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 50);
    return () => clearTimeout(timer);
  }, []);

  // Save on unmount or when code changes significantly
  const saveContent = useCallback(() => {
    const currentCode = codeRef.current;
    if (currentCode !== mermaidElement.tileContent?.chart) {
      onUpdateMermaid({
        tileContent: {
          ...mermaidElement.tileContent,
          chart: currentCode,
        },
      });
    }
  }, [mermaidElement.tileContent, onUpdateMermaid]);

  const handleClose = useCallback(() => {
    saveContent();
    setIsAnimating(true);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose, saveContent]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  const handleTemplateSelect = (templateCode: string) => {
    setCode(templateCode);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/20 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className={cn(
          "w-[92%] max-w-[1600px] min-w-[700px] h-full",
          "bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden",
          "transition-all duration-300 ease-in-out"
        )}
        style={{
          opacity: isAnimating ? 0 : 1,
          transform: isAnimating ? "scale(0.95)" : "scale(1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              Mermaid Editor
            </span>
            {mermaidElement.tileTitle && (
              <span className="text-sm text-muted-foreground">
                — {mermaidElement.tileTitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                showTemplates
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Templates
              {showTemplates ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Save and close editor"
            >
              <span className="text-sm">Save & Close</span>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Code Editor */}
          <div className="flex flex-col border-r border-border w-[40%]">
            <div className="px-4 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Code
              </span>
            </div>
            <div className="flex-1 p-4">
              <textarea
                value={code}
                onChange={handleCodeChange}
                className="w-full h-full p-4 text-sm font-mono bg-background text-foreground rounded-lg border border-border outline-none resize-none focus:border-ring focus:ring-0 scrollbar-thin scrollbar-thumb-muted-foreground/40 scrollbar-track-transparent"
                placeholder="Enter mermaid diagram code here..."
                spellCheck={false}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Preview
              </span>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              {code ? (
                <MermaidPreview chart={code} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  Enter code to see preview
                </div>
              )}
            </div>
          </div>

          {/* Templates Sidebar */}
          {showTemplates && (
            <div className="w-[25%] flex flex-col border-l border-border">
              <div className="px-4 py-2 border-b border-border bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Templates
                </span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {MERMAID_TEMPLATES.map((template) => (
                    <button
                      key={template.name}
                      onClick={() => handleTemplateSelect(template.code)}
                      className="w-full text-left px-3 py-2.5 rounded-md border border-dashed border-border bg-background/80 hover:bg-muted/60 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-md border border-border bg-background flex items-center justify-center">
                          <LayoutGrid className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">
                            {template.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {template.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          Learn more about Mermaid syntax at{" "}
          <a
            href="https://mermaid.js.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            mermaid.js.org
          </a>
          <span className="mx-2">•</span>
          Changes are saved automatically when you close
        </div>
      </div>
    </div>
  );
}
