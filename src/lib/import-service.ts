import type {
    BoardElement,
    BoardComment,
    ShadeworksFile,
} from "@/lib/board-types";
import type { Board, BoardStore } from "@/lib/store-types";
import {
    isFileSystemAccessSupported,
    isFileOpenPickerSupported,
    saveBoardToWorkspaceStorage,
} from "@/lib/filesystem-storage";
import { set } from "idb-keyval";

// Re-declare types for File System Access API
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
    queryPermission(descriptor?: {
        mode?: "read" | "readwrite";
    }): Promise<PermissionState>;
    requestPermission(descriptor?: {
        mode?: "read" | "readwrite";
    }): Promise<PermissionState>;
}

const WORKSPACE_STORAGE_HANDLE_PREFIX = "kladde-fs-workspace-storage-handle:";

/**
 * Get the filename for a board in a workspace
 * - Quick boards are numbered (handled elsewhere)
 * - Regular boards use the board name
 */
function getBoardBaseFileName(board: Board): string {
    const name = board.name.trim();
    if (name && !name.startsWith("Quick Board")) {
        return name;
    }

    const date = new Date(board.createdAt);
    return date.toISOString().split("T")[0];
}

function getBoardFileName(board: Board, allBoards: Map<string, Board>): string {
    const baseName = getBoardBaseFileName(board);
    const hasCollision = Array.from(allBoards.values()).some(
        (other) =>
            other.id !== board.id &&
            other.workstreamId === board.workstreamId &&
            getBoardBaseFileName(other) === baseName,
    );

    return hasCollision ? `${baseName}-${board.id.slice(0, 8)}` : baseName;
}

/**
 * Parsed .kladde file structure
 */
export interface ParsedKladdeFile {
    fileName: string;
    boardName: string;
    elements: BoardElement[];
    comments: BoardComment[];
    appState: ShadeworksFile["appState"];
    isValid: boolean;
    error?: string;
    fileHandle?: FSFileHandle;
}

/**
 * Folder structure for import preview
 */
export interface FolderImportStructure {
    rootBoards: ParsedKladdeFile[];
    subfolders: {
        folderName: string;
        folderHandle: FSDirectoryHandle;
        boards: ParsedKladdeFile[];
    }[];
    directoryHandle: FSDirectoryHandle;
}

/**
 * Import operation result
 */
export interface ImportResult {
    success: boolean;
    boardsImported: number;
    workspacesCreated: number;
    boardIds: string[];
    workspaceIds: string[];
    errors: string[];
}

/**
 * Check if File System Access API is available
 */
export function canUseFileSystemAPI(): boolean {
    return isFileSystemAccessSupported() && isFileOpenPickerSupported();
}

/**
 * Derive board name from filename
 */
export function deriveBoardName(fileName: string): string {
    let name = fileName;

    // Remove file extension
    name = name.replace(/\.(kladde|shadeworks|json)$/i, "");

    // Replace common separators with spaces
    name = name.replace(/[-_]+/g, " ");

    // Handle camelCase/PascalCase
    name = name.replace(/([a-z])([A-Z])/g, "$1 $2");

    // Trim whitespace
    name = name.trim();

    // Capitalize first letter
    if (name.length > 0) {
        name = name.charAt(0).toUpperCase() + name.slice(1);
    }

    // Limit length
    name = name.slice(0, 200);

    // Fallback if empty
    if (!name) {
        name = `Imported Board ${new Date().toLocaleDateString()}`;
    }

    return name;
}

/**
 * Validate ShadeworksFile structure
 */
export function validateShadeworksFile(
    data: unknown,
): { valid: boolean; error?: string } {
    if (!data || typeof data !== "object") {
        return { valid: false, error: "Invalid file format: not an object" };
    }

    const file = data as Record<string, unknown>;

    // Check type field
    if (file.type !== "kladde" && file.type !== "shadeworks") {
        return {
            valid: false,
            error: 'Invalid file format: missing or invalid "type" field',
        };
    }

    // Check version
    if (typeof file.version !== "number") {
        return {
            valid: false,
            error: 'Invalid file format: missing or invalid "version" field',
        };
    }

    // Check elements array
    if (!Array.isArray(file.elements)) {
        return {
            valid: false,
            error: 'Invalid file format: missing or invalid "elements" array',
        };
    }

    // Check appState
    if (!file.appState || typeof file.appState !== "object") {
        return {
            valid: false,
            error: 'Invalid file format: missing or invalid "appState" field',
        };
    }

    const appState = file.appState as Record<string, unknown>;
    const validBackgrounds = ["none", "dots", "lines", "grid"];
    if (!validBackgrounds.includes(appState.canvasBackground as string)) {
        return {
            valid: false,
            error: 'Invalid file format: invalid "canvasBackground" value',
        };
    }

    return { valid: true };
}

