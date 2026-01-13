"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, Zap } from "lucide-react";
import type { Board } from "@/lib/store-types";
import { useBoardStore } from "@/store/board-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface QuickBoardsSidebarProps {
    quickBoards: Board[];
    onMoveBoard: (board: Board) => void;
}

export function QuickBoardsSidebar({ quickBoards, onMoveBoard }: QuickBoardsSidebarProps) {
    const router = useRouter();

    if (quickBoards.length === 0) {
        return null;
    }

    return (
        <aside className="shrink-0 w-56 pl-6 sticky top-0 h-[calc(100vh-140px)] flex items-center">
            <div className="bg-card/95 backdrop-blur-md border border-purple-500/30 rounded-xl shadow-sm overflow-hidden min-h-[300px]">
                {/* Sidebar Content */}
                <div className="p-3 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-purple-300 dark:scrollbar-thumb-purple-800 scrollbar-track-transparent">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span className="text-sm font-semibold text-foreground">
                                Quick Boards
                            </span>
                            <span className="text-xs text-muted-foreground">
                                ({quickBoards.length})
                            </span>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Delete all"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>
                                        Delete all Quick Boards?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete all {quickBoards.length} Quick Board
                                        {quickBoards.length === 1 ? "" : "s"}. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => {
                                            quickBoards.forEach((board) => {
                                                useBoardStore.getState().deleteBoard(board.id);
                                            });
                                        }}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        Delete All
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>

                    {/* Quick Board Items */}
                    <div className="space-y-1.5">
                        {quickBoards.map((board) => (
                            <div
                                key={board.id}
                                onClick={(e) => {
                                    if (e.ctrlKey || e.metaKey) {
                                        window.open(`/board/${board.id}`, "_blank");
                                        return;
                                    }
                                    router.push(`/board/${board.id}`);
                                }}
                                className="group relative flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-purple-200 dark:border-purple-800 bg-card/50 p-2.5 transition-all duration-200 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/20"
                            >
                                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-500 shrink-0">
                                    <Zap className="h-3.5 w-3.5 text-white" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xs font-medium leading-tight text-foreground truncate">
                                        {board.name}
                                    </h3>
                                    <div className="text-[10px] text-muted-foreground">
                                        {new Date(board.createdAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </div>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MoreHorizontal className="h-3 w-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" side="right" className="z-[150]">
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/board/${board.id}`);
                                            }}
                                        >
                                            Open
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onMoveBoard(board);
                                            }}
                                        >
                                            Move to Workspace...
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                useBoardStore.getState().deleteBoard(board.id);
                                            }}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
}
