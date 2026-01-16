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
    debounceMs = 800,
}: UseFilesystemAutoSaveOptions): FilesystemAutoSaveStatus {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef<string>("");
    const [hasDiskFile, setHasDiskFile] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Function to check file handle status
    const checkFileHandle = useCallback(async () => {
        const handle = await getBoardFileHandle(boardId);
        setHasDiskFile(!!handle);
        if (handle) {
            // Initialize lastSavedRef if we have a file handle
            lastSavedRef.current = JSON.stringify({
                elements,
                canvasBackground,
            });
            setIsDirty(false);
        }
    }, [boardId, elements, canvasBackground]);

    // Check if this board has a file handle on mount and when boardId changes
    useEffect(() => {
        void checkFileHandle();
    }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Track dirty state when content changes
    useEffect(() => {
        if (!hasDiskFile) return;
        const currentHash = JSON.stringify({ elements, canvasBackground });
        setIsDirty(currentHash !== lastSavedRef.current);
    }, [elements, canvasBackground, hasDiskFile]);

    const save = useCallback(async () => {
        if (!isOwner || !enabled) return;

        const handle = await getBoardFileHandle(boardId);
        if (!handle) {
            setHasDiskFile(false);
            return;
        }

        setHasDiskFile(true);

        const hash = JSON.stringify({ elements, canvasBackground });
        if (hash === lastSavedRef.current) return;

        setIsSaving(true);

        const kladdeFile: ShadeworksFile = {
            type: "kladde",
            version: 1,
            elements,
            appState: {
                canvasBackground,
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
        }
    }, [boardId, elements, canvasBackground, isOwner, enabled]);

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
