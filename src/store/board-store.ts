import { create } from "zustand";
import { persist } from "zustand/middleware";
import { idbStorage } from "./middleware/idb-storage";
import type {
  Board,
  BoardData,
  BoardStore,
  Workstream,
  PatchOperation,
} from "@/lib/store-types";
import type { BoardElement } from "@/lib/board-types";

const DEFAULT_WORKSTREAM_ID = "personal";

/**
 * Helper to create an empty board
 */
function createEmptyBoard(
  id: string,
  name: string,
  workstreamId: string
): Board {
  const now = new Date();
  return {
    id,
    name,
    description: "",
    workstreamId,
    tags: [],
    thumbnail: undefined,
    createdAt: now,
    updatedAt: now,
    lastAccessed: now,
    metadata: {
      elementCount: 0,
      canvasBounds: {
        width: 0,
        height: 0,
        minX: 0,
        minY: 0,
      },
    },
    settings: {
      backgroundColor: "none",
      gridVisible: true,
      gridSize: 20,
    },
  };
}

/**
 * Helper to create an empty board data
 */
function createEmptyBoardData(): BoardData {
  return {
    elements: [],
    version: 0,
  };
}

/**
 * Helper to create default workstream
 */
function createDefaultWorkstream(): Workstream {
  const now = new Date();
  return {
    id: DEFAULT_WORKSTREAM_ID,
    name: "Personal",
    description: "Your personal boards",
    color: "#6366f1",
    icon: "user",
    createdAt: now,
    updatedAt: now,
    boardIds: [],
    metadata: {
      boardCount: 0,
      lastAccessed: now,
    },
  };
}

/**
 * Main board store with local-first persistence
 */
