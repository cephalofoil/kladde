"use client";

import { useEffect, useState, useCallback } from "react";
import { Database, HardDrive, Cloud, Check, FolderOpen } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useBoardStore } from "@/store/board-store";
import {
    getKladdeStorageSize,
    getBrowserStorageQuota,
    calculateStorageBreakdown,
    formatBytes,
    getStoragePercentage,
    type StorageBreakdown,
} from "@/lib/storage-utils";
import {
    isFileSystemAccessSupported,
    requestGlobalStorageDirectory,
    getGlobalStorageDirectoryName,
    clearGlobalStorageDirectory,
    hasGlobalStorageDirectory,
    saveBoardToGlobalStorage,
} from "@/lib/filesystem-storage";
import type { ShadeworksFile } from "@/lib/board-types";

const QUICK_BOARDS_WORKSPACE_ID = "quick-boards";
const QUICKBOARDS_FOLDER_NAME = "quickboards";

interface StorageOptionProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    active?: boolean;
    disabled?: boolean;
    badge?: string;
    onClick?: () => void;
    children?: React.ReactNode;
}

function StorageOption({
    icon,
    title,
    description,
    active,
    disabled,
    badge,
    onClick,
    children,
}: StorageOptionProps) {
    const isClickable = !!onClick && !disabled;

    return (
        <div
            onClick={isClickable ? onClick : undefined}
            className={`flex items-start gap-3 rounded-lg border p-4 ${
                active
                    ? "border-primary bg-primary/5"
                    : disabled
                      ? "border-muted bg-muted/30 opacity-60"
                      : isClickable
                        ? "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors"
                        : "border-border"
            }`}
        >
            <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                }`}
            >
                {icon}
            </div>
            <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                    <span
                        className={`font-medium ${disabled ? "text-muted-foreground" : ""}`}
                    >
                        {title}
                    </span>
                    {badge && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {badge}
                        </span>
                    )}
                    {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p
                    className={`text-sm ${disabled ? "text-muted-foreground/70" : "text-muted-foreground"}`}
                >
                    {description}
                </p>
                {children}
            </div>
        </div>
    );
}

export function StorageSection() {
    const [mounted, setMounted] = useState(false);
    const [actualStorageSize, setActualStorageSize] = useState(0);
    const [browserQuota, setBrowserQuota] = useState(0);
    const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
    const [isEnablingDiskStorage, setIsEnablingDiskStorage] = useState(false);
    const [syncProgress, setSyncProgress] = useState<{
        current: number;
        total: number;
    } | null>(null);
    const [fsApiSupported, setFsApiSupported] = useState(false);

    const boards = useBoardStore((s) => s.boards);
    const boardData = useBoardStore((s) => s.boardData);
    const workstreams = useBoardStore((s) => s.workstreams);
    const getStorageStats = useBoardStore((s) => s.getStorageStats);
    const settings = useBoardStore((s) => s.settings);
    const setDiskStorageEnabled = useBoardStore((s) => s.setDiskStorageEnabled);

    // Get board filename based on type
    const getBoardFileName = useCallback(
        (boardId: string): string => {
            const board = boards.get(boardId);
            if (!board) return boardId;

            if (board.workstreamId === QUICK_BOARDS_WORKSPACE_ID) {
                // Get quick board number by sorting all quick boards by creation date
                const quickBoards = Array.from(boards.values())
                    .filter((b) => b.workstreamId === QUICK_BOARDS_WORKSPACE_ID)
                    .sort(
                        (a, b) =>
                            new Date(a.createdAt).getTime() -
                            new Date(b.createdAt).getTime(),
                    );
                const index = quickBoards.findIndex((b) => b.id === board.id);
                return `${index + 1}`;
            }

            // Use board name if it looks like a custom name
            const name = board.name.trim();
            if (name && !name.startsWith("Quick Board")) {
                return name;
            }

            // Fall back to creation date
            const date = new Date(board.createdAt);
            return date.toISOString().split("T")[0]; // YYYY-MM-DD
        },
        [boards],
    );

    // Get workspace folder name
    const getWorkspaceFolderName = useCallback(
        (workstreamId: string): string => {
            if (workstreamId === QUICK_BOARDS_WORKSPACE_ID) {
                return QUICKBOARDS_FOLDER_NAME;
            }
            const workstream = workstreams.get(workstreamId);
            return workstream?.name || "Personal";
        },
        [workstreams],
    );

    // Sync all existing boards to disk
    const syncAllBoardsToDisk = useCallback(async () => {
        // Get fresh data directly from the store to avoid stale closures
        const storeState = useBoardStore.getState();
        const currentBoards = storeState.boards;
        const currentBoardData = storeState.boardData;
        const currentWorkstreams = storeState.workstreams;

        const allBoards = Array.from(currentBoards.values());
        const total = allBoards.length;

        if (total === 0) {
            console.log("No boards to sync");
            return;
        }

        console.log(`Syncing ${total} boards to disk...`);
        setSyncProgress({ current: 0, total });

        for (let i = 0; i < allBoards.length; i++) {
            const board = allBoards[i];
            const data = currentBoardData.get(board.id);

            // Get folder name
            let folderName: string;
            if (board.workstreamId === QUICK_BOARDS_WORKSPACE_ID) {
                folderName = QUICKBOARDS_FOLDER_NAME;
            } else {
                const workstream = currentWorkstreams.get(board.workstreamId);
                folderName = workstream?.name || "Personal";
            }

            // Get file name
            let fileName: string;
            if (board.workstreamId === QUICK_BOARDS_WORKSPACE_ID) {
                const quickBoards = allBoards
                    .filter((b) => b.workstreamId === QUICK_BOARDS_WORKSPACE_ID)
                    .sort(
                        (a, b) =>
                            new Date(a.createdAt).getTime() -
                            new Date(b.createdAt).getTime(),
                    );
                const index = quickBoards.findIndex((b) => b.id === board.id);
                fileName = `${index + 1}`;
            } else {
                const name = board.name.trim();
                if (name && !name.startsWith("Quick Board")) {
                    fileName = name;
                } else {
                    const date = new Date(board.createdAt);
                    fileName = date.toISOString().split("T")[0];
                }
            }

            const elements = data?.elements || [];
            const kladdeFile: ShadeworksFile = {
                type: "kladde",
                version: 1,
                elements,
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
            const result = await saveBoardToGlobalStorage(
                folderName,
                fileName,
                jsonString,
            );
            console.log(
                `Saved board "${board.name}" to ${folderName}/${fileName}.kladde:`,
                result ? "success" : "failed",
            );

            setSyncProgress({ current: i + 1, total });
        }

        console.log("Sync complete!");
        setSyncProgress(null);
    }, []);

    useEffect(() => {
        setMounted(true);
        setFsApiSupported(isFileSystemAccessSupported());

        const fetchStorageInfo = async () => {
            // Get actual Kladde storage size from IndexedDB
            const kladdeSize = await getKladdeStorageSize();
            setActualStorageSize(kladdeSize);

            // Get browser quota (for reference)
            const quota = await getBrowserStorageQuota();
            setBrowserQuota(quota);

            // Calculate breakdown from in-memory state (estimated)
            const storeBreakdown = calculateStorageBreakdown(
                boards,
                boardData,
                workstreams,
            );
            setBreakdown(storeBreakdown);

            // Check if disk storage is still accessible
            if (settings.diskStorageEnabled) {
                const hasAccess = await hasGlobalStorageDirectory();
                if (!hasAccess) {
                    // Lost access, try to get the name for display
                    const dirName = await getGlobalStorageDirectoryName();
                    if (!dirName) {
                        // Completely lost, disable
                        setDiskStorageEnabled(false);
                    }
                }
            }
        };

        fetchStorageInfo();
    }, [
        boards,
        boardData,
        workstreams,
        settings.diskStorageEnabled,
        setDiskStorageEnabled,
    ]);

    const handleEnableDiskStorage = useCallback(async () => {
        if (!fsApiSupported) return;

        setIsEnablingDiskStorage(true);
        try {
            const handle = await requestGlobalStorageDirectory();
            if (handle) {
                setDiskStorageEnabled(true, handle.name);
                // Sync all existing boards to disk
                await syncAllBoardsToDisk();
            }
        } catch (error) {
            console.error("Failed to enable disk storage:", error);
        } finally {
            setIsEnablingDiskStorage(false);
        }
    }, [fsApiSupported, setDiskStorageEnabled, syncAllBoardsToDisk]);

    const handleDisableDiskStorage = useCallback(async () => {
        await clearGlobalStorageDirectory();
        setDiskStorageEnabled(false);
    }, [setDiskStorageEnabled]);

    const handleChangeFolder = useCallback(async () => {
        if (!fsApiSupported) return;

        setIsEnablingDiskStorage(true);
        try {
            const handle = await requestGlobalStorageDirectory();
            if (handle) {
                setDiskStorageEnabled(true, handle.name);
            }
        } catch (error) {
            console.error("Failed to change disk storage folder:", error);
        } finally {
            setIsEnablingDiskStorage(false);
        }
    }, [fsApiSupported, setDiskStorageEnabled]);

    const stats = mounted
        ? getStorageStats()
        : { boardCount: 0, workspaceCount: 0 };
    const usagePercentage = getStoragePercentage(
        actualStorageSize,
        browserQuota,
    );

    if (!mounted) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Storage Location</CardTitle>
                        <CardDescription>
                            Where your data is stored
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-48" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    const diskStorageActive = settings.diskStorageEnabled;
    const diskStorageDescription = diskStorageActive
        ? `Boards are automatically saved to "${settings.diskStorageDirectoryName}"`
        : fsApiSupported
          ? "Save all boards automatically to a folder on your computer."
          : "Not supported in this browser. Use Chrome or Edge.";

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Storage Location</CardTitle>
                    <CardDescription>
                        Where your boards and workspaces are stored
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <StorageOption
                        icon={<Database className="h-5 w-5" />}
                        title="Browser Storage"
                        description="Your boards are stored locally in your browser using IndexedDB."
                        active={!diskStorageActive}
                    />
                    <StorageOption
                        icon={<HardDrive className="h-5 w-5" />}
                        title="Local Disk Storage"
                        description={diskStorageDescription}
                        active={diskStorageActive}
                        disabled={!fsApiSupported}
                        onClick={
                            !diskStorageActive && fsApiSupported
                                ? handleEnableDiskStorage
                                : undefined
                        }
                    >
                        {diskStorageActive && (
                            <div
                                className="flex items-center gap-2 mt-2"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleChangeFolder}
                                    disabled={isEnablingDiskStorage}
                                >
                                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                                    Change Folder
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDisableDiskStorage}
                                >
                                    Disable
                                </Button>
                            </div>
                        )}
                        {!diskStorageActive &&
                            fsApiSupported &&
                            isEnablingDiskStorage && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    {syncProgress
                                        ? `Syncing boards... ${syncProgress.current}/${syncProgress.total}`
                                        : "Selecting folder..."}
                                </p>
                            )}
                    </StorageOption>
                    <StorageOption
                        icon={<Cloud className="h-5 w-5" />}
                        title="Cloud Storage"
                        description="Sync your boards across devices with cloud backup."
                        disabled
                        badge="Coming Soon"
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Storage Usage</CardTitle>
                    <CardDescription>
                        Current storage consumption
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                Kladde Data
                            </span>
                            <span className="font-medium">
                                {formatBytes(actualStorageSize)}
                            </span>
                        </div>
                        <Progress
                            value={
                                usagePercentage ||
                                (actualStorageSize > 0 ? 1 : 0)
                            }
                            className="h-2"
                        />
                        {browserQuota > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {usagePercentage.toFixed(2)}% of{" "}
                                {formatBytes(browserQuota)} browser quota
                            </p>
                        )}
                    </div>

                    {breakdown && breakdown.total > 0 && (
                        <div className="space-y-2 border-t pt-4">
                            <p className="text-sm font-medium">
                                Breakdown (estimated)
                            </p>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Board metadata
                                    </span>
                                    <span>{formatBytes(breakdown.boards)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Board content (drawings, tiles)
                                    </span>
                                    <span>
                                        {formatBytes(breakdown.boardData)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Workspaces
                                    </span>
                                    <span>
                                        {formatBytes(breakdown.workstreams)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-1 border-t pt-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Total boards
                            </span>
                            <span className="font-medium">
                                {stats.boardCount}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Total workspaces
                            </span>
                            <span className="font-medium">
                                {stats.workspaceCount}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
