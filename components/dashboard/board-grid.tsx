"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useBoardStore } from "@/stores/board-management-store";
import type { Board, Workstream } from "@/types/canvas";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/dates/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Clock,
  Plus,
  MoreVertical,
  Settings,
  Copy,
} from "lucide-react";

export function BoardGrid() {
  const router = useRouter();

  // Subscribe to specific store slices to reduce re-renders
  const getFilteredBoards = useBoardStore((state) => state.getFilteredBoards);
  const dashboardView = useBoardStore((state) => state.dashboardView);
  const searchQuery = useBoardStore((state) => state.searchQuery);
  const selectedTags = useBoardStore((state) => state.selectedTags);
  const workstreams = useBoardStore((state) => state.workstreams);
  const boards = useBoardStore((state) => state.boards);
  const updateLastAccessed = useBoardStore((state) => state.updateLastAccessed);
  const duplicateBoard = useBoardStore((state) => state.duplicateBoard);
  const deleteBoard = useBoardStore((state) => state.deleteBoard);
  const createBoard = useBoardStore((state) => state.createBoard);
  const setSearchQuery = useBoardStore((state) => state.setSearchQuery);
  const setSelectedTags = useBoardStore((state) => state.setSelectedTags);

  // Hydration state to prevent SSR mismatch
  const [isHydrated, setIsHydrated] = useState(false);

  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<
    (() => void) | null
  >(null);

  // Handle hydration - wait for client-side store to be ready
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const filteredBoards: Board[] = isHydrated ? getFilteredBoards() : [];

  const handleBoardClick = (boardId: string) => {
    updateLastAccessed(boardId);
    router.push(`/board/${boardId}`);
  };

  const handleDuplicateBoard = (boardId: string) => {
    duplicateBoard(boardId);
  };

  const confirmDelete = (deleteAction: () => void) => {
    setPendingDeleteAction(() => deleteAction);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteAction) {
      pendingDeleteAction();
    }
    setShowDeleteDialog(false);
    setPendingDeleteAction(null);
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setPendingDeleteAction(null);
  };

  const handleDeleteBoard = (boardId: string) => {
    confirmDelete(() => deleteBoard(boardId));
  };

  const BoardCard = ({ board }: { board: Board }) => {
    const workstream = workstreams.find(
      (w: Workstream) => w.id === board.workstreamId,
    );

    return (
      <Card className="group cursor-pointer hover:shadow-md transition-all duration-200">
        <CardContent className="p-0">
          {/* Board Thumbnail */}
          <div
            className="aspect-video bg-gray-100 rounded-t-lg relative overflow-hidden"
            onClick={() => handleBoardClick(board.id)}
          >
            {board.thumbnail ? (
              <Image
                src={board.thumbnail}
                alt={board.name}
                className="object-cover"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <FileText className="h-12 w-12" />
              </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-200" />
          </div>

          {/* Board Info */}
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate mb-1">
                  {board.name}
                </h3>
                {board.description && (
                  <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                    {board.description}
                  </p>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBoardClick(board.id)}>
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDuplicateBoard(board.id)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push(`/board/${board.id}/settings`)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteBoard(board.id)}
                    className="text-red-600"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Workstream */}
            {workstream && (
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: workstream.color }}
                />
                <span className="text-xs text-gray-500">{workstream.name}</span>
              </div>
            )}

            {/* Tags */}
            {board.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {board.tags.slice(0, 3).map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {board.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{board.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{board.metadata.tileCount} tiles</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(board.lastAccessed)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const BoardListItem = ({ board }: { board: Board }) => {
    const workstream = workstreams.find(
      (w: Workstream) => w.id === board.workstreamId,
    );

    return (
      <Card className="group cursor-pointer hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => handleBoardClick(board.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-gray-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {board.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {workstream && (
                      <>
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: workstream.color }}
                        />
                        <span className="text-xs text-gray-500">
                          {workstream.name}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                      </>
                    )}
                    <span className="text-xs text-gray-500">
                      {board.metadata.tileCount} tiles
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(board.lastAccessed)}
                    </span>
                  </div>

                  {board.description && (
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {board.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tags and Actions */}
            <div className="flex items-center gap-2">
              {board.tags.length > 0 && (
                <div className="flex gap-1">
                  {board.tags.slice(0, 2).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {board.tags.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{board.tags.length - 2}
                    </Badge>
                  )}
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBoardClick(board.id)}>
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDuplicateBoard(board.id)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push(`/board/${board.id}/settings`)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteBoard(board.id)}
                    className="text-red-600"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const CreateBoardCard = () => {
    const handleCreateBoard = () => {
      if (!workstreams || workstreams.length === 0) {
        // Show error message to user
        console.error("Cannot create board: No workstreams available");
        // Consider showing a toast notification or redirecting to workstream creation
        return;
      }

      const defaultWorkstream = workstreams[0];
      const newId = createBoard({
        workstreamId: defaultWorkstream.id,
        name: `New Board ${boards.length + 1}`,
        description: "",
        tags: [],
        metadata: {
          tileCount: 0,
          connectionCount: 0,
          canvasBounds: { width: 0, height: 0, minX: 0, minY: 0 },
        },
        settings: {
          isPublic: false,
          allowComments: true,
          backgroundColor: "#ffffff",
          gridVisible: true,
        },
      });
      if (newId) router.push(`/board/${newId}`);
    };

    return (
      <Card className="cursor-pointer hover:shadow-md transition-all duration-200 border-2 border-dashed border-gray-300 hover:border-blue-400">
        <CardContent className="p-0">
          <div
            className="aspect-video flex items-center justify-center"
            onClick={handleCreateBoard}
          >
            <div className="text-center text-gray-400 hover:text-blue-500 transition-colors">
              <Plus className="h-12 w-12 mx-auto mb-2" />
              <span className="text-sm font-medium">Create New Board</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Show loading state during hydration to prevent SSR mismatch
  if (!isHydrated) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-0">
                <div className="aspect-video bg-gray-200 rounded-t-lg" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (
    filteredBoards.length === 0 &&
    !searchQuery &&
    selectedTags.length === 0
  ) {
    // No boards at all
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-6" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No boards yet
        </h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Get started by creating your first board. Choose from templates or
          start with a blank canvas.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => router.push("/templates")} variant="outline">
            Browse Templates
          </Button>
          <Button
            onClick={() => {
              if (!workstreams || workstreams.length === 0) {
                console.error("Cannot create board: No workstreams available");
                return;
              }
              const defaultWorkstream = workstreams[0];
              const newId = createBoard({
                workstreamId: defaultWorkstream.id,
                name: `New Board ${boards.length + 1}`,
                description: "",
                tags: [],
                metadata: {
                  tileCount: 0,
                  connectionCount: 0,
                  canvasBounds: { width: 0, height: 0, minX: 0, minY: 0 },
                },
                settings: {
                  isPublic: false,
                  allowComments: true,
                  backgroundColor: "#ffffff",
                  gridVisible: true,
                },
              });
              if (newId) router.push(`/board/${newId}`);
            }}
          >
            Create New Board
          </Button>
        </div>
      </div>
    );
  }

  if (filteredBoards.length === 0) {
    // No boards match filters
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No boards found
        </h3>
        <p className="text-gray-600 mb-4">
          Try adjusting your search or filter criteria
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setSearchQuery("");
            setSelectedTags([]);
          }}
        >
          Clear Filters
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Board Grid/List */}
      {dashboardView === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <CreateBoardCard />
          {filteredBoards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      ) : dashboardView === "list" ? (
        <div className="space-y-3">
          {filteredBoards.map((board) => (
            <BoardListItem key={board.id} board={board} />
          ))}
        </div>
      ) : (
        // Timeline view - simplified for now
        <div className="space-y-4">
          {filteredBoards.map((board) => (
            <div key={board.id} className="border-l-4 border-blue-200 pl-4">
              <div className="text-sm text-gray-500">
                {formatDate(board.lastAccessed)}
              </div>
              <BoardListItem board={board} />
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelDelete();
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this board? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              onClick={handleCancelDelete}
              className="hover:bg-muted/50"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
