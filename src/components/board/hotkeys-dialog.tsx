"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { KbdGroup } from "@/components/ui/kbd";
import { getModifierKey, isMac } from "@/lib/platform";

interface HotkeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HotkeysDialog({ open, onOpenChange }: HotkeysDialogProps) {
  const modKey = useMemo(() => getModifierKey(), []);
  const shiftKey = useMemo(() => (isMac() ? "⇧" : "Shift"), []);

  const shortcuts = useMemo(
    () => [
      {
        category: "Tools",
        items: [
          { keys: ["H"], description: "Hand tool" },
          { keys: ["V"], description: "Select tool" },
          { keys: ["1"], description: "Pen / Highlighter / Eraser" },
          { keys: ["2"], description: "Line / Arrow" },
          {
            keys: ["3"],
            description: "Rectangle / Diamond / Ellipse",
          },
          { keys: ["4"], description: "Text tool" },
        ],
      },
      {
        category: "Tiles",
        items: [
          { keys: ["5"], description: "Text tile" },
          { keys: ["6"], description: "Note tile" },
          { keys: ["7"], description: "Code tile" },
          { keys: ["8"], description: "Diagram tile" },
          { keys: ["9"], description: "Image tile" },
        ],
      },
      {
        category: "Edit",
        items: [
          { keys: [modKey, "Z"], description: "Undo" },
          { keys: [modKey, shiftKey, "Z"], description: "Redo" },
          { keys: [modKey, "Y"], description: "Redo" },
          { keys: [modKey, "X"], description: "Cut" },
          { keys: [modKey, "C"], description: "Copy" },
          { keys: [modKey, "V"], description: "Paste" },
          { keys: [modKey, "D"], description: "Duplicate" },
          { keys: [modKey, "A"], description: "Select all" },
          { keys: ["Delete"], description: "Delete selected" },
          { keys: ["Esc"], description: "Deselect / cancel editing" },
          {
            keys: ["Hold", "Shift"],
            description: "Constrain while drawing",
          },
        ],
      },
      {
        category: "Clipboard & Styles",
        items: [
          {
            keys: [shiftKey, "Alt", "C"],
            description: "Copy to clipboard as PNG",
          },
          { keys: [modKey, "Alt", "C"], description: "Copy styles" },
          { keys: [modKey, "Alt", "V"], description: "Paste styles" },
        ],
      },
      {
        category: "Arrange",
        items: [
          { keys: [modKey, "["], description: "Send backward" },
          { keys: [modKey, "]"], description: "Bring forward" },
          {
            keys: [modKey, shiftKey, "["],
            description: "Send to back",
          },
          {
            keys: [modKey, shiftKey, "]"],
            description: "Bring to front",
          },
        ],
      },
      {
        category: "Transform",
        items: [
          { keys: [shiftKey, "H"], description: "Flip horizontal" },
          { keys: [shiftKey, "V"], description: "Flip vertical" },
        ],
      },
      {
        category: "Links",
        items: [
          { keys: [modKey, "K"], description: "Add / edit link" },
          {
            keys: [modKey, shiftKey, "L"],
            description: "Lock / unlock selection",
          },
        ],
      },
      {
        category: "Canvas",
        items: [
          { keys: ["Scroll"], description: "Pan canvas" },
          {
            keys: [modKey, "+", "Scroll"],
            description: "Zoom canvas",
          },
        ],
      },
      {
        category: "View",
        items: [
          { keys: ["Alt", "R"], description: "Toggle view mode" },
          { keys: ["Alt", "S"], description: "Toggle snap to objects" },
        ],
      },
      {
        category: "File & Actions",
        items: [
          { keys: [modKey, "O"], description: "Open (.kladde)" },
          { keys: [modKey, "S"], description: "Save to file" },
          {
            keys: [modKey, shiftKey, "S"],
            description: "Export board file",
          },
          {
            keys: [modKey, shiftKey, "E"],
            description: "Export image",
          },
          {
            keys: [modKey, shiftKey, "L"],
            description: "Toggle light/dark theme",
          },
          { keys: [modKey, "F"], description: "Find on canvas" },
          { keys: ["?"], description: "Show keyboard shortcuts" },
        ],
      },
    ],
    [modKey, shiftKey],
  );

  if (!open) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl select-none">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick reference for the whiteboard
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {shortcuts.map((section, idx) => (
              <div key={section.category}>
                <h3 className="text-sm font-semibold mb-3 font-[var(--font-heading)]">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((shortcut, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
                    >
                      <span className="text-sm text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <KbdGroup>
                        {shortcut.keys.map((key, keyIdx) => (
                          <span key={keyIdx}>
                            <span>{key}</span>
                            {keyIdx < shortcut.keys.length - 1 &&
                              key !== "+" && (
                                <span className="text-sm opacity-85">
                                  {shortcut.keys[keyIdx + 1] === "+" ? "" : "+"}
                                </span>
                              )}
                          </span>
                        ))}
                      </KbdGroup>
                    </div>
                  ))}
                </div>
                {idx < shortcuts.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