/**
 * Parse a single .kladde file from File object
 */
export async function parseKladdeFile(
    file: File,
    fileHandle?: FSFileHandle,
): Promise<ParsedKladdeFile> {
    const fileName = file.name;
    const boardName = deriveBoardName(fileName);

    try {
        const content = await file.text();
        const data = JSON.parse(content);

        const validation = validateShadeworksFile(data);
        if (!validation.valid) {
            return {
                fileName,
                boardName,
                elements: [],
                comments: [],
                appState: { canvasBackground: "none" },
                isValid: false,
                error: validation.error,
                fileHandle,
            };
        }

        const shadeworksFile = data as ShadeworksFile;

        return {
            fileName,
            boardName,
            elements: shadeworksFile.elements,
            comments: shadeworksFile.comments || [],
            appState: shadeworksFile.appState,
            isValid: true,
            fileHandle,
        };
    } catch (error) {
        return {
            fileName,
            boardName,
            elements: [],
            comments: [],
            appState: { canvasBackground: "none" },
            isValid: false,
            error:
                error instanceof SyntaxError
                    ? "Invalid JSON format"
                    : `Failed to read file: ${(error as Error).message}`,
            fileHandle,
        };
    }
}

/**
 * Request user to select .kladde file(s) for import
 */
export async function requestImportFiles(
    multiple = false,
): Promise<{ files: ParsedKladdeFile[]; fileHandles: FSFileHandle[] } | null> {
    if (!isFileOpenPickerSupported()) {
        return null;
    }

    try {
        const handles = await window.showOpenFilePicker!({
            multiple,
            types: [
                {
                    description: "Kladde boards",
                    accept: {
                        "application/json": [".kladde", ".shadeworks", ".json"],
                    },
                },
            ],
        });

        const files: ParsedKladdeFile[] = [];
        for (const handle of handles) {
            const file = await handle.getFile();
            const parsed = await parseKladdeFile(file, handle);
            files.push(parsed);
        }

        return { files, fileHandles: handles };
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            return null;
        }
        throw error;
    }
}

/**
 * Request user to select a folder for import
 */
export async function requestImportFolder(): Promise<FolderImportStructure | null> {
    if (!isFileSystemAccessSupported()) {
        return null;
    }

    try {
        const handle = await window.showDirectoryPicker!({
            mode: "readwrite",
            startIn: "documents",
        });

        return scanFolderForImport(handle);
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            return null;
        }
        throw error;
    }
}

/**
 * Scan a folder structure for .kladde files
 */
export async function scanFolderForImport(
    directoryHandle: FSDirectoryHandle,
): Promise<FolderImportStructure> {
    const rootBoards: ParsedKladdeFile[] = [];
    const subfolders: FolderImportStructure["subfolders"] = [];

    for await (const entry of directoryHandle.values()) {
        if (entry.kind === "file") {
            const fileHandle = entry as FSFileHandle;
            if (
                fileHandle.name.endsWith(".kladde") ||
                fileHandle.name.endsWith(".shadeworks")
            ) {
                const file = await fileHandle.getFile();
                const parsed = await parseKladdeFile(file, fileHandle);
                rootBoards.push(parsed);
            }
        } else if (entry.kind === "directory") {
            const subDirHandle = entry as FSDirectoryHandle;
            const subBoards: ParsedKladdeFile[] = [];

            // Scan one level deep only
            for await (const subEntry of subDirHandle.values()) {
                if (subEntry.kind === "file") {
                    const fileHandle = subEntry as FSFileHandle;
                    if (
                        fileHandle.name.endsWith(".kladde") ||
                        fileHandle.name.endsWith(".shadeworks")
                    ) {
                        const file = await fileHandle.getFile();
                        const parsed = await parseKladdeFile(file, fileHandle);
                        subBoards.push(parsed);
                    }
                }
            }

            if (subBoards.length > 0) {
                subfolders.push({
                    folderName: subDirHandle.name,
                    folderHandle: subDirHandle,
                    boards: subBoards,
                });
            }
        }
    }

    return {
        rootBoards,
        subfolders,
        directoryHandle,
    };
}

