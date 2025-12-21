import "@/lib/immer-setup";
import React from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useBoardStore } from "@/stores/board-management-store";
import type { TileData, Connection } from "@/types/canvas";

interface CanvasSnapshot {
  tiles: TileData[];
  connections: Connection[];
  assets: Record<string, unknown>;
}

interface BoardHistoryState {
  history: CanvasSnapshot[];
  future: CanvasSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
}

interface HistoryStore {
  boards: Map<string, BoardHistoryState>;
  push: (boardId: string) => void;
  undo: (boardId: string) => boolean;
  redo: (boardId: string) => boolean;
  canUndo: (boardId: string) => boolean;
  canRedo: (boardId: string) => boolean;
  initBoard: (boardId: string) => void;
  clearBoard: (boardId: string) => void;
}

const useHistoryStore = create<HistoryStore>()(
  immer((set, get) => ({
    boards: new Map(),

    initBoard: (boardId: string) => {
      set((state) => {
        if (!state.boards.has(boardId)) {
          state.boards.set(boardId, {
            history: [],
            future: [],
            canUndo: false,
            canRedo: false,
          });
        }
      });
    },

    clearBoard: (boardId: string) => {
      set((state) => {
        state.boards.delete(boardId);
      });
    },

    push: (boardId: string) => {
      const canvas = useBoardStore.getState();
      const snapshot: CanvasSnapshot = {
        tiles: structuredClone(canvas.tiles),
        connections: structuredClone(canvas.connections),
        assets: structuredClone(canvas.assets),
      };

      set((state) => {
        const boardState = state.boards.get(boardId);
        if (!boardState) {
          // Initialize if not exists
          state.boards.set(boardId, {
            history: [snapshot],
            future: [],
            canUndo: false,
            canRedo: false,
          });
          return;
        }

        boardState.history.push(snapshot);
        if (boardState.history.length > 100) {
          boardState.history.shift();
        }
        boardState.future = [];
        boardState.canUndo = boardState.history.length > 1;
        boardState.canRedo = boardState.future.length > 0;
      });
    },

    undo: (boardId: string) => {
      const state = get();
      const boardState = state.boards.get(boardId);
      if (!boardState || boardState.history.length < 2) return false;

      let previous: CanvasSnapshot | undefined;
      set((s) => {
        const board = s.boards.get(boardId)!;
        const current = board.history.pop()!;
        board.future.push(current);
        previous = board.history[board.history.length - 1];
        board.canUndo = board.history.length > 1;
        board.canRedo = board.future.length > 0;
      });

      if (!previous) return false;
      useBoardStore.setState({
        tiles: structuredClone(previous.tiles),
        connections: structuredClone(previous.connections),
        assets: structuredClone(previous.assets),
      });
      return true;
    },

    redo: (boardId: string) => {
      const state = get();
      const boardState = state.boards.get(boardId);
      if (!boardState || boardState.future.length === 0) return false;

      let next: CanvasSnapshot | undefined;
      set((s) => {
        const board = s.boards.get(boardId)!;
        next = board.future.pop()!;
        board.history.push(next);
        board.canUndo = board.history.length > 1;
        board.canRedo = board.future.length > 0;
      });

      if (!next) return false;
      useBoardStore.setState({
        tiles: structuredClone(next.tiles),
        connections: structuredClone(next.connections),
        assets: structuredClone(next.assets),
      });
      return true;
    },

    canUndo: (boardId: string) => {
      const state = get();
      const boardState = state.boards.get(boardId);
      return boardState?.canUndo ?? false;
    },

    canRedo: (boardId: string) => {
      const state = get();
      const boardState = state.boards.get(boardId);
      return boardState?.canRedo ?? false;
    },
  })),
);

export function useCanvasHistory(boardId: string) {
  const { push, undo, redo, canUndo, canRedo, initBoard, clearBoard } =
    useHistoryStore();

  // Initialize board on mount using useEffect to avoid render-time mutations
  React.useEffect(() => {
    if (!useHistoryStore.getState().boards.has(boardId)) {
      initBoard(boardId);
    }
  }, [boardId, initBoard]);

  // Use selectors with shallow comparison to avoid unnecessary re-renders
  const boardCanUndo = useHistoryStore(
    React.useCallback((state) => state.canUndo(boardId), [boardId]),
  );
  const boardCanRedo = useHistoryStore(
    React.useCallback((state) => state.canRedo(boardId), [boardId]),
  );

  return React.useMemo(
    () => ({
      pushToHistory: () => push(boardId),
      undo: () => undo(boardId),
      redo: () => redo(boardId),
      canUndo: boardCanUndo,
      canRedo: boardCanRedo,
      clearHistory: () => clearBoard(boardId),
    }),
    [push, undo, redo, boardCanUndo, boardCanRedo, clearBoard, boardId],
  );
}
