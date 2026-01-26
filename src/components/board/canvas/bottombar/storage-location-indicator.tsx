"use client";

import { useBoardStore } from "@/store/board-store";
import { Globe, HardDrive, Cloud } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface StorageLocationIndicatorProps {
    boardId: string;
}

const storageConfig = {
    browser: {
        icon: Globe,
        label: "Browser",
        tooltip: "Stored in your browser's local storage",
    },
    disk: {
        icon: HardDrive,
        label: "Disk",
        tooltip: "Saved to your local filesystem",
    },
    cloud: {
        icon: Cloud,
        label: "Cloud",
        tooltip: "Synced to cloud storage",
    },
} as const;

export function StorageLocationIndicator({
    boardId,
}: StorageLocationIndicatorProps) {
    const board = useBoardStore((s) => s.boards.get(boardId));
    const workstreams = useBoardStore((s) => s.workstreams);

    if (!board) return null;

    const workstream = workstreams.get(board.workstreamId);
    const storageType = workstream?.storageType || "browser";
    const config = storageConfig[storageType];
    const Icon = config.icon;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="text-xs font-medium">{config.label}</span>
                </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
                {config.tooltip}
            </TooltipContent>
        </Tooltip>
    );
}
