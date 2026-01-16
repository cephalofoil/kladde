import { useEffect, useRef, useCallback, useState } from "react";
import type { BoardElement, ShadeworksFile } from "@/lib/board-types";
import type { Board, Workstream } from "@/lib/store-types";
import {
  saveBoardToGlobalStorage,
  hasGlobalStorageDirectory,
} from "@/lib/filesystem-storage";
import { useBoardStore } from "@/store/board-store";
import { useBoardSyncStore } from "@/store/board-sync-store";

const QUICK_BOARDS_WORKSPACE_ID = "quick-boards";
const QUICKBOARDS_FOLDER_NAME = "quickboards";

interface UseDiskStorageSyncOptions {
  boardId: string;
  elements: BoardElement[];
  canvasBackground: "none" | "dots" | "lines" | "grid";
  enabled?: boolean;
  debounceMs?: number;
}

/**
 * Get the filename for a board
 * - Quick boards: numbered (1, 2, 3...)
 * - Regular boards: board name or creation date
 */
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

  // Use board name if it looks like a custom name
  const name = board.name.trim();
  if (name && !name.startsWith("Quick Board")) {
    return name;
  }

  // Fall back to creation date
  const date = new Date(board.createdAt);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Get the folder name for a workspace
 */
function getWorkspaceFolderName(
  workstreamId: string,
  workstreams: Map<string, Workstream>,
): string {
  if (workstreamId === QUICK_BOARDS_WORKSPACE_ID) {
    return QUICKBOARDS_FOLDER_NAME;
  }

  const workstream = workstreams.get(workstreamId);
  return workstream?.name || "Personal";
}

export interface DiskStorageSyncStatus {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
}

/**
 * Hook that syncs a board to disk storage when the workspace has disk storage enabled
 */
export function useDiskStorageSync({
  boardId,
  elements,
  canvasBackground,
  enabled = true,
  debounceMs = 1000,
}: UseDiskStorageSyncOptions): DiskStorageSyncStatus {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHashRef = useRef<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const boards = useBoardStore((s) => s.boards);
  const workstreams = useBoardStore((s) => s.workstreams);

  // Get the workspace storage type for this board
  const board = boards.get(boardId);
  const workspace = board ? workstreams.get(board.workstreamId) : null;
  const workspaceStorageType = workspace?.storageType || "browser";
  const isDiskStorage = workspaceStorageType === "disk";

  // Get sync store actions
  const setSyncStatus = useBoardSyncStore((s) => s.setSyncStatus);

  const syncToDisk = useCallback(async () => {
    if (!isDiskStorage || !enabled) return;

    // Check if we still have access to the directory
    const hasAccess = await hasGlobalStorageDirectory();
    if (!hasAccess) return;

    const currentBoard = useBoardStore.getState().boards.get(boardId);
    if (!currentBoard) return;

    const currentHash = JSON.stringify({ elements, canvasBackground });
    if (currentHash === lastSavedHashRef.current) {
      // Already saved, ensure status is "saved"
      setSyncStatus(boardId, "saved");
      return;
    }

    setIsSyncing(true);
    setSyncStatus(boardId, "saving");

    try {
      const currentWorkstreams = useBoardStore.getState().workstreams;
      const currentBoards = useBoardStore.getState().boards;

      const folderName = getWorkspaceFolderName(
        currentBoard.workstreamId,
        currentWorkstreams,
      );
      const fileName = getBoardFileName(currentBoard, currentBoards);

      const kladdeFile: ShadeworksFile = {
        type: "kladde",
        version: 1,
        elements,
        appState: {
          canvasBackground,
        },
      };

      const jsonString = JSON.stringify(kladdeFile, null, 2);
      const result = await saveBoardToGlobalStorage(
        folderName,
        fileName,
        jsonString,
      );

      if (result) {
        lastSavedHashRef.current = currentHash;
        setLastSyncedAt(new Date());
        setSyncStatus(boardId, "saved");
      }
    } catch (error) {
      console.error("Failed to sync board to disk:", error);
      // Keep as unsaved on error
      setSyncStatus(boardId, "unsaved");
    } finally {
      setIsSyncing(false);
    }
  }, [
    boardId,
    elements,
    canvasBackground,
    isDiskStorage,
    enabled,
    setSyncStatus,
  ]);

  // Mark as unsaved when content changes (for disk storage workspaces)
  useEffect(() => {
    if (!isDiskStorage || !enabled) return;

    const currentHash = JSON.stringify({ elements, canvasBackground });
    if (currentHash !== lastSavedHashRef.current) {
      setSyncStatus(boardId, "unsaved");
    }
  }, [
    boardId,
    elements,
    canvasBackground,
    isDiskStorage,
    enabled,
    setSyncStatus,
  ]);

  // Debounced sync on content change
  useEffect(() => {
    if (!isDiskStorage || !enabled) return;

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
    debounceMs,
    syncToDisk,
  ]);

  // Sync on unmount if there are pending changes
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        void syncToDisk();
      }
    };
  }, [syncToDisk]);

  // Initialize sync status on mount for disk storage boards
  useEffect(() => {
    if (isDiskStorage && enabled) {
      // Check if there are unsaved changes
      const currentHash = JSON.stringify({ elements, canvasBackground });
      if (currentHash !== lastSavedHashRef.current) {
        setSyncStatus(boardId, "unsaved");
      } else {
        setSyncStatus(boardId, "saved");
      }
    }
  }, [
    boardId,
    isDiskStorage,
    enabled,
    elements,
    canvasBackground,
    setSyncStatus,
  ]);

  return {
    isSyncing,
    lastSyncedAt,
  };
}
