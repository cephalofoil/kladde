import { get, set } from "idb-keyval";
import { v4 as uuid } from "uuid";
import type { BoardElement } from "./board-types";
import type {
    HistoryEntry,
    BoardHistory,
    HistoryOperationType,
    HistoryUser,
} from "./history-types";

const HISTORY_STORAGE_KEY_PREFIX = "kladde-history-";
const DEFAULT_MAX_ENTRIES = 100;

/**
 * Manages version history for a board, storing it in IndexedDB
 */
export class HistoryManager {
    private boardId: string;
    private history: BoardHistory | null = null;
    private isOwner: boolean;
    private currentUser: HistoryUser;
    private pendingBatch: {
        elementIds: Set<string>;
        beforeSnapshot: BoardElement[];
        operations: HistoryOperationType[];
    } | null = null;
    private batchTimeout: ReturnType<typeof setTimeout> | null = null;
    private readonly BATCH_DELAY = 500; // ms to wait before committing batch

    constructor(boardId: string, userId: string, userName: string, isOwner: boolean) {
        this.boardId = boardId;
        this.isOwner = isOwner;
        this.currentUser = {
            id: userId,
            name: userName,
            isOwner,
        };
    }

    /**
     * Initialize the history manager by loading existing history from storage
     */
    async initialize(): Promise<void> {
        if (!this.isOwner) {
            // Guests don't load or save history
            return;
        }

        const key = `${HISTORY_STORAGE_KEY_PREFIX}${this.boardId}`;
        const stored = await get<BoardHistory>(key);

        if (stored) {
            this.history = stored;
        } else {
            this.history = {
                boardId: this.boardId,
                entries: [],
                maxEntries: DEFAULT_MAX_ENTRIES,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            await this.save();
        }
    }

    /**
     * Update the current user info (e.g., when name changes)
     */
    updateUser(userId: string, userName: string, isOwner: boolean): void {
        this.currentUser = { id: userId, name: userName, isOwner };
        this.isOwner = isOwner;
    }

    /**
     * Save history to IndexedDB
     */
    private async save(): Promise<void> {
        if (!this.isOwner || !this.history) return;

        const key = `${HISTORY_STORAGE_KEY_PREFIX}${this.boardId}`;
        this.history.updatedAt = Date.now();
        await set(key, this.history);
    }

    /**
     * Generate a description for the operation
     */
    private generateDescription(
        operation: HistoryOperationType,
        elementIds: string[],
        elements: BoardElement[]
    ): string {
        const count = elementIds.length;
        const elementTypes = new Set(
            elements
                .filter((el) => elementIds.includes(el.id))
                .map((el) => el.type)
        );
        const typeStr =
            elementTypes.size === 1
                ? Array.from(elementTypes)[0]
                : `${count} elements`;

        switch (operation) {
            case "add":
                return `Added ${count === 1 ? typeStr : `${count} elements`}`;
            case "update":
                return `Updated ${count === 1 ? typeStr : `${count} elements`}`;
            case "delete":
                return `Deleted ${count === 1 ? typeStr : `${count} elements`}`;
            case "batch":
                return `Modified ${count} elements`;
            default:
                return `Changed ${count} elements`;
        }
    }

    /**
     * Commit any pending batch operations
     */
    private async commitBatch(afterSnapshot: BoardElement[]): Promise<void> {
        if (!this.pendingBatch || !this.history || !this.isOwner) return;

        const entry: HistoryEntry = {
            id: uuid(),
            timestamp: Date.now(),
            operation: this.pendingBatch.operations.length > 1 ? "batch" : this.pendingBatch.operations[0],
            user: { ...this.currentUser },
            elementIds: Array.from(this.pendingBatch.elementIds),
            beforeSnapshot: this.pendingBatch.beforeSnapshot,
            afterSnapshot: [...afterSnapshot],
            description: this.generateDescription(
                this.pendingBatch.operations.length > 1 ? "batch" : this.pendingBatch.operations[0],
                Array.from(this.pendingBatch.elementIds),
                afterSnapshot
            ),
        };

        this.history.entries.push(entry);

        // Trim to max entries
        while (this.history.entries.length > this.history.maxEntries) {
            this.history.entries.shift();
        }

        this.pendingBatch = null;
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }

        await this.save();
    }

    /**
     * Log an add operation
     */
    async logAdd(
        elementIds: string[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[]
    ): Promise<void> {
        if (!this.isOwner) return;
        await this.logOperation("add", elementIds, beforeElements, afterElements);
    }

    /**
     * Log an update operation
     */
    async logUpdate(
        elementIds: string[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[]
    ): Promise<void> {
        if (!this.isOwner) return;
        await this.logOperation("update", elementIds, beforeElements, afterElements);
    }

    /**
     * Log a delete operation
     */
    async logDelete(
        elementIds: string[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[]
    ): Promise<void> {
        if (!this.isOwner) return;
        await this.logOperation("delete", elementIds, beforeElements, afterElements);
    }

    /**
     * Internal method to log any operation with batching
     */
    private async logOperation(
        operation: HistoryOperationType,
        elementIds: string[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[]
    ): Promise<void> {
        if (!this.history || !this.isOwner) return;

        // Start or extend a batch
        if (!this.pendingBatch) {
            this.pendingBatch = {
                elementIds: new Set(elementIds),
                beforeSnapshot: [...beforeElements],
                operations: [operation],
            };
        } else {
            elementIds.forEach((id) => this.pendingBatch!.elementIds.add(id));
            if (!this.pendingBatch.operations.includes(operation)) {
                this.pendingBatch.operations.push(operation);
            }
        }

        // Reset batch timer
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        this.batchTimeout = setTimeout(() => {
            this.commitBatch(afterElements);
        }, this.BATCH_DELAY);
    }

    /**
     * Force commit any pending batch immediately
     */
    async flush(currentElements: BoardElement[]): Promise<void> {
        if (this.pendingBatch) {
            if (this.batchTimeout) {
                clearTimeout(this.batchTimeout);
                this.batchTimeout = null;
            }
            await this.commitBatch(currentElements);
        }
    }

    /**
     * Get all history entries
     */
    getEntries(): HistoryEntry[] {
        return this.history?.entries || [];
    }

    /**
     * Get a specific entry by ID
     */
    getEntry(entryId: string): HistoryEntry | undefined {
        return this.history?.entries.find((e) => e.id === entryId);
    }

    /**
     * Restore board to a specific history entry state
     * Returns the elements from that snapshot
     */
    restoreToEntry(entryId: string): BoardElement[] | null {
        const entry = this.getEntry(entryId);
        if (!entry) return null;
        return [...entry.afterSnapshot];
    }

    /**
     * Get the state before a specific entry (for undo)
     */
    getStateBefore(entryId: string): BoardElement[] | null {
        const entry = this.getEntry(entryId);
        if (!entry) return null;
        return [...entry.beforeSnapshot];
    }

    /**
     * Clear all history for this board
     */
    async clearHistory(): Promise<void> {
        if (!this.isOwner || !this.history) return;

        this.history.entries = [];
        await this.save();
    }

    /**
     * Delete history from storage (when board is deleted)
     */
    static async deleteHistory(boardId: string): Promise<void> {
        const { del } = await import("idb-keyval");
        const key = `${HISTORY_STORAGE_KEY_PREFIX}${boardId}`;
        await del(key);
    }

    /**
     * Export history as JSON for debugging or backup
     */
    exportHistory(): string {
        return JSON.stringify(this.history, null, 2);
    }
}
