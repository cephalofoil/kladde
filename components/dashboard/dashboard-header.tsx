"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/stores/board-management-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
import {
  Search,
  Plus,
  Grid3X3,
  List,
  Calendar,
  Filter,
  Layout,
} from "lucide-react";

export function DashboardHeader() {
  const router = useRouter();
  const boardManagement = useBoardStore();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const allTags = boardManagement.getAllTags();
  const selectedTags = boardManagement.selectedTags;
  const searchQuery = boardManagement.searchQuery;
  const dashboardView = boardManagement.dashboardView;

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    boardManagement.setSelectedTags(newTags);
  };

  const clearFilters = () => {
    boardManagement.setSearchQuery("");
    boardManagement.setSelectedTags([]);
  };

  const handleCreateBoard = () => {
    // Read directly from the latest store snapshot to avoid stale state
    const { workstreams, currentWorkstreamId, createBoard } =
      useBoardStore.getState();
    if (!workstreams || workstreams.length === 0) {
      console.error("Cannot create board: No workstreams available");
      return;
    }

    // Prefer the currently selected workstream, fall back to the first
    const defaultWorkstream =
      workstreams.find((ws) => ws.id === currentWorkstreamId) ?? workstreams[0];
    const boardsCount = useBoardStore.getState().boards.length;

    // Create the board and capture the returned ID
    const newBoardId = createBoard({
      workstreamId: defaultWorkstream.id,
      name: `New Board ${boardsCount + 1}`,
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

  return (
    <header className="bg-white border-b px-6 py-4">
      {/* Top Row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            {boardManagement.boards.length} boards across{" "}
            {boardManagement.workstreams.length} workstreams
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/templates")}
            className="flex items-center gap-2"
          >
            <Layout className="h-4 w-4" />
            Templates
          </Button>

          <Button
            onClick={handleCreateBoard}
            disabled={boardManagement.workstreams.length === 0}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Board
          </Button>
        </div>
      </div>

      {/* Search and Controls Row */}
      <div className="flex items-center justify-between">
        {/* Search and Filters */}
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search boards..."
              value={searchQuery}
              onChange={(e) => boardManagement.setSearchQuery(e.target.value)}
              className="pl-10 pr-4"
            />

            {/* Command Palette Hint */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <DropdownMenu open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Tags
                  {selectedTags.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedTags.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Filter by Tags</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {allTags.map((tag) => (
                  <DropdownMenuItem
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className="flex items-center justify-between"
                  >
                    <span>{tag}</span>
                    {selectedTags.includes(tag) && (
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </DropdownMenuItem>
                ))}

                {selectedTags.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearFilters}>
                      Clear all filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Clear Filters */}
          {(searchQuery || selectedTags.length > 0) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={dashboardView === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => boardManagement.setDashboardView("grid")}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>

          <Button
            variant={dashboardView === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => boardManagement.setDashboardView("list")}
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            variant={dashboardView === "timeline" ? "default" : "outline"}
            size="sm"
            onClick={() => boardManagement.setDashboardView("timeline")}
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Active Filters Display */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <span className="text-sm text-gray-600">Filtered by:</span>
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => handleTagToggle(tag)}
            >
              {tag} ×
            </Badge>
          ))}
        </div>
      )}
    </header>
  );
}
