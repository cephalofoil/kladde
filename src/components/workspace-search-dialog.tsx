"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, X, FileText, Type, StickyNote, Frame, ArrowRight } from "lucide-react";
import { useBoardStore } from "@/store/board-store";
import {
  searchWorkspace,
  groupResultsByBoard,
  type SearchResult,
} from "@/lib/search-utils";
import { cn } from "@/lib/utils";

interface WorkspaceSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workstreamId?: string;
}

function getMatchTypeIcon(matchType: SearchResult["matchType"]) {
  switch (matchType) {
    case "board-name":
      return <FileText className="w-3.5 h-3.5" />;
    case "tile-title":
    case "tile-content":
      return <StickyNote className="w-3.5 h-3.5" />;
    case "text-element":
      return <Type className="w-3.5 h-3.5" />;
    case "frame-label":
      return <Frame className="w-3.5 h-3.5" />;
    default:
      return <FileText className="w-3.5 h-3.5" />;
  }
}

function getMatchTypeLabel(matchType: SearchResult["matchType"]) {
  switch (matchType) {
    case "board-name":
      return "Board";
    case "tile-title":
      return "Tile";
    case "tile-content":
      return "Tile content";
    case "text-element":
      return "Text";
    case "frame-label":
      return "Frame";
    default:
      return "Match";
  }
}

export function WorkspaceSearchDialog({
  isOpen,
  onClose,
  workstreamId,
}: WorkspaceSearchDialogProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const boards = useBoardStore((s) => s.boards);
  const boardData = useBoardStore((s) => s.boardData);
  const workstreams = useBoardStore((s) => s.workstreams);

  const results = useMemo(() => {
    return searchWorkspace(searchQuery, boards, boardData, workstreamId);
  }, [searchQuery, boards, boardData, workstreamId]);

  const groupedResults = useMemo(() => {
    return groupResultsByBoard(results);
  }, [results]);

  // Flatten for keyboard navigation
  const flatResults = useMemo(() => {
    const flat: { boardId: string; result: SearchResult }[] = [];
    for (const [boardId, boardResults] of groupedResults) {
      // Just add the first/best result per board for navigation
      if (boardResults.length > 0) {
        flat.push({ boardId, result: boardResults[0] });
      }
    }
    return flat;
  }, [groupedResults]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    } else {
      setSearchQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && flatResults.length > 0) {
      const selectedElement = resultsRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, flatResults.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < flatResults.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatResults.length > 0 && flatResults[selectedIndex]) {
        navigateToResult(flatResults[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const navigateToResult = (item: { boardId: string; result: SearchResult }) => {
    onClose();
    // Navigate to board, optionally with element focus in the future
    router.push(`/board/${item.boardId}`);
  };

  const currentWorkstream = workstreamId
    ? workstreams.get(workstreamId)
    : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div
        ref={containerRef}
        className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[60vh] flex flex-col overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-muted-foreground"
            placeholder={
              currentWorkstream
                ? `Search in ${currentWorkstream.name}...`
                : "Search all boards..."
            }
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
            esc
          </div>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="flex-1 overflow-y-auto">
          {searchQuery.trim() === "" ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">
                Type to search board names and content
              </p>
            </div>
          ) : flatResults.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">No results found for "{searchQuery}"</p>
            </div>
          ) : (
            <div className="py-2">
              {flatResults.map((item, index) => {
                const boardResults = groupedResults.get(item.boardId) || [];
                const isSelected = index === selectedIndex;

                return (
                  <div
                    key={item.boardId}
                    data-index={index}
                    onClick={() => navigateToResult(item)}
                    className={cn(
                      "px-4 py-3 cursor-pointer transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-muted/50",
                    )}
                  >
                    {/* Board name */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">
                        {item.result.boardName}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    </div>

                    {/* Matches in this board */}
                    <div className="space-y-1">
                      {boardResults.slice(0, 3).map((result, resultIndex) => (
                        <div
                          key={`${result.elementId || "board"}-${resultIndex}`}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span className="text-muted-foreground mt-0.5">
                            {getMatchTypeIcon(result.matchType)}
                          </span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            {getMatchTypeLabel(result.matchType)}:
                          </span>
                          <span className="text-foreground/80 truncate">
                            {result.matchedText}
                          </span>
                        </div>
                      ))}
                      {boardResults.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-5">
                          +{boardResults.length - 3} more matches
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {flatResults.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex items-center gap-4">
            <span>
              {results.length} result{results.length !== 1 ? "s" : ""} in{" "}
              {flatResults.length} board{flatResults.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                ↵
              </kbd>
              open
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
