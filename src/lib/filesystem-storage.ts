import { get, set, del } from "idb-keyval";

// Type declarations for File System Access API (not yet in standard TypeScript lib)
interface ShowDirectoryPickerOptions {
    mode?: "read" | "readwrite";
    startIn?:
        | "desktop"
        | "documents"
        | "downloads"
        | "music"
        | "pictures"
        | "videos";
}

interface FSDirectoryHandle {
    kind: "directory";
    name: string;
    getDirectoryHandle(
        name: string,
        options?: { create?: boolean },
    ): Promise<FSDirectoryHandle>;
    getFileHandle(
        name: string,
        options?: { create?: boolean },
    ): Promise<FSFileHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    values(): AsyncIterableIterator<FSDirectoryHandle | FSFileHandle>;
    queryPermission(descriptor?: {
        mode?: "read" | "readwrite";
    }): Promise<PermissionState>;
    requestPermission(descriptor?: {
        mode?: "read" | "readwrite";
    }): Promise<PermissionState>;
}

interface FSFileHandle {
    kind: "file";
    name: string;
    getFile(): Promise<File>;
    createWritable(): Promise<FSWritableFileStream>;
    queryPermission(descriptor?: {
        mode?: "read" | "readwrite";
    }): Promise<PermissionState>;
    requestPermission(descriptor?: {
        mode?: "read" | "readwrite";
    }): Promise<PermissionState>;
}

export type FileSystemFileHandle = FSFileHandle;

interface FSWritableFileStream extends WritableStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
}

declare global {
    interface Window {
        showDirectoryPicker?: (
            options?: ShowDirectoryPickerOptions,
        ) => Promise<FSDirectoryHandle>;
        showOpenFilePicker?: (options?: {
            multiple?: boolean;
            types?: Array<{
                description?: string;
                accept: Record<string, string[]>;
            }>;
        }) => Promise<FSFileHandle[]>;
    }
}

const DIRECTORY_HANDLE_KEY = "kladde-fs-directory-handle";
const GLOBAL_STORAGE_HANDLE_KEY = "kladde-fs-global-storage-handle";
const BOARD_FILE_HANDLE_PREFIX = "kladde-fs-board-file-handle:";
const WORKSPACE_STORAGE_HANDLE_PREFIX =
    "kladde-fs-workspace-storage-handle:";

// Workspace storage is per-workspace to avoid cross-workspace folder reuse.
// We request permission during picker selection and only store the handle
// when read/write access is granted.

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "showDirectoryPicker" in window &&
        typeof window.showDirectoryPicker === "function"
    );
}

/**
 * Request user to select a storage directory
 * Returns the directory handle or null if cancelled
 */
export async function requestStorageDirectory(): Promise<FSDirectoryHandle | null> {
    if (!isFileSystemAccessSupported()) {
        throw new Error(
            "File System Access API is not supported in this browser",
        );
    }

    try {
        const handle = await window.showDirectoryPicker!({
            mode: "readwrite",
            startIn: "documents",
        });

        // Store the handle for persistence across sessions
        await set(DIRECTORY_HANDLE_KEY, handle);

        return handle;
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            // User cancelled the picker
            return null;
        }
        throw error;
    }
}

/**
 * Check if File Open picker is supported
 */
export function isFileOpenPickerSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "showOpenFilePicker" in window &&
        typeof window.showOpenFilePicker === "function"
    );
}

/**
 * Request user to select a .kladde file
 * Returns the file handle or null if cancelled
 */
export async function requestOpenFile(): Promise<FSFileHandle | null> {
    if (!isFileOpenPickerSupported()) {
        throw new Error("File Open picker is not supported in this browser");
    }

    try {
        const [handle] = await window.showOpenFilePicker!({
            multiple: false,
            types: [
                {
                    description: "Kladde boards",
                    accept: {
                        "application/json": [".kladde", ".shadeworks"],
                    },
                },
            ],
        });

        return handle ?? null;
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            return null;
        }
        throw error;
    }
}

/**
 * Check if we have a stored directory handle
 */
export async function hasStorageDirectory(): Promise<boolean> {
    try {
        const handle = await get<FSDirectoryHandle>(DIRECTORY_HANDLE_KEY);
        if (!handle) return false;

        // Verify we still have permission
        const permission = await handle.queryPermission({ mode: "readwrite" });
        return permission === "granted";
    } catch {
        return false;
    }
}

