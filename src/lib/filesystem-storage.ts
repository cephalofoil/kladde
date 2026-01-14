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
const BOARD_FILE_HANDLE_PREFIX = "kladde-fs-board-file-handle:";

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
    throw new Error("File System Access API is not supported in this browser");
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
