"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/board-store";
import { cn } from "@/lib/utils";
import {
  renameBoardInGlobalStorage,
  saveBoardToGlobalStorage,
  sanitizeFileName,
} from "@/lib/filesystem-storage";
import type { ShadeworksFile } from "@/lib/board-types";

const QUICK_BOARDS_WORKSPACE_ID = "quick-boards";
const QUICKBOARDS_FOLDER_NAME = "quickboards";

interface CanvasTitleBarProps {
  boardId: string;
  className?: string;
  isGuest?: boolean;
  hasDiskFile?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
}

export function CanvasTitleBar({
  boardId,
  className,
  isGuest = false,
  hasDiskFile = false,
  isDirty = false,
  isSaving = false,
}: CanvasTitleBarProps) {
  const router = useRouter();
  const boards = useBoardStore((s) => s.boards);
  const workstreams = useBoardStore((s) => s.workstreams);
  const updateBoard = useBoardStore((s) => s.updateBoard);

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const spanRef = useRef<HTMLSpanElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    boardName,
    workstreamName,
    workstreamColor,
    workstreamId,
    workspaceStorageType,
  } = useMemo(() => {
    const board = boards.get(boardId);
    const ws = board ? workstreams.get(board.workstreamId) : null;
    return {
      boardName: board?.name ?? "Untitled Board",
      workstreamName: ws?.name ?? "Workspace",
      workstreamColor: ws?.color ?? "#6366f1",
      workstreamId: ws?.id ?? null,
      workspaceStorageType: ws?.storageType ?? "browser",
    };
  }, [boards, workstreams, boardId]);

  const isDiskStorageWorkspace = workspaceStorageType === "disk";
  const canRename = !isGuest;

  useEffect(() => {
    if (isRenaming && spanRef.current) {
      spanRef.current.focus();
      // Place cursor at the end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(spanRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isRenaming]);

  const handleWorkspaceClick = () => {
    if (workstreamId) {
      router.push(`/dashboard?workstream=${workstreamId}`);
    } else {
      router.push("/dashboard");
    }
  };

  const handleBoardNameClick = () => {
    if (!canRename) return;
    setNewName(boardName);
    setIsRenaming(true);
  };

  // Rename file on disk when board is renamed
  const renameBoardOnDisk = useCallback(
    async (oldName: string, newBoardName: string) => {
      if (!isDiskStorageWorkspace) return;

      const board = boards.get(boardId);
      if (!board) return;

      // Quick boards use numbers, not names
      if (board.workstreamId === QUICK_BOARDS_WORKSPACE_ID) return;

      const boardData = useBoardStore.getState().boardData.get(boardId);
      const elements = boardData?.elements || [];

      // Get folder name
      const workstream = workstreams.get(board.workstreamId);
      const folderName = workstream?.name || "Personal";

      // Create file content
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

      // Rename (save with new name, delete old)
      await renameBoardInGlobalStorage(
        folderName,
        oldName,
        newBoardName,
        jsonString,
      );
    },
    [boardId, boards, workstreams, isDiskStorageWorkspace],
  );

  const handleRenameSubmit = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (newName.trim() && newName.trim() !== boardName) {
      const oldName = boardName;
      updateBoard(boardId, { name: newName.trim() });
      // Also rename on disk if disk storage is enabled
      void renameBoardOnDisk(oldName, newName.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameBlur = () => {
    // Delay blur to allow for immediate actions like Enter key
    blurTimeoutRef.current = setTimeout(() => {
      handleRenameSubmit();
    }, 150);
  };

  // Determine save status indicator
  // Show indicator if either per-file disk save OR workspace has disk storage
  const showSaveIndicator = hasDiskFile || isDiskStorageWorkspace;
  const saveStatusIndicator = showSaveIndicator ? (
    <span
      className={cn(
        "text-xs px-1.5 py-0.5 rounded transition-colors select-none",
        isSaving
          ? "text-amber-600 dark:text-amber-400"
          : isDirty
            ? "text-amber-600 dark:text-amber-400"
            : "text-emerald-600 dark:text-emerald-400",
      )}
    >
      {isSaving ? "Saving..." : isDirty ? "Unsaved" : "Saved"}
    </span>
  ) : null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-md px-2 h-10 shadow-2xl",
        className,
      )}
    >
      {!isGuest && (
        <>
          {/* Workspace button with color dot */}
          <button
            onClick={handleWorkspaceClick}
            className="inline-flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/60 transition-colors"
            title="Go to Workspace"
          >
            <span
              className="inline-block h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: workstreamColor }}
            />
            <span className="text-sm font-medium text-foreground font-[var(--font-heading)]">
              {workstreamName}
            </span>
          </button>

          {/* Slash separator */}
          <span className="text-muted-foreground/50 text-base select-none self-center">
            /
          </span>
        </>
      )}

      {/* Board name (clickable to rename) */}
      <span
        ref={spanRef}
        role="textbox"
        contentEditable={canRename && isRenaming}
        suppressContentEditableWarning
        onBlur={(e) => {
          if (canRename && isRenaming) {
            setNewName(e.currentTarget.textContent || "");
            handleRenameBlur();
          }
        }}
        onKeyDown={(e) => {
          if (!canRename || !isRenaming) return;
          if (e.key === "Enter") {
            e.preventDefault();
            setNewName(e.currentTarget.textContent || "");
            handleRenameSubmit();
          } else if (e.key === "Escape") {
            e.currentTarget.textContent = boardName;
            setIsRenaming(false);
          }
          e.stopPropagation();
        }}
        onInput={(e) => {
          if (canRename) {
            setNewName(e.currentTarget.textContent || "");
          }
        }}
        onClick={(e) => {
          if (!isRenaming && canRename) {
            handleBoardNameClick();
          }
          e.stopPropagation();
        }}
        className={cn(
          "text-sm font-semibold text-foreground px-2 py-1 font-[var(--font-heading)] outline-none",
          canRename
            ? isRenaming
              ? "border-b border-ring"
              : "rounded-md hover:bg-muted/60 transition-colors cursor-text"
            : "rounded-md",
        )}
        title={canRename && !isRenaming ? "Click to rename" : undefined}
      >
        {boardName}
      </span>

      {/* Save status indicator */}
      {saveStatusIndicator}
    </div>
  );
}
