import React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { BOARD_DATA_VERSION } from "@/types/version";
import { DEBOUNCE_DELAYS } from "@/lib/constants";
import type {
  BoardData,
  TileData,
  Connection,
  Board,
  Workstream,
} from "@/types/canvas";
import { idbStorage } from "./idb-storage";
import { safeParseDate } from "@/lib/dates/parse";
import { applyPatchLocally, applyShallowPatch } from "./patch-utils";

export type FlushStatus =
  | "idle"
  | "saving-local"
  | "queued-remote"
  | "syncing"
  | "error";
export type PatchOp = {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
};

interface BoardStore {
  board: BoardData;
  tiles: TileData[];
  connections: Connection[];
  assets: Record<string, unknown>;
  drafts: Record<string, unknown>;
  dirtyPaths: Set<string>;
  patchQueue: PatchOp[];
  status: FlushStatus;
  version: string;
  workstreams: Workstream[];
  currentWorkstreamId: string | null;
  boards: Board[];
  currentBoardId: string | null;
  boardData: Record<string, BoardData>;

  // Dashboard state
  selectedTags: string[];
  searchQuery: string;
  dashboardView: "grid" | "list" | "timeline";

  // Board management helpers
  loadBoardData: (id: string) => BoardData;
  switchToBoard: (id: string) => void;
  updateBoard: (id: string, data: Partial<Board>) => void;
  saveBoardData: (id: string, data?: BoardData) => void;

  setDraft: (key: string, value: unknown) => void;
  commitDraft: (key: string, targetPath: string) => void;
  update: (patch: Partial<BoardData>, opts?: { hot?: boolean }) => void;
  scheduleFlush: (reason?: "idle" | "pointerup" | "visibilitychange") => void;
  flushNow: () => Promise<void>;
  markSynced: (nextVersion: string) => void;
  getWorkstreamBoards: (id: string) => Board[];
  getFilteredBoards: () => Board[];
  updateLastAccessed: (id: string) => void;
  duplicateBoard: (id: string) => void;
  deleteBoard: (id: string) => void;
  createBoard: (
    boardData: Omit<Board, "id" | "createdAt" | "updatedAt" | "lastAccessed">,
  ) => string;
  createBoardWithId: (
    workstreamId: string,
    id: string,
    boardData: Omit<Board, "id" | "createdAt" | "updatedAt" | "lastAccessed">,
  ) => void;
  createWorkstream: (
    workstream: Omit<Workstream, "id" | "createdAt" | "updatedAt">,
  ) => void;
  ensureBoardExists: (boardId: string, boardData?: Partial<Board>) => Board;
  ensureDefaultWorkstream: () => Workstream;

  // Dashboard methods
  getAllTags: () => string[];
  setSelectedTags: (tags: string[]) => void;
  setSearchQuery: (query: string) => void;
  setDashboardView: (view: "grid" | "list" | "timeline") => void;
}

const createEmptyBoardData = (): BoardData => ({
  tiles: [],
  connections: [],
  assets: {},
  version: BOARD_DATA_VERSION,
});

let flushTimer: ReturnType<typeof setTimeout> | null = null;

