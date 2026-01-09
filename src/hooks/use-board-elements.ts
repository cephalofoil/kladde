import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useBoardStore } from "@/store/board-store";
import type { BoardElement } from "@/lib/board-types";
import type { CollaborationManager } from "@/lib/collaboration";

interface UseBoardElementsOptions {
  isOwner?: boolean;
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
  const { isOwner = true } = options;

  // Get elements from Zustand store - use stable selector
  const boardData = useBoardStore((s) => s.boardData.get(boardId));
  const storeElements = useMemo(
    () => boardData?.elements || EMPTY_ELEMENTS,
    [boardData?.elements],
  );
  const setStoreElements = useBoardStore((s) => s.setElements);
  const replaceStoreElements = useBoardStore((s) => s.replaceElements);

  // Local state for elements (synced with store or collaboration)
  const [elements, setElementsInternal] = useState<BoardElement[]>(() => {
    // For guests, start with empty - they'll receive from collab
    // For owners, use store elements
    return isOwner ? storeElements : EMPTY_ELEMENTS;
  });

  // Wrapper to deduplicate before setting
  const setElements = useCallback((newElements: BoardElement[]) => {
    setElementsInternal(deduplicateElements(newElements));
  }, []);

  // Track if we've initialized from collab
  const initializedFromCollabRef = useRef(false);

  // Debounced save to store - only for owners in solo mode
  useEffect(() => {
    // Don't save if not owner or in collaboration mode
    if (!isOwner) return;
    if (collaboration) return; // Collab mode saves are handled in the sync effect

    const timer = setTimeout(() => {
      setStoreElements(boardId, elements);
    }, 500);

    return () => clearTimeout(timer);
  }, [elements, boardId, setStoreElements, isOwner, collaboration]);

  // Sync with collaboration when active
  useEffect(() => {
    if (!collaboration) {
      // Solo mode: just use store elements (only for owner)
      if (isOwner) {
        setElements(storeElements);
      }
      initializedFromCollabRef.current = false;
      return;
    }

    // Collaboration mode: bidirectional sync
    let mounted = true;

    // For owner: load existing elements into Yjs on first connect
    if (
      isOwner &&
      storeElements.length > 0 &&
      !initializedFromCollabRef.current
    ) {
      // Owner loads their local elements into the collaboration
      // Use setElements which clears existing and sets new ones
      collaboration.setElements(storeElements);
      initializedFromCollabRef.current = true;
    }

    // Get initial elements from collaboration (may have data from owner)
    const loadInitialElements = async () => {
      const collabElements = await collaboration.getElementsAsync();
      if (mounted && collabElements.length > 0) {
        setElements(collabElements);
      } else if (mounted && isOwner && storeElements.length > 0) {
        // If no collab elements and we're owner, use store elements
        setElements(storeElements);
      }
    };

    loadInitialElements();

    // Subscribe to collaboration changes
    const unsubscribe = collaboration.onElementsChange((newElements) => {
      if (mounted) {
        setElements(newElements);
        // Only owner saves to store
        if (isOwner) {
          replaceStoreElements(boardId, deduplicateElements(newElements));
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [
    collaboration,
    boardId,
    storeElements,
    replaceStoreElements,
    isOwner,
    setElements,
  ]);

  // Update function that works in both solo and collab modes
  const updateElements = useCallback(
    (newElements: BoardElement[]) => {
      const deduplicated = deduplicateElements(newElements);
      setElementsInternal(deduplicated);

      if (collaboration) {
        // In collaboration mode, update Yjs (will trigger onElementsChange)
        collaboration.setElements(deduplicated);
      }
      // Store update happens via debounced effect (only for owner)
    },
    [collaboration],
  );

  return { elements, setElements: updateElements };
}
