"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
    Upload,
    Globe,
    HardDrive,
    Check,
    X,
    AlertCircle,
    FileIcon,
    FolderIcon,
    Plus,
    Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardStore, QUICK_BOARDS_WORKSPACE_ID } from "@/store/board-store";
import {
    canUseFileSystemAPI,
    requestImportFiles,
    requestImportFolder,
    importFileToBrowser,
    importFileToDisk,
    importFolderToBrowser,
    importFolderToDisk,
    importFromFileInput,
    type ParsedKladdeFile,
    type FolderImportStructure,
    type ImportResult,
} from "@/lib/import-service";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StorageOption = "browser" | "disk";
type ImportState =
    | "idle"
    | "selecting"
    | "preview"
    | "importing"
    | "success"
    | "error";

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultWorkspaceId?: string;
}

interface StorageOptionCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    selected?: boolean;
    disabled?: boolean;
    badge?: string;
    onClick?: () => void;
}

function StorageOptionCard({
    icon,
    title,
    description,
    selected,
    disabled,
    badge,
    onClick,
}: StorageOptionCardProps) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
        }
    };

    return (
        <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={disabled ? undefined : onClick}
            onKeyDown={handleKeyDown}
            className={cn(
                "flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
                selected
                    ? "border-accent bg-accent/10 ring-2 ring-accent/20"
                    : disabled
                      ? "border-muted bg-muted/30 opacity-60 cursor-not-allowed"
                      : "border-border hover:border-muted-foreground/50 hover:bg-muted/30 cursor-pointer",
            )}
        >
            <div
                className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    selected
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground",
                )}
            >
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "font-medium",
                            disabled && "text-muted-foreground",
                        )}
                    >
                        {title}
                    </span>
                    {badge && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {badge}
                        </span>
                    )}
                    {selected && <Check className="h-4 w-4 text-accent" />}
                </div>
                <p
                    className={cn(
                        "text-sm mt-0.5",
                        disabled
                            ? "text-muted-foreground/70"
                            : "text-muted-foreground",
                    )}
                >
                    {description}
                </p>
            </div>
        </div>
    );
}