/**
 * Import a single file to browser storage
 */
export function importFileToBrowser(
    parsed: ParsedKladdeFile,
    workstreamId: string,
    store: BoardStore,
): string {
    // Create new board
    const boardId = store.createBoard(parsed.boardName, workstreamId);

    // Set elements and comments
    store.setElements(boardId, parsed.elements);
    store.setComments(boardId, parsed.comments);

    // Update board settings with canvas background
    store.updateBoard(boardId, {
        settings: {
            backgroundColor: parsed.appState.canvasBackground,
            gridVisible: true,
            gridSize: parsed.appState.gridSize || 20,
        },
    });

    return boardId;
}

/**
 * Import a single file with disk storage reference
 */
export async function importFileToDisk(
    parsed: ParsedKladdeFile,
    workstreamId: string,
    store: BoardStore,
    directoryHandle?: FSDirectoryHandle,
): Promise<string> {
    // First ensure workspace has disk storage type if directory handle provided
    if (directoryHandle) {
        store.setWorkspaceStorageType(workstreamId, "disk", directoryHandle.name);
        // Store the directory handle
        await set(
            `${WORKSPACE_STORAGE_HANDLE_PREFIX}${workstreamId}`,
            directoryHandle,
        );
    }

    // Create board and set data
    const boardId = store.createBoard(parsed.boardName, workstreamId);
    store.setElements(boardId, parsed.elements);
    store.setComments(boardId, parsed.comments);

    // Update board settings
    store.updateBoard(boardId, {
        settings: {
            backgroundColor: parsed.appState.canvasBackground,
            gridVisible: true,
            gridSize: parsed.appState.gridSize || 20,
        },
    });

    const board = store.boards.get(boardId);
    if (!board) return boardId;

    const fileName = getBoardFileName(board, store.boards);
    const kladdeFile: ShadeworksFile = {
        type: "kladde",
        version: 1,
        elements: parsed.elements,
        comments: parsed.comments,
        appState: parsed.appState,
    };
    const jsonString = JSON.stringify(kladdeFile, null, 2);
    const savedHandle = await saveBoardToWorkspaceStorage(
        workstreamId,
        fileName,
        jsonString,
    );
    if (!savedHandle) {
        throw new Error(
            "Workspace disk storage is not available. Board kept in browser storage.",
        );
    }

    return boardId;
}

/**
 * Import folder to browser storage
 */
export function importFolderToBrowser(
    structure: FolderImportStructure,
    targetWorkstreamId: string,
    store: BoardStore,
): ImportResult {
    const result: ImportResult = {
        success: true,
        boardsImported: 0,
        workspacesCreated: 0,
        boardIds: [],
        workspaceIds: [],
        errors: [],
    };

    // Import root boards to target workspace
    for (const parsed of structure.rootBoards) {
        if (!parsed.isValid) {
            result.errors.push(`${parsed.fileName}: ${parsed.error}`);
            continue;
        }

        try {
            const boardId = importFileToBrowser(parsed, targetWorkstreamId, store);
            result.boardIds.push(boardId);
            result.boardsImported++;
        } catch (error) {
            result.errors.push(
                `${parsed.fileName}: ${(error as Error).message}`,
            );
        }
    }

    // Create workspaces for subfolders and import their boards
    for (const subfolder of structure.subfolders) {
        try {
            // Create workspace with folder name
            const workspaceId = store.createWorkstream(
                subfolder.folderName,
                getRandomColor(),
            );
            result.workspaceIds.push(workspaceId);
            result.workspacesCreated++;

            // Import boards to new workspace
            for (const parsed of subfolder.boards) {
                if (!parsed.isValid) {
                    result.errors.push(`${parsed.fileName}: ${parsed.error}`);
                    continue;
                }

                try {
                    const boardId = importFileToBrowser(parsed, workspaceId, store);
                    result.boardIds.push(boardId);
                    result.boardsImported++;
                } catch (error) {
                    result.errors.push(
                        `${parsed.fileName}: ${(error as Error).message}`,
                    );
                }
            }
        } catch (error) {
            result.errors.push(
                `Folder ${subfolder.folderName}: ${(error as Error).message}`,
            );
        }
    }

    result.success = result.errors.length === 0;
    return result;
}