export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      // Initial state
      boards: new Map(),
      boardData: new Map(),
      workstreams: new Map([[DEFAULT_WORKSTREAM_ID, createDefaultWorkstream()]]),
      ui: {
        currentBoardId: null,
        currentWorkstreamId: DEFAULT_WORKSTREAM_ID,
        selectedTags: [],
        searchQuery: "",
        dashboardView: "grid",
      },
      patchQueue: [],
      flushStatus: "idle",

      // Board CRUD
      createBoard: (name: string, workstreamId?: string) => {
        const boardId = crypto.randomUUID();
        const wsId = workstreamId || DEFAULT_WORKSTREAM_ID;

        set((state) => {
          const newBoard = createEmptyBoard(boardId, name, wsId);
          const newBoardData = createEmptyBoardData();

          const boards = new Map(state.boards);
          const boardData = new Map(state.boardData);
          const workstreams = new Map(state.workstreams);

          boards.set(boardId, newBoard);
          boardData.set(boardId, newBoardData);

          // Update workstream
          const workstream = workstreams.get(wsId);
          if (workstream) {
            workstreams.set(wsId, {
              ...workstream,
              boardIds: [...workstream.boardIds, boardId],
              metadata: {
                ...workstream.metadata,
                boardCount: workstream.boardIds.length + 1,
                lastAccessed: new Date(),
              },
            });
          }

          return {
            boards,
            boardData,
            workstreams,
            ui: { ...state.ui, currentBoardId: boardId },
          };
        });

        return boardId;
      },

      loadBoard: (id: string) => {
        const board = get().boards.get(id);
        if (board) {
          set((state) => {
            const boards = new Map(state.boards);
            boards.set(id, {
              ...board,
              lastAccessed: new Date(),
            });
            return { boards, ui: { ...state.ui, currentBoardId: id } };
          });
        }
        return board || null;
      },

      updateBoard: (id: string, updates: Partial<Board>) => {
        set((state) => {
          const board = state.boards.get(id);
          if (!board) return state;

          const boards = new Map(state.boards);
          boards.set(id, {
            ...board,
            ...updates,
            updatedAt: new Date(),
          });

          return { boards };
        });
      },

      deleteBoard: (id: string) => {
        set((state) => {
          const board = state.boards.get(id);
          if (!board) return state;

          const boards = new Map(state.boards);
          const boardData = new Map(state.boardData);
          const workstreams = new Map(state.workstreams);

          boards.delete(id);
          boardData.delete(id);

          // Remove from workstream
          const workstream = workstreams.get(board.workstreamId);
          if (workstream) {
            workstreams.set(board.workstreamId, {
              ...workstream,
              boardIds: workstream.boardIds.filter((bid) => bid !== id),
              metadata: {
                ...workstream.metadata,
                boardCount: workstream.boardIds.length - 1,
              },
            });
          }

          // Update current board if deleted
          const ui =
            state.ui.currentBoardId === id
              ? { ...state.ui, currentBoardId: null }
              : state.ui;

          return { boards, boardData, workstreams, ui };
        });
      },

      duplicateBoard: (id: string) => {
        const state = get();
        const board = state.boards.get(id);
        const data = state.boardData.get(id);

        if (!board || !data) return "";

        const newId = crypto.randomUUID();
        const now = new Date();

        set((prevState) => {
          const boards = new Map(prevState.boards);
          const boardData = new Map(prevState.boardData);
          const workstreams = new Map(prevState.workstreams);

          // Create duplicate board
          boards.set(newId, {
            ...board,
            id: newId,
            name: `${board.name} (Copy)`,
            createdAt: now,
            updatedAt: now,
            lastAccessed: now,
          });

          // Duplicate board data
          boardData.set(newId, {
            elements: data.elements.map((el) => ({
              ...el,
              id: crypto.randomUUID(), // New IDs for elements
            })),
            version: 0,
          });

          // Update workstream
          const workstream = workstreams.get(board.workstreamId);
          if (workstream) {
            workstreams.set(board.workstreamId, {
              ...workstream,
              boardIds: [...workstream.boardIds, newId],
              metadata: {
                ...workstream.metadata,
                boardCount: workstream.boardIds.length + 1,
              },
            });
          }

          return { boards, boardData, workstreams };
        });

        return newId;
      },

      switchToBoard: (id: string) => {
        set((state) => ({
          ui: { ...state.ui, currentBoardId: id },
        }));
      },

      // Element operations
      getElements: (boardId: string) => {
        const data = get().boardData.get(boardId);
        return data?.elements || [];
      },

      setElements: (boardId: string, elements: BoardElement[]) => {
        set((state) => {
          const boardData = new Map(state.boardData);
          const currentData = boardData.get(boardId);

          boardData.set(boardId, {
            elements,
            version: (currentData?.version || 0) + 1,
          });

          // Update board metadata
          const boards = new Map(state.boards);
          const board = boards.get(boardId);
          if (board) {
            boards.set(boardId, {
              ...board,
              metadata: {
                ...board.metadata,
                elementCount: elements.length,
              },
              updatedAt: new Date(),
            });
          }

          return { boardData, boards };
        });
      },

      addElement: (boardId: string, element: BoardElement) => {
        set((state) => {
          const data = state.boardData.get(boardId);
          if (!data) return state;

          const boardData = new Map(state.boardData);
          boardData.set(boardId, {
            elements: [...data.elements, element],
            version: data.version + 1,
          });

          return { boardData };
        });
      },

      updateElement: (
        boardId: string,
        elementId: string,
        updates: Partial<BoardElement>
      ) => {
        set((state) => {
          const data = state.boardData.get(boardId);
          if (!data) return state;

          const boardData = new Map(state.boardData);
          boardData.set(boardId, {
            elements: data.elements.map((el) =>
              el.id === elementId ? { ...el, ...updates } : el
            ),
            version: data.version + 1,
          });

          return { boardData };
        });
      },

      deleteElement: (boardId: string, elementId: string) => {
        set((state) => {
          const data = state.boardData.get(boardId);
          if (!data) return state;

          const boardData = new Map(state.boardData);
          boardData.set(boardId, {
            elements: data.elements.filter((el) => el.id !== elementId),
            version: data.version + 1,
          });

          return { boardData };
        });
      },

      replaceElements: (boardId: string, elements: BoardElement[]) => {
        // For Yjs sync - replaces all elements without incrementing version
        set((state) => {
          const boardData = new Map(state.boardData);
          const currentData = boardData.get(boardId);

          boardData.set(boardId, {
            elements,
            version: currentData?.version || 0,
          });

          return { boardData };
        });
      },

      // Workstream management
      createWorkstream: (name: string, color: string, icon?: string) => {
        const id = crypto.randomUUID();
        const now = new Date();

        set((state) => {
          const workstreams = new Map(state.workstreams);
          workstreams.set(id, {
            id,
            name,
            description: "",
            color,
            icon,
            createdAt: now,
            updatedAt: now,
            boardIds: [],
            metadata: {
              boardCount: 0,
              lastAccessed: now,
            },
          });

          return { workstreams };
        });

        return id;
      },

      updateWorkstream: (id: string, updates: Partial<Workstream>) => {
        set((state) => {
          const workstream = state.workstreams.get(id);
          if (!workstream) return state;

          const workstreams = new Map(state.workstreams);
          workstreams.set(id, {
            ...workstream,
            ...updates,
            updatedAt: new Date(),
          });

          return { workstreams };
        });
      },

      deleteWorkstream: (id: string) => {
        if (id === DEFAULT_WORKSTREAM_ID) return; // Can't delete default

        set((state) => {
          const workstream = state.workstreams.get(id);
          if (!workstream) return state;

          const workstreams = new Map(state.workstreams);
          const boards = new Map(state.boards);

          // Move boards to default workstream
          const defaultWs = workstreams.get(DEFAULT_WORKSTREAM_ID)!;
          workstream.boardIds.forEach((boardId) => {
            const board = boards.get(boardId);
            if (board) {
              boards.set(boardId, {
                ...board,
                workstreamId: DEFAULT_WORKSTREAM_ID,
              });
            }
          });

          workstreams.set(DEFAULT_WORKSTREAM_ID, {
            ...defaultWs,
            boardIds: [...defaultWs.boardIds, ...workstream.boardIds],
            metadata: {
              ...defaultWs.metadata,
              boardCount: defaultWs.boardIds.length + workstream.boardIds.length,
            },
          });

          workstreams.delete(id);

          return { workstreams, boards };
        });
      },

      getWorkstreamBoards: (workstreamId: string) => {
        const state = get();
        return Array.from(state.boards.values()).filter(
          (board) => board.workstreamId === workstreamId
        );
      },

      // Dashboard features
      getAllTags: () => {
        const allTags = new Set<string>();
        Array.from(get().boards.values()).forEach((board) => {
          board.tags.forEach((tag) => allTags.add(tag));
        });
        return Array.from(allTags).sort();
      },

      setSelectedTags: (tags: string[]) => {
        set((state) => ({
          ui: { ...state.ui, selectedTags: tags },
        }));
      },

      setSearchQuery: (query: string) => {
        set((state) => ({
          ui: { ...state.ui, searchQuery: query },
        }));
      },

      getFilteredBoards: () => {
        const state = get();
        const { searchQuery, selectedTags, currentWorkstreamId } = state.ui;

        let boards = Array.from(state.boards.values());

        // Filter by workstream
        if (currentWorkstreamId) {
          boards = boards.filter(
            (board) => board.workstreamId === currentWorkstreamId
          );
        }

        // Filter by search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          boards = boards.filter(
            (board) =>
              board.name.toLowerCase().includes(query) ||
              board.description?.toLowerCase().includes(query)
          );
        }

        // Filter by tags
        if (selectedTags.length > 0) {
          boards = boards.filter((board) =>
            selectedTags.every((tag) => board.tags.includes(tag))
          );
        }

        // Sort by last accessed (most recent first)
        return boards.sort(
          (a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime()
        );
      },

      setDashboardView: (view: "grid" | "list") => {
        set((state) => ({
          ui: { ...state.ui, dashboardView: view },
        }));
      },

      // Persistence
      saveBoard: async (boardId: string) => {
        // Manual save is handled by Zustand persist middleware
        // This is a no-op but can be used for explicit saves
        return Promise.resolve();
      },

      loadAllBoards: async () => {
        // Loading is handled by Zustand persist middleware on hydration
        return Promise.resolve();
      },
    }),
    {
      name: "kladde-boards",
      storage: idbStorage,
      // Custom serialization to handle Map objects
      serialize: (state) => {
        return JSON.stringify({
          ...state.state,
          boards: Array.from(state.state.boards.entries()),
          boardData: Array.from(state.state.boardData.entries()),
          workstreams: Array.from(state.state.workstreams.entries()),
        });
      },
      deserialize: (str) => {
        const parsed = JSON.parse(str);
        return {
          state: {
            ...parsed,
            boards: new Map(parsed.boards || []),
            boardData: new Map(parsed.boardData || []),
            workstreams: new Map(
              parsed.workstreams || [[DEFAULT_WORKSTREAM_ID, createDefaultWorkstream()]]
            ),
          },
          version: 0,
        };
      },
      partialize: (state) => ({
        boards: state.boards,
        boardData: state.boardData,
        workstreams: state.workstreams,
        ui: state.ui,
        // Don't persist patchQueue or flushStatus
      }),
      onRehydrateStorage: () => (state) => {
        // Ensure default workstream exists
        if (state && !state.workstreams.has(DEFAULT_WORKSTREAM_ID)) {
          state.workstreams.set(DEFAULT_WORKSTREAM_ID, createDefaultWorkstream());
        }
      },
    }
  )
);
