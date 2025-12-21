"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import MentionsEditor, { extractMentionsFromEditorState } from "@/components/mentions-editor";
// Template components removed for local-first version
// import { TemplateBookmark } from "@/components/template-bookmark";
// import { TemplateGallery } from "@/components/template-gallery";
import {
  Copy,
  Send,
  FileText,
  Code,
  GitBranch,
  StickyNote,
  X,
} from "lucide-react";
import type { TileData, Connection } from "@/types/canvas";
import { usePromptWriterStore } from "@/stores/prompt-writer-store";
import { useBoardStore } from "@/stores/board-management-store";
// Template store removed for local-first version
// import { useTemplateStore } from "@/stores/template-store";
// import type { Template as SupabaseTemplate } from "@/types/templates";

export interface Template {
  id: string;
  name: string;
  icon: React.ReactNode;
  systemPrompt: string;
}

interface PromptWriterProps {
  tileId: string;
  tileType: TileData["type"];
  allTiles: TileData[];
  connections?: Connection[];
  onCopyPrompt?: (prompt: string) => void;
  onSendToAI?: (prompt: string) => Promise<void> | void;
}

export const PROMPT_TEMPLATES: Partial<Record<TileData["type"], Template[]>> = {
  text: [
    {
      id: "concept",
      name: "Write a Concept",
      icon: <FileText className="h-4 w-4" />,
      systemPrompt:
        "You are a skilled technical writer. Create a comprehensive concept explanation that is clear, well-structured, and includes relevant examples. Focus on breaking down complex ideas into understandable components.",
    },
    {
      id: "summary",
      name: "Summarize",
      icon: <FileText className="h-4 w-4" />,
      systemPrompt:
        "You are an expert at creating concise, accurate summaries. Extract the key points and main ideas while maintaining the essential meaning and context.",
    },
    {
      id: "expand",
      name: "Expand Content",
      icon: <FileText className="h-4 w-4" />,
      systemPrompt:
        "You are a content development specialist. Expand on the given content by adding relevant details, examples, and explanations while maintaining coherence and flow.",
    },
    {
      id: "rewrite",
      name: "Rewrite & Improve",
      icon: <FileText className="h-4 w-4" />,
      systemPrompt:
        "You are an expert editor and writer. Rewrite the content to improve clarity, flow, and engagement while preserving the original meaning and intent.",
    },
  ],
  code: [
    {
      id: "explain",
      name: "Explain Code",
      icon: <Code className="h-4 w-4" />,
      systemPrompt:
        "You are a senior software engineer and mentor. Explain the code clearly, covering its purpose, how it works, key concepts used, and any important implementation details.",
    },
    {
      id: "optimize",
      name: "Optimize Code",
      icon: <Code className="h-4 w-4" />,
      systemPrompt:
        "You are a performance optimization expert. Analyze the code and suggest improvements for better performance, readability, and maintainability while following best practices.",
    },
    {
      id: "debug",
      name: "Debug & Fix",
      icon: <Code className="h-4 w-4" />,
      systemPrompt:
        "You are a debugging specialist. Identify potential issues, bugs, or improvements in the code and provide solutions with clear explanations.",
    },
    {
      id: "refactor",
      name: "Refactor Code",
      icon: <Code className="h-4 w-4" />,
      systemPrompt:
        "You are a code refactoring expert. Improve the code structure, readability, and maintainability while preserving functionality and following best practices.",
    },
  ],
  mermaid: [
    {
      id: "flowchart",
      name: "Create Flow Chart",
      icon: <GitBranch className="h-4 w-4" />,
      systemPrompt:
        "You are a process visualization expert. Create a clear flowchart diagram using Mermaid syntax that shows the flow of processes, decisions, and outcomes with proper symbols and connections.",
    },
    {
      id: "sequence",
      name: "Sequence Diagram",
      icon: <GitBranch className="h-4 w-4" />,
      systemPrompt:
        "You are a systems architect. Create a sequence diagram using Mermaid syntax that clearly shows interactions between components, actors, or systems over time.",
    },
    {
      id: "entity-relation",
      name: "Entity Relation",
      icon: <GitBranch className="h-4 w-4" />,
      systemPrompt:
        "You are a database designer. Create an Entity-Relationship diagram using Mermaid syntax showing entities, attributes, and relationships with proper notation.",
    },
    {
      id: "class-diagram",
      name: "Class Diagram",
      icon: <GitBranch className="h-4 w-4" />,
      systemPrompt:
        "You are a software architect. Create a UML class diagram using Mermaid syntax showing classes, their attributes, methods, and relationships including inheritance and associations.",
    },
  ],
  note: [
    {
      id: "brainstorm",
      name: "Brainstorm Ideas",
      icon: <StickyNote className="h-4 w-4" />,
      systemPrompt:
        "You are a creative thinking facilitator. Generate diverse, innovative ideas and suggestions based on the given context. Think outside the box and provide actionable insights.",
    },
    {
      id: "organize",
      name: "Organize Notes",
      icon: <StickyNote className="h-4 w-4" />,
      systemPrompt:
        "You are an organizational expert. Structure and organize the given notes into a clear, logical format with proper headings, bullet points, and categories.",
    },
    {
      id: "action-items",
      name: "Extract Actions",
      icon: <StickyNote className="h-4 w-4" />,
      systemPrompt:
        "You are a project coordinator. Extract actionable tasks, next steps, and deliverables from the given content. Organize them by priority and provide clear, specific actions.",
    },
    {
      id: "meeting-notes",
      name: "Meeting Summary",
      icon: <StickyNote className="h-4 w-4" />,
      systemPrompt:
        "You are a meeting facilitator. Create a structured summary including key decisions, action items, attendees, and follow-up tasks from the given notes.",
    },
  ],
};

