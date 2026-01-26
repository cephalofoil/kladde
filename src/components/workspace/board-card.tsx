"use client";

import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/board-store";
import type { Board } from "@/lib/store-types";
import type { WorkspaceStorageType } from "@/lib/store-types";
import {
  MoreHorizontal,
  Pin,
  Pencil,
  Database,
  HardDrive,
  Cloud,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BoardCardProps {
  board: Board;
  isPinned?: boolean;
  onTogglePin?: (boardId: string) => void;
  workstreamColor?: string;
  storageType?: WorkspaceStorageType;
}

/**
 * Get the icon component for a storage type
 */
function StorageIcon({
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

export function BoardCard({
  board,
  isPinned = false,
  onTogglePin,
  workstreamColor,
  storageType = "browser",
}: BoardCardProps) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(board.name);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateBoard = useBoardStore((s) => s.updateBoard);
  const deleteBoard = useBoardStore((s) => s.deleteBoard);

  const handleClick = (e: React.MouseEvent) => {
    // Ctrl/Cmd + Click opens in new tab
    if (e.ctrlKey || e.metaKey) {
      window.open(`/board/${board.id}`, "_blank");
      return;
    }
    router.push(`/board/${board.id}`);
  };

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isRenaming]);

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDropdownOpen(false);
    setNewName(board.name);
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (newName.trim() && newName.trim() !== board.name) {
      updateBoard(board.id, { name: newName.trim() });
    }
    setIsRenaming(false);
  };

  const handleRenameBlur = () => {
    // Delay blur to allow for immediate actions like Enter key
    blurTimeoutRef.current = setTimeout(() => {
      handleRenameSubmit();
    }, 150);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteBoard(board.id);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicateBoard = useBoardStore.getState().duplicateBoard;
    const newId = duplicateBoard(board.id);
    if (newId) {
      router.push(`/board/${newId}`);
    }
  };

  return (
    <div
      onClick={isRenaming ? undefined : (e) => handleClick(e)}
      className="group relative flex cursor-pointer flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-accent-foreground/30 hover:shadow-lg"
    >
      <div className="absolute right-4 top-[18px]">
        <div className="rounded-full bg-card/80 px-2 py-0.5 text-xs font-normal text-muted-foreground transition-opacity group-hover:opacity-0">
          {new Date(board.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </div>
      </div>
      <div className="mb-4 flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg"
          style={{
            backgroundColor: workstreamColor,
          }}
        >
          <div className="h-6 w-6 rounded bg-card/20" />
        </div>
        <div className="relative flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRename}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          {onTogglePin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin(board.id);
              }}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Pin className="h-4 w-4" />
            </Button>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation();
                    router.push(`/board/${board.id}`);
                  }}
                >
                  Open
                </DropdownMenuItem>
                {onTogglePin && (
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      onTogglePin(board.id);
                    }}
                  >
                    {isPinned ? "Unpin Board" : "Pin Board"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleDuplicate}>
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div
        className="flex-1"
        onClick={(e) => isRenaming && e.stopPropagation()}
      >
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRenameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRenameSubmit();
              } else if (e.key === "Escape") {
                setIsRenaming(false);
              }
            }}
            className="mb-2 w-full bg-transparent border-b-2 border-ring outline-none text-base font-semibold leading-snug text-foreground px-1 -ml-1"
          />
        ) : (
          <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug text-foreground cursor-text hover:text-foreground/80 transition-colors">
            {board.name}
          </h3>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {/* Storage type indicator */}
          <span className="flex items-center gap-1 rounded bg-muted px-2 py-0.5">
            <StorageIcon type={storageType} className="h-3 w-3" />
            <span>{getStorageLabel(storageType)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
