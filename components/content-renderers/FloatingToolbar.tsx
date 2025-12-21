"use client";

import React, { useCallback, useState } from "react";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  HeadingTagType,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  $isListNode,
} from "@lexical/list";
import { $createCodeNode } from "@lexical/code";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating formatting toolbar for a Lexical editor.
 *
 * Renders a compact toolbar that reflects the current selection's block type and inline formatting
 * (bold, italic, underline, strikethrough, inline code, link) and dispatches Lexical commands to
 * change block-level styles (paragraph, headings, lists, quote, code block) and inline formats.
 *
 * The component subscribes to editor selection changes to update its UI state and uses the Lexical
 * composer context to call `editor.update`, `editor.dispatchCommand`, and register the
 * SELECTION_CHANGE_COMMAND handler. Invoking the Link control toggles a link using
 * TOGGLE_LINK_COMMAND (inserts "https://" when enabling a link; passes null to remove it).
 *
 * @returns A React element containing the floating formatting toolbar.
 */
export function FloatingToolbar() {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = useState("paragraph");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === "root"
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();

      // Update text format
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));

      if ($isListNode(element)) {
        const parentList = anchorNode.getParents().find($isListNode);
        const type = parentList
          ? parentList.getListType()
          : element.getListType();
        setBlockType(type);
      } else {
        const type = $isHeadingNode(element)
          ? element.getTag()
          : element.getType();
        setBlockType(type);
      }
    }
  }, []);

  React.useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      1,
    );
  }, [editor, updateToolbar]);

  const formatParagraph = () => {
    if (blockType !== "paragraph") {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    }
  };

  const formatHeading = (headingSize: HeadingTagType) => {
    if (blockType !== headingSize) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(headingSize));
        }
      });
    }
  };

  const formatBulletList = () => {
    if (blockType !== "ul") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    }
  };

  const formatNumberedList = () => {
    if (blockType !== "ol") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  const formatQuote = () => {
    if (blockType !== "quote") {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
    }
  };

  const formatCode = () => {
    if (blockType !== "code") {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCodeNode());
        }
      });
    }
  };

  const insertLink = useCallback(() => {
    if (!isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);

  return (
    <div className="flex flex-wrap w-fit items-center gap-1 px-2 py-1 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm">
      {/* Block Type Controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={formatParagraph}
          className={cn(
            "p-1 rounded hover:bg-gray-100 flex items-center",
            blockType === "paragraph" && "bg-gray-200",
          )}
          title="Normal text"
        >
          <Type size={14} />
        </button>

        <button
          onClick={() => formatHeading("h1")}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            blockType === "h1" && "bg-gray-200",
          )}
          title="Heading 1"
        >
          <Heading1 size={14} />
        </button>

        <button
          onClick={() => formatHeading("h2")}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            blockType === "h2" && "bg-gray-200",
          )}
          title="Heading 2"
        >
          <Heading2 size={14} />
        </button>

        <button
          onClick={() => formatHeading("h3")}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            blockType === "h3" && "bg-gray-200",
          )}
          title="Heading 3"
        >
          <Heading3 size={14} />
        </button>
      </div>

      <div className="w-px h-4 bg-gray-300" />

      {/* List Controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={formatBulletList}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            blockType === "ul" && "bg-gray-200",
          )}
          title="Bullet List"
        >
          <List size={14} />
        </button>

        <button
          onClick={formatNumberedList}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            blockType === "ol" && "bg-gray-200",
          )}
          title="Numbered List"
        >
          <ListOrdered size={14} />
        </button>

        <button
          onClick={formatQuote}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            blockType === "quote" && "bg-gray-200",
          )}
          title="Quote"
        >
          <Quote size={14} />
        </button>

        <button
          onClick={formatCode}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            blockType === "code" && "bg-gray-200",
          )}
          title="Code Block"
        >
          <Code2 size={14} />
        </button>
      </div>

      <div className="w-px h-4 bg-gray-300" />

      {/* Text Format Controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
          }}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            isBold && "bg-gray-200",
          )}
          title="Bold (⌘B)"
        >
          <Bold size={14} />
        </button>

        <button
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
          }}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            isItalic && "bg-gray-200",
          )}
          title="Italic (⌘I)"
        >
          <Italic size={14} />
        </button>

        <button
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
          }}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            isUnderline && "bg-gray-200",
          )}
          title="Underline (⌘U)"
        >
          <Underline size={14} />
        </button>

        <button
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
          }}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            isStrikethrough && "bg-gray-200",
          )}
          title="Strikethrough"
        >
          <Strikethrough size={14} />
        </button>

        <button
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
          }}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            isCode && "bg-gray-200",
          )}
          title="Inline Code"
        >
          <Code2 size={12} />
        </button>

        <button
          onClick={insertLink}
          className={cn(
            "p-1 rounded hover:bg-gray-100",
            isLink && "bg-gray-200",
          )}
          title="Link"
        >
          <Link size={14} />
        </button>
      </div>
    </div>
  );
}