/**
 * PromptWriter — a composable AI prompt editor tied to a tile canvas.
 *
 * Renders a textarea for composing an AI prompt with:
 * - in-text `@ID` mentions (autocomplete dropdown) that insert tile references,
 * - optional per-tile-type templates (with a template system prompt),
 * - actions to clear, copy (writes assembled prompt to the clipboard), and send the assembled prompt to an AI handler.
 *
 * When copying or sending, the component builds a multi-section prompt that includes:
 * - an optional SYSTEM PROMPT (from the selected template),
 * - the USER REQUEST (with `@<id>` mentions replaced by `@refN` placeholders),
 * - CURRENT CONTEXT (primary tile title, type, and full content),
 * - CONNECTED ELEMENTS (outgoing/incoming connected tiles with full content),
 * - REFERENCED CONTENT (full content for tiles referenced with `@`),
 * - METADATA footer (counts, primary tile type, generation timestamp).
 *
 * The component persists its editing state via local state (adapted from canvas store).
 *
 * @param tileId - ID of the primary tile this prompt is associated with.
 * @param tileType - Type of the primary tile (used to select available templates).
 * @param allTiles - All tiles available for mentions and content extraction.
 * @param connections - Connections between tiles; used to include connected elements in the assembled prompt.
 * @param onCopyPrompt - Optional callback invoked with the assembled full prompt after copying (clipboard write is attempted).
 * @param onSendToAI - Optional callback invoked with the assembled full prompt when the Send action is triggered.
 * @returns The PromptWriter React element.
 */
