"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/stores/board-management-store";
import type { Board, Workstream } from "@/types/canvas";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates/format";
import {
  ChevronDown,
  Search,
  FileText,
  Clock,
  Plus,
  Folder,
} from "lucide-react";

interface BoardSwitcherProps {
  currentBoardId?: string | null;
  className?: string;
}

export function BoardSwitcher({
  currentBoardId,
  className,
}: BoardSwitcherProps) {
  const router = useRouter();
  const boardManagement = useBoardStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const currentBoard = currentBoardId
    ? boardManagement.boards.find((b) => b.id === currentBoardId)
    : null;

  const currentWorkstream = currentBoard
    ? boardManagement.workstreams.find(
        (w) => w.id === currentBoard.workstreamId,
      )
    : null;

  // Filter boards based on search query
  const filteredBoards = [...boardManagement.boards]
    .filter((board) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        board.name.toLowerCase().includes(query) ||
        board.description?.toLowerCase().includes(query) ||
        board.tags.some((tag: string) => tag.toLowerCase().includes(query))
      );
    })
    .sort(
      (a, b) =>
        new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime(),
    )
    .slice(0, 10); // Show max 10 boards

  // Group boards by workstream
  const boardsByWorkstream = filteredBoards.reduce(
    (acc, board) => {
      const workstream = boardManagement.workstreams.find(
        (w) => w.id === board.workstreamId,
      );
      const key = workstream?.id ?? "__unknown__";
      if (!acc[key]) {
        acc[key] = { workstream, boards: [] };
      }
      acc[key].boards.push(board);
      return acc;
    },
    {} as Record<string, { workstream?: Workstream; boards: Board[] }>,
  );

  const handleBoardSelect = (boardId: string) => {
    boardManagement.updateLastAccessed(boardId);
    router.push(`/board/${boardId}`);
    setIsOpen(false);
  };

  const handleCreateBoard = () => {
    setIsOpen(false);
    router.push("/"); // Go to dashboard to create a board
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={["justify-between min-w-[200px]", className]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="flex items-center gap-2 truncate">
            {currentBoard ? (
              <>
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{currentBoard.name}</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 shrink-0" />
                <span>Select Board</span>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80 p-0" align="start">
        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search boards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-8"
            />
          </div>
        </div>

        {/* Current Board (if any) */}
        {currentBoard && (
          <>
            <DropdownMenuLabel className="text-xs text-gray-500 font-normal">
              Current Board
            </DropdownMenuLabel>
            <DropdownMenuItem className="px-3 py-2 bg-blue-50">
              <div className="flex items-center gap-2 w-full">
                <FileText className="h-4 w-4 text-blue-600" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-blue-900 truncate">
                    {currentBoard.name}
                  </div>
                  {currentWorkstream && (
                    <div className="text-xs text-blue-700 flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: currentWorkstream.color }}
                      />
                      {currentWorkstream.name}
                    </div>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs">
                  Current
                </Badge>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Board List */}
        <div className="max-h-96 overflow-y-auto">
          {Object.keys(boardsByWorkstream).length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? "No boards found" : "No boards available"}
            </div>
          ) : (
            (
              Object.entries(boardsByWorkstream) as [
                string,
                { workstream?: Workstream; boards: Board[] },
              ][]
            ).map(([workstreamKey, { workstream, boards }]) => (
              <div key={workstreamKey}>
                <DropdownMenuLabel className="text-xs text-gray-500 font-normal flex items-center gap-2">
                  <Folder className="h-3 w-3" />
                  {workstream?.name ?? "Unknown Workstream"}
                </DropdownMenuLabel>

                {boards.map((board: Board) => (
                  <DropdownMenuItem
                    key={board.id}
                    className="px-3 py-2 cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleBoardSelect(board.id);
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {board.name}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(board.lastAccessed)}
                          </span>
                          <span>{board.metadata.tileCount} tiles</span>
                        </div>
                      </div>
                      {board.tags.length > 0 && (
                        <div className="flex gap-1">
                          {board.tags.slice(0, 2).map((tag: string) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleCreateBoard}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Board
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
