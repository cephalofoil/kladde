import { get, set } from "idb-keyval";
import { v4 as uuid } from "uuid";
import type { BoardElement } from "./board-types";
import type {
    HistoryEntry,
    BoardHistory,
    HistoryOperationType,
    HistoryUser,
    ElementChange,
} from "./history-types";

const HISTORY_STORAGE_KEY_PREFIX = "kladde-history-";
const DEFAULT_MAX_ENTRIES = 100;

/**
 * Get a human-readable label for an element
 */
function getElementLabel(element: BoardElement): string | undefined {
    if (element.type === "frame" && element.label) {
        return element.label;
    }
    if (element.type === "tile" && element.tileTitle) {
        return element.tileTitle;
    }
    if (element.type === "text" && element.text) {
        const text = element.text.trim();
        return text.length > 30 ? text.substring(0, 30) + "..." : text;
    }
    return undefined;
}

/**
 * Get a human-readable name for an element type
 */
function getElementTypeName(element: BoardElement): string {
    if (element.type === "tile" && element.tileType) {
        const tileTypeMap: Record<string, string> = {
            "tile-text": "Text Tile",
            "tile-note": "Note",
            "tile-code": "Code Block",
            "tile-mermaid": "Diagram",
            "tile-image": "Image",
            "tile-document": "Document",
        };
        return tileTypeMap[element.tileType] || "Tile";
    }
    if (element.type === "pen" && element.penMode === "highlighter") {
        return "Highlighter";
    }
    const typeMap: Record<string, string> = {
        pen: "Stroke",
        line: "Line",
        arrow: "Arrow",
        rectangle: "Rectangle",
        diamond: "Diamond",
        ellipse: "Ellipse",
        text: "Text",
        frame: "Frame",
        "web-embed": "Web Embed",
        laser: "Laser",
        tile: "Tile",
    };
    return typeMap[element.type] || element.type;
}

function getElementSubType(
    element: BoardElement | undefined,
): string | undefined {
    if (!element) return undefined;
    if (element.type === "tile" && element.tileType) {
        return element.tileType;
    }
    if (element.type === "pen" && element.penMode === "highlighter") {
        return "highlighter";
    }
    return undefined;
}

/**
 * Properties to ignore when detecting changes
 */
const IGNORED_PROPERTIES = new Set(["timestamp"]);

/**
 * Properties that are important to track
 */
const IMPORTANT_PROPERTIES: Record<string, string> = {
    x: "position",
    y: "position",
    width: "size",
    height: "size",
    rotation: "rotation",
    strokeColor: "stroke color",
    strokeWidth: "stroke width",
    fillColor: "fill color",
    text: "text content",
    label: "label",
    tileTitle: "title",
    tileContent: "content",
    noteText: "note text",
    noteColor: "note color",
    code: "code",
    chart: "diagram",
    opacity: "opacity",
    hidden: "visibility",
    locked: "lock state",
    zIndex: "layer order",
    points: "shape",
};

/**
 * Detect what properties changed between two elements
 */
function detectChangedProperties(
    before: BoardElement,
    after: BoardElement,
): { properties: string[]; summary: string } {
    const changedProperties: string[] = [];
    const changedDescriptions: string[] = [];

    const allKeys = new Set([
        ...Object.keys(before),
        ...Object.keys(after),
    ]) as Set<keyof BoardElement>;

    for (const key of allKeys) {
        if (IGNORED_PROPERTIES.has(key)) continue;

        const beforeVal = before[key];
        const afterVal = after[key];

        // Deep compare for objects/arrays
        const beforeStr = JSON.stringify(beforeVal);
        const afterStr = JSON.stringify(afterVal);

        if (beforeStr !== afterStr) {
            // Store human-readable property name
            const readableName =
                IMPORTANT_PROPERTIES[key] ||
                key
                    .replace(/([A-Z])/g, " $1")
                    .toLowerCase()
                    .trim();
            changedProperties.push(readableName);
            if (IMPORTANT_PROPERTIES[key]) {
                changedDescriptions.push(IMPORTANT_PROPERTIES[key]);
            }
        }
    }

    // Generate summary
    let summary = "";
    // Deduplicate (e.g., x and y both map to "position")
    const uniqueProps = [...new Set(changedProperties)];
    if (changedDescriptions.length > 0) {
        const unique = [...new Set(changedDescriptions)];
        if (unique.length <= 2) {
            summary = `Changed ${unique.join(" and ")}`;
        } else {
            summary = `Changed ${unique.slice(0, 2).join(", ")} and ${unique.length - 2} more`;
        }
    } else if (uniqueProps.length > 0) {
        summary = `Modified ${uniqueProps.length} properties`;
    }

    return { properties: uniqueProps, summary };
}

/**
 * Manages version history for a board, storing it in IndexedDB
 * Saves every change immediately (no batching)
 */
export class HistoryManager {
    private boardId: string;
    private history: BoardHistory | null = null;
    private isOwner: boolean;
    private currentUser: HistoryUser;