export function ImportModal({
    isOpen,
    onClose,
    defaultWorkspaceId,
}: ImportModalProps) {
    const [state, setState] = useState<ImportState>("idle");
    const [storageOption, setStorageOption] = useState<StorageOption>("browser");
    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

    // File/folder data
    const [parsedFiles, setParsedFiles] = useState<ParsedKladdeFile[]>([]);
    const [folderStructure, setFolderStructure] =
        useState<FolderImportStructure | null>(null);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string>("");

    // File input ref for fallback
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Store hooks
    const workstreams = useBoardStore((s) => s.workstreams);
    const createWorkstream = useBoardStore((s) => s.createWorkstream);

    const workstreamsList = useMemo(
        () =>
            Array.from(workstreams.values()).filter(
                (ws) => ws.id !== QUICK_BOARDS_WORKSPACE_ID,
            ),
        [workstreams],
    );
    const canUseFSAPI = canUseFileSystemAPI();

    // Initialize default workspace
    const resolvedDefaultWorkspaceId = useMemo(() => {
        const defaultId = defaultWorkspaceId || "personal";
        const safeDefaultId =
            defaultId === QUICK_BOARDS_WORKSPACE_ID ? "personal" : defaultId;
        return (
            workstreamsList.find((ws) => ws.id === safeDefaultId)?.id ||
            workstreamsList[0]?.id ||
            "personal"
        );
    }, [defaultWorkspaceId, workstreamsList]);

    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
        resolvedDefaultWorkspaceId,
    );

    // Get the selected workspace's storage type for single file imports
    const selectedWorkspace = workstreams.get(selectedWorkspaceId);
    const workspaceStorageType = selectedWorkspace?.storageType || "browser";


    const handleSelectFile = useCallback(async () => {
        setState("selecting");

        if (canUseFSAPI) {
            const result = await requestImportFiles(true);
            if (result && result.files.length > 0) {
                setParsedFiles(result.files);
                setFolderStructure(null);
                setState("preview");
            } else {
                setState("idle");
            }
        } else {
            // Fallback: trigger file input
            fileInputRef.current?.click();
        }
    }, [canUseFSAPI]);

    const handleFileInputChange = useCallback(async () => {
        if (fileInputRef.current) {
            const files = await importFromFileInput(fileInputRef.current);
            if (files.length > 0) {
                setParsedFiles(files);
                setFolderStructure(null);
                setState("preview");
            } else {
                setState("idle");
            }
            // Reset input
            fileInputRef.current.value = "";
        }
    }, []);

    const handleSelectFolder = useCallback(async () => {
        if (!canUseFSAPI) {
            setError("Folder import requires Chrome or Edge browser");
            return;
        }

        setState("selecting");
        const structure = await requestImportFolder();

        if (structure) {
            const totalBoards =
                structure.rootBoards.length +
                structure.subfolders.reduce((acc, sf) => acc + sf.boards.length, 0);

            if (totalBoards === 0) {
                setError("No .kladde files found in the selected folder");
                setState("idle");
                return;
            }

            setFolderStructure(structure);
            setParsedFiles([]);
            setState("preview");
        } else {
            setState("idle");
        }
    }, [canUseFSAPI]);

    const handleCreateWorkspace = useCallback(() => {
        if (!newWorkspaceName.trim()) return;

        const colors = [
            "#6366f1",
            "#8b5cf6",
            "#a855f7",
            "#ec4899",
            "#f43f5e",
            "#f97316",
            "#22c55e",
            "#0ea5e9",
            "#3b82f6",
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const id = createWorkstream(newWorkspaceName.trim(), color);
        setSelectedWorkspaceId(id);
        setIsCreatingWorkspace(false);
        setNewWorkspaceName("");
    }, [newWorkspaceName, createWorkstream]);

    const handleImport = useCallback(async () => {
        setState("importing");
        setError("");

        const store = useBoardStore.getState();

        try {
            let result: ImportResult;

            if (folderStructure) {
                // Folder import
                if (storageOption === "disk") {
                    result = await importFolderToDisk(
                        folderStructure,
                        selectedWorkspaceId,
                        store,
                    );
                } else {
                    result = importFolderToBrowser(
                        folderStructure,
                        selectedWorkspaceId,
                        store,
                    );
                }
            } else {
                // Single/multiple file import
                result = {
                    success: true,
                    boardsImported: 0,
                    workspacesCreated: 0,
                    boardIds: [],
                    workspaceIds: [],
                    errors: [],
                };

                // For single file imports, use the workspace's existing storage type
                for (const parsed of parsedFiles) {
                    if (!parsed.isValid) {
                        result.errors.push(`${parsed.fileName}: ${parsed.error}`);
                        continue;
                    }

                    try {
                        let boardId: string;
                        if (workspaceStorageType === "disk") {
                            boardId = await importFileToDisk(
                                parsed,
                                selectedWorkspaceId,
                                store,
                            );
                        } else {
                            boardId = importFileToBrowser(
                                parsed,
                                selectedWorkspaceId,
                                store,
                            );
                        }
                        result.boardIds.push(boardId);
                        result.boardsImported++;
                    } catch (err) {
                        result.errors.push(
                            `${parsed.fileName}: ${(err as Error).message}`,
                        );
                    }
                }

                result.success = result.errors.length === 0;
            }

            setImportResult(result);
            setState(result.success ? "success" : "error");

            // Auto-close on success after delay
            if (result.success && result.boardsImported > 0) {
                setTimeout(() => {
                    onClose();
                }, 1500);
            }
        } catch (err) {
            setError((err as Error).message);
            setState("error");
        }
    }, [
        folderStructure,
        parsedFiles,
        storageOption,
        workspaceStorageType,
        selectedWorkspaceId,
        onClose,
    ]);

    const validFilesCount = parsedFiles.filter((f) => f.isValid).length;
    const totalElements = parsedFiles
        .filter((f) => f.isValid)
        .reduce((acc, f) => acc + f.elements.length, 0);

    const folderValidCount = folderStructure
        ? folderStructure.rootBoards.filter((f) => f.isValid).length +
          folderStructure.subfolders.reduce(
              (acc, sf) => acc + sf.boards.filter((f) => f.isValid).length,
              0,
          )
        : 0;

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget && state !== "importing") {
                    onClose();
                }
            }}
        >
            <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Import Boards</h2>
                    <button
                        onClick={onClose}
                        disabled={state === "importing"}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content based on state */}
                {state === "idle" && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Import .kladde board files or an entire folder of boards.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="h-24 flex-col gap-2"
                                onClick={handleSelectFile}
                            >
                                <FileIcon className="h-6 w-6" />
                                <span>Select File(s)</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-24 flex-col gap-2"
                                onClick={handleSelectFolder}
                                disabled={!canUseFSAPI}
                            >
                                <FolderIcon className="h-6 w-6" />
                                <span>Select Folder</span>
                                {!canUseFSAPI && (
                                    <span className="text-xs text-muted-foreground">
                                        Chrome/Edge only
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {state === "selecting" && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {state === "preview" && (
                    <div className="space-y-5">
                        {/* Files preview */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium">Files to import</h3>
                            <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
                                {parsedFiles.length > 0 && (
                                    <div className="space-y-1">
                                        {parsedFiles.map((file, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-2 text-sm"
                                            >
                                                {file.isValid ? (
                                                    <Check className="h-4 w-4 text-emerald-500" />
                                                ) : (
                                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                                )}
                                                <span
                                                    className={cn(
                                                        !file.isValid && "text-muted-foreground",
                                                    )}
                                                >
                                                    {file.boardName}
                                                </span>
                                                {file.isValid && (
                                                    <span className="text-muted-foreground">
                                                        ({file.elements.length} elements)
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {folderStructure && (
                                    <div className="space-y-3">
                                        {folderStructure.rootBoards.length > 0 && (
                                            <div>
                                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                                    Root boards (to selected workspace)
                                                </div>
                                                {folderStructure.rootBoards.map((file, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-center gap-2 text-sm"
                                                    >
                                                        {file.isValid ? (
                                                            <Check className="h-4 w-4 text-emerald-500" />
                                                        ) : (
                                                            <AlertCircle className="h-4 w-4 text-amber-500" />
                                                        )}
                                                        <span>{file.boardName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {folderStructure.subfolders.map((sf, i) => (
                                            <div key={i}>
                                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                                    <FolderIcon className="h-3 w-3 inline mr-1" />
                                                    {sf.folderName} (new workspace)
                                                </div>
                                                {sf.boards.map((file, j) => (
                                                    <div
                                                        key={j}
                                                        className="flex items-center gap-2 text-sm pl-4"
                                                    >
                                                        {file.isValid ? (
                                                            <Check className="h-4 w-4 text-emerald-500" />
                                                        ) : (
                                                            <AlertCircle className="h-4 w-4 text-amber-500" />
                                                        )}
                                                        <span>{file.boardName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {parsedFiles.length > 0
                                    ? `${validFilesCount} valid file(s), ${totalElements} total elements`
                                    : `${folderValidCount} valid board(s), ${folderStructure?.subfolders.length || 0} workspace(s) will be created`}
                            </p>
                        </div>

                        {/* Storage options - only for folder imports (new workspaces) */}
                        {folderStructure && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium">Storage type for new workspaces</h3>
                                <div className="grid gap-3">
                                    <StorageOptionCard
                                        icon={<Globe className="h-5 w-5" />}
                                        title="Import to Browser"
                                        description="Copy content to browser storage (IndexedDB)"
                                        selected={storageOption === "browser"}
                                        onClick={() => setStorageOption("browser")}
                                    />
                                    <StorageOptionCard
                                        icon={<HardDrive className="h-5 w-5" />}
                                        title="Import to Disk"
                                        description="Keep files on disk, workspaces reference source location"
                                        selected={storageOption === "disk"}
                                        disabled={!canUseFSAPI}
                                        badge={!canUseFSAPI ? "Chrome/Edge" : undefined}
                                        onClick={() => setStorageOption("disk")}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Info for single file imports - uses workspace storage type */}
                        {parsedFiles.length > 0 && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                                {workspaceStorageType === "disk" ? (
                                    <HardDrive className="h-4 w-4" />
                                ) : (
                                    <Globe className="h-4 w-4" />
                                )}
                                <span>
                                    Will be stored in{" "}
                                    <strong>{workspaceStorageType === "disk" ? "disk" : "browser"}</strong>{" "}
                                    storage (matching workspace setting)
                                </span>
                            </div>
                        )}

                        {/* Workspace selector */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium">Import to workspace</h3>
                            {isCreatingWorkspace ? (
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="New workspace name"
                                        value={newWorkspaceName}
                                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleCreateWorkspace();
                                            if (e.key === "Escape") setIsCreatingWorkspace(false);
                                        }}
                                        autoFocus
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleCreateWorkspace}
                                        disabled={!newWorkspaceName.trim()}
                                    >
                                        Create
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setIsCreatingWorkspace(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <Select
                                    value={selectedWorkspaceId}
                                    onValueChange={(value) => {
                                        if (value === "__create__") {
                                            setIsCreatingWorkspace(true);
                                        } else {
                                            setSelectedWorkspaceId(value);
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select workspace" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[200]">
                                        {workstreamsList.map((ws) => (
                                            <SelectItem key={ws.id} value={ws.id}>
                                                {ws.name}
                                            </SelectItem>
                                        ))}
                                        <SelectSeparator />
                                        <SelectItem value="__create__">
                                            <span className="flex items-center gap-2">
                                                <Plus className="h-4 w-4" />
                                                Create new workspace
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="ghost" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={
                                    (parsedFiles.length === 0 && !folderStructure) ||
                                    (parsedFiles.length > 0 && validFilesCount === 0) ||
                                    (folderStructure !== null && folderValidCount === 0)
                                }
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Import {parsedFiles.length > 0 ? validFilesCount : folderValidCount}{" "}
                                board(s)
                            </Button>
                        </div>
                    </div>
                )}

                {state === "importing" && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" />
                        <p className="text-sm text-muted-foreground">Importing boards...</p>
                    </div>
                )}

                {state === "success" && importResult && (
                    <div className="flex flex-col items-center justify-center py-8 gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                            <Check className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div className="text-center">
                            <p className="font-medium">Import successful!</p>
                            <p className="text-sm text-muted-foreground">
                                {importResult.boardsImported} board(s) imported
                                {importResult.workspacesCreated > 0 &&
                                    `, ${importResult.workspacesCreated} workspace(s) created`}
                            </p>
                        </div>
                    </div>
                )}

                {state === "error" && (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center justify-center py-6 gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
                                <AlertCircle className="h-6 w-6 text-amber-500" />
                            </div>
                            <div className="text-center">
                                <p className="font-medium">Import completed with errors</p>
                                {importResult && (
                                    <p className="text-sm text-muted-foreground">
                                        {importResult.boardsImported} board(s) imported,{" "}
                                        {importResult.errors.length} error(s)
                                    </p>
                                )}
                                {error && (
                                    <p className="text-sm text-destructive mt-2">{error}</p>
                                )}
                            </div>
                        </div>
                        {importResult && importResult.errors.length > 0 && (
                            <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-sm">
                                {importResult.errors.map((err, i) => (
                                    <div key={i} className="text-muted-foreground">
                                        {err}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end">
                            <Button onClick={onClose}>Close</Button>
                        </div>
                    </div>
                )}

                {/* Hidden file input for fallback */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".kladde,.shadeworks,.json"
                    multiple
                    className="hidden"
                    onChange={handleFileInputChange}
                />
            </div>
        </div>
    );
}
