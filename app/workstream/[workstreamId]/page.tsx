"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useBoardStore } from "@/stores/board-management-store";
import type { Board } from "@/types/canvas";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates/format";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  Plus,
  Search,
  Grid3X3,
  List,
  Clock,
  FileText,
  Settings,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function WorkstreamPage() {
  const router = useRouter();
  const boardManagement = useBoardStore();
  const { workstreamId } = useParams<{ workstreamId: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<
    (() => void) | null
  >(null);

  const currentWorkstream = boardManagement.workstreams.find(
    (w) => w.id === workstreamId,
  );
  const workstreamBoards = boardManagement.getWorkstreamBoards(workstreamId);

  // Filter boards based on search query
  const filteredBoards = workstreamBoards.filter(
    (board) =>
      board.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      board.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      board.tags.some((tag: string) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  );

  const handleCreateBoard = () => {
    const boardName = `New Board ${workstreamBoards.length + 1}`;
    const newBoardId = boardManagement.createBoard({
      workstreamId,
      name: boardName,
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

    // Navigate to the new board
    if (newBoardId) {
      router.push(`/board/${newBoardId}`);
    }
  };

  const handleBoardClick = (boardId: string) => {
    boardManagement.updateLastAccessed(boardId);
    router.push(`/board/${boardId}`);
  };

  const handleDuplicateBoard = (boardId: string) => {
    boardManagement.duplicateBoard(boardId);
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
    confirmDelete(() => boardManagement.deleteBoard(boardId));
  };

  if (!currentWorkstream) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Workstream not found</p>
          <Button onClick={() => router.push("/")} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const BoardCard = ({ board }: { board: Board }) => (
    <Card
      key={board.id}
      className="group cursor-pointer hover:shadow-md transition-all duration-200"
      onClick={() => handleBoardClick(board.id)}
    >
      <CardContent className="p-4">
        {/* Board Thumbnail */}
        <div className="aspect-video bg-gray-100 rounded-lg mb-3 relative overflow-hidden">
          {board.thumbnail ? (
            <Image
              src={board.thumbnail}
              alt={board.name}
              className="w-full h-full object-cover"
              width={400}
              height={300}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <FileText className="h-8 w-8" />
            </div>
          )}

          {/* Hover Actions */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateBoard(board.id);
                }}
              >
                Duplicate
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
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
        </div>

        {/* Board Info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm truncate">{board.name}</h3>
          {board.description && (
            <p className="text-xs text-gray-600 line-clamp-2">
              {board.description}
            </p>
          )}

          {/* Tags */}
          {board.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
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

  const BoardListItem = ({ board }: { board: Board }) => (
    <Card
      key={board.id}
      className="group cursor-pointer hover:shadow-sm transition-shadow"
      onClick={() => handleBoardClick(board.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{board.name}</h3>
            {board.description && (
              <p className="text-xs text-gray-600 mt-1 truncate">
                {board.description}
              </p>
            )}

            {/* Tags */}
            {board.tags.length > 0 && (
              <div className="flex gap-1 mt-2">
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
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{board.metadata.tileCount} tiles</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(board.lastAccessed)}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => handleDuplicateBoard(board.id)}
                >
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentWorkstream.color }}
              />
              <h1 className="font-semibold text-xl">
                {currentWorkstream.name}
              </h1>
            </div>
          </div>

          <Button
            onClick={handleCreateBoard}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Board
          </Button>
        </div>


      </header>

      {/* Content */}
      <div className="p-6">
        {/* Search and Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-96">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search boards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Boards */}
        {filteredBoards.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            {searchQuery ? (
              <>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No boards found
                </h3>
                <p className="text-gray-600">
                  Try adjusting your search criteria
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No boards yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Create your first board to get started
                </p>
                <Button onClick={handleCreateBoard}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Board
                </Button>
              </>
            )}
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                : "space-y-3"
            }
          >
            {filteredBoards.map((board) =>
              viewMode === "grid" ? (
                <BoardCard key={board.id} board={board} />
              ) : (
                <BoardListItem key={board.id} board={board} />
              ),
            )}
          </div>
        )}
      </div>

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
