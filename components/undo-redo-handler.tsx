"use client";

import { useCanvasHistory } from "@/hooks/useCanvasHistory";
import { useEventListener } from "@/hooks/useEventListener";

interface UndoRedoHandlerProps {
  boardId: string;
}

export function UndoRedoHandler({ boardId }: UndoRedoHandlerProps) {
  const { undo, redo, canUndo, canRedo } = useCanvasHistory(boardId);

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") {
      e.preventDefault();
      if (canUndo) {
        undo();
      }
    } else if (
      ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") ||
      ((e.metaKey || e.ctrlKey) && e.key === "y")
    ) {
      e.preventDefault();
      if (canRedo) {
        redo();
      }
    }
  };

  useEventListener("keydown", handleKeyDown, document);
  return null;
}
