import { useEffect, useState, useCallback } from "react";
import { useBoardStore } from "@/store/board-store";
import type { BoardElement } from "@/lib/board-types";
import type { CollaborationManager } from "@/lib/collaboration";

/**
 * Hook to manage board elements with local-first storage
 * and optional collaboration sync
 */
export function useBoardElements(
  boardId: string,
  collaboration: CollaborationManager | null
) {
  // Get elements from Zustand store
  const storeElements = useBoardStore((s) => s.getElements(boardId));
  const setStoreElements = useBoardStore((s) => s.setElements);
  const replaceStoreElements = useBoardStore((s) => s.replaceElements);

  // Local state for elements (synced with store)
  const [elements, setElements] = useState<BoardElement[]>(storeElements);

  // Debounced save to store
  useEffect(() => {
    const timer = setTimeout(() => {
      setStoreElements(boardId, elements);
    }, 500);

    return () => clearTimeout(timer);
  }, [elements, boardId, setStoreElements]);

  // Sync with collaboration when active
  useEffect(() => {
    if (!collaboration) {
      // Solo mode: just use store elements
      setElements(storeElements);
      return;
    }

    // Collaboration mode: bidirectional sync
    let mounted = true;

    // Initialize collaboration with current store elements
    const initElements = storeElements;
    if (initElements.length > 0) {
      // Load existing elements into Yjs
      collaboration.setElements(initElements);
    }

    // Get initial elements from collaboration (may have data from other users)
    const collabElements = collaboration.getElements();
    if (mounted && collabElements.length > 0) {
      setElements(collabElements);
    }

    // Subscribe to collaboration changes
    const unsubscribe = collaboration.onElementsChange((newElements) => {
      if (mounted) {
        setElements(newElements);
        // Update store immediately (no debounce during collab)
        replaceStoreElements(boardId, newElements);
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [collaboration, boardId, storeElements, replaceStoreElements]);

  // Update function that works in both solo and collab modes
  const updateElements = useCallback(
    (newElements: BoardElement[]) => {
      setElements(newElements);

      if (collaboration) {
        // In collaboration mode, update Yjs (will trigger onElementsChange)
        collaboration.setElements(newElements);
      }
      // Store update happens via debounced effect
    },
    [collaboration]
  );

  return { elements, setElements: updateElements };
}
