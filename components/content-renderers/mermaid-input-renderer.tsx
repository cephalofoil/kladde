"use client";

import { useState, useRef } from "react";
import { usePromptWriterStore } from "@/stores/prompt-writer-store";
import { useBoardStore } from "@/stores/board-management-store";
import { DEBOUNCE_DELAYS } from "@/lib/constants";
import { useDebouncedTimer } from "@/hooks/use-debounced-timer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Send,
  AtSign,
  GitBranch,
  Database,
  Workflow,
} from "lucide-react";
import type { TileData } from "@/types/canvas";

interface MermaidInputRendererProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
  allTiles: TileData[];
  selectedTemplate?: string;
  onTemplateSelect?: (template: string) => void;
}

const DIAGRAM_TEMPLATES = [
  {
    id: "entity-relation",
    name: "Entity Relation",
    icon: <Database className="h-4 w-4" />,
    systemPrompt:
      "Create an Entity-Relationship Diagram (ERD) showing entities, attributes, and relationships between them. Use proper ERD notation with rectangles for entities, ovals for attributes, and diamonds for relationships.",
  },
  {
    id: "process-flow",
    name: "Process Flow",
    icon: <Workflow className="h-4 w-4" />,
    systemPrompt:
      "Create a flowchart showing a process flow with decision points, actions, and connections. Use standard flowchart symbols: rectangles for processes, diamonds for decisions, and arrows for flow direction.",
  },
  {
    id: "sequence",
    name: "Sequence",
    icon: <GitBranch className="h-4 w-4" />,
    systemPrompt:
      "Create a sequence diagram showing interactions between components or actors over time. Include lifelines, messages, and timing information.",
  },
  {
    id: "class",
    name: "Class",
    icon: <GitBranch className="h-4 w-4" />,
    systemPrompt:
      "Create a class diagram showing classes, their attributes, methods, and relationships. Include inheritance, associations, and dependencies.",
  },
];

export function MermaidInputRenderer({
  prompt,
  onPromptChange,
  onGenerate,
  onCopyPrompt,
  allTiles,
  selectedTemplate,
  onTemplateSelect,
}: MermaidInputRendererProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  const setDraft = usePromptWriterStore((s) => s.setDraftByKey);
  const commitDraft = useBoardStore((s) => s.commitDraft);
  const { schedule: scheduleCommit, cancel: cancelCommit } = useDebouncedTimer(
    DEBOUNCE_DELAYS.INPUT,
  );

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    onPromptChange(value);
    setDraft("mermaid", value);
    if (!isComposing) {
      scheduleCommit(() => commitDraft("mermaid", "/mermaid"));
    }
    setCursorPosition(cursorPos);

    // Check if user is typing @mention
    const beforeCursor = value.substring(0, cursorPos);
    const atIndex = beforeCursor.lastIndexOf("@");

    if (atIndex !== -1 && atIndex === beforeCursor.length - 1) {
      setShowMentions(true);
      setMentionFilter("");
    } else if (
      atIndex !== -1 &&
      beforeCursor.substring(atIndex + 1).match(/^[a-zA-Z0-9\s]*$/)
    ) {
      setShowMentions(true);
      setMentionFilter(beforeCursor.substring(atIndex + 1));
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (tile: TileData) => {
    const beforeCursor = prompt.substring(0, cursorPosition);
    const afterCursor = prompt.substring(cursorPosition);
    const atIndex = beforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const newPrompt =
        beforeCursor.substring(0, atIndex) +
        `@${tile.title || "Untitled"}\u200B ` +
        afterCursor;
      onPromptChange(newPrompt);
      setShowMentions(false);

      // Focus back to textarea
      setTimeout(() => {
        textareaRef.current?.focus();
        const newCursorPos = atIndex + (tile.title || "Untitled").length + 3;
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const filteredTiles = allTiles.filter((tile) =>
    (tile.title || "Untitled")
      .toLowerCase()
      .includes(mentionFilter.toLowerCase()),
  );

  const handleTemplateSelect = (templateId: string) => {
    if (onTemplateSelect) {
      onTemplateSelect(templateId);
    }
    
    // Find the selected template and update the prompt
    const template = DIAGRAM_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      onPromptChange(template.systemPrompt);
      setDraft("mermaid", template.systemPrompt);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 space-y-4">
      {/* Header - Fixed Label */}
      <div className="flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-sky-600" />
        <span className="text-lg font-semibold text-sky-800">
          Diagram Generator
        </span>
      </div>

      {/* Prompt Input */}
      <div className="relative flex-1">
        <Textarea
          ref={textareaRef}
          value={prompt}
          onChange={handlePromptChange}
          onCompositionStart={() => {
            cancelCommit();
            setIsComposing(true);
          }}
          onCompositionEnd={(e) => {
            setIsComposing(false);
            setDraft("mermaid", e.currentTarget.value);
            commitDraft("mermaid", "/mermaid");
          }}
          placeholder="Describe the diagram you want to create... Use @tilename to reference other tiles for context"
          className="w-full h-full resize-none pr-20 text-sm border-2 focus:border-sky-500 focus:ring-0"
          onFocus={() => textareaRef.current?.select()}
        />

        {/* Copy button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-12 h-8 w-8 p-0 hover:bg-sky-100"
          onClick={onCopyPrompt}
          disabled={!prompt.trim()}
          title="Copy prompt with template and references"
        >
          <Copy className="h-4 w-4" />
        </Button>

        {/* Generate button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-sky-100"
          onClick={onGenerate}
          disabled={!prompt.trim()}
          title="Generate diagram"
        >
          <Send className="h-4 w-4" />
        </Button>

        {/* Mention dropdown */}
        {showMentions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
            {filteredTiles.length > 0 ? (
              filteredTiles.map((tile) => (
                <button
                  key={tile.id}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  onClick={() => handleMentionSelect(tile)}
                >
                  <AtSign className="h-3 w-3 text-gray-400" />
                  <span className="text-sm">{tile.title || "Untitled"}</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {tile.type}
                  </Badge>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No tiles found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Template Selection - Below Input */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-700">
          Diagram Type (Optional)
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DIAGRAM_TEMPLATES.map((template) => (
            <button
              key={template.id}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${
                selectedTemplate === template.id
                  ? "border-sky-500 bg-sky-50 shadow-md"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => handleTemplateSelect(template.id)}
            >
              <div
                className={`p-2 rounded-lg ${
                  selectedTemplate === template.id
                    ? "bg-sky-100"
                    : "bg-gray-100"
                }`}
              >
                {template.icon}
              </div>
              <span
                className={`text-sm font-medium ${
                  selectedTemplate === template.id
                    ? "text-sky-700"
                    : "text-gray-700"
                }`}
              >
                {template.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
