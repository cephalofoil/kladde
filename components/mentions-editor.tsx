"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import {
  BeautifulMentionsPlugin,
  BeautifulMentionNode,
  type BeautifulMentionsTheme,
  useBeautifulMentions,
  type BeautifulMentionsMenuProps,
  type BeautifulMentionsMenuItemProps,
} from "lexical-beautiful-mentions";
import { $getRoot, EditorState } from "lexical";
import type { TileData } from "@/types/canvas";
import React, { useMemo, useCallback } from "react";

type MentionData = { 
  id: string; 
  kind?: "user" | "note" | "tile" | "tag"; 
  tileType?: TileData["type"];
  [key: string]: any;
};

const theme: BeautifulMentionsTheme = {
  "@": "rounded-xl px-1.5 py-0.5 font-medium bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800 inline-block",
  "@Focused": "ring-2 ring-blue-500 bg-blue-200 dark:bg-blue-800",
  "#": "rounded-xl px-1.5 py-0.5 font-medium bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 border border-emerald-200 dark:border-emerald-800 inline-block",
  "#Focused": "ring-2 ring-emerald-500 bg-emerald-200 dark:bg-emerald-800",
};

const initialConfig = {
  namespace: "mentions-editor",
  nodes: [BeautifulMentionNode], // register mention node
  theme: { beautifulMentions: theme },
  onError(error: Error) { 
    console.error("Lexical error:", error); 
  },
};

interface MentionsEditorProps {
  value?: string; // serialized editor state (JSON string)
  onChange?: (json: string, plainText: string) => void;
  allTiles: TileData[];
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export default function MentionsEditor({
  value,
  onChange,
  allTiles,
  placeholder = "Type @ to mention tiles or # for tags...",
  className = "min-h-[100px] w-full rounded-md border p-3 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
  minHeight = "100px",
}: MentionsEditorProps) {
  // Initialize editor with value if provided
  const editorConfig = useMemo(() => ({
    ...initialConfig,
    editorState: value ? value : undefined,
  }), [value]);

  const handleEditorChange = useCallback((editorState: EditorState) => {
    const json = JSON.stringify(editorState.toJSON());
    
    // Extract plain text for backwards compatibility
    editorState.read(() => {
      const root = $getRoot();
      const plainText = root.getTextContent();
      onChange?.(json, plainText);
    });
  }, [onChange]);

  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div className={className} style={{ minHeight }}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable 
              className="outline-none min-h-full"
              style={{ minHeight: "inherit" }}
            />
          }
          placeholder={
            <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin onChange={handleEditorChange} />
        <MentionsPlugin allTiles={allTiles} />
      </div>
    </LexicalComposer>
  );
}

// Custom menu component following the official examples
function CustomMenu({ loading, ...props }: BeautifulMentionsMenuProps) {
  return (
    <ul
      className="absolute top-full left-0 mt-1 bg-popover text-popover-foreground border rounded-md shadow-md z-50 max-h-60 overflow-y-auto m-0 p-0 list-none min-w-[250px] max-w-[400px]"
      {...props}
    />
  );
}

// Custom menu item component following the official examples  
const CustomMenuItem = React.forwardRef<
  HTMLLIElement,
  BeautifulMentionsMenuItemProps
>(({ 
  selected, 
  item, 
  itemValue, 
  tileType,
  id,
  value,
  trigger,
  data,
  ...domProps 
}, ref) => {
  // Extract data safely
  const isTag = item.trigger === "#";
  const displayValue = typeof item === 'object' && 'value' in item ? item.value : String(item);
  
  return (
    <li
      className={`m-0 px-3 py-2 text-left flex items-center gap-2 text-sm outline-none select-none transition-colors cursor-pointer ${
        selected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent hover:text-accent-foreground"
      }`}
      {...domProps}
      ref={ref}
    >
      <span className={`font-mono text-sm ${
        isTag 
          ? "text-emerald-600 dark:text-emerald-400" 
          : "text-blue-600 dark:text-blue-400"
      }`}>
        {isTag ? "#" : "@"}{displayValue}
      </span>
      <span className="text-xs text-muted-foreground ml-auto">
        {isTag ? "tag" : "tile"}
      </span>
    </li>
  );
});

CustomMenuItem.displayName = "CustomMenuItem";

function MentionsPlugin({ allTiles }: { allTiles: TileData[] }) {
  // Create mention items in the format expected by the plugin
  const mentionItems = useMemo(() => {
    // For @ mentions, create items with metadata
    const tileItems = allTiles.map(tile => ({
      value: tile.title || tile.id,
      id: tile.id,
      tileType: tile.type,
    }));

    // For # mentions, simple string array
    const tagItems = [
      "important", 
      "todo", 
      "mermaid", 
      "draft", 
      "review", 
      "completed", 
      "urgent", 
      "idea", 
      "question",
      "bug",
      "feature",
      "documentation"
    ];

    return {
      "@": tileItems,
      "#": tagItems,
    };
  }, [allTiles]);

  return (
    <BeautifulMentionsPlugin
      // Use the items format instead of onSearch for simpler implementation
      items={mentionItems}

      // Allow multi-word mentions for tile names
      allowSpaces={true}

      // Control spacing around mentions
      autoSpace={true}

      // Disable create-new entry when nothing matches
      creatable={false}

      // Insert the current highlighted suggestion if the editor blurs
      insertOnBlur={true}

      // Disable re-opening menu after user deletes a mention
      showMentionsOnDelete={false}

      // Custom components
      menuComponent={CustomMenu}
      menuItemComponent={CustomMenuItem}
    />
  );
}

// Utility function to extract mentions from editor state
export function extractMentionsFromEditorState(editorStateJson: string): Array<{
  trigger: string;
  value: string;
  data?: any;
}> {
  if (!editorStateJson) return [];

  try {
    const editorState = JSON.parse(editorStateJson);
    const mentions: Array<{
      trigger: string;
      value: string;
      data?: any;
    }> = [];

    // Recursively search through all nodes for mentions
    function extractFromNode(node: any) {
      if (node.type === "beautifulMention") {
        mentions.push({
          trigger: node.trigger || "@",
          value: node.value || "",
          data: node.data,
        });
      }
      
      if (node.children) {
        node.children.forEach(extractFromNode);
      }
    }

    if (editorState.root) {
      extractFromNode(editorState.root);
    }

    return mentions;
  } catch (error) {
    console.error("Error extracting mentions:", error);
    return [];
  }
}
