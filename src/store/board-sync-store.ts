import { create } from "zustand";

/**
 * Sync status for a board
 */
export type BoardSyncStatus = "saved" | "saving" | "unsaved";

/**
 * Store state for tracking real-time sync status per board
 */
interface BoardSyncState {
  syncStatus: Map<string, BoardSyncStatus>;
  setSyncStatus: (boardId: string, status: BoardSyncStatus) => void;
  getBoardSyncStatus: (boardId: string) => BoardSyncStatus;
  clearSyncStatus: (boardId: string) => void;
  clearAllSyncStatus: () => void;
}

/**
 * Lightweight store to track real-time sync status per board.
 * This is separate from the main board store to avoid unnecessary
 * re-renders and persistence overhead.
 */
export const useBoardSyncStore = create<BoardSyncState>()((set, get) => ({
  syncStatus: new Map(),

  setSyncStatus: (boardId: string, status: BoardSyncStatus) => {
    const currentStatus = get().syncStatus.get(boardId);
    // Only update if status actually changed
    if (currentStatus === status) return;
    set((state) => {
      const syncStatus = new Map(state.syncStatus);
      syncStatus.set(boardId, status);
      return { syncStatus };
    });
  },

  getBoardSyncStatus: (boardId: string) => {
    return get().syncStatus.get(boardId) || "saved";
  },

  clearSyncStatus: (boardId: string) => {
    set((state) => {
      const syncStatus = new Map(state.syncStatus);
      syncStatus.delete(boardId);
      return { syncStatus };
    });
  },

  clearAllSyncStatus: () => {
    set({ syncStatus: new Map() });
  },
}));
