"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/board-store";
import { cn } from "@/lib/utils";

interface CanvasTitleBarProps {
    boardId: string;
    className?: string;
}

export function CanvasTitleBar({ boardId, className }: CanvasTitleBarProps) {
    const router = useRouter();
    const boards = useBoardStore((s) => s.boards);
    const workstreams = useBoardStore((s) => s.workstreams);
    const updateBoard = useBoardStore((s) => s.updateBoard);

    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { boardName, workstreamName, workstreamColor, workstreamId } =
        useMemo(() => {
            const board = boards.get(boardId);
            const ws = board ? workstreams.get(board.workstreamId) : null;
            return {
                boardName: board?.name ?? "Untitled Board",
                workstreamName: ws?.name ?? "Workspace",
                workstreamColor: ws?.color ?? "#6366f1",
                workstreamId: ws?.id ?? null,
            };
        }, [boards, workstreams, boardId]);

    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            // Place cursor at the end instead of selecting all
            const len = inputRef.current.value.length;
            inputRef.current.setSelectionRange(len, len);
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
        setNewName(boardName);
        setIsRenaming(true);
    };

    const handleRenameSubmit = () => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        if (newName.trim() && newName.trim() !== boardName) {
            updateBoard(boardId, { name: newName.trim() });
        }
        setIsRenaming(false);
    };

    const handleRenameBlur = () => {
        // Delay blur to allow for immediate actions like Enter key
        blurTimeoutRef.current = setTimeout(() => {
            handleRenameSubmit();
        }, 150);
    };

    return (
        <div
            className={cn(
                "inline-flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-md px-2 h-10 shadow-2xl min-w-[200px]",
                className,
            )}
        >
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
                <span className="text-sm font-medium text-foreground">
                    {workstreamName}
                </span>
            </button>

            {/* Slash separator */}
            <span className="text-muted-foreground/50 text-base select-none self-center">
                /
            </span>

            {/* Board name (clickable to rename) */}
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
                        e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: `${Math.max(newName.length * 8 + 20, 80)}px`,
                    }}
                    className="bg-transparent border-b border-ring outline-none text-sm font-semibold text-foreground px-2 py-1"
                />
            ) : (
                <button
                    onClick={handleBoardNameClick}
                    className="text-sm font-semibold text-foreground px-2 py-1 rounded-md hover:bg-muted/60 transition-colors cursor-text"
                    title="Click to rename"
                >
                    {boardName}
                </button>
            )}
        </div>
    );
}
