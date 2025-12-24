"use client";

import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/board-store";
import type { Board } from "@/lib/store-types";
import { MoreHorizontal, Pin } from "lucide-react";
import { useState } from "react";
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
}

export function BoardCard({
  board,
  isPinned = false,
  onTogglePin,
  workstreamColor
}: BoardCardProps) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(board.name);

  const updateBoard = useBoardStore((s) => s.updateBoard);
  const deleteBoard = useBoardStore((s) => s.deleteBoard);

  const handleClick = () => {
    router.push(`/board/${board.id}`);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newName.trim() && newName.trim() !== board.name) {
      updateBoard(board.id, { name: newName.trim() });
    }
    setIsRenaming(false);
  };

  const handleRenameBlur = () => {
    setNewName(board.name); // Reset to original name
    setIsRenaming(false);
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
      onClick={isRenaming ? undefined : handleClick}
      className="group relative flex cursor-pointer flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-accent-foreground/30 hover:shadow-lg"
    >
      <div className="mb-4 flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg"
          style={{
            backgroundColor: workstreamColor,
          }}
        >
          <div className="h-6 w-6 rounded bg-card/20" />
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
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
              <DropdownMenuItem onClick={handleRename}>
                Rename
              </DropdownMenuItem>
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

      <div className="flex-1">
        {isRenaming ? (
          <form onSubmit={handleRenameSubmit} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRenameBlur}
              autoFocus
              className="w-full rounded border border-primary bg-background px-2 py-1 mb-2 text-base font-semibold leading-snug text-foreground outline-none"
            />
          </form>
        ) : (
          <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug text-foreground">
            {board.name}
          </h3>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {new Date(board.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span>-</span>
          <span className="rounded bg-muted px-2 py-0.5 capitalize text-muted-foreground">
            temporary
          </span>
        </div>
      </div>
    </div>
  );
}
