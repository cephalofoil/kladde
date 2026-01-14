"use client";

import { useEffect, useState } from "react";
import { Database, HardDrive, Cloud, Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useBoardStore } from "@/store/board-store";
import {
  getKladdeStorageSize,
  getBrowserStorageQuota,
  calculateStorageBreakdown,
  formatBytes,
  getStoragePercentage,
  type StorageBreakdown,
} from "@/lib/storage-utils";

interface StorageOptionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
}

function StorageOption({
  icon,
  title,
  description,
  active,
  disabled,
  badge,
}: StorageOptionProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        active
          ? "border-primary bg-primary/5"
          : disabled
            ? "border-muted bg-muted/30 opacity-60"
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
      </div>
    </div>
  );
}

export function StorageSection() {
  const [mounted, setMounted] = useState(false);
  const [actualStorageSize, setActualStorageSize] = useState(0);
  const [browserQuota, setBrowserQuota] = useState(0);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);

  const boards = useBoardStore((s) => s.boards);
  const boardData = useBoardStore((s) => s.boardData);
  const workstreams = useBoardStore((s) => s.workstreams);
  const getStorageStats = useBoardStore((s) => s.getStorageStats);

  useEffect(() => {
    setMounted(true);

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
            <CardTitle>Storage Location</CardTitle>
            <CardDescription>Where your data is stored</CardDescription>
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
            active
          />
          <StorageOption
            icon={<HardDrive className="h-5 w-5" />}
            title="Local Disk Storage"
            description="Use Menu > Save to... to save boards to your computer's file system."
            disabled
            badge="Via Save Menu"
          />
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