    constructor(
        boardId: string,
        userId: string,
        userName: string,
        isOwner: boolean,
    ) {
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
     * Update the current user info
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
     * Generate detailed changes for added elements
     */
    private generateAddChanges(
        elementIds: string[],
        afterElements: BoardElement[],
    ): ElementChange[] {
        return elementIds.map((id) => {
            const element = afterElements.find((el) => el.id === id);
            return {
                elementId: id,
                elementType: element?.type || "pen",
                elementSubType: getElementSubType(element),
                elementLabel: element ? getElementLabel(element) : undefined,
                operation: "add" as const,
                changeSummary: element
                    ? `Added ${getElementTypeName(element)}`
                    : "Added element",
            };
        });
    }

    /**
     * Generate detailed changes for deleted elements
     */
    private generateDeleteChanges(
        elementIds: string[],
        beforeElements: BoardElement[],
    ): ElementChange[] {
        return elementIds.map((id) => {
            const element = beforeElements.find((el) => el.id === id);
            return {
                elementId: id,
                elementType: element?.type || "pen",
                elementSubType: getElementSubType(element),
                elementLabel: element ? getElementLabel(element) : undefined,
                operation: "delete" as const,
                changeSummary: element
                    ? `Deleted ${getElementTypeName(element)}`
                    : "Deleted element",
            };
        });
    }

    /**
     * Generate detailed changes for updated elements
     */
    private generateUpdateChanges(
        elementIds: string[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[],
    ): ElementChange[] {
        return elementIds.map((id) => {
            const before = beforeElements.find((el) => el.id === id);
            const after = afterElements.find((el) => el.id === id);

            if (!before || !after) {
                return {
                    elementId: id,
                    elementType: (after || before)?.type || "pen",
                    elementSubType: getElementSubType(after || before),
                    operation: "update" as const,
                    changeSummary: "Updated element",
                };
            }

            const { properties, summary } = detectChangedProperties(
                before,
                after,
            );

            return {
                elementId: id,
                elementType: after.type,
                elementSubType: getElementSubType(after),
                elementLabel: getElementLabel(after),
                operation: "update" as const,
                changedProperties: properties,
                changeSummary:
                    summary || `Updated ${getElementTypeName(after)}`,
            };
        });
    }

    /**
     * Generate a description for the operation
     */
    private generateDescription(
        operation: HistoryOperationType,
        changes: ElementChange[],
    ): string {
        if (changes.length === 0) return "No changes";

        if (changes.length === 1) {
            return changes[0].changeSummary || "Modified element";
        }

        // Group by operation
        const adds = changes.filter((c) => c.operation === "add");
        const updates = changes.filter((c) => c.operation === "update");
        const deletes = changes.filter((c) => c.operation === "delete");

        const parts: string[] = [];
        if (adds.length > 0) {
            parts.push(
                `Added ${adds.length} element${adds.length > 1 ? "s" : ""}`,
            );
        }
        if (updates.length > 0) {
            parts.push(
                `Updated ${updates.length} element${updates.length > 1 ? "s" : ""}`,
            );
        }
        if (deletes.length > 0) {
            parts.push(
                `Deleted ${deletes.length} element${deletes.length > 1 ? "s" : ""}`,
            );
        }

        return parts.join(", ");
    }

    /**
     * Create and save a history entry immediately
     */
    private async createEntry(
        operation: HistoryOperationType,
        changes: ElementChange[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[],
    ): Promise<void> {
        if (!this.history || !this.isOwner) return;

        const entry: HistoryEntry = {
            id: uuid(),
            timestamp: Date.now(),
            operation,
            user: { ...this.currentUser },
            elementIds: changes.map((c) => c.elementId),
            changes,
            beforeSnapshot: [...beforeElements],
            afterSnapshot: [...afterElements],
            description: this.generateDescription(operation, changes),
        };

        this.history.entries.push(entry);

        // Trim to max entries
        while (this.history.entries.length > this.history.maxEntries) {
            this.history.entries.shift();
        }

        await this.save();
    }

    /**
     * Log an add operation - saves immediately
     */
    async logAdd(
        elementIds: string[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[],
    ): Promise<void> {
        if (!this.isOwner || elementIds.length === 0) return;

        const changes = this.generateAddChanges(elementIds, afterElements);
        await this.createEntry("add", changes, beforeElements, afterElements);
    }

    /**
     * Log an update operation - saves immediately
     */
    async logUpdate(
        elementIds: string[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[],
    ): Promise<void> {
        if (!this.isOwner || elementIds.length === 0) return;

        const changes = this.generateUpdateChanges(
            elementIds,
            beforeElements,
            afterElements,
        );
        await this.createEntry(
            "update",
            changes,
            beforeElements,
            afterElements,
        );
    }

    /**
     * Log a delete operation - saves immediately
     */
    async logDelete(
        elementIds: string[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[],
    ): Promise<void> {
        if (!this.isOwner || elementIds.length === 0) return;

        const changes = this.generateDeleteChanges(elementIds, beforeElements);
        await this.createEntry(
            "delete",
            changes,
            beforeElements,
            afterElements,
        );
    }

    /**
     * Flush is now a no-op since we save immediately
     */
    async flush(_currentElements: BoardElement[]): Promise<void> {
        // No-op - we save immediately now
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
     */
    restoreToEntry(entryId: string): BoardElement[] | null {
        const entry = this.getEntry(entryId);
        if (!entry) return null;
        return [...entry.afterSnapshot];
    }

    /**
     * Get the state before a specific entry
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
     * Delete history from storage
     */
    static async deleteHistory(boardId: string): Promise<void> {
        const { del } = await import("idb-keyval");
        const key = `${HISTORY_STORAGE_KEY_PREFIX}${boardId}`;
        await del(key);
    }

    /**
     * Export history as JSON
     */
    exportHistory(): string {
        return JSON.stringify(this.history, null, 2);
    }
}