/**
 * Import folder with disk storage
 */
export async function importFolderToDisk(
    structure: FolderImportStructure,
    targetWorkstreamId: string,
    store: BoardStore,
): Promise<ImportResult> {
    const result: ImportResult = {
        success: true,
        boardsImported: 0,
        workspacesCreated: 0,
        boardIds: [],
        workspaceIds: [],
        errors: [],
    };

    // Set target workspace to disk storage with root directory
    store.setWorkspaceStorageType(
        targetWorkstreamId,
        "disk",
        structure.directoryHandle.name,
    );
    await set(
        `${WORKSPACE_STORAGE_HANDLE_PREFIX}${targetWorkstreamId}`,
        structure.directoryHandle,
    );

    // Import root boards
    for (const parsed of structure.rootBoards) {
        if (!parsed.isValid) {
            result.errors.push(`${parsed.fileName}: ${parsed.error}`);
            continue;
        }

        try {
            const boardId = await importFileToDisk(
                parsed,
                targetWorkstreamId,
                store,
            );
            result.boardIds.push(boardId);
            result.boardsImported++;
        } catch (error) {
            result.errors.push(
                `${parsed.fileName}: ${(error as Error).message}`,
            );
        }
    }

    // Create workspaces for subfolders with disk storage
    for (const subfolder of structure.subfolders) {
        try {
            const workspaceId = store.createWorkstream(
                subfolder.folderName,
                getRandomColor(),
            );
            result.workspaceIds.push(workspaceId);
            result.workspacesCreated++;

            // Set workspace to disk storage with subfolder handle
            store.setWorkspaceStorageType(
                workspaceId,
                "disk",
                subfolder.folderName,
            );
            await set(
                `${WORKSPACE_STORAGE_HANDLE_PREFIX}${workspaceId}`,
                subfolder.folderHandle,
            );

            // Import boards
            for (const parsed of subfolder.boards) {
                if (!parsed.isValid) {
                    result.errors.push(`${parsed.fileName}: ${parsed.error}`);
                    continue;
                }

                try {
                    const boardId = await importFileToDisk(
                        parsed,
                        workspaceId,
                        store,
                    );
                    result.boardIds.push(boardId);
                    result.boardsImported++;
                } catch (error) {
                    result.errors.push(
                        `${parsed.fileName}: ${(error as Error).message}`,
                    );
                }
            }
        } catch (error) {
            result.errors.push(
                `Folder ${subfolder.folderName}: ${(error as Error).message}`,
            );
        }
    }

    result.success = result.errors.length === 0;
    return result;
}

/**
 * Fallback import using FileReader for browsers without File System Access API
 */
export function importFromFileInput(
    inputElement: HTMLInputElement,
): Promise<ParsedKladdeFile[]> {
    return new Promise((resolve) => {
        const files = inputElement.files;
        if (!files || files.length === 0) {
            resolve([]);
            return;
        }

        const parsed: ParsedKladdeFile[] = [];
        let remaining = files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            parseKladdeFile(file).then((result) => {
                parsed.push(result);
                remaining--;
                if (remaining === 0) {
                    resolve(parsed);
                }
            });
        }
    });
}

/**
 * Get a random color for new workspaces
 */
function getRandomColor(): string {
    const colors = [
        "#6366f1", // Indigo
        "#8b5cf6", // Violet
        "#a855f7", // Purple
        "#d946ef", // Fuchsia
        "#ec4899", // Pink
        "#f43f5e", // Rose
        "#ef4444", // Red
        "#f97316", // Orange
        "#f59e0b", // Amber
        "#eab308", // Yellow
        "#84cc16", // Lime
        "#22c55e", // Green
        "#10b981", // Emerald
        "#14b8a6", // Teal
        "#06b6d4", // Cyan
        "#0ea5e9", // Sky
        "#3b82f6", // Blue
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}