export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      board: createEmptyBoardData(),
      tiles: [],
      connections: [],
      assets: {},
      drafts: {},
      dirtyPaths: new Set(),
      patchQueue: [],
      status: "idle",
      version: BOARD_DATA_VERSION,
      workstreams: [],
      currentWorkstreamId: null,
      boards: [],
      currentBoardId: null,
      boardData: {},

      // Dashboard state
      selectedTags: [],
      searchQuery: "",
      dashboardView: "grid",

      setDraft: (k, v) => set((s) => ({ drafts: { ...s.drafts, [k]: v } })),

      commitDraft: (k, path) => {
        const v = get().drafts[k];
        if (v === undefined) return;
        if (!path.startsWith("/")) return;
        set((s) => {
          const op: PatchOp = { op: "replace", path, value: v };
          applyPatchLocally(s.board, op);
          s.patchQueue.push(op);
          s.dirtyPaths.add(path);
          const { [k]: _omit, ...rest } = s.drafts;
          s.drafts = rest;
          s.status = "queued-remote";
          return s;
        });
        get().scheduleFlush();
      },

      update: (patch) => {
        const { currentBoardId } = get();
        set((s) => {
          // Update both the current board and the specific board data
          applyShallowPatch(s.board, patch, s.dirtyPaths, s.patchQueue);

          // Update the specific board data for local persistence
          if (currentBoardId && s.boardData[currentBoardId]) {
            applyShallowPatch(
              s.boardData[currentBoardId],
              patch,
              new Set(),
              [],
            );
          } else if (currentBoardId) {
            // Initialize board data if it doesn't exist
            s.boardData[currentBoardId] = { ...s.board, ...patch };
          }

          // Update board metadata if tiles or connections changed
          if (currentBoardId && (patch.tiles || patch.connections)) {
            const board = s.boards.find((b) => b.id === currentBoardId);
            if (board) {
              const boardData = s.boardData[currentBoardId];
              board.metadata.tileCount = boardData?.tiles?.length || 0;
              board.metadata.connectionCount =
                boardData?.connections?.length || 0;
              board.updatedAt = new Date();
            }
          }

          s.status = "queued-remote";
          return s;
        });

        get().scheduleFlush();
      },

      scheduleFlush: (reason) => {
        if (reason === "visibilitychange") {
          void get().flushNow();
          return;
        }
        if (flushTimer) clearTimeout(flushTimer);
        const delay =
          reason === "pointerup"
            ? DEBOUNCE_DELAYS.IMMEDIATE
            : DEBOUNCE_DELAYS.BOARD_SAVE;
        flushTimer = setTimeout(() => get().flushNow(), delay);
      },

      flushNow: async () => {
        const { patchQueue, version } = get();
        if (!patchQueue.length) return;
        set({ status: "syncing" });
        try {
          const res = await fetch("/api/boards/current", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json-patch+json",
              "If-Match": version,
            },
            body: JSON.stringify(patchQueue),
          });
          if (res.ok) {
            const data = await res.json();
            set({ patchQueue: [], status: "idle", version: data.version });
          } else {
            set({ status: "error" });
          }
        } catch (e) {
          set({ status: "error" });
        }
      },

      markSynced: (v) => set({ status: "idle", version: v, patchQueue: [] }),

      loadBoardData: (id) => get().boardData[id] ?? createEmptyBoardData(),
      switchToBoard: (id) => {
        set((s) => {
          // Ensure board data exists for this board
          if (!s.boardData[id]) {
            s.boardData[id] = createEmptyBoardData();
          }

          return {
            currentBoardId: id,
            board: s.boardData[id],
          };
        });

        // Update lastAccessed time for the board (critical for persistence)
        get().updateLastAccessed(id);
      },
      updateBoard: (id, data) =>
        set((s) => ({
          boards: s.boards.map((b) => (b.id === id ? { ...b, ...data } : b)),
        })),
      saveBoardData: (id, data) => {
        const state = get();
        const toSave = data ?? state.boardData[id] ?? state.board;
        if (!toSave) return;

        // Local-first: Update in-memory store which auto-persists to IndexedDB via Zustand persist
        set((s) => ({
          boardData: { ...s.boardData, [id]: toSave },
          // Also update the current board if this is the active board
          ...(s.currentBoardId === id ? { board: toSave } : {}),
        }));

        // Remote sync is handled by the PATCH system via scheduleFlush()
        // This eliminates duplicate work and ensures proper debouncing
      },

      getWorkstreamBoards: (id) =>
        get().boards.filter((b) => b.workstreamId === id),
      getFilteredBoards: () => {
        const { boards, selectedTags, searchQuery } = get();
        const query = searchQuery.toLowerCase();
        return boards.filter((b) => {
          const matchesQuery =
            b.name.toLowerCase().includes(query) ||
            b.description?.toLowerCase().includes(query) ||
            b.tags.some((t) => t.toLowerCase().includes(query));
          const matchesTags =
            !selectedTags.length ||
            selectedTags.every((t) => b.tags.includes(t));
          return matchesQuery && matchesTags;
        });
      },
      updateLastAccessed: (id) =>
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === id ? { ...b, lastAccessed: new Date() } : b,
          ),
        })),
      duplicateBoard: (id: string) => {
        const state = get();
        const src = state.boards.find((b) => b.id === id);
        if (!src) return;
        const newId = crypto.randomUUID();
        const now = new Date();
        const copy: Board = {
          ...src,
          id: newId,
          name: `${src.name} (Copy)`,
          createdAt: now,
          updatedAt: now,
          lastAccessed: now,
        };
        set((s) => {
          const ws = s.workstreams.find((w) => w.id === copy.workstreamId);
          if (ws) {
            ws.boardIds.push(newId);
            ws.metadata.boardCount = (ws.metadata.boardCount ?? 0) + 1;
            ws.updatedAt = now;
          }
          const srcData = s.boardData[id] ?? createEmptyBoardData();
          return {
            boards: [...s.boards, copy],
            boardData: {
              ...s.boardData,
              [newId]: structuredClone(srcData),
            },
          };
        });
      },
      deleteBoard: (id: string) => {
        const state = get();
        const boardToDelete = state.boards.find((b) => b.id === id);
        if (!boardToDelete) return;

        set((s) => {
          const nextBoards = s.boards.filter((b) => b.id !== id);
          const ws = s.workstreams.find(
            (w) => w.id === boardToDelete.workstreamId,
          );
          if (ws) {
            ws.boardIds = ws.boardIds.filter((bid) => bid !== id);
            ws.metadata.boardCount = Math.max(
              0,
              (ws.metadata.boardCount ?? 0) - 1,
            );
            ws.updatedAt = new Date();
          }
          const { [id]: _omit, ...nextBoardData } = s.boardData;
          return { boards: nextBoards, boardData: nextBoardData };
        });
      },
      createBoard: (
        boardData: Omit<
          Board,
          "id" | "createdAt" | "updatedAt" | "lastAccessed"
        >,
      ) => {
        const newBoard: Board = {
          ...boardData,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessed: new Date(),
          tags: boardData.tags || [],
          metadata: boardData.metadata || {
            tileCount: 0,
            connectionCount: 0,
            canvasBounds: { width: 0, height: 0, minX: 0, minY: 0 },
          },
        };
        set((s) => ({
          boards: [...s.boards, newBoard],
          currentBoardId: newBoard.id,
          boardData: { ...s.boardData, [newBoard.id]: createEmptyBoardData() },
        }));
        return newBoard.id;
      },
      createBoardWithId: (
        workstreamId: string,
        id: string,
        boardData: Omit<
          Board,
          "id" | "createdAt" | "updatedAt" | "lastAccessed"
        >,
      ) => {
        const now = new Date();
        set((state) => {
          // Check if board already exists
          if (state.boards.some((b) => b.id === id)) {
            return state; // Board already exists, no changes
          }

          const newBoard: Board = {
            ...boardData,
            id,
            workstreamId,
            createdAt: now,
            updatedAt: now,
            lastAccessed: now,
            tags: boardData.tags || [],
            metadata: boardData.metadata || {
              tileCount: 0,
              connectionCount: 0,
              canvasBounds: {
                width: 2000,
                height: 2000,
                minX: -500,
                minY: -500,
              },
            },
            settings: boardData.settings || {
              isPublic: false,
              allowComments: true,
              backgroundColor: "#ffffff",
              gridVisible: true,
            },
          };

          // Update workstream
          const workstream = state.workstreams.find(
            (w) => w.id === workstreamId,
          );
          if (workstream) {
            if (!workstream.boardIds.includes(id)) {
              workstream.boardIds.push(id);
            }
            workstream.metadata.boardCount = workstream.boardIds.length;
            workstream.updatedAt = now;
          }

          return {
            ...state,
            boards: [...state.boards, newBoard],
            boardData: { ...state.boardData, [id]: createEmptyBoardData() },
            currentBoardId: id,
            currentWorkstreamId: workstreamId,
          };
        });
      },
      createWorkstream: (workstreamData) => {
        const newWorkstream: Workstream = {
          ...workstreamData,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((s) => ({
          workstreams: [...s.workstreams, newWorkstream],
        }));
      },
      ensureBoardExists: (boardId, boardData = {}) => {
        const state = get();
        let existingBoard = state.boards.find((b) => b.id === boardId);

        if (!existingBoard) {
          // Ensure we have a default workstream
          const defaultWorkstream = get().ensureDefaultWorkstream();

          // Validate and resolve workstream ID
          const providedWorkstreamId =
            boardData.workstreamId || defaultWorkstream.id;
          const workstreamExists = state.workstreams.some(
            (w) => w.id === providedWorkstreamId,
          );
          const resolvedWorkstreamId = workstreamExists
            ? providedWorkstreamId
            : defaultWorkstream.id;

          if (!workstreamExists && boardData.workstreamId) {
            console.error(
              `Workstream ${boardData.workstreamId} not found, using default`,
            );
          }

          // Check if we have existing board data
          const existingBoardData = state.boardData[boardId];

          // Validate and normalize board data

          const newBoard: Board = {
            id: boardId,
            name:
              typeof boardData.name === "string"
                ? boardData.name
                : existingBoardData
                  ? "Recovered Board"
                  : "New Board",
            description:
              typeof boardData.description === "string"
                ? boardData.description
                : "Board created from direct access",
            workstreamId: resolvedWorkstreamId,
            tags: Array.isArray(boardData.tags) ? boardData.tags : [],
            thumbnail: boardData.thumbnail,
            createdAt: safeParseDate(boardData.createdAt),
            updatedAt: safeParseDate(boardData.updatedAt),
            lastAccessed: new Date(),
            metadata: {
              tileCount:
                typeof boardData.metadata?.tileCount === "number"
                  ? boardData.metadata.tileCount
                  : existingBoardData?.tiles?.length || 0,
              connectionCount:
                typeof boardData.metadata?.connectionCount === "number"
                  ? boardData.metadata.connectionCount
                  : existingBoardData?.connections?.length || 0,
              canvasBounds: {
                width:
                  typeof boardData.metadata?.canvasBounds?.width === "number"
                    ? boardData.metadata.canvasBounds.width
                    : 2000,
                height:
                  typeof boardData.metadata?.canvasBounds?.height === "number"
                    ? boardData.metadata.canvasBounds.height
                    : 2000,
                minX:
                  typeof boardData.metadata?.canvasBounds?.minX === "number"
                    ? boardData.metadata.canvasBounds.minX
                    : -500,
                minY:
                  typeof boardData.metadata?.canvasBounds?.minY === "number"
                    ? boardData.metadata.canvasBounds.minY
                    : -500,
              },
            },
            settings: {
              isPublic:
                typeof boardData.settings?.isPublic === "boolean"
                  ? boardData.settings.isPublic
                  : false,
              allowComments:
                typeof boardData.settings?.allowComments === "boolean"
                  ? boardData.settings.allowComments
                  : true,
              backgroundColor:
                typeof boardData.settings?.backgroundColor === "string"
                  ? boardData.settings.backgroundColor
                  : "#ffffff",
              gridVisible:
                typeof boardData.settings?.gridVisible === "boolean"
                  ? boardData.settings.gridVisible
                  : true,
            },
          };

          set((s) => {
            const ws = s.workstreams.find((w) => w.id === resolvedWorkstreamId);
            if (ws && !ws.boardIds.includes(newBoard.id)) {
              ws.boardIds.push(newBoard.id);
              ws.metadata.boardCount = (ws.metadata.boardCount ?? 0) + 1;
              ws.updatedAt = new Date();
            }
            return {
              boards: [...s.boards, newBoard],
              boardData: {
                ...s.boardData,
                [boardId]: s.boardData[boardId] || createEmptyBoardData(),
              },
            };
          });

          existingBoard = newBoard;
        }

        return existingBoard;
      },
      ensureDefaultWorkstream: () => {
        const state = get();

        if (state.workstreams.length === 0) {
          const defaultWorkstream: Workstream = {
            id: crypto.randomUUID(),
            name: "Default Workspace",
            description: "Default workspace for boards",
            color: "#3b82f6",
            icon: "Folder",
            createdAt: new Date(),
            updatedAt: new Date(),
            boardIds: [],
            metadata: {
              boardCount: 0,
              lastAccessed: new Date(),
            },
          };

          set((s) => ({
            workstreams: [...s.workstreams, defaultWorkstream],
          }));

          return defaultWorkstream;
        }

        return state.workstreams[0];
      },

      // Dashboard methods
      getAllTags: () => {
        const state = get();
        const tags = new Set<string>();
        state.boards.forEach((board: Board) => {
          if (board.tags && Array.isArray(board.tags)) {
            board.tags.forEach((tag: string) => tags.add(tag));
          }
        });
        return Array.from(tags).sort();
      },
      setSelectedTags: (tags) => set({ selectedTags: tags }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setDashboardView: (view) => set({ dashboardView: view }),
    }),
    {
      name: "board-store",
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        board: s.board,
        version: s.version,
        patchQueue: s.patchQueue,
        workstreams: s.workstreams,
        boards: s.boards,
        boardData: s.boardData,
        currentBoardId: s.currentBoardId,
        currentWorkstreamId: s.currentWorkstreamId,
        selectedTags: s.selectedTags,
        searchQuery: s.searchQuery,
        dashboardView: s.dashboardView,
      }),
      version: 1,
      // Add error handling for hydration failures with SSR safety
      onRehydrateStorage: () => {
        return (state, error) => {
          if (typeof window === "undefined") {
            // Server-side: silently complete without logging
            return;
          }

          if (!state) return;

          // Use shared date parser for hydration

          // Convert persisted Workstreams date fields from strings to Date objects
          state.workstreams = state.workstreams.map((ws) => ({
            ...ws,
            createdAt: safeParseDate(ws.createdAt),
            updatedAt: safeParseDate(ws.updatedAt),
            metadata: {
              ...ws.metadata,
              lastAccessed: ws.metadata.lastAccessed
                ? safeParseDate(ws.metadata.lastAccessed)
                : undefined,
            },
          }));

          // Convert persisted Boards date fields from strings to Date objects
          state.boards = state.boards.map((b) => ({
            ...b,
            createdAt: safeParseDate(b.createdAt),
            updatedAt: safeParseDate(b.updatedAt),
            lastAccessed: safeParseDate(b.lastAccessed),
          }));

          // Preserve existing default-workstream fallback
          if (state.workstreams.length === 0) {
            const defaultWorkstream = {
              id: crypto.randomUUID(),
              name: "Default Workspace",
              description: "Default workspace for boards",
              color: "#3b82f6",
              icon: "Folder",
              createdAt: new Date(),
              updatedAt: new Date(),
              boardIds: [],
              metadata: {
                boardCount: 0,
                lastAccessed: new Date(),
              },
            };
            state.workstreams = [defaultWorkstream];
          }
        };
      },
    },
  ),
);

export default useBoardStore;

// Client-side hook to setup lifecycle flush events
export const useBoardStoreLifecycle = () => {
  React.useEffect(() => {
    // Guard against SSR
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const flushWithBeacon = () => {
      const { patchQueue, version } = useBoardStore.getState();
      if (!patchQueue.length) return;
      try {
        // Include version in the request body since sendBeacon can't set custom headers
        const payload = { patches: patchQueue, version };
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/boards/current/beacon", blob);
      } catch {
        void useBoardStore.getState().flushNow();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushWithBeacon();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushWithBeacon);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushWithBeacon);
    };
  }, []);
};
