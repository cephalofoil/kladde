"use client";

import { useBoardStore } from "@/store/board-store";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function BoardFilters() {
  const [localSearch, setLocalSearch] = useState("");
  const boards = useBoardStore((s) => s.boards);
  const searchQuery = useBoardStore((s) => s.ui.searchQuery);
  const setSearchQuery = useBoardStore((s) => s.setSearchQuery);
  const selectedTags = useBoardStore((s) => s.ui.selectedTags);
  const setSelectedTags = useBoardStore((s) => s.setSelectedTags);
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    boards.forEach((board) => {
      board.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [boards]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const clearFilters = () => {
    setLocalSearch("");
    setSearchQuery("");
    setSelectedTags([]);
  };

  const hasFilters = searchQuery || selectedTags.length > 0;

  return (
    <div className="mt-4 space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search boards..."
          className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 border-border"
        />
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Tags:
          </span>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                selectedTags.includes(tag)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {tag}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