export function PromptWriter({
  tileId,
  tileType,
  allTiles,
  connections = [],
  onCopyPrompt,
  onSendToAI,
}: PromptWriterProps) {
  // Get current board ID for namespacing drafts
  const currentBoardId = useBoardStore((s) => s.currentBoardId);
  const draftKey = `${currentBoardId ?? "global"}:${tileId}`;

  // Local state using prompt-writer-store for persistence
  const promptDraft = usePromptWriterStore((s) => s.drafts[draftKey]);
  const prompt = promptDraft?.plainText || "";
  const persistedEditorState = promptDraft?.editorState;
  const setDraft = usePromptWriterStore((s) => s.setDraft);
  // Template store methods removed for local-first version
  // const setTemplate = usePromptWriterStore((s) => s.setTemplate);
  // const clearTemplate = usePromptWriterStore((s) => s.clearTemplate);
  const getTemplate = usePromptWriterStore((s) => s.getTemplate);

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  // Template gallery disabled for local-first version
  // const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Editor state - replacing old textarea with Lexical
  const [editorState, setEditorState] = useState<string>("");
  const [promptPlainText, setPromptPlainText] = useState<string>("");
  const [editorKey, setEditorKey] = useState(0); // Force re-render when clearing

  // Templates disabled for local-first version - use static templates only
  const templates = useMemo(() => {
    return PROMPT_TEMPLATES[tileType] || [];
  }, [tileType]);

  // Template handlers removed for local-first version
  // const handleTemplateSelect = (template: Template | null) => {
  //   setSelectedTemplate(template);
  //   if (template) {
  //     setTemplate(currentBoardId ?? "global", tileId, template.id);
  //   } else {
  //     clearTemplate(currentBoardId ?? "global", tileId);
  //   }
  // };

  // Initialize editor and template with persisted data
  useEffect(() => {
    if (persistedEditorState && !editorState) {
      // Use the persisted editor state if available (contains mentions)
      setEditorState(persistedEditorState);
      setPromptPlainText(prompt);
    } else if (prompt && !editorState && !persistedEditorState) {
      // Fallback to plain text if no editor state is persisted
      setPromptPlainText(prompt);
    }
  }, [prompt, persistedEditorState, editorState]);

  // Initialize template from store - run when template data or keys change
  useEffect(() => {
    const persistedTemplateId = getTemplate(currentBoardId ?? "global", tileId);
    if (persistedTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id === persistedTemplateId);
      if (template && (!selectedTemplate || selectedTemplate.id !== template.id)) {
        setSelectedTemplate(template);
      }
    }
  }, [getTemplate, currentBoardId, tileId, templates, selectedTemplate]);

  const handleEditorChange = (json: string, plainText: string) => {
    setEditorState(json);
    setPromptPlainText(plainText);
    // Persist both plain text and editor state for proper persistence when leaving tile focus
    setDraft(currentBoardId ?? "global", tileId, plainText, json);
  };

  // Utility removed - was used for mentions but no longer needed
  // const getTileMentionText = (tile: TileData): string => {
  //   return tile.title || tile.id;
  // };

  const getTileContent = (tile: TileData): string => {
    switch (tile.type) {
      case "text":
        return tile.content?.text || "";
      case "code":
        return tile.content?.code || "";
      case "note":
        return tile.content?.text || "";
      case "mermaid":
        return tile.content?.chart || "";
      default:
        return JSON.stringify(tile.content || {});
    }
  };

  const getTileDescription = (tile: TileData): string => {
    switch (tile.type) {
      case "text":
        return "Text Content";
      case "code":
        return `Code (${tile.content?.language || "unknown"})`;
      case "note":
        return "Note";
      case "mermaid":
        return "Mermaid Diagram";
      default:
        return tile.type;
    }
  };

  const buildFullPrompt = (): string => {
    // Get the current tile
    const currentTile = allTiles.find((t) => t.id === tileId);
    if (!currentTile) return prompt;

    // Get connections related to this tile
    const relatedConnections = connections.filter(
      (conn) => conn.fromTileId === tileId || conn.toTileId === tileId,
    );

    // Build comprehensive prompt structure
    let finalPrompt = "";

    // Add template system prompt if selected
    if (selectedTemplate) {
      finalPrompt += `# SYSTEM PROMPT\n${selectedTemplate.systemPrompt}\n\n`;
    }

    // Add main user prompt with mention replacements
    let userPrompt = promptPlainText || prompt;
    let refCounter = 1;
    const references: { id: string; tile: TileData; trigger: string }[] = [];

    // Extract mentions from editor state if available
    if (editorState) {
      const mentions = extractMentionsFromEditorState(editorState);
      
      // Process mentions and replace with references
      mentions.forEach(mention => {
        if (mention.trigger === "@") {
          // Find tile by title, ID, or from the mention data
          let tile = allTiles.find(t => 
            (t.title && t.title === mention.value) || t.id === mention.value
          );
          
          // If we have data with an id, try to find by that
          if (!tile && mention.data && typeof mention.data === 'object' && 'id' in mention.data) {
            tile = allTiles.find(t => t.id === mention.data.id);
          }
          if (tile) {
            const refId = `@ref${refCounter}`;
            references.push({ id: refId, tile, trigger: mention.trigger });
            
            // Replace the mention in the user prompt
            userPrompt = userPrompt.replace(
              new RegExp(`@${mention.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
              refId
            );
            refCounter++;
          }
        }
      });
    } else {
      // Fallback to old regex-based approach for backwards compatibility
      const mentionRegex = /@([^\s]+)/g;
      userPrompt = userPrompt.replace(mentionRegex, (match, mentionedText) => {
        const tile = allTiles.find((t) => 
          (t.title && t.title === mentionedText) || t.id === mentionedText
        );
        if (tile) {
          const refId = `@ref${refCounter}`;
          references.push({ id: refId, tile, trigger: "@" });
          refCounter++;
          return refId;
        }
        return match;
      });
    }

    finalPrompt += `# USER REQUEST\n${userPrompt}\n\n`;

    // Add current tile context
    finalPrompt += `═══════════════════════════════════════════════════════════════════\n`;
    finalPrompt += `# CURRENT CONTEXT\n\n`;
    finalPrompt += `## Primary Tile: "${currentTile.title || currentTile.id}"\n`;
    finalPrompt += `**Type:** ${getTileDescription(currentTile)}\n`;
    finalPrompt += `**Content:**\n\`\`\`\n${getTileContent(currentTile)}\n\`\`\`\n\n`;

    // Add connections context if any exist
    if (relatedConnections.length > 0) {
      finalPrompt += `## Connected Elements\n`;

      // Group connections by direction
      const outgoingConnections = relatedConnections.filter(
        (conn) => conn.fromTileId === tileId,
      );
      const incomingConnections = relatedConnections.filter(
        (conn) => conn.toTileId === tileId,
      );

      if (outgoingConnections.length > 0) {
        finalPrompt += `\n**Outgoing Connections:**\n`;
        outgoingConnections.forEach((conn, index) => {
          const targetTile = allTiles.find((t) => t.id === conn.toTileId);
          if (targetTile) {
            const label = conn.label ? ` (${conn.label})` : "";
            finalPrompt += `\n### ${index + 1}. → "${targetTile.title || targetTile.id}"${label}\n`;
            finalPrompt += `**Type:** ${getTileDescription(targetTile)}\n`;
            finalPrompt += `**Full Content:**\n\`\`\`${targetTile.type === "code" ? targetTile.content?.language || "" : ""}\n${getTileContent(targetTile)}\n\`\`\`\n`;
          }
        });
      }

      if (incomingConnections.length > 0) {
        finalPrompt += `\n**Incoming Connections:**\n`;
        incomingConnections.forEach((conn, index) => {
          const sourceTile = allTiles.find((t) => t.id === conn.fromTileId);
          if (sourceTile) {
            const label = conn.label ? ` (${conn.label})` : "";
            finalPrompt += `\n### ${index + 1}. ← "${sourceTile.title || sourceTile.id}"${label}\n`;
            finalPrompt += `**Type:** ${getTileDescription(sourceTile)}\n`;
            finalPrompt += `**Full Content:**\n\`\`\`${sourceTile.type === "code" ? sourceTile.content?.language || "" : ""}\n${getTileContent(sourceTile)}\n\`\`\`\n`;
          }
        });
      }
    }

    // Add referenced tiles (from @mentions) with full content
    if (references.length > 0) {
      finalPrompt += `═══════════════════════════════════════════════════════════════════\n`;
      finalPrompt += `# REFERENCED CONTENT\n\n`;

      references.forEach(({ id, tile }) => {
        finalPrompt += `## ${id}: "${tile.title || tile.id}"\n`;
        finalPrompt += `**Type:** ${getTileDescription(tile)}\n`;
        finalPrompt += `**Full Content:**\n\`\`\`${tile.type === "code" ? tile.content?.language || "" : ""}\n${getTileContent(tile)}\n\`\`\`\n\n`;
      });
    }

    // Add footer with metadata
    finalPrompt += `═══════════════════════════════════════════════════════════════════\n`;
    finalPrompt += `# METADATA\n`;
    finalPrompt += `- Total Connected Elements: ${relatedConnections.length}\n`;
    finalPrompt += `- Referenced Tiles: ${references.length}\n`;
    finalPrompt += `- Primary Tile Type: ${currentTile.type}\n`;
    finalPrompt += `- Generated: ${new Date().toISOString()}\n`;

    return finalPrompt;
  };

  const handleCopy = () => {
    const fullPrompt = buildFullPrompt();
    navigator.clipboard.writeText(fullPrompt);
    onCopyPrompt?.(fullPrompt);
  };

  const handleSend = async () => {
    if (isSending) return;
    
    setIsSending(true);
    try {
      const fullPrompt = buildFullPrompt();
      await onSendToAI?.(fullPrompt);
    } catch (error) {
      console.error("Error in handleSend:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    // Clear both editor state and prompt from store
    setEditorState("");
    setPromptPlainText("");
    setDraft(currentBoardId ?? "global", tileId, "", "");
    
    // Force re-render of MentionsEditor by changing key
    setEditorKey(prev => prev + 1);
  };


  return (
    <div className="relative space-y-3">
      {/* Main prompt input area */}
      <div className="relative border border-border rounded-lg bg-background overflow-hidden">
        {/* Mentions Editor for input */}
        <MentionsEditor
          key={editorKey}
          value={(() => {
            // Priority: 1. Current editor state, 2. Persisted editor state, 3. Synthetic from plain text
            const valueToUse = editorState || persistedEditorState || (prompt ? JSON.stringify({
              "root": {
                "children": [{
                  "children": [{
                    "detail": 0,
                    "format": 0,
                    "mode": "normal",
                    "style": "",
                    "text": prompt,
                    "type": "text",
                    "version": 1
                  }],
                  "direction": "ltr",
                  "format": "",
                  "indent": 0,
                  "type": "paragraph",
                  "version": 1
                }],
                "direction": "ltr",
                "format": "",
                "indent": 0,
                "type": "root",
                "version": 1
              }
            }) : "");
            return valueToUse;
          })()}
          onChange={handleEditorChange}
          allTiles={allTiles}
          placeholder="Write your AI prompt... Use @ to reference tiles or # for tags."
          className="min-h-[100px] w-full border-0 p-3 text-sm"
        />

        {/* Template Gallery - disabled for local-first version */}
        {/* {templates.length > 0 && (
          <TemplateGallery
            templates={templates}
            selectedTemplate={selectedTemplate || undefined}
            onSelectTemplate={handleTemplateSelect}
            isVisible={isTemplateGalleryOpen}
          />
        )} */}
        
        {/* Action buttons - positioned below the text area */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2">
            {/* Templates disabled for local-first version */}
            {selectedTemplate && (
              <span className="text-xs text-muted-foreground px-2 py-1">
                Template: {selectedTemplate.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
              disabled={!promptPlainText.trim()}
              title="Clear prompt"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              disabled={!promptPlainText.trim()}
              title="Copy prompt with references"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 px-3 text-xs font-medium"
              onClick={handleSend}
              disabled={true}
              title="AI integration disabled in local-first version"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send (Disabled)
            </Button>
          </div>
        </div>
      </div>


    </div>
  );
}
