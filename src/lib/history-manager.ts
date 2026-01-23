import { get, set } from "idb-keyval";
import { v4 as uuid } from "uuid";
import type { BoardElement } from "./board-types";
import type {
    HistoryEntry,
    BoardHistory,
    HistoryOperationType,
    HistoryUser,
    ElementChange,
    PropertyChangeDetail,
} from "./history-types";

const HISTORY_STORAGE_KEY_PREFIX = "kladde-history-";
const DEFAULT_MAX_ENTRIES = 100;
const TEXT_CHANGE_DEBOUNCE_MS = 1000; // Debounce text-related changes by 1 second

/**
 * Properties that are considered "text" changes and should be debounced
 */
const TEXT_PROPERTIES = new Set([
    "text",
    "tileTitle",
    "tileContent",
    "noteText",
    "code",
    "chart",
    "label",
    "richText",
]);

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
        // Include noteStyle for tile-note elements (e.g., "tile-note-torn")
        if (
            element.tileType === "tile-note" &&
            element.tileContent?.noteStyle === "torn"
        ) {
            return "tile-note-torn";
        }
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
 * Check if the changes between two elements are only text-related
 */
function isTextOnlyChange(before: BoardElement, after: BoardElement): boolean {
    const allKeys = new Set([
        ...Object.keys(before),
        ...Object.keys(after),
    ]) as Set<keyof BoardElement>;

    for (const key of allKeys) {
        if (IGNORED_PROPERTIES.has(key)) continue;

        const beforeVal = before[key];
        const afterVal = after[key];
        const beforeStr = JSON.stringify(beforeVal);
        const afterStr = JSON.stringify(afterVal);

        if (beforeStr !== afterStr) {
            // If any non-text property changed, it's not a text-only change
            if (!TEXT_PROPERTIES.has(key)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Format a position value for display
 */
function formatPosition(x: number, y: number): string {
    return `(${Math.round(x)}, ${Math.round(y)})`;
}

/**
 * Format a size value for display
 */
function formatSize(width: number, height: number): string {
    return `${Math.round(width)} × ${Math.round(height)}`;
}

/**
 * Format a color value for display
 */
function formatColor(color: string | undefined): string {
    if (!color || color === "transparent") return "transparent";
    return color;
}

/**
 * Format a numeric value with units
 */
function formatNumber(value: number, unit?: string): string {
    const rounded = Math.round(value * 10) / 10;
    return unit ? `${rounded}${unit}` : `${rounded}`;
}

/**
 * Detect what properties changed between two elements
 */
function detectChangedProperties(
    before: BoardElement,
    after: BoardElement,
): { properties: string[]; summary: string; details: PropertyChangeDetail[] } {
    const changedProperties: string[] = [];
    const changedDescriptions: string[] = [];
    const details: PropertyChangeDetail[] = [];

    const allKeys = new Set([
        ...Object.keys(before),
        ...Object.keys(after),
    ]) as Set<keyof BoardElement>;

    // Track position and size changes separately for combined reporting
    let positionChanged = false;
    let sizeChanged = false;

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

            // Generate detailed change info based on property type
            if (key === "x" || key === "y") {
                positionChanged = true;
            } else if (key === "width" || key === "height") {
                sizeChanged = true;
            } else if (key === "rotation") {
                const fromRot = (before.rotation ?? 0) % 360;
                const toRot = (after.rotation ?? 0) % 360;
                details.push({
                    property: "rotation",
                    fromValue: formatNumber(fromRot, "°"),
                    toValue: formatNumber(toRot, "°"),
                    description: `Rotated from ${formatNumber(fromRot, "°")} to ${formatNumber(toRot, "°")}`,
                });
            } else if (key === "strokeColor") {
                details.push({
                    property: "stroke color",
                    fromValue: formatColor(before.strokeColor),
                    toValue: formatColor(after.strokeColor),
                    description: `Stroke: ${formatColor(before.strokeColor)} → ${formatColor(after.strokeColor)}`,
                });
            } else if (key === "fillColor") {
                details.push({
                    property: "fill color",
                    fromValue: formatColor(before.fillColor),
                    toValue: formatColor(after.fillColor),
                    description: `Fill: ${formatColor(before.fillColor)} → ${formatColor(after.fillColor)}`,
                });
            } else if (key === "strokeWidth") {
                details.push({
                    property: "stroke width",
                    fromValue: formatNumber(before.strokeWidth ?? 2, "px"),
                    toValue: formatNumber(after.strokeWidth ?? 2, "px"),
                    description: `Stroke width: ${formatNumber(before.strokeWidth ?? 2, "px")} → ${formatNumber(after.strokeWidth ?? 2, "px")}`,
                });
            } else if (key === "opacity") {
                details.push({
                    property: "opacity",
                    fromValue: formatNumber(before.opacity ?? 100, "%"),
                    toValue: formatNumber(after.opacity ?? 100, "%"),
                    description: `Opacity: ${formatNumber(before.opacity ?? 100, "%")} → ${formatNumber(after.opacity ?? 100, "%")}`,
                });
            } else if (key === "fontSize") {
                details.push({
                    property: "font size",
                    fromValue: formatNumber(before.fontSize ?? 16, "px"),
                    toValue: formatNumber(after.fontSize ?? 16, "px"),
                    description: `Font size: ${formatNumber(before.fontSize ?? 16, "px")} → ${formatNumber(after.fontSize ?? 16, "px")}`,
                });
            } else if (key === "fontFamily") {
                const fromFont = (before.fontFamily ?? "Inter").replace(
                    /var\(--font-|\)/g,
                    "",
                );
                const toFont = (after.fontFamily ?? "Inter").replace(
                    /var\(--font-|\)/g,
                    "",
                );
                details.push({
                    property: "font",
                    fromValue: fromFont,
                    toValue: toFont,
                    description: `Font: ${fromFont} → ${toFont}`,
                });
            } else if (key === "hidden") {
                details.push({
                    property: "visibility",
                    fromValue: before.hidden ? "hidden" : "visible",
                    toValue: after.hidden ? "hidden" : "visible",
                    description: after.hidden ? "Hidden" : "Made visible",
                });
            } else if (key === "locked") {
                details.push({
                    property: "lock state",
                    fromValue: before.locked ? "locked" : "unlocked",
                    toValue: after.locked ? "locked" : "unlocked",
                    description: after.locked ? "Locked" : "Unlocked",
                });
            } else if (key === "zIndex") {
                const fromZ = before.zIndex ?? 0;
                const toZ = after.zIndex ?? 0;
                const direction = toZ > fromZ ? "forward" : "backward";
                details.push({
                    property: "layer order",
                    fromValue: String(fromZ),
                    toValue: String(toZ),
                    description: `Moved ${direction} in layer order`,
                });
            } else if (key === "tileContent") {
                // Check for noteColor changes inside tileContent
                const content = after.tileContent as
                    | { noteColor?: string }
                    | undefined;
                const beforeContent = before.tileContent as
                    | { noteColor?: string }
                    | undefined;
                if (beforeContent?.noteColor !== content?.noteColor) {
                    details.push({
                        property: "note color",
                        fromValue: beforeContent?.noteColor ?? "default",
                        toValue: content?.noteColor ?? "default",
                        description: `Note color changed`,
                    });
                }
            } else if (
                key === "text" ||
                key === "label" ||
                key === "tileTitle"
            ) {
                details.push({
                    property: readableName,
                    description: `${readableName.charAt(0).toUpperCase() + readableName.slice(1)} edited`,
                });
            } else if (key === "cornerRadius") {
                details.push({
                    property: "corner radius",
                    fromValue: formatNumber(before.cornerRadius ?? 0, "px"),
                    toValue: formatNumber(after.cornerRadius ?? 0, "px"),
                    description: `Corner radius: ${formatNumber(before.cornerRadius ?? 0, "px")} → ${formatNumber(after.cornerRadius ?? 0, "px")}`,
                });
            } else if (key === "textAlign") {
                details.push({
                    property: "text alignment",
                    fromValue: before.textAlign ?? "left",
                    toValue: after.textAlign ?? "left",
                    description: `Aligned ${after.textAlign ?? "left"}`,
                });
            }
        }
    }

    // Add combined position change detail
    if (positionChanged) {
        const fromPos = formatPosition(before.x ?? 0, before.y ?? 0);
        const toPos = formatPosition(after.x ?? 0, after.y ?? 0);
        details.unshift({
            property: "position",
            fromValue: fromPos,
            toValue: toPos,
            description: `Moved from ${fromPos} to ${toPos}`,
        });
    }

    // Add combined size change detail
    if (sizeChanged) {
        const fromSize = formatSize(before.width ?? 0, before.height ?? 0);
        const toSize = formatSize(after.width ?? 0, after.height ?? 0);
        details.unshift({
            property: "size",
            fromValue: fromSize,
            toValue: toSize,
            description: `Resized from ${fromSize} to ${toSize}`,
        });
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

    return { properties: uniqueProps, summary, details };
}

/**
 * Pending text change info for debouncing
 */
interface PendingTextChange {
    elementId: string;
    beforeElement: BoardElement;
    timeoutId: ReturnType<typeof setTimeout>;
    userOverride?: HistoryUser;
}

/**
 * Manages version history for a board, storing it in IndexedDB
 * Debounces text-related changes to avoid creating entries for each keystroke
 */
export class HistoryManager {
    private boardId: string;
    private history: BoardHistory | null = null;
    private isOwner: boolean;
    private currentUser: HistoryUser;
    private pendingTextChanges: Map<string, PendingTextChange> = new Map();
    private redoStack: HistoryEntry[] = [];

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

            const { properties, summary, details } = detectChangedProperties(
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
                propertyDetails: details,
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
        userOverride?: HistoryUser,
    ): Promise<void> {
        if (!this.history || !this.isOwner) return;

        // Clear redo stack when a new action is performed (like git)
        this.redoStack = [];

        const entry: HistoryEntry = {
            id: uuid(),
            timestamp: Date.now(),
            operation,
            user: { ...(userOverride ?? this.currentUser) },
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
        userOverride?: HistoryUser,
    ): Promise<void> {
        if (!this.isOwner || elementIds.length === 0) return;

        const changes = this.generateAddChanges(elementIds, afterElements);
        await this.createEntry(
            "add",
            changes,
            beforeElements,
            afterElements,
            userOverride,
        );
    }

    /**
     * Log an update operation - debounces text-only changes
     */
    async logUpdate(
        elementIds: string[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[],
        userOverride?: HistoryUser,
    ): Promise<void> {
        if (!this.isOwner || elementIds.length === 0) return;

        // Separate text-only changes from other changes
        const textOnlyIds: string[] = [];
        const immediateIds: string[] = [];

        for (const id of elementIds) {
            const before = beforeElements.find((el) => el.id === id);
            const after = afterElements.find((el) => el.id === id);

            if (before && after && isTextOnlyChange(before, after)) {
                textOnlyIds.push(id);
            } else {
                immediateIds.push(id);
            }
        }

        // Handle immediate (non-text) changes right away
        if (immediateIds.length > 0) {
            const changes = this.generateUpdateChanges(
                immediateIds,
                beforeElements,
                afterElements,
            );
            await this.createEntry(
                "update",
                changes,
                beforeElements,
                afterElements,
                userOverride,
            );
        }

        // Handle text changes with debouncing
        for (const id of textOnlyIds) {
            const before = beforeElements.find((el) => el.id === id);
            const after = afterElements.find((el) => el.id === id);
            if (!before || !after) continue;

            const existing = this.pendingTextChanges.get(id);

            if (existing) {
                // Clear the existing timeout and keep the original "before" state
                clearTimeout(existing.timeoutId);
            }

            // Use the original "before" state if we have one, otherwise use current before
            const originalBefore = existing?.beforeElement || before;

            // Set a new timeout
            const timeoutId = setTimeout(() => {
                this.flushPendingTextChange(id, afterElements);
            }, TEXT_CHANGE_DEBOUNCE_MS);

            this.pendingTextChanges.set(id, {
                elementId: id,
                beforeElement: originalBefore,
                timeoutId,
                userOverride,
            });
        }
    }

    /**
     * Flush a pending text change for a specific element
     */
    private async flushPendingTextChange(
        elementId: string,
        currentElements: BoardElement[],
    ): Promise<void> {
        const pending = this.pendingTextChanges.get(elementId);
        if (!pending) return;

        this.pendingTextChanges.delete(elementId);

        const afterElement = currentElements.find((el) => el.id === elementId);
        if (!afterElement) return;

        // Create a before snapshot with the original element
        const beforeElements = currentElements.map((el) =>
            el.id === elementId ? pending.beforeElement : el,
        );

        const changes = this.generateUpdateChanges(
            [elementId],
            beforeElements,
            currentElements,
        );
        await this.createEntry(
            "update",
            changes,
            beforeElements,
            currentElements,
            pending.userOverride,
        );
    }

    /**
     * Log a delete operation - saves immediately
     */
    async logDelete(
        elementIds: string[],
        beforeElements: BoardElement[],
        afterElements: BoardElement[],
        userOverride?: HistoryUser,
    ): Promise<void> {
        if (!this.isOwner || elementIds.length === 0) return;

        const changes = this.generateDeleteChanges(elementIds, beforeElements);
        await this.createEntry(
            "delete",
            changes,
            beforeElements,
            afterElements,
            userOverride,
        );
    }

    /**
     * Flush any pending text changes (called on unmount or before restore)
     */
    async flush(currentElements: BoardElement[]): Promise<void> {
        // Flush all pending text changes
        for (const [elementId, pending] of this.pendingTextChanges) {
            clearTimeout(pending.timeoutId);
            await this.flushPendingTextChange(elementId, currentElements);
        }
        this.pendingTextChanges.clear();
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
     * Undo the last history entry - removes it from history and returns it
     * Returns the entry that was undone, or null if nothing to undo
     */
    async undoLastEntry(): Promise<HistoryEntry | null> {
        if (
            !this.isOwner ||
            !this.history ||
            this.history.entries.length === 0
        ) {
            return null;
        }

        // Pop the last entry
        const entry = this.history.entries.pop();
        if (!entry) return null;

        // Push to redo stack
        this.redoStack.push(entry);

        await this.save();
        return entry;
    }

    /**
     * Redo a previously undone history entry - adds it back to history
     * Returns the entry that was redone, or null if nothing to redo
     */
    async redoEntry(): Promise<HistoryEntry | null> {
        if (!this.isOwner || !this.history || this.redoStack.length === 0) {
            return null;
        }

        // Pop from redo stack
        const entry = this.redoStack.pop();
        if (!entry) return null;

        // Add back to history
        this.history.entries.push(entry);

        await this.save();
        return entry;
    }

    /**
     * Clear the redo stack (called when a new action is performed)
     */
    clearRedoStack(): void {
        this.redoStack = [];
    }

    /**
     * Check if there are entries that can be undone
     */
    canUndoHistory(): boolean {
        return (this.history?.entries.length ?? 0) > 0;
    }

    /**
     * Check if there are entries that can be redone
     */
    canRedoHistory(): boolean {
        return this.redoStack.length > 0;
    }

    /**
     * Clear all history for this board
     */
    async clearHistory(): Promise<void> {
        if (!this.isOwner || !this.history) return;
        this.history.entries = [];
        this.redoStack = [];
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
