import { useEffect, useRef, useCallback, useState } from "react";
import type { BoardElement, ShadeworksFile } from "@/lib/board-types";
import {
    getBoardFileHandle,
    writeToFileHandle,
} from "@/lib/filesystem-storage";

interface UseFilesystemAutoSaveOptions {
    boardId: string;
    elements: BoardElement[];
    canvasBackground: "none" | "dots" | "lines" | "grid";
    isOwner: boolean;
    enabled?: boolean;
    debounceMs?: number;
}

export interface FilesystemAutoSaveStatus {
    hasDiskFile: boolean;
    isDirty: boolean;
    isSaving: boolean;
    recheckFileHandle: () => void;
}

export function useFilesystemAutoSave({
    boardId,
    elements,
    canvasBackground,
    isOwner,
    enabled = true,
    debounceMs = 400,
}: UseFilesystemAutoSaveOptions): FilesystemAutoSaveStatus {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef<string>("");
    const inFlightRef = useRef(false);
    const pendingSaveRef = useRef(false);
    const [hasDiskFile, setHasDiskFile] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const elementsRef = useRef(elements);
    const canvasBackgroundRef = useRef(canvasBackground);
    elementsRef.current = elements;
    canvasBackgroundRef.current = canvasBackground;

    // Function to check file handle status
    const checkFileHandle = useCallback(async () => {
        const handle = await getBoardFileHandle(boardId);
        setHasDiskFile(!!handle);
        if (handle) {
            // Initialize lastSavedRef if we have a file handle
            lastSavedRef.current = JSON.stringify({
                elements: elementsRef.current,
                canvasBackground: canvasBackgroundRef.current,
            });
            setIsDirty(false);
        }
    }, [boardId]);

    // Check if this board has a file handle on mount and when boardId changes
    useEffect(() => {
        void checkFileHandle();
    }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Track dirty state when content changes
    useEffect(() => {
        if (!hasDiskFile) return;
        const currentHash = JSON.stringify({
            elements: elementsRef.current,
            canvasBackground: canvasBackgroundRef.current,
        });
        setIsDirty(currentHash !== lastSavedRef.current);
    }, [elements, canvasBackground, hasDiskFile]);

    const save = useCallback(async () => {
        if (!isOwner || !enabled) return;
        if (inFlightRef.current) {
            pendingSaveRef.current = true;
            return;
        }

        const handle = await getBoardFileHandle(boardId);
        if (!handle) {
            setHasDiskFile(false);
            return;
        }

        setHasDiskFile(true);

        const hash = JSON.stringify({
            elements: elementsRef.current,
            canvasBackground: canvasBackgroundRef.current,
        });
        if (hash === lastSavedRef.current) return;

        setIsSaving(true);
        inFlightRef.current = true;

        const kladdeFile: ShadeworksFile = {
            type: "kladde",
            version: 1,
            elements: elementsRef.current,
            appState: {
                canvasBackground: canvasBackgroundRef.current,
            },
        };

        try {
            const jsonString = JSON.stringify(kladdeFile, null, 2);
            await writeToFileHandle(handle, jsonString);
            lastSavedRef.current = hash;
            setIsDirty(false);
        } catch (error) {
            console.error("Failed to auto-save to filesystem:", error);
        } finally {
            setIsSaving(false);
            inFlightRef.current = false;
            if (pendingSaveRef.current) {
                pendingSaveRef.current = false;
                void save();
            }
        }
    }, [boardId, isOwner, enabled]);

    useEffect(() => {
        if (!isOwner || !enabled) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            void save();
        }, debounceMs);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [elements, canvasBackground, isOwner, enabled, debounceMs, save]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                void save();
            }
        };
    }, [save]);

    // Expose a function to manually recheck file handle (e.g., after saving via modal)
    const recheckFileHandle = useCallback(() => {
        void checkFileHandle();
    }, [checkFileHandle]);

    return { hasDiskFile, isDirty, isSaving, recheckFileHandle };
}
