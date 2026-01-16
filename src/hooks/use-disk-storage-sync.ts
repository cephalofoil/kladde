import { useEffect, useRef, useCallback } from "react";
import type { BoardElement, ShadeworksFile } from "@/lib/board-types";
import type { Board, Workstream } from "@/lib/store-types";
import {
    saveBoardToGlobalStorage,
    hasGlobalStorageDirectory,
} from "@/lib/filesystem-storage";
import { useBoardStore } from "@/store/board-store";

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
                    new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime(),
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
 * Hook that syncs a board to disk storage when global disk storage is enabled
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
    const isSyncingRef = useRef(false);
    const lastSyncedAtRef = useRef<Date | null>(null);

    const diskStorageEnabled = useBoardStore((s) => s.settings.diskStorageEnabled);
    const boards = useBoardStore((s) => s.boards);
    const workstreams = useBoardStore((s) => s.workstreams);

    const syncToDisk = useCallback(async () => {
        if (!diskStorageEnabled || !enabled) return;

        // Check if we still have access to the directory
        const hasAccess = await hasGlobalStorageDirectory();
        if (!hasAccess) return;

        const board = boards.get(boardId);
        if (!board) return;

        const currentHash = JSON.stringify({ elements, canvasBackground });
        if (currentHash === lastSavedHashRef.current) return;

        isSyncingRef.current = true;

        try {
            const folderName = getWorkspaceFolderName(
                board.workstreamId,
                workstreams,
            );
            const fileName = getBoardFileName(board, boards);

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
                lastSyncedAtRef.current = new Date();
            }
        } catch (error) {
            console.error("Failed to sync board to disk:", error);
        } finally {
            isSyncingRef.current = false;
        }
    }, [
        boardId,
        elements,
        canvasBackground,
        diskStorageEnabled,
        enabled,
        boards,
        workstreams,
    ]);

    // Debounced sync on content change
    useEffect(() => {
        if (!diskStorageEnabled || !enabled) return;

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
    }, [elements, canvasBackground, diskStorageEnabled, enabled, debounceMs, syncToDisk]);

    // Sync on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                void syncToDisk();
            }
        };
    }, [syncToDisk]);

    return {
        isSyncing: isSyncingRef.current,
        lastSyncedAt: lastSyncedAtRef.current,
    };
}
