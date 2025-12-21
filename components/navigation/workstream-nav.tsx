"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useBoardStore } from "@/stores/board-management-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Folder,
  FolderOpen,
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  Home,
  Layout,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WorkstreamNavProps {
  className?: string;
  collapsed?: boolean;
}

export function WorkstreamNav({
  className,
  collapsed = false,
}: WorkstreamNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const boardManagement = useBoardStore();
  const [expandedWorkstreams, setExpandedWorkstreams] = useState<Set<string>>(
    new Set(),
  );

  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<
    (() => void) | null
  >(null);

  // Create workstream dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkstream, setNewWorkstream] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
  });
  const [isCreating, setIsCreating] = useState(false);

  const toggleWorkstream = (workstreamId: string) => {
    const newExpanded = new Set(expandedWorkstreams);
    if (newExpanded.has(workstreamId)) {
      newExpanded.delete(workstreamId);
    } else {
      newExpanded.add(workstreamId);
    }
    setExpandedWorkstreams(newExpanded);
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

  const isCurrentPath = (path: string) => pathname === path;
  const isWorkstreamActive = (workstreamId: string) => {
    if (pathname.startsWith(`/workstream/${workstreamId}`)) return true;
    const match = pathname.match(/^\/board\/([^/]+)/);
    const boardIdInPath = match?.[1];
    if (!boardIdInPath) return false;
    const board = boardManagement.boards.find((b) => b.id === boardIdInPath);
    return !!board && board.workstreamId === workstreamId;
  };

  const handleCreateBoard = (workstreamId: string) => {
    const newBoardId = boardManagement.createBoard({
      workstreamId,
      name: `New Board ${boardManagement.getWorkstreamBoards(workstreamId).length + 1}`,
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

    if (newBoardId) {
      router.push(`/board/${newBoardId}`);
    }
  };

  if (collapsed) {
    return (
      <div className={`w-16 bg-white border-r flex flex-col ${className}`}>
        {/* Collapsed Icons */}
        <div className="p-3 space-y-2">
          <Button
            variant={isCurrentPath("/") ? "default" : "ghost"}
            size="sm"
            onClick={() => router.push("/")}
            className="w-10 h-10 p-0"
            title="Dashboard"
          >
            <Home className="h-4 w-4" />
          </Button>

          <Button
            variant={isCurrentPath("/templates") ? "default" : "ghost"}
            size="sm"
            onClick={() => router.push("/templates")}
            className="w-10 h-10 p-0"
            title="Templates"
          >
            <Layout className="h-4 w-4" />
          </Button>

          <Separator className="my-2" />

          {/* Workstream Icons */}
          {boardManagement.workstreams.map((workstream) => (
            <Button
              key={workstream.id}
              variant={isWorkstreamActive(workstream.id) ? "default" : "ghost"}
              size="sm"
              onClick={() => router.push(`/workstream/${workstream.id}`)}
              className="w-10 h-10 p-0"
              title={workstream.name}
            >
              <div
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: workstream.color }}
              />
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-64 bg-white border-r flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Navigation</h2>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {/* Main Navigation */}
          <Button
            variant={isCurrentPath("/") ? "default" : "ghost"}
            size="sm"
            onClick={() => router.push("/")}
            className="w-full justify-start"
          >
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>

          <Button
            variant={isCurrentPath("/templates") ? "default" : "ghost"}
            size="sm"
            onClick={() => router.push("/templates")}
            className="w-full justify-start"
          >
            <Layout className="h-4 w-4 mr-2" />
            Templates
          </Button>

          <Separator className="my-3" />

          {/* Workstreams */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Workstreams
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {boardManagement.workstreams.length === 0 ? (
              <div className="px-2 py-4 text-center text-gray-500 text-sm">
                No workstreams yet
              </div>
            ) : (
              (() => {
                const activeBoardId = pathname.match(/^\/board\/([^/]+)/)?.[1];
                return boardManagement.workstreams.map((workstream) => {
                  const workstreamBoards = boardManagement.getWorkstreamBoards(
                    workstream.id,
                  );
                  const isExpanded = expandedWorkstreams.has(workstream.id);
                  const isActive = isWorkstreamActive(workstream.id);

                  return (
                    <Collapsible
                      key={workstream.id}
                      open={isExpanded}
                      onOpenChange={() => toggleWorkstream(workstream.id)}
                    >
                      <div className="group">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant={isActive ? "secondary" : "ghost"}
                            size="sm"
                            className="w-full justify-between group/item"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isExpanded ? (
                                <FolderOpen className="h-4 w-4 text-gray-500" />
                              ) : (
                                <Folder className="h-4 w-4 text-gray-500" />
                              )}
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: workstream.color }}
                              />
                              <span className="truncate text-left">
                                {workstream.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Badge variant="secondary" className="text-xs">
                                {workstreamBoards.length}
                              </Badge>
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </div>
                          </Button>
                        </CollapsibleTrigger>

                        <CollapsibleContent className="space-y-1 ml-4 mt-1">
                          {/* Boards in this workstream */}
                          {[...workstreamBoards]
                            .sort((a, b) => {
                              const ts = (d: string | Date | undefined) => {
                                const t = d ? new Date(d).getTime() : 0;
                                return Number.isFinite(t) ? t : 0;
                              };
                              return ts(b.lastAccessed) - ts(a.lastAccessed);
                            })
                            .slice(0, 8) // Limit to 8 boards in sidebar
                            .map((board) => {
                              const isBoardActive = activeBoardId === board.id;

                              return (
                                <div
                                  key={board.id}
                                  className="flex items-center gap-1 group/board"
                                >
                                  <Button
                                    variant={
                                      isBoardActive ? "default" : "ghost"
                                    }
                                    size="sm"
                                    onClick={() => {
                                      boardManagement.updateLastAccessed(
                                        board.id,
                                      );
                                      router.push(`/board/${board.id}`);
                                    }}
                                    className="flex-1 justify-start text-xs h-7"
                                  >
                                    <FileText className="h-3 w-3 mr-2 text-gray-400" />
                                    <span className="truncate">
                                      {board.name}
                                    </span>
                                  </Button>

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 opacity-0 group-hover/board:opacity-100 transition-opacity"
                                      >
                                        <MoreHorizontal className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          router.push(
                                            `/board/${board.id}/settings`,
                                          )
                                        }
                                      >
                                        Settings
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          boardManagement.duplicateBoard(
                                            board.id,
                                          )
                                        }
                                      >
                                        Duplicate
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          confirmDelete(() =>
                                            boardManagement.deleteBoard(
                                              board.id,
                                            ),
                                          );
                                        }}
                                        className="text-red-600"
                                      >
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              );
                            })}

                          {/* Show more link if there are more boards */}
                          {workstreamBoards.length > 8 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(`/workstream/${workstream.id}`)
                              }
                              className="w-full justify-start text-xs h-7 text-gray-500"
                            >
                              <span className="truncate">
                                +{workstreamBoards.length - 8} more boards
                              </span>
                            </Button>
                          )}

                          {/* Create board in this workstream */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCreateBoard(workstream.id)}
                            className="w-full justify-start text-xs h-7 text-gray-500 hover:text-gray-900"
                          >
                            <Plus className="h-3 w-3 mr-2" />
                            <span>Add board</span>
                          </Button>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                });
              })()
            )}
          </div>
        </div>
      </ScrollArea>

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

      {/* Create Workstream Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Workstream</DialogTitle>
            <DialogDescription>
              Workstreams help organize your boards by project, team, or topic.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workstream-name">Name</Label>
              <Input
                id="workstream-name"
                placeholder="e.g. Product Design, Marketing, Engineering"
                value={newWorkstream.name}
                onChange={(e) =>
                  setNewWorkstream({ ...newWorkstream, name: e.target.value })
                }
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workstream-description">Description</Label>
              <Textarea
                id="workstream-description"
                placeholder="Brief description of this workstream's purpose"
                value={newWorkstream.description}
                onChange={(e) =>
                  setNewWorkstream({
                    ...newWorkstream,
                    description: e.target.value,
                  })
                }
                className="w-full min-h-20 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workstream-color">Color</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-md border border-gray-200 flex-shrink-0"
                  style={{ backgroundColor: newWorkstream.color }}
                />
                <Input
                  id="workstream-color"
                  type="color"
                  value={newWorkstream.color}
                  onChange={(e) =>
                    setNewWorkstream({
                      ...newWorkstream,
                      color: e.target.value,
                    })
                  }
                  className="w-20 h-8 p-1 border border-gray-200 rounded"
                />
                <div className="flex gap-1">
                  {[
                    "#3b82f6",
                    "#ef4444",
                    "#10b981",
                    "#f59e0b",
                    "#8b5cf6",
                    "#ec4899",
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="w-6 h-6 rounded-md border border-gray-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() =>
                        setNewWorkstream({ ...newWorkstream, color })
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setNewWorkstream({
                  name: "",
                  description: "",
                  color: "#3b82f6",
                });
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newWorkstream.name.trim()) return;

                setIsCreating(true);
                try {
                  await boardManagement.createWorkstream({
                    name: newWorkstream.name.trim(),
                    description: newWorkstream.description.trim(),
                    color: newWorkstream.color,
                    icon: "folder",
                    boardIds: [],
                    metadata: {
                      boardCount: 0,
                    },
                  });

                  // Reset form and close dialog
                  setNewWorkstream({
                    name: "",
                    description: "",
                    color: "#3b82f6",
                  });
                  setShowCreateDialog(false);
                } catch (error) {
                  console.error("Failed to create workstream:", error);
                } finally {
                  setIsCreating(false);
                }
              }}
              disabled={!newWorkstream.name.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create Workstream"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
