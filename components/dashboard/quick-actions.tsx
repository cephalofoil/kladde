"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useBoardStore } from "@/stores/board-management-store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Layout,
  Clock,
  TrendingUp,
  FileText,
  Folder,
} from "lucide-react";
import { formatDate } from "@/lib/dates/format";

export function QuickActions() {
  const router = useRouter();
  const boardManagement = useBoardStore();

  // Get recent boards (last 3)
  const toTime = (d?: string | number | Date) =>
    d ? new Date(d).getTime() || 0 : 0;

  const recentBoards = [...boardManagement.boards]
    .sort((a, b) => toTime(b.lastAccessed) - toTime(a.lastAccessed))
    .slice(0, 3);

  const handleCreateBoard = () => {
    const { workstreams, currentWorkstreamId, createBoard } =
      useBoardStore.getState();
    if (!workstreams || workstreams.length === 0) {
      console.error("Cannot create board: No workstreams available");
      return;
    }

    const defaultWorkstream =
      workstreams.find((ws) => ws.id === currentWorkstreamId) ?? workstreams[0];
    const newBoardId = createBoard({
      workstreamId: defaultWorkstream.id,
      name: `New Board ${boardManagement.boards.length + 1}`,
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

  const handleBoardClick = (boardId: string) => {
    boardManagement.updateLastAccessed(boardId);
    router.push(`/board/${boardId}`);
  };

  return (
    <div className="mb-8">
      {/* Quick Actions Row */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Create New Board */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow group">
          <CardContent className="p-6 text-center" onClick={handleCreateBoard}>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
              <Plus className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-medium mb-1">New Board</h3>
            <p className="text-sm text-gray-600">Start with a blank canvas</p>
          </CardContent>
        </Card>

        {/* Browse Templates */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow group">
          <CardContent
            className="p-6 text-center"
            onClick={() => router.push("/templates")}
          >
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-200 transition-colors">
              <Layout className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-medium mb-1">Templates</h3>
            <p className="text-sm text-gray-600">Start from a template</p>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-medium mb-1">
              {boardManagement.boards.length}
            </h3>
            <p className="text-sm text-gray-600">Total Boards</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Folder className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="font-medium mb-1">
              {boardManagement.workstreams.length}
            </h3>
            <p className="text-sm text-gray-600">Workstreams</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Boards */}
      {recentBoards.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-gray-400" />
            <h3 className="font-medium text-gray-900">Recent Boards</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentBoards.map((board) => {
              const workstream = boardManagement.workstreams.find(
                (w) => w.id === board.workstreamId,
              );

              return (
                <Card
                  key={board.id}
                  className="cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => handleBoardClick(board.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Board Thumbnail/Icon */}
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {board.thumbnail ? (
                          <Image
                            src={board.thumbnail}
                            alt={board.name}
                            className="w-full h-full object-cover rounded-lg"
                            width={40}
                            height={40}
                          />
                        ) : (
                          <FileText className="h-5 w-5 text-gray-400" />
                        )}
                      </div>

                      {/* Board Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {board.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          {workstream && (
                            <>
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: workstream.color }}
                              />
                              <span className="text-xs text-gray-500 truncate">
                                {workstream.name}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Tags (first 2) */}
                        {board.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
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

                      {/* Last Accessed */}
                      <div className="text-xs text-gray-500 text-right">
                        {formatDate(board.lastAccessed)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
