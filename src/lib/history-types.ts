import type { BoardElement } from "./board-types";

/**
 * Permission levels for collaboration
 */
export type CollabPermission = "edit" | "comment" | "view";

/**
 * Types of operations that can be logged
 */
export type HistoryOperationType = "add" | "update" | "delete" | "batch";

/**
 * Information about the user who performed an operation
 */
export interface HistoryUser {
    id: string;
    name: string;
    isOwner: boolean;
}

/**
 * Detailed change for a single element
 */
export interface ElementChange {
    elementId: string;
    elementType: BoardElement["type"];
    /** Optional subtype (tileType or penMode) for more specific icons */
    elementSubType?: string;
    elementLabel?: string; // For frames, tiles with titles, etc.
    operation: "add" | "update" | "delete";
    /** Properties that changed (for updates) */
    changedProperties?: string[];
    /** Summary of what changed */
    changeSummary?: string;
}

/**
 * A single history entry representing one operation
 */
export interface HistoryEntry {
    id: string;
    timestamp: number;
    operation: HistoryOperationType;
    user: HistoryUser;
    /** Element IDs affected by this operation */
    elementIds: string[];
    /** Detailed changes for each element */
    changes: ElementChange[];
    /** Snapshot of elements before the operation (for undo/restore) */
    beforeSnapshot: BoardElement[];
    /** Snapshot of elements after the operation */
    afterSnapshot: BoardElement[];
    /** Human-readable description of the operation */
    description: string;
}

/**
 * The complete history log for a board
 */
export interface BoardHistory {
    boardId: string;
    entries: HistoryEntry[];
    /** Maximum number of entries to keep */
    maxEntries: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * Collaboration session information
 */
export interface CollabSession {
    sessionId: string;
    boardId: string;
    ownerId: string;
    ownerName: string;
    createdAt: number;
    /** Default permission for the share link */
    defaultPermission: CollabPermission;
    /** Active participants */
    participants: Map<
        string,
        {
            userId: string;
            name: string;
            permission: CollabPermission;
            joinedAt: number;
        }
    >;
}
