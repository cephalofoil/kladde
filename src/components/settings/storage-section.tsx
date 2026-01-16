"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Database,
  HardDrive,
  Cloud,
  Check,
  FolderOpen,
  ChevronDown,
  Save,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useBoardStore, QUICK_BOARDS_WORKSPACE_ID } from "@/store/board-store";
import type { WorkspaceStorageType, Workstream } from "@/lib/store-types";
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
  hasGlobalStorageDirectory,
  saveBoardToGlobalStorage,
} from "@/lib/filesystem-storage";
import type { ShadeworksFile } from "@/lib/board-types";

const QUICKBOARDS_FOLDER_NAME = "quickboards";

/**
 * Get the icon component for a storage type
 */
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

/**
 * Get the label for a storage type
 */
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

interface WorkspaceStorageRowProps {
  workspace: Workstream;
  fsApiSupported: boolean;
  onChangeStorageType: (
    workspaceId: string,
    type: WorkspaceStorageType,
    directoryName?: string,
  ) => void;
  isSyncing: boolean;
}

function WorkspaceStorageRow({
  workspace,
  fsApiSupported,
  onChangeStorageType,
  isSyncing,
}: WorkspaceStorageRowProps) {
  const storageType = workspace.storageType || "browser";
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);

  const handleSelectDisk = async () => {
    if (!fsApiSupported) return;

    setIsSelectingFolder(true);
    try {
      const handle = await requestGlobalStorageDirectory();
      if (handle) {
        onChangeStorageType(workspace.id, "disk", handle.name);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const handleSelectBrowser = () => {
    onChangeStorageType(workspace.id, "browser");
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3">
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: workspace.color }}
        />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{workspace.name}</p>
          {storageType === "disk" && workspace.storageConfig?.directoryName && (
            <p className="text-xs text-muted-foreground truncate">
              {workspace.storageConfig.directoryName}
            </p>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={isSyncing || isSelectingFolder}
          >
            <StorageTypeIcon type={storageType} className="h-3.5 w-3.5" />
            <span>{getStorageLabel(storageType)}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleSelectBrowser} className="gap-2">
            <Database className="h-4 w-4" />
            <span>Browser</span>
            {storageType === "browser" && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleSelectDisk}
            disabled={!fsApiSupported}
            className="gap-2"
          >
            <HardDrive className="h-4 w-4" />
            <span>Disk</span>
            {!fsApiSupported && (
              <span className="text-xs text-muted-foreground ml-auto">
                Chrome/Edge only
              </span>
            )}
            {storageType === "disk" && fsApiSupported && (
              <Check className="h-4 w-4 ml-auto" />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="gap-2">
            <Cloud className="h-4 w-4" />
            <span>Cloud</span>
            <span className="text-xs text-muted-foreground ml-auto">
              Coming Soon
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function StorageSection() {
  const [mounted, setMounted] = useState(false);
  const [actualStorageSize, setActualStorageSize] = useState(0);
  const [browserQuota, setBrowserQuota] = useState(0);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [fsApiSupported, setFsApiSupported] = useState(false);
  const [syncingWorkspaceId, setSyncingWorkspaceId] = useState<string | null>(
    null,
  );

  const boards = useBoardStore((s) => s.boards);
  const boardData = useBoardStore((s) => s.boardData);
  const workstreams = useBoardStore((s) => s.workstreams);
  const getStorageStats = useBoardStore((s) => s.getStorageStats);
  const setWorkspaceStorageType = useBoardStore(
    (s) => s.setWorkspaceStorageType,
  );
  const autoSaveEnabled = useBoardStore((s) => s.settings.autoSaveEnabled);
  const setAutoSaveEnabled = useBoardStore((s) => s.setAutoSaveEnabled);

  // Get workspaces as array, excluding Quick Boards for now (we can add it back if needed)
  const workspacesList = Array.from(workstreams.values()).filter(
    (ws) => ws.id !== QUICK_BOARDS_WORKSPACE_ID,
  );

  // Sync all boards in a workspace to disk
  const syncWorkspaceBoardsToDisk = useCallback(async (workspaceId: string) => {
    const storeState = useBoardStore.getState();
    const currentBoards = storeState.boards;
    const currentBoardData = storeState.boardData;
    const currentWorkstreams = storeState.workstreams;
    const workspace = currentWorkstreams.get(workspaceId);

    if (!workspace) return;

    const workspaceBoards = Array.from(currentBoards.values()).filter(
      (b) => b.workstreamId === workspaceId,
    );

    if (workspaceBoards.length === 0) return;

    const folderName =
      workspaceId === QUICK_BOARDS_WORKSPACE_ID
        ? QUICKBOARDS_FOLDER_NAME
        : workspace.name;

    for (let i = 0; i < workspaceBoards.length; i++) {
      const board = workspaceBoards[i];
      const data = currentBoardData.get(board.id);

      // Get file name
      let fileName: string;
      if (workspaceId === QUICK_BOARDS_WORKSPACE_ID) {
        const quickBoards = workspaceBoards.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
      await saveBoardToGlobalStorage(folderName, fileName, jsonString);
    }
  }, []);

  const handleChangeStorageType = useCallback(
    async (
      workspaceId: string,
      type: WorkspaceStorageType,
      directoryName?: string,
    ) => {
      // Update the store
      setWorkspaceStorageType(workspaceId, type, directoryName);

      // If switching to disk, sync all boards in this workspace
      if (type === "disk") {
        setSyncingWorkspaceId(workspaceId);
        try {
          // Check if we have directory access
          const hasAccess = await hasGlobalStorageDirectory();
          if (hasAccess) {
            await syncWorkspaceBoardsToDisk(workspaceId);
          }
        } catch (error) {
          console.error("Failed to sync workspace to disk:", error);
        } finally {
          setSyncingWorkspaceId(null);
        }
      }
    },
    [setWorkspaceStorageType, syncWorkspaceBoardsToDisk],
  );

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
    };

    fetchStorageInfo();
  }, [boards, boardData, workstreams]);

  const stats = mounted
    ? getStorageStats()
    : { boardCount: 0, workspaceCount: 0 };
  const usagePercentage = getStoragePercentage(actualStorageSize, browserQuota);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Workspace Storage</CardTitle>
            <CardDescription>
              Configure storage for each workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Storage</CardTitle>
          <CardDescription>
            Configure where each workspace stores its boards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {workspacesList.map((workspace) => (
              <WorkspaceStorageRow
                key={workspace.id}
                workspace={workspace}
                fsApiSupported={fsApiSupported}
                onChangeStorageType={handleChangeStorageType}
                isSyncing={syncingWorkspaceId === workspace.id}
              />
            ))}
          </div>

          {workspacesList.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No workspaces found
            </p>
          )}

          {!fsApiSupported && (
            <p className="text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
              Disk storage requires Chrome or Edge browser with File System
              Access API support.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Save</CardTitle>
          <CardDescription>
            Automatically save changes to disk storage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-save-toggle" className="text-sm font-medium">
                Enable auto-save
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically save boards to disk when changes are made.
                <br />
                Use{" "}
                <kbd className="px-1 py-0.5 text-xs bg-muted rounded">
                  Ctrl+S
                </kbd>{" "}
                to save manually.
              </p>
            </div>
            <Switch
              id="auto-save-toggle"
              checked={autoSaveEnabled}
              onCheckedChange={setAutoSaveEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
          <CardDescription>Current storage consumption</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Kladde Data</span>
              <span className="font-medium">
                {formatBytes(actualStorageSize)}
              </span>
            </div>
            <Progress
              value={usagePercentage || (actualStorageSize > 0 ? 1 : 0)}
              className="h-2"
            />
            {browserQuota > 0 && (
              <p className="text-xs text-muted-foreground">
                {usagePercentage.toFixed(2)}% of {formatBytes(browserQuota)}{" "}
                browser quota
              </p>
            )}
          </div>

          {breakdown && breakdown.total > 0 && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Breakdown (estimated)</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Board metadata</span>
                  <span>{formatBytes(breakdown.boards)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Board content (drawings, tiles)
                  </span>
                  <span>{formatBytes(breakdown.boardData)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Workspaces</span>
                  <span>{formatBytes(breakdown.workstreams)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total boards</span>
              <span className="font-medium">{stats.boardCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total workspaces</span>
              <span className="font-medium">{stats.workspaceCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
