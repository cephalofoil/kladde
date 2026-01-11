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
                    { keys: ["F"], description: "Frame tool" },
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
                    { keys: ["Delete"], description: "Delete selected" },
                    { keys: ["Esc"], description: "Deselect / cancel editing" },
                    {
                        keys: ["Hold", "Shift"],
                        description: "Constrain while drawing",
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
                category: "File & Actions",
                items: [
                    { keys: [modKey, "O"], description: "Open (.kladde)" },
                    { keys: [modKey, "S"], description: "Save to file" },
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
                                                {shortcut.keys.map(
                                                    (key, keyIdx) => (
                                                        <span key={keyIdx}>
                                                            <span>{key}</span>
                                                            {keyIdx <
                                                                shortcut.keys
                                                                    .length -
                                                                    1 &&
                                                                key !== "+" && (
                                                                    <span className="text-sm opacity-85">
                                                                        {shortcut
                                                                            .keys[
                                                                            keyIdx +
                                                                                1
                                                                        ] ===
                                                                        "+"
                                                                            ? ""
                                                                            : "+"}
                                                                    </span>
                                                                )}
                                                        </span>
                                                    ),
                                                )}
                                            </KbdGroup>
                                        </div>
                                    ))}
                                </div>
                                {idx < shortcuts.length - 1 && (
                                    <Separator className="mt-4" />
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
