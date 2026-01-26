import Image from "next/image";
import type { BoardElement } from "@/lib/board-types";
import { MermaidRenderer } from "./mermaid-renderer";
import { MermaidCodeEditor } from "./mermaid-code-editor";

const MERMAID_QUICK_TEMPLATES = [
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
        name: "Sequence",
        code: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B->>A: Hello Alice!`,
    },
    {
        name: "Class",
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
        code: `stateDiagram-v2
    [*] --> Still
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
    },
];

interface MermaidTileBodyProps {
    elementId: string;
    content?: BoardElement["tileContent"];
    width: number;
    height: number;
    tileTitle: string;
    isEditing: boolean;
    isEditingTitle: boolean;
    mermaidScale: number;
    onSetEditing: (next: boolean) => void;
    onUpdate?: (updates: Partial<BoardElement>) => void;
    onOpenMermaidEditor?: (elementId: string) => void;
    onStartTitleEdit: () => void;
    onFinishTitleEdit: () => void;
    onTitleChange: (value: string) => void;
    chartPointerEvents?: "none" | "auto";
    rendererClassName?: string;
}

export function MermaidTileBody({
    elementId,
    content,
    width,
    height,
    tileTitle,
    isEditing,
    isEditingTitle,
    mermaidScale,
    onSetEditing,
    onUpdate,
    onOpenMermaidEditor,
    onStartTitleEdit,
    onFinishTitleEdit,
    onTitleChange,
    chartPointerEvents = "auto",
    rendererClassName,
}: MermaidTileBodyProps) {
    if (isEditing) {
        return (
            <div className="absolute inset-0 pointer-events-auto rounded-lg overflow-hidden">
                <MermaidCodeEditor
                    initialCode={content?.chart || ""}
                    onSave={(code) => {
                        onUpdate?.({
                            tileContent: {
                                ...content,
                                chart: code,
                            },
                        });
                        onSetEditing(false);
                    }}
                    onCancel={() => onSetEditing(false)}
                    onExpand={
                        onOpenMermaidEditor
                            ? () => {
                                  onSetEditing(false);
                                  onOpenMermaidEditor(elementId);
                              }
                            : undefined
                    }
                    width={width - 8}
                    height={height - 8}
                    tileTitle={tileTitle}
                    isEditingTitle={isEditingTitle}
                    onStartTitleEdit={onStartTitleEdit}
                    onTitleChange={onTitleChange}
                    onFinishTitleEdit={onFinishTitleEdit}
                />
            </div>
        );
    }

    if (content?.chart) {
        return (
            <div
                className={[
                    "absolute left-2 right-2 bottom-2 top-12 rounded-b-lg overflow-hidden flex items-center justify-center",
                    chartPointerEvents === "none"
                        ? "pointer-events-none"
                        : "pointer-events-auto",
                ].join(" ")}
            >
                <MermaidRenderer
                    chart={content.chart}
                    width={width - 16}
                    height={height - 50}
                    scale={mermaidScale}
                    className={rendererClassName}
                />
            </div>
        );
    }

    return (
        <div className="absolute left-0 right-0 bottom-0 top-12 flex items-center justify-center pointer-events-auto rounded-b-lg">
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-4 max-w-xs text-center">
                <Image
                    src="/icons/diagram-tool.svg"
                    alt=""
                    width={48}
                    height={48}
                    className="w-12 h-12 opacity-40 dark:invert dark:opacity-50"
                />
                <h3 className="text-sm font-medium text-foreground">
                    Create your diagram
                </h3>
                <p className="text-xs text-muted-foreground">
                    Visualize flows, sequences, and structures with Mermaid
                    syntax
                </p>
                <button
                    onClick={() => onSetEditing(true)}
                    className="mt-1 px-4 py-2 text-sm font-medium bg-foreground text-background rounded-full hover:bg-foreground/90 transition-colors"
                >
                    + Create Diagram
                </button>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>or try:</span>
                    {MERMAID_QUICK_TEMPLATES.map((template, idx) => (
                        <span key={template.name}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdate?.({
                                        tileContent: {
                                            ...content,
                                            chart: template.code,
                                        },
                                    });
                                    onSetEditing(true);
                                }}
                                className="text-primary hover:underline"
                            >
                                {template.name}
                            </button>
                            {idx < MERMAID_QUICK_TEMPLATES.length - 1 && (
                                <span>,</span>
                            )}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
