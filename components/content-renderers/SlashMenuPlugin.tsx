"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  LexicalEditor,
} from "lexical";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { $createCodeNode } from "@lexical/code";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlashMenuItem {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onSelect: (editor: LexicalEditor) => void;
  keywords: string[];
}

const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  {
    key: "paragraph",
    title: "Text",
    description: "Just start writing with plain text",
    icon: <Type size={16} />,
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    },
    keywords: ["text", "paragraph", "p"],
  },
  {
    key: "h1",
    title: "Heading 1",
    description: "Big section heading",
    icon: <Heading1 size={16} />,
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode("h1"));
        }
      });
    },
    keywords: ["heading", "h1", "title", "big"],
  },
  {
    key: "h2",
    title: "Heading 2",
    description: "Medium section heading",
    icon: <Heading2 size={16} />,
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode("h2"));
        }
      });
    },
    keywords: ["heading", "h2", "subtitle"],
  },
  {
    key: "h3",
    title: "Heading 3",
    description: "Small section heading",
    icon: <Heading3 size={16} />,
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode("h3"));
        }
      });
    },
    keywords: ["heading", "h3", "subheading"],
  },
  {
    key: "ul",
    title: "Bulleted list",
    description: "Create a simple bulleted list",
    icon: <List size={16} />,
    onSelect: (editor) => {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    },
    keywords: ["list", "bullet", "ul", "unordered"],
  },
  {
    key: "ol",
    title: "Numbered list",
    description: "Create a list with numbering",
    icon: <ListOrdered size={16} />,
    onSelect: (editor) => {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    },
    keywords: ["list", "number", "ol", "ordered"],
  },
  {
    key: "quote",
    title: "Quote",
    description: "Capture a quote",
    icon: <Quote size={16} />,
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
    },
    keywords: ["quote", "blockquote", "citation"],
  },
  {
    key: "code",
    title: "Code block",
    description: "Capture a code snippet",
    icon: <Code2 size={16} />,
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCodeNode());
        }
      });
    },
    keywords: ["code", "codeblock", "snippet"],
  },
  {
    key: "link",
    title: "Link",
    description: "Add a link",
    icon: <Link size={16} />,
    onSelect: (editor) => {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
    },
    keywords: ["link", "url", "href"],
  },
];

function getTextUpToCursor(): string | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }
  const anchor = selection.anchor;
  if (anchor.type !== "text") {
    return null;
  }
  const anchorNode = anchor.getNode();
  if (!anchorNode.isSimpleText()) {
    return null;
  }
  const anchorOffset = anchor.offset;
  return anchorNode.getTextContent().slice(0, anchorOffset);
}

function useSlashMenu(editor: LexicalEditor) {
  const [queryString, setQueryString] = useState<string | null>(null);

  useEffect(() => {
    const updateListener = () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          setQueryString(null);
          return;
        }

        const text = getTextUpToCursor();
        const match = text?.match(/\/([a-zA-Z0-9]*)$/);
        if (match) {
          setQueryString(match[1]);
        } else {
          setQueryString(null);
        }
      });
    };

    const removeUpdateListener = editor.registerUpdateListener(updateListener);
    const removeTextContentListener =
      editor.registerTextContentListener(updateListener);

    return () => {
      removeUpdateListener();
      removeTextContentListener();
    };
  }, [editor]);

  const queryRegex = useMemo(
    () => (queryString != null ? new RegExp(queryString, "i") : null),
    [queryString],
  );

  const results = useMemo(() => {
    if (queryRegex == null) {
      return SLASH_MENU_ITEMS;
    }
    return SLASH_MENU_ITEMS.filter(
      (item) =>
        queryRegex.test(item.title) ||
        queryRegex.test(item.description) ||
        item.keywords.some((keyword) => queryRegex.test(keyword)),
    );
  }, [queryRegex]);

  return {
    queryString,
    results,
  };
}

interface SlashMenuProps {
  onSelect: (item: SlashMenuItem) => void;
  results: SlashMenuItem[];
  selectedIndex: number;
}

function SlashMenu({ onSelect, results, selectedIndex }: SlashMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedItem = menuRef.current?.children[
      selectedIndex
    ] as HTMLElement;
    selectedItem?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div
      ref={menuRef}
      className="absolute z-10 w-64 max-h-64 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg"
    >
      {results.map((item, index) => (
        <button
          key={item.key}
          className={cn(
            "w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-3 first:rounded-t-lg last:rounded-b-lg",
            index === selectedIndex && "bg-gray-100",
          )}
          onClick={() => onSelect(item)}
        >
          <span className="text-gray-500">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">
              {item.title}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {item.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function SlashMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const { queryString, results } = useSlashMenu(editor);
  const isOpen = queryString !== null;

  // Update menu position when selection changes
  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const nativeSelection = window.getSelection();
        if (!nativeSelection || nativeSelection.rangeCount === 0) return;

        const range = nativeSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setMenuPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      });
    };

    updatePosition();
    const timeoutId = setTimeout(updatePosition, 0);

    return () => clearTimeout(timeoutId);
  }, [editor, isOpen, queryString]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const closeMenu = useCallback(() => {
    setMenuPosition(null);
  }, []);

  const onSelect = useCallback(
    (item: SlashMenuItem) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        if (anchor.type !== "text") return;

        const anchorNode = anchor.getNode();
        const anchorOffset = anchor.offset;
        const text = anchorNode.getTextContent();

        // Find the slash and remove everything from slash to cursor
        const beforeSlash = text.slice(0, anchorOffset).lastIndexOf("/");
        if (beforeSlash !== -1) {
          const textBefore = text.slice(0, beforeSlash);
          const textAfter = text.slice(anchorOffset);

          anchorNode.setTextContent(textBefore + textAfter);

          // Set selection after the removed slash command
          const newSelection = $getSelection();
          if ($isRangeSelection(newSelection)) {
            newSelection.setTextNodeRange(
              anchorNode,
              beforeSlash,
              anchorNode,
              beforeSlash,
            );
          }
        }

        // Execute the command
        item.onSelect(editor);
      });

      closeMenu();
    },
    [editor, closeMenu],
  );

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleArrowUp = () => {
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      return true;
    };

    const handleArrowDown = () => {
      setSelectedIndex((prev) => (prev + 1) % results.length);
      return true;
    };

    const handleEnter = () => {
      if (results[selectedIndex]) {
        onSelect(results[selectedIndex]);
      }
      return true;
    };

    const handleEscape = () => {
      closeMenu();
      return true;
    };

    const removeUpListener = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      handleArrowUp,
      COMMAND_PRIORITY_LOW,
    );
    const removeDownListener = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      handleArrowDown,
      COMMAND_PRIORITY_LOW,
    );
    const removeEnterListener = editor.registerCommand(
      KEY_ENTER_COMMAND,
      handleEnter,
      COMMAND_PRIORITY_LOW,
    );
    const removeEscapeListener = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      handleEscape,
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      removeUpListener();
      removeDownListener();
      removeEnterListener();
      removeEscapeListener();
    };
  }, [editor, isOpen, results, selectedIndex, closeMenu, onSelect]);

  if (!isOpen || !menuPosition || typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "absolute",
        top: menuPosition.top,
        left: menuPosition.left,
      }}
    >
      <SlashMenu
        onSelect={onSelect}
        results={results}
        selectedIndex={selectedIndex}
      />
    </div>,
    document.body,
  );
}