/**
 * Get the stored directory handle
 * Returns null if not set or permission denied
 */
export async function getStorageDirectory(): Promise<FSDirectoryHandle | null> {
    try {
        const handle = await get<FSDirectoryHandle>(DIRECTORY_HANDLE_KEY);
        if (!handle) return null;

        // Check permission status
        const permission = await handle.queryPermission({ mode: "readwrite" });

        if (permission === "granted") {
            return handle;
        }

        // Try to request permission if it was prompt
        if (permission === "prompt") {
            const newPermission = await handle.requestPermission({
                mode: "readwrite",
            });
            if (newPermission === "granted") {
                return handle;
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Get the name of the storage directory (for display)
 */
export async function getStorageDirectoryName(): Promise<string | null> {
    const handle = await getStorageDirectory();
    return handle?.name ?? null;
}

/**
 * Clear the stored directory handle
 */
export async function clearStorageDirectory(): Promise<void> {
    await del(DIRECTORY_HANDLE_KEY);
}

/**
 * Store a file handle for a specific board
 */
export async function setBoardFileHandle(
    boardId: string,
    handle: FSFileHandle | null,
): Promise<void> {
    const key = `${BOARD_FILE_HANDLE_PREFIX}${boardId}`;
    if (!handle) {
        await del(key);
        return;
    }
    await set(key, handle);
}

/**
 * Retrieve the stored file handle for a specific board
 */
export async function getBoardFileHandle(
    boardId: string,
): Promise<FSFileHandle | null> {
    try {
        const key = `${BOARD_FILE_HANDLE_PREFIX}${boardId}`;
        const handle = await get<FSFileHandle>(key);
        if (!handle) return null;

        const permission = await handle.queryPermission({ mode: "readwrite" });
        if (permission === "granted") {
            return handle;
        }

        if (permission === "prompt") {
            const newPermission = await handle.requestPermission({
                mode: "readwrite",
            });
            if (newPermission === "granted") {
                return handle;
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Clear stored file handle for a specific board
 */
export async function clearBoardFileHandle(boardId: string): Promise<void> {
    const key = `${BOARD_FILE_HANDLE_PREFIX}${boardId}`;
    await del(key);
}

/**
 * Request user to select a storage directory for a workspace
 * Returns the directory handle or null if cancelled
 */
export async function requestWorkspaceStorageDirectory(
    workspaceId: string,
): Promise<FSDirectoryHandle | null> {
    if (!isFileSystemAccessSupported()) {
        throw new Error(
            "File System Access API is not supported in this browser",
        );
    }

    try {
        const handle = await window.showDirectoryPicker!({
            mode: "readwrite",
            startIn: "documents",
        });

        const permission = await handle.requestPermission({
            mode: "readwrite",
        });
        if (permission !== "granted") {
            return null;
        }

        const key = `${WORKSPACE_STORAGE_HANDLE_PREFIX}${workspaceId}`;
        await set(key, handle);

        return handle;
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            return null;
        }
        throw error;
    }
}

/**
 * Check if workspace storage directory is configured and accessible
 */
export async function hasWorkspaceStorageDirectory(
    workspaceId: string,
): Promise<boolean> {
    try {
        const key = `${WORKSPACE_STORAGE_HANDLE_PREFIX}${workspaceId}`;
        const handle = await get<FSDirectoryHandle>(key);
        if (!handle) return false;

        const permission = await handle.queryPermission({ mode: "readwrite" });
        return permission === "granted";
    } catch {
        return false;
    }
}

/**
 * Get the workspace storage directory handle
 * Returns null if not set or permission denied
 */
export async function getWorkspaceStorageDirectory(
    workspaceId: string,
): Promise<FSDirectoryHandle | null> {
    try {
        const key = `${WORKSPACE_STORAGE_HANDLE_PREFIX}${workspaceId}`;
        const handle = await get<FSDirectoryHandle>(key);
        if (!handle) return null;

        const permission = await handle.queryPermission({ mode: "readwrite" });

        if (permission === "granted") {
            return handle;
        }

        if (permission === "prompt") {
            const newPermission = await handle.requestPermission({
                mode: "readwrite",
            });
            if (newPermission === "granted") {
                return handle;
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Get the name of a workspace storage directory (for display)
 */
export async function getWorkspaceStorageDirectoryName(
    workspaceId: string,
): Promise<string | null> {
    const handle = await getWorkspaceStorageDirectory(workspaceId);
    return handle?.name ?? null;
}

/**
 * Clear the workspace storage directory handle
 */
export async function clearWorkspaceStorageDirectory(
    workspaceId: string,
): Promise<void> {
    const key = `${WORKSPACE_STORAGE_HANDLE_PREFIX}${workspaceId}`;
    await del(key);
}

/**
 * Write content to a file in the storage directory
 */
export async function writeFile(
    path: string,
    content: string,
): Promise<FSFileHandle> {
    const rootHandle = await getStorageDirectory();
    if (!rootHandle) {
        throw new Error("No storage directory configured");
    }

    // Handle nested paths (e.g., "boards/abc123.json")
    const parts = path.split("/");
    const fileName = parts.pop()!;

    let currentHandle: FSDirectoryHandle = rootHandle;

    // Navigate/create subdirectories
    for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, {
            create: true,
        });
    }

    // Create/overwrite the file
    const fileHandle = await currentHandle.getFileHandle(fileName, {
        create: true,
    });
    await writeToFileHandle(fileHandle, content);
    return fileHandle;
}

/**
 * Write content to an existing file handle
 */
export async function writeToFileHandle(
    handle: FSFileHandle,
    content: string,
): Promise<void> {
    const writable = await handle.createWritable();
    try {
        await writable.write(content);
    } finally {
        await writable.close();
    }
}

/**
 * Read content from a file in the storage directory
 * Returns null if file doesn't exist
 */
export async function readFile(path: string): Promise<string | null> {
    const rootHandle = await getStorageDirectory();
    if (!rootHandle) {
        throw new Error("No storage directory configured");
    }

    try {
        // Handle nested paths
        const parts = path.split("/");
        const fileName = parts.pop()!;

        let currentHandle: FSDirectoryHandle = rootHandle;

        // Navigate subdirectories
        for (const part of parts) {
            currentHandle = await currentHandle.getDirectoryHandle(part);
        }

        const fileHandle = await currentHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        return await file.text();
    } catch (error) {
        if ((error as Error).name === "NotFoundError") {
            return null;
        }
        throw error;
    }
}

/**
 * Delete a file from the storage directory
 */
export async function deleteFile(path: string): Promise<void> {
    const rootHandle = await getStorageDirectory();
    if (!rootHandle) {
        throw new Error("No storage directory configured");
    }

    try {
        // Handle nested paths
        const parts = path.split("/");
        const fileName = parts.pop()!;

        let currentHandle: FSDirectoryHandle = rootHandle;

        // Navigate subdirectories
        for (const part of parts) {
            currentHandle = await currentHandle.getDirectoryHandle(part);
        }

        await currentHandle.removeEntry(fileName);
    } catch (error) {
        if ((error as Error).name === "NotFoundError") {
            // File already doesn't exist, that's fine
            return;
        }
        throw error;
    }
}

/**
 * List all files in a subdirectory
 * Returns array of file names (without path)
 */
export async function listFiles(subdir?: string): Promise<string[]> {
    const rootHandle = await getStorageDirectory();
    if (!rootHandle) {
        throw new Error("No storage directory configured");
    }

    try {
        let targetHandle: FSDirectoryHandle = rootHandle;

        if (subdir) {
            const parts = subdir.split("/");
            for (const part of parts) {
                targetHandle = await targetHandle.getDirectoryHandle(part);
            }
        }

        const files: string[] = [];
        for await (const entry of targetHandle.values()) {
            if (entry.kind === "file") {
                files.push(entry.name);
            }
        }

        return files;
    } catch (error) {
        if ((error as Error).name === "NotFoundError") {
            return [];
        }
        throw error;
    }
}

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
    try {
        const content = await readFile(path);
        return content !== null;
    } catch {
        return false;
    }
}

/**
 * Save a board to a workspace storage directory
 */
export async function saveBoardToWorkspaceStorage(
    workspaceId: string,
    fileName: string,
    content: string,
): Promise<FSFileHandle | null> {
    const rootHandle = await getWorkspaceStorageDirectory(workspaceId);
    if (!rootHandle) return null;

    try {
        const sanitizedFileName = sanitizeFileName(fileName);
        const fullFileName = sanitizedFileName.endsWith(".kladde")
            ? sanitizedFileName
            : `${sanitizedFileName}.kladde`;

        const fileHandle = await rootHandle.getFileHandle(fullFileName, {
            create: true,
        });
        await writeToFileHandle(fileHandle, content);

        return fileHandle;
    } catch (error) {
        console.error("Failed to save board to workspace storage:", error);
        return null;
    }
}

/**
 * Rename a board file in workspace storage
 */
export async function renameBoardInWorkspaceStorage(
    workspaceId: string,
    oldFileName: string,
    newFileName: string,
    content: string,
): Promise<FSFileHandle | null> {
    const rootHandle = await getWorkspaceStorageDirectory(workspaceId);
    if (!rootHandle) return null;

    try {
        const sanitizedOldName = sanitizeFileName(oldFileName);
        const sanitizedNewName = sanitizeFileName(newFileName);
        const oldFullName = sanitizedOldName.endsWith(".kladde")
            ? sanitizedOldName
            : `${sanitizedOldName}.kladde`;
        const newFullName = sanitizedNewName.endsWith(".kladde")
            ? sanitizedNewName
            : `${sanitizedNewName}.kladde`;

        const newFileHandle = await rootHandle.getFileHandle(newFullName, {
            create: true,
        });
        await writeToFileHandle(newFileHandle, content);

        if (oldFullName !== newFullName) {
            try {
                await rootHandle.removeEntry(oldFullName);
            } catch {
                // Ignore if old file doesn't exist
            }
        }

        return newFileHandle;
    } catch (error) {
        console.error("Failed to rename board in workspace storage:", error);
        return null;
    }
}

// ============================================================================
// GLOBAL DISK STORAGE FUNCTIONS
// These functions manage a global storage directory for all boards
// ============================================================================

/**
 * Request user to select a global storage directory for all boards
 * Returns the directory handle or null if cancelled
 */
export async function requestGlobalStorageDirectory(): Promise<FSDirectoryHandle | null> {
    if (!isFileSystemAccessSupported()) {
        throw new Error(
            "File System Access API is not supported in this browser",
        );
    }

    try {
        const handle = await window.showDirectoryPicker!({
            mode: "readwrite",
            startIn: "documents",
        });

        // Store the handle for persistence across sessions
        await set(GLOBAL_STORAGE_HANDLE_KEY, handle);

        return handle;
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            return null;
        }
        throw error;
    }
}

/**
 * Check if global storage directory is configured and accessible
 */
export async function hasGlobalStorageDirectory(): Promise<boolean> {
    try {
        const handle = await get<FSDirectoryHandle>(GLOBAL_STORAGE_HANDLE_KEY);
        if (!handle) return false;

        const permission = await handle.queryPermission({ mode: "readwrite" });
        return permission === "granted";
    } catch {
        return false;
    }
}

/**
 * Get the global storage directory handle
 * Returns null if not set or permission denied
 */
export async function getGlobalStorageDirectory(): Promise<FSDirectoryHandle | null> {
    try {
        const handle = await get<FSDirectoryHandle>(GLOBAL_STORAGE_HANDLE_KEY);
        if (!handle) return null;

        const permission = await handle.queryPermission({ mode: "readwrite" });

        if (permission === "granted") {
            return handle;
        }

        if (permission === "prompt") {
            const newPermission = await handle.requestPermission({
                mode: "readwrite",
            });
            if (newPermission === "granted") {
                return handle;
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Get the name of the global storage directory (for display)
 */
export async function getGlobalStorageDirectoryName(): Promise<string | null> {
    const handle = await getGlobalStorageDirectory();
    return handle?.name ?? null;
}

/**
 * Clear the global storage directory handle (disable disk storage)
 */
export async function clearGlobalStorageDirectory(): Promise<void> {
    await del(GLOBAL_STORAGE_HANDLE_KEY);
}

/**
 * Sanitize a name for use as a filename/folder name
 */
export function sanitizeFileName(name: string): string {
    // Remove or replace invalid characters
    return name
        .replace(/[<>:"/\\|?*]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200); // Limit length
}

/**
 * Ensure a workspace folder exists in global storage
 */
export async function ensureWorkspaceFolderExists(
    workspaceName: string,
): Promise<FSDirectoryHandle | null> {
    const rootHandle = await getGlobalStorageDirectory();
    if (!rootHandle) return null;

    try {
        const folderName = sanitizeFileName(workspaceName);
        return await rootHandle.getDirectoryHandle(folderName, {
            create: true,
        });
    } catch (error) {
        console.error("Failed to create workspace folder:", error);
        return null;
    }
}

/**
 * Ensure the quickboards folder exists
 */
export async function ensureQuickboardsFolderExists(): Promise<FSDirectoryHandle | null> {
    const rootHandle = await getGlobalStorageDirectory();
    if (!rootHandle) return null;

    try {
        return await rootHandle.getDirectoryHandle("quickboards", {
            create: true,
        });
    } catch (error) {
        console.error("Failed to create quickboards folder:", error);
        return null;
    }
}

/**
 * Save a board to the global storage directory
 */
export async function saveBoardToGlobalStorage(
    workspaceFolderName: string,
    fileName: string,
    content: string,
): Promise<FSFileHandle | null> {
    const rootHandle = await getGlobalStorageDirectory();
    if (!rootHandle) return null;

    try {
        const folderName = sanitizeFileName(workspaceFolderName);
        const sanitizedFileName = sanitizeFileName(fileName);
        const fullFileName = sanitizedFileName.endsWith(".kladde")
            ? sanitizedFileName
            : `${sanitizedFileName}.kladde`;

        // Get or create the workspace folder
        const workspaceHandle = await rootHandle.getDirectoryHandle(
            folderName,
            {
                create: true,
            },
        );

        // Create/overwrite the file
        const fileHandle = await workspaceHandle.getFileHandle(fullFileName, {
            create: true,
        });
        await writeToFileHandle(fileHandle, content);

        return fileHandle;
    } catch (error) {
        console.error("Failed to save board to global storage:", error);
        return null;
    }
}

/**
 * Delete a board file from global storage
 */
export async function deleteBoardFromGlobalStorage(
    workspaceFolderName: string,
    fileName: string,
): Promise<boolean> {
    const rootHandle = await getGlobalStorageDirectory();
    if (!rootHandle) return false;

    try {
        const folderName = sanitizeFileName(workspaceFolderName);
        const sanitizedFileName = sanitizeFileName(fileName);
        const fullFileName = sanitizedFileName.endsWith(".kladde")
            ? sanitizedFileName
            : `${sanitizedFileName}.kladde`;

        const workspaceHandle = await rootHandle.getDirectoryHandle(folderName);
        await workspaceHandle.removeEntry(fullFileName);
        return true;
    } catch (error) {
        if ((error as Error).name === "NotFoundError") {
            return true; // Already doesn't exist
        }
        console.error("Failed to delete board from global storage:", error);
        return false;
    }
}

/**
 * Rename a board file in global storage
 */
export async function renameBoardInGlobalStorage(
    workspaceFolderName: string,
    oldFileName: string,
    newFileName: string,
    content: string,
): Promise<FSFileHandle | null> {
    const rootHandle = await getGlobalStorageDirectory();
    if (!rootHandle) return null;

    try {
        const folderName = sanitizeFileName(workspaceFolderName);
        const sanitizedOldName = sanitizeFileName(oldFileName);
        const sanitizedNewName = sanitizeFileName(newFileName);
        const oldFullName = sanitizedOldName.endsWith(".kladde")
            ? sanitizedOldName
            : `${sanitizedOldName}.kladde`;
        const newFullName = sanitizedNewName.endsWith(".kladde")
            ? sanitizedNewName
            : `${sanitizedNewName}.kladde`;

        const workspaceHandle = await rootHandle.getDirectoryHandle(folderName);

        // Create new file with content
        const newFileHandle = await workspaceHandle.getFileHandle(newFullName, {
            create: true,
        });
        await writeToFileHandle(newFileHandle, content);

        // Delete old file (if different name)
        if (oldFullName !== newFullName) {
            try {
                await workspaceHandle.removeEntry(oldFullName);
            } catch {
                // Ignore if old file doesn't exist
            }
        }

        return newFileHandle;
    } catch (error) {
        console.error("Failed to rename board in global storage:", error);
        return null;
    }
}

/**
 * Move a board file between workspace folders
 */
export async function moveBoardInGlobalStorage(
    oldWorkspaceFolderName: string,
    newWorkspaceFolderName: string,
    fileName: string,
    content: string,
): Promise<FSFileHandle | null> {
    const rootHandle = await getGlobalStorageDirectory();
    if (!rootHandle) return null;

    try {
        const oldFolderName = sanitizeFileName(oldWorkspaceFolderName);
        const newFolderName = sanitizeFileName(newWorkspaceFolderName);
        const sanitizedFileName = sanitizeFileName(fileName);
        const fullFileName = sanitizedFileName.endsWith(".kladde")
            ? sanitizedFileName
            : `${sanitizedFileName}.kladde`;

        // Create new workspace folder if needed
        const newWorkspaceHandle = await rootHandle.getDirectoryHandle(
            newFolderName,
            { create: true },
        );

        // Create file in new location
        const newFileHandle = await newWorkspaceHandle.getFileHandle(
            fullFileName,
            {
                create: true,
            },
        );
        await writeToFileHandle(newFileHandle, content);

        // Delete from old location
        if (oldFolderName !== newFolderName) {
            try {
                const oldWorkspaceHandle =
                    await rootHandle.getDirectoryHandle(oldFolderName);
                await oldWorkspaceHandle.removeEntry(fullFileName);
            } catch {
                // Ignore if old file doesn't exist
            }
        }

        return newFileHandle;
    } catch (error) {
        console.error("Failed to move board in global storage:", error);
        return null;
    }
}

/**
 * Rename a workspace folder in global storage
 */
export async function renameWorkspaceFolderInGlobalStorage(
    oldName: string,
    newName: string,
): Promise<boolean> {
    const rootHandle = await getGlobalStorageDirectory();
    if (!rootHandle) return false;

    const oldFolderName = sanitizeFileName(oldName);
    const newFolderName = sanitizeFileName(newName);

    if (oldFolderName === newFolderName) return true;

    try {
        // Get old folder
        const oldHandle = await rootHandle.getDirectoryHandle(oldFolderName);

        // Create new folder
        const newHandle = await rootHandle.getDirectoryHandle(newFolderName, {
            create: true,
        });

        // Copy all files from old to new
        for await (const entry of oldHandle.values()) {
            if (entry.kind === "file") {
                const file = await entry.getFile();
                const content = await file.text();
                const newFileHandle = await newHandle.getFileHandle(
                    entry.name,
                    {
                        create: true,
                    },
                );
                await writeToFileHandle(newFileHandle, content);
            }
        }

        // Delete old folder
        await rootHandle.removeEntry(oldFolderName, { recursive: true });

        return true;
    } catch (error) {
        console.error("Failed to rename workspace folder:", error);
        return false;
    }
}

/**
 * Delete a workspace folder from global storage
 */
export async function deleteWorkspaceFolderFromGlobalStorage(
    workspaceName: string,
): Promise<boolean> {
    const rootHandle = await getGlobalStorageDirectory();
    if (!rootHandle) return false;

    try {
        const folderName = sanitizeFileName(workspaceName);
        await rootHandle.removeEntry(folderName, { recursive: true });
        return true;
    } catch (error) {
        if ((error as Error).name === "NotFoundError") {
            return true;
        }
        console.error("Failed to delete workspace folder:", error);
        return false;
    }
}

/**
 * List all board files in a workspace folder
 */
export async function listBoardsInWorkspaceFolder(
    workspaceName: string,
): Promise<string[]> {
    const rootHandle = await getGlobalStorageDirectory();
    if (!rootHandle) return [];

    try {
        const folderName = sanitizeFileName(workspaceName);
        const workspaceHandle = await rootHandle.getDirectoryHandle(folderName);

        const files: string[] = [];
        for await (const entry of workspaceHandle.values()) {
            if (entry.kind === "file" && entry.name.endsWith(".kladde")) {
                files.push(entry.name);
            }
        }

        return files;
    } catch (error) {
        if ((error as Error).name === "NotFoundError") {
            return [];
        }
        console.error("Failed to list boards in workspace folder:", error);
        return [];
    }
}

/**
 * Export type for directory handle
 */
export type { FSDirectoryHandle };
