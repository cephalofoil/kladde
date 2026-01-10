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
 * Pending text change info for debouncing
 */
interface PendingTextChange {
  elementId: string;
  beforeElement: BoardElement;
  timeoutId: ReturnType<typeof setTimeout>;
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

      const { properties, summary } = detectChangedProperties(before, after);

      return {
        elementId: id,
        elementType: after.type,
        elementSubType: getElementSubType(after),
        elementLabel: getElementLabel(after),
        operation: "update" as const,
        changedProperties: properties,
        changeSummary: summary || `Updated ${getElementTypeName(after)}`,
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
      parts.push(`Added ${adds.length} element${adds.length > 1 ? "s" : ""}`);
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
   * Log an update operation - debounces text-only changes
   */
  async logUpdate(
    elementIds: string[],
    beforeElements: BoardElement[],
    afterElements: BoardElement[],
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
      await this.createEntry("update", changes, beforeElements, afterElements);
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
    await this.createEntry("update", changes, beforeElements, currentElements);
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
    await this.createEntry("delete", changes, beforeElements, afterElements);
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
