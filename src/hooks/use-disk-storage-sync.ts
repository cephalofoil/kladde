import { useEffect, useRef, useCallback, useState } from "react";
import type { BoardElement, ShadeworksFile } from "@/lib/board-types";
import type { Board } from "@/lib/store-types";
import {
  saveBoardToWorkspaceStorage,
  hasWorkspaceStorageDirectory,
} from "@/lib/filesystem-storage";
import { useBoardStore } from "@/store/board-store";
import { useBoardSyncStore } from "@/store/board-sync-store";

const QUICK_BOARDS_WORKSPACE_ID = "quick-boards";

interface UseDiskStorageSyncOptions {
  boardId: string;
  elements: BoardElement[];
  canvasBackground: "none" | "dots" | "lines" | "grid";
  enabled?: boolean;
  /** Debounce time in milliseconds before auto-saving (default: 500ms) */
  debounceMs?: number;
}

/**
 * Get the filename for a board
 * - Quick boards: numbered (1, 2, 3...)
 * - Regular boards: board name or creation date
 */
function getBoardBaseFileName(board: Board): string {
  const name = board.name.trim();
  if (name && !name.startsWith("Quick Board")) {
    return name;
  }

  const date = new Date(board.createdAt);
  return date.toISOString().split("T")[0];
}

function getBoardFileName(board: Board, allBoards: Map<string, Board>): string {
  if (board.workstreamId === QUICK_BOARDS_WORKSPACE_ID) {
    // Get quick board number by sorting all quick boards by creation date
    const quickBoards = Array.from(allBoards.values())
      .filter((b) => b.workstreamId === QUICK_BOARDS_WORKSPACE_ID)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    const index = quickBoards.findIndex((b) => b.id === board.id);
    return `${index + 1}`;
  }

  const baseName = getBoardBaseFileName(board);
  const hasCollision = Array.from(allBoards.values()).some(
    (other) =>
      other.id !== board.id &&
      other.workstreamId === board.workstreamId &&
      getBoardBaseFileName(other) === baseName,
  );

  return hasCollision ? `${baseName}-${board.id.slice(0, 8)}` : baseName;
}

export interface DiskStorageSyncStatus {
  isSaving: boolean;
  isDirty: boolean;
  lastSavedAt: Date | null;
  isDiskStorage: boolean;
  saveNow: () => Promise<void>;
}

/**
 * Hook that syncs a board to disk storage when the workspace has disk storage enabled
 */
