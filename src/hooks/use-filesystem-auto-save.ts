import { useEffect, useRef, useCallback } from "react";
import type { BoardElement, ShadeworksFile } from "@/lib/board-types";
import {
  getBoardFileHandle,
  writeToFileHandle,
} from "@/lib/filesystem-storage";

interface UseFilesystemAutoSaveOptions {
  boardId: string;
  elements: BoardElement[];
  canvasBackground: "none" | "dots" | "lines" | "grid";
  isOwner: boolean;
  enabled?: boolean;
  debounceMs?: number;
}

export function useFilesystemAutoSave({
  boardId,
  elements,
  canvasBackground,
  isOwner,
  enabled = true,
  debounceMs = 800,
}: UseFilesystemAutoSaveOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const save = useCallback(async () => {
    if (!isOwner || !enabled) return;

    const handle = await getBoardFileHandle(boardId);
    if (!handle) return;

    const hash = JSON.stringify({ elements, canvasBackground });
    if (hash === lastSavedRef.current) return;
    lastSavedRef.current = hash;

    const kladdeFile: ShadeworksFile = {
      type: "kladde",
      version: 1,
      elements,
      appState: {
        canvasBackground,
      },
    };

    try {
      const jsonString = JSON.stringify(kladdeFile, null, 2);
      await writeToFileHandle(handle, jsonString);
    } catch (error) {
      console.error("Failed to auto-save to filesystem:", error);
    }
  }, [boardId, elements, canvasBackground, isOwner, enabled]);

  useEffect(() => {
    if (!isOwner || !enabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      void save();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [elements, canvasBackground, isOwner, enabled, debounceMs, save]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        void save();
      }
    };
  }, [save]);
}
