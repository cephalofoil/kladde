import type { BoardComment, BoardElement } from "./board-types";

/**
 * Represents a board in the system
 */
export interface Board {
    id: string; // UUID for board
    name: string;
    description?: string;
    workstreamId: string;
    tags: string[];
    thumbnail?: string; // Base64 data URL
    createdAt: Date;
    updatedAt: Date;
    lastAccessed: Date;
    metadata: {
        elementCount: number; // Number of elements on board
        canvasBounds: {
            width: number;
            height: number;
            minX: number;
            minY: number;
        };
    };
    settings: {
        backgroundColor: string; // Canvas background
        gridVisible: boolean;
        gridSize?: number;
        handDrawn?: boolean; // Hand-drawn rendering mode
    };
}

/**
 * Represents the actual drawing data for a board
 * Stored separately from Board metadata for lazy loading
 */
export interface BoardData {
    elements: BoardElement[]; // From board-types.ts (no transformation needed!)
    comments: BoardComment[];
    version: number; // For optimistic updates
}

/**
 * Storage type for workspaces
 */
export type WorkspaceStorageType = "browser" | "disk" | "cloud";

/**
 * Storage configuration for workspaces
 */
export interface WorkspaceStorageConfig {
    directoryName?: string; // For disk storage - folder name selected by user
}

/**
 * Represents a collection of boards
 */
export interface Workstream {
    id: string;
    name: string;
    description?: string;
    color: string;
    icon?: string;
    createdAt: Date;
    updatedAt: Date;
    boardIds: string[];
    storageType: WorkspaceStorageType;
    storageConfig?: WorkspaceStorageConfig;
    metadata: {
        boardCount: number;
        lastAccessed: Date;
    };
}

/**
 * UI state for dashboard and board management
 */
export interface UIState {
    currentBoardId: string | null;
    currentWorkstreamId: string;
    selectedTags: string[];
    searchQuery: string;
    dashboardView: "grid" | "list";
}

/**
 * Patch operation for optimistic updates
 */
export interface PatchOperation {
    op: "add" | "update" | "delete" | "replace";
    path: string; // JSONPath-style path
    value?: unknown;
    timestamp: number;
}

/**
 * Status of flush operation to IndexedDB
 */
export type FlushStatus = "idle" | "flushing" | "error";

/**
 * Complete store state
 */
export interface BoardStoreState {
    // Data
    boards: Map<string, Board>;
    boardData: Map<string, BoardData>;
    workstreams: Map<string, Workstream>;
    ui: UIState;
    settings: {
        collabInvitesEnabled: boolean; // Allow sharing collab invite links
        diskStorageEnabled: boolean; // Whether global disk storage is active
        diskStorageDirectoryName?: string; // Display name of selected folder
        autoSaveEnabled: boolean; // Whether auto-save is enabled for disk storage
    };

    // Optimistic updates
    patchQueue: PatchOperation[];
    flushStatus: FlushStatus;
}

/**
 * Store actions interface
 */
export interface BoardStoreActions {
    // Board CRUD
    createBoard: (name: string, workstreamId?: string) => string; // Returns boardId
    loadBoard: (id: string) => Board | null;
    updateBoard: (id: string, updates: Partial<Board>) => void;
    deleteBoard: (id: string) => void;
    duplicateBoard: (id: string) => string;
    switchToBoard: (id: string) => void;

    // Element operations
    getElements: (boardId: string) => BoardElement[];
    setElements: (boardId: string, elements: BoardElement[]) => void;
    addElement: (boardId: string, element: BoardElement) => void;
    updateElement: (
        boardId: string,
        elementId: string,
        updates: Partial<BoardElement>,
    ) => void;
    deleteElement: (boardId: string, elementId: string) => void;
    replaceElements: (boardId: string, elements: BoardElement[]) => void; // For Yjs sync
    getComments: (boardId: string) => BoardComment[];
    setComments: (boardId: string, comments: BoardComment[]) => void;
    addComment: (boardId: string, comment: BoardComment) => void;
    updateComment: (
        boardId: string,
        commentId: string,
        updates: Partial<BoardComment>,
    ) => void;
    deleteComment: (boardId: string, commentId: string) => void;
    replaceComments: (boardId: string, comments: BoardComment[]) => void;

    // Workstream management
    createWorkstream: (name: string, color: string, icon?: string) => string;
    updateWorkstream: (id: string, updates: Partial<Workstream>) => void;
    deleteWorkstream: (id: string) => void;
    getWorkstreamBoards: (workstreamId: string) => Board[];
    moveBoard: (boardId: string, targetWorkstreamId: string) => void;
    setWorkspaceStorageType: (
        workspaceId: string,
        storageType: WorkspaceStorageType,
        directoryName?: string,
    ) => void;

    // Dashboard features
    getAllTags: () => string[];
    setSelectedTags: (tags: string[]) => void;
    setSearchQuery: (query: string) => void;
    getFilteredBoards: () => Board[];
    setDashboardView: (view: "grid" | "list") => void;

    // Persistence
    saveBoard: (boardId: string) => Promise<void>;
    loadAllBoards: () => Promise<void>;

    // Settings / Data management
    getStorageStats: () => { boardCount: number; workspaceCount: number };
    clearAllData: () => Promise<void>;
    setCollabInvitesEnabled: (enabled: boolean) => void;
    setDiskStorageEnabled: (enabled: boolean, directoryName?: string) => void;
    setAutoSaveEnabled: (enabled: boolean) => void;
}

/**
 * Complete store interface combining state and actions
 */
export type BoardStore = BoardStoreState & BoardStoreActions;