export function useDiskStorageSync({
  boardId,
  elements,
  canvasBackground,
  enabled = true,
  debounceMs = 500,
}: UseDiskStorageSyncOptions): DiskStorageSyncStatus {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHashRef = useRef<string>("");
  const needsInitialSaveRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const boards = useBoardStore((s) => s.boards);
  const workstreams = useBoardStore((s) => s.workstreams);
  const autoSaveEnabled = useBoardStore(
    (s) => s.settings?.autoSaveEnabled ?? true,
  );

  // Get the workspace storage type for this board
  const board = boards.get(boardId);
  const workspace = board ? workstreams.get(board.workstreamId) : null;
  const workspaceStorageType = workspace?.storageType || "browser";
  const isDiskStorage = workspaceStorageType === "disk";

  // Get sync store actions
  const setSyncStatus = useBoardSyncStore((s) => s.setSyncStatus);

  // Use refs to avoid stale values inside async work
  const elementsRef = useRef(elements);
  const canvasBackgroundRef = useRef(canvasBackground);
  elementsRef.current = elements;
  canvasBackgroundRef.current = canvasBackground;

  const syncToDisk = useCallback(
    async (force = false) => {
      if (!isDiskStorage || !enabled) return;
      if (inFlightRef.current) {
        pendingSyncRef.current = true;
        return;
      }

      const currentBoard = useBoardStore.getState().boards.get(boardId);
      if (!currentBoard) return;

      // Check if we still have access to the directory
      const hasAccess = await hasWorkspaceStorageDirectory(
        currentBoard.workstreamId,
      );
      if (!hasAccess) return;

      const currentHash = JSON.stringify({
        elements: elementsRef.current,
        canvasBackground: canvasBackgroundRef.current,
      });
      if (
        !force &&
        currentHash === lastSavedHashRef.current &&
        !needsInitialSaveRef.current
      ) {
        // Already saved, ensure status is "saved"
        setIsDirty(false);
        setSyncStatus(boardId, "saved");
        return;
      }

      setIsSaving(true);
      setSyncStatus(boardId, "saving");
      inFlightRef.current = true;

      try {
        const currentBoards = useBoardStore.getState().boards;

        const fileName = getBoardFileName(currentBoard, currentBoards);

        const kladdeFile: ShadeworksFile = {
          type: "kladde",
          version: 1,
          elements: elementsRef.current,
          appState: {
            canvasBackground: canvasBackgroundRef.current,
          },
        };

        const jsonString = JSON.stringify(kladdeFile, null, 2);
        const result = await saveBoardToWorkspaceStorage(
          currentBoard.workstreamId,
          fileName,
          jsonString,
        );

        if (result) {
          lastSavedHashRef.current = currentHash;
          needsInitialSaveRef.current = false;
          setLastSavedAt(new Date());
          setIsDirty(false);
          setSyncStatus(boardId, "saved");
        }
      } catch (error) {
        console.error("Failed to sync board to disk:", error);
        // Keep as unsaved on error
        setIsDirty(true);
        setSyncStatus(boardId, "unsaved");
      } finally {
        setIsSaving(false);
        inFlightRef.current = false;
        if (pendingSyncRef.current) {
          pendingSyncRef.current = false;
          void syncToDisk();
        }
      }
    },
    [
      boardId,
      isDiskStorage,
      enabled,
      setSyncStatus,
    ],
  );

  // Manual save function
  const saveNow = useCallback(async () => {
    // Clear any pending auto-save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await syncToDisk(true);
  }, [syncToDisk]);

  // Mark as unsaved when content changes (for disk storage workspaces)
  useEffect(() => {
    if (!isDiskStorage || !enabled) return;

    if (!lastSavedHashRef.current) return;

    const currentHash = JSON.stringify({
      elements: elementsRef.current,
      canvasBackground: canvasBackgroundRef.current,
    });
    if (currentHash !== lastSavedHashRef.current) {
      // Only update if not already dirty
      setIsDirty((prev) => {
        if (!prev) setSyncStatus(boardId, "unsaved");
        return true;
      });
    }
  }, [
    boardId,
    elements,
    canvasBackground,
    isDiskStorage,
    enabled,
    setSyncStatus,
  ]);

  useEffect(() => {
    if (!isDiskStorage || !enabled) return;

    const currentHash = JSON.stringify({
      elements: elementsRef.current,
      canvasBackground: canvasBackgroundRef.current,
    });
    lastSavedHashRef.current = currentHash;
    needsInitialSaveRef.current = true;
    setIsDirty(false);
    setSyncStatus(boardId, "saved");
  }, [boardId, isDiskStorage, enabled, setSyncStatus]);

  // Debounced auto-save on content change (only if auto-save is enabled)
  useEffect(() => {
    if (!isDiskStorage || !enabled || !autoSaveEnabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      void syncToDisk();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    elements,
    canvasBackground,
    isDiskStorage,
    enabled,
    autoSaveEnabled,
    debounceMs,
    syncToDisk,
  ]);

  // Sync on unmount if there are pending changes
  useEffect(() => {
    const syncOnUnmount = syncToDisk;
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        void syncOnUnmount();
      }
    };
  }, [syncToDisk]);

  return {
    isSaving,
    isDirty,
    lastSavedAt,
    isDiskStorage,
    saveNow,
  };
}
