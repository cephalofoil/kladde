import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useBoardStore } from "@/store/board-store";
import type { BoardElement } from "@/lib/board-types";
import type { CollaborationManager } from "@/lib/collaboration";

interface UseBoardElementsOptions {
    isOwner?: boolean;
    syncStoreUpdates?: boolean;
}

// Stable empty array reference to prevent infinite re-renders
const EMPTY_ELEMENTS: BoardElement[] = [];

/**
 * Deduplicate elements by ID, keeping the last occurrence
 */
function deduplicateElements(elements: BoardElement[]): BoardElement[] {
    const seen = new Map<string, BoardElement>();
    for (const el of elements) {
        seen.set(el.id, el);
    }
    return Array.from(seen.values());
}

function areElementsEqual(a: BoardElement[], b: BoardElement[]): boolean {
    if (a.length !== b.length) return false;
    return !a.some((el, i) => {
        const other = b[i];
        if (!other || el.id !== other.id) return true;
        return JSON.stringify(el) !== JSON.stringify(other);
    });
}

/**
 * Hook to manage board elements with local-first storage
 * and optional collaboration sync
 *
 * @param boardId - The ID of the board
 * @param collaboration - Optional collaboration manager for real-time sync
 * @param options - Additional options including isOwner flag
 */
export function useBoardElements(
    boardId: string,
    collaboration: CollaborationManager | null,
    options: UseBoardElementsOptions = {},
) {
    const { isOwner = true, syncStoreUpdates = false } = options;

    // Get elements from Zustand store - use stable selector
    const boardData = useBoardStore((s) => s.boardData.get(boardId));
    const storeElements = useMemo(
        () => boardData?.elements || EMPTY_ELEMENTS,
        [boardData?.elements],
    );
    const setStoreElements = useBoardStore((s) => s.setElements);
    const replaceStoreElements = useBoardStore((s) => s.replaceElements);

    // Keep storeElements in a ref to avoid dependency issues
    const storeElementsRef = useRef(storeElements);
    useEffect(() => {
        storeElementsRef.current = storeElements;
    }, [storeElements]);

    // Keep replaceStoreElements in a ref to avoid dependency issues
    const replaceStoreElementsRef = useRef(replaceStoreElements);
    useEffect(() => {
        replaceStoreElementsRef.current = replaceStoreElements;
    }, [replaceStoreElements]);

    // Local state for elements (synced with store or collaboration)
    const [elements, setElementsInternal] = useState<BoardElement[]>(() => {
        // For guests, start with empty - they'll receive from collab
        // For owners, use store elements
        return isOwner ? storeElements : EMPTY_ELEMENTS;
    });
    const elementsRef = useRef(elements);
    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    // Track if we've initialized from collab
    const initializedFromCollabRef = useRef(false);
    // Track if we've synced store elements to avoid loops
    const hasSyncedStoreRef = useRef(false);
    const skipNextStoreSaveRef = useRef(false);
    // Track whether the latest change originated from a remote user
    const lastChangeIsRemoteRef = useRef(false);
    const lastStoreUpdateFromCollabRef = useRef(false);

    // Debounced save to store - only for owners in solo mode
    useEffect(() => {
        // Don't save if not owner or in collaboration mode
        if (!isOwner) return;
        if (collaboration) return; // Collab mode saves are handled in the sync effect
        if (skipNextStoreSaveRef.current) {
            skipNextStoreSaveRef.current = false;
            return;
        }

        const timer = setTimeout(() => {
            setStoreElements(boardId, elements);
        }, 500);

        return () => clearTimeout(timer);
    }, [elements, boardId, setStoreElements, isOwner, collaboration]);

    // Solo mode: sync store elements once on mount
    useEffect(() => {
        if (collaboration) return; // Skip in collab mode
        if (!isOwner) return;
        if (hasSyncedStoreRef.current) return;

        const currentStoreElements = storeElementsRef.current;
        if (currentStoreElements.length > 0) {
            hasSyncedStoreRef.current = true;
            setElementsInternal(deduplicateElements(currentStoreElements));
        }
    }, [collaboration, isOwner]);

    // Solo mode: keep in sync with store updates (e.g. other tabs)
    useEffect(() => {
        if (!isOwner) return;
        if (collaboration && !syncStoreUpdates) return;

        const nextElements = storeElementsRef.current;
        if (areElementsEqual(elementsRef.current, nextElements)) return;

        if (collaboration && syncStoreUpdates) {
            if (lastStoreUpdateFromCollabRef.current) {
                lastStoreUpdateFromCollabRef.current = false;
                return;
            }
        }

        skipNextStoreSaveRef.current = true;
        hasSyncedStoreRef.current = true;
        const deduplicated = deduplicateElements(nextElements);
        setElementsInternal(deduplicated);
        if (collaboration && syncStoreUpdates) {
            lastChangeIsRemoteRef.current = false;
            collaboration.setElements(deduplicated);
        }
    }, [collaboration, isOwner, storeElements, syncStoreUpdates]);

    // Sync with collaboration when active
    useEffect(() => {
        if (!collaboration) {
            initializedFromCollabRef.current = false;
            return;
        }

        // Collaboration mode: bidirectional sync
        let mounted = true;

        // For owner: load existing elements into Yjs on first connect
        const currentStoreElements = storeElementsRef.current;
        if (
            isOwner &&
            currentStoreElements.length > 0 &&
            !initializedFromCollabRef.current
        ) {
            // Owner loads their local elements into the collaboration
            collaboration.setElements(currentStoreElements);
            initializedFromCollabRef.current = true;
        }

        // Get initial elements from collaboration (may have data from owner)
        const loadInitialElements = async () => {
            const collabElements = await collaboration.getElementsAsync();
            if (mounted && collabElements.length > 0) {
                setElementsInternal(deduplicateElements(collabElements));
            } else if (mounted && isOwner && currentStoreElements.length > 0) {
                // If no collab elements and we're owner, use store elements
                setElementsInternal(deduplicateElements(currentStoreElements));
            }
        };

        loadInitialElements();

        // Subscribe to collaboration changes
        const unsubscribe = collaboration.onElementsChange(
            (newElements, info) => {
                if (mounted) {
                    lastChangeIsRemoteRef.current = info?.isRemote ?? false;
                    const deduplicated = deduplicateElements(newElements);
                    // Only update if elements actually changed (compare by serialization)
                    setElementsInternal((prev) => {
                        if (prev.length !== deduplicated.length)
                            return deduplicated;
                        // Quick check - compare IDs and a few key properties
                        const changed = deduplicated.some((el, i) => {
                            const prevEl = prev[i];
                            if (!prevEl || el.id !== prevEl.id) return true;
                            // Check if element was modified (compare stringified for deep check)
                            return (
                                JSON.stringify(el) !== JSON.stringify(prevEl)
                            );
                        });
                        return changed ? deduplicated : prev;
                    });
                    // Only owner saves to store - use ref to avoid dependency
                    if (isOwner) {
                        lastStoreUpdateFromCollabRef.current = true;
                        replaceStoreElementsRef.current(boardId, deduplicated);
                    }
                }
            },
        );

        return () => {
            mounted = false;
            unsubscribe?.();
        };
    }, [collaboration, boardId, isOwner]);

    // Update function that works in both solo and collab modes
    const updateElements = useCallback(
        (newElements: BoardElement[]) => {
            const deduplicated = deduplicateElements(newElements);
            setElementsInternal(deduplicated);

            if (collaboration) {
                // In collaboration mode, update Yjs (will trigger onElementsChange)
                lastChangeIsRemoteRef.current = false;
                collaboration.setElements(deduplicated);
            }
            // Store update happens via debounced effect (only for owner)
        },
        [collaboration],
    );

    return { elements, setElements: updateElements, lastChangeIsRemoteRef };
}
