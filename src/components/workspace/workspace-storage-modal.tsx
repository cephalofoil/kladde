"use client";

import { useState, useCallback } from "react";
import { Database, HardDrive, Cloud, Check, Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBoardStore } from "@/store/board-store";
import type { WorkspaceStorageType, Workstream } from "@/lib/store-types";
import type { ShadeworksFile } from "@/lib/board-types";
import {
    isFileSystemAccessSupported,
    requestWorkspaceStorageDirectory,
    getWorkspaceStorageDirectoryName,
    hasWorkspaceStorageDirectory,
    saveBoardToWorkspaceStorage,
} from "@/lib/filesystem-storage";

interface WorkspaceStorageModalProps {
    workspace: Workstream;
    isOpen: boolean;
    onClose: () => void;
}

function getBoardBaseFileName(board: {
    name: string;
    createdAt: Date;
}): string {
    const name = board.name.trim();
    if (name && !name.startsWith("Quick Board")) {
        return name;
    }
    const date = new Date(board.createdAt);
    return date.toISOString().split("T")[0];
}

function StorageTypeIcon({
    type,
    className,
}: {
    type: WorkspaceStorageType;
    className?: string;
}) {
    switch (type) {
        case "disk":
            return <HardDrive className={className} />;
        case "cloud":
            return <Cloud className={className} />;
        case "browser":
        default:
            return <Database className={className} />;
    }
}

function getStorageLabel(type: WorkspaceStorageType): string {
    switch (type) {
        case "disk":
            return "Disk";
        case "cloud":
            return "Cloud";
        case "browser":
        default:
            return "Browser";
    }
}

function getStorageDescription(type: WorkspaceStorageType): string {
    switch (type) {
        case "disk":
            return "Save boards as .kladde files in a folder on your computer";
        case "cloud":
            return "Sync boards to the cloud (coming soon)";
        case "browser":
        default:
            return "Store boards in your browser's IndexedDB";
    }
}

export function WorkspaceStorageModal({
    workspace,
    isOpen,
    onClose,
}: WorkspaceStorageModalProps) {
    const currentType = workspace.storageType || "browser";
    const [selectedType, setSelectedType] =
        useState<WorkspaceStorageType>(currentType);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fsApiSupported = isFileSystemAccessSupported();
    const setWorkspaceStorageType = useBoardStore(
        (s) => s.setWorkspaceStorageType,
    );

    const syncWorkspaceBoardsToDisk = useCallback(
        async (workspaceId: string) => {
            const storeState = useBoardStore.getState();
            const currentBoards = storeState.boards;
            const currentBoardData = storeState.boardData;

            const workspaceBoards = Array.from(currentBoards.values()).filter(
                (b) => b.workstreamId === workspaceId,
            );

            if (workspaceBoards.length === 0) return;

            const baseNameCounts = new Map<string, number>();
            workspaceBoards.forEach((board) => {
                const baseName = getBoardBaseFileName(board);
                baseNameCounts.set(
                    baseName,
                    (baseNameCounts.get(baseName) ?? 0) + 1,
                );
            });

            for (let i = 0; i < workspaceBoards.length; i++) {
                const board = workspaceBoards[i];
                const data = currentBoardData.get(board.id);

                const baseName = getBoardBaseFileName(board);
                const hasCollision = (baseNameCounts.get(baseName) ?? 0) > 1;
                const fileName = hasCollision
                    ? `${baseName}-${board.id.slice(0, 8)}`
                    : baseName;

                const elements = data?.elements || [];
                const comments = data?.comments || [];
                const kladdeFile: ShadeworksFile = {
                    type: "kladde",
                    version: 1,
                    elements,
                    comments,
                    appState: {
                        canvasBackground:
                            (board.settings.backgroundColor as
                                | "none"
                                | "dots"
                                | "lines"
                                | "grid") || "none",
                    },
                };

                const jsonString = JSON.stringify(kladdeFile, null, 2);
                await saveBoardToWorkspaceStorage(
                    workspaceId,
                    fileName,
                    jsonString,
                );
            }
        },
        [],
    );

    const handleConfirm = async () => {
        if (selectedType === currentType) {
            onClose();
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            if (selectedType === "disk") {
                // Check if we already have a directory configured
                const existingName = await getWorkspaceStorageDirectoryName(
                    workspace.id,
                );

                if (existingName) {
                    // Use existing directory
                    setWorkspaceStorageType(
                        workspace.id,
                        "disk",
                        existingName,
                    );
                } else {
                    // Request new directory
                    const handle = await requestWorkspaceStorageDirectory(
                        workspace.id,
                    );
                    if (!handle) {
                        setIsSaving(false);
                        return; // User cancelled
                    }
                    setWorkspaceStorageType(
                        workspace.id,
                        "disk",
                        handle.name,
                    );
                }

                // Sync existing boards to disk
                const hasAccess = await hasWorkspaceStorageDirectory(
                    workspace.id,
                );
                if (hasAccess) {
                    await syncWorkspaceBoardsToDisk(workspace.id);
                }
            } else {
                // Switching to browser or cloud
                setWorkspaceStorageType(workspace.id, selectedType);
            }

            onClose();
        } catch (err) {
            console.error("Failed to change storage type:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to change storage type",
            );
        } finally {
            setIsSaving(false);
        }
    };

    const storageOptions: {
        type: WorkspaceStorageType;
        disabled: boolean;
        disabledReason?: string;
    }[] = [
        { type: "browser", disabled: false },
        {
            type: "disk",
            disabled: !fsApiSupported,
            disabledReason: "Chrome/Edge only",
        },
        { type: "cloud", disabled: true, disabledReason: "Coming Soon" },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Change Storage Location</DialogTitle>
                    <DialogDescription>
                        Choose where to store boards in{" "}
                        <strong>{workspace.name}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 py-4">
                    {storageOptions.map(({ type, disabled, disabledReason }) => (
                        <button
                            key={type}
                            onClick={() => !disabled && setSelectedType(type)}
                            disabled={disabled}
                            className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                                selectedType === type && !disabled
                                    ? "border-primary bg-primary/5"
                                    : disabled
                                      ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                        >
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                                    selectedType === type && !disabled
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                }`}
                            >
                                <StorageTypeIcon
                                    type={type}
                                    className="h-5 w-5"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                        {getStorageLabel(type)}
                                    </span>
                                    {type === currentType && (
                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                            Current
                                        </span>
                                    )}
                                    {disabledReason && (
                                        <span className="text-xs text-muted-foreground">
                                            {disabledReason}
                                        </span>
                                    )}
                                    {selectedType === type && !disabled && (
                                        <Check className="h-4 w-4 text-primary ml-auto" />
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {getStorageDescription(type)}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>

                {selectedType === "disk" &&
                    selectedType !== currentType &&
                    workspace.metadata.boardCount > 0 && (
                        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                            {workspace.metadata.boardCount} board
                            {workspace.metadata.boardCount === 1 ? "" : "s"} will
                            be synced to your selected folder.
                        </p>
                    )}

                {error && (
                    <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                        {error}
                    </p>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isSaving || selectedType === currentType}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Change Storage"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
