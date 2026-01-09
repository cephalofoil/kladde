import { useEffect, useRef, useCallback } from "react";
import { useBoardStore } from "@/store/board-store";
import type { BoardElement } from "@/lib/board-types";

interface UseAutoSaveOptions {
    boardId: string;
    elements: BoardElement[];
    isOwner: boolean;
    enabled?: boolean;
    debounceMs?: number;
}

/**
 * Hook to auto-save board elements to IndexedDB
 * Only saves if the user is the owner of the board
 */
export function useAutoSave({
    boardId,
    elements,
    isOwner,
    enabled = true,
    debounceMs = 500,
}: UseAutoSaveOptions) {
    const setStoreElements = useBoardStore((s) => s.setElements);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef<string>("");

    const save = useCallback(() => {
        if (!isOwner || !enabled) return;

        // Create a simple hash of elements to avoid unnecessary saves
        const elementsHash = JSON.stringify(elements.map((e) => e.id).sort());
        if (elementsHash === lastSavedRef.current) return;

        lastSavedRef.current = elementsHash;
        setStoreElements(boardId, elements);
    }, [boardId, elements, isOwner, enabled, setStoreElements]);

    useEffect(() => {
        if (!isOwner || !enabled) return;

        // Clear any pending save
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Schedule a new save
        timeoutRef.current = setTimeout(save, debounceMs);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [elements, isOwner, enabled, debounceMs, save]);

    // Force save on unmount if there are pending changes
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                // Synchronous save on unmount
                if (isOwner && enabled) {
                    save();
                }
            }
        };
    }, [isOwner, enabled, save]);

    return { save };
}
