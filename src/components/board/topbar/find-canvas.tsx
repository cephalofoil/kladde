"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import type { BoardElement } from "@/lib/board-types";

interface FindCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  elements: BoardElement[];
  onFocusElement: (element: BoardElement) => void;
  onHighlightElements?: (
    elementIds: string[],
    currentId?: string | null,
  ) => void;
  currentHighlightId?: string | null;
}

export function FindCanvas(props: FindCanvasProps) {
  if (!props.isOpen) return null;

  return <FindCanvasContent {...props} />;
}

function FindCanvasContent({
  onClose,
  elements,
  onFocusElement,
  onHighlightElements,
}: FindCanvasProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Store callback in ref to avoid dependency issues
  const onHighlightElementsRef = useRef(onHighlightElements);
  useEffect(() => {
    onHighlightElementsRef.current = onHighlightElements;
  }, [onHighlightElements]);

  // Auto-focus input when opened
  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      onHighlightElementsRef.current?.([]);
    };
  }, []);

  // Close on click outside
  useEffect(() => {
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
  }, [onClose]);

  // Store onFocusElement in ref too
  const onFocusElementRef = useRef(onFocusElement);
  useEffect(() => {
    onFocusElementRef.current = onFocusElement;
  }, [onFocusElement]);

  const results = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    return elements.filter((el) => {
      if (el.type === "text") {
        return el.text?.toLowerCase().includes(query);
      }

      if (el.type === "frame") {
        return el.label?.toLowerCase().includes(query);
      }

      if (el.type === "tile") {
        if (el.tileTitle?.toLowerCase().includes(query)) {
          return true;
        }

        if (el.tileContent) {
          const content = el.tileContent;

          if (content.richText?.toLowerCase().includes(query)) {
            return true;
          }

          if (content.noteText?.toLowerCase().includes(query)) {
            return true;
          }

          if (content.code?.toLowerCase().includes(query)) {
            return true;
          }

          if (content.chart?.toLowerCase().includes(query)) {
            return true;
          }

          if (content.bookmarkTitle?.toLowerCase().includes(query)) {
            return true;
          }
          if (content.bookmarkDescription?.toLowerCase().includes(query)) {
            return true;
          }
          if (content.displayName?.toLowerCase().includes(query)) {
            return true;
          }
        }

        if (el.tileType) {
          const tileTypeName = el.tileType.replace("tile-", "").toLowerCase();
          if (tileTypeName.includes(query) || query === "tile") {
            return true;
          }
        }
      }

      if (el.type.toLowerCase().includes(query)) {
        return true;
      }

      return false;
    });
  }, [searchQuery, elements]);

  const safeIndex = Math.min(currentIndex, Math.max(results.length - 1, 0));

  useEffect(() => {
    if (results.length === 0) {
      onHighlightElementsRef.current?.([]);
      return;
    }

    onHighlightElementsRef.current?.(
      results.map((el) => el.id),
      results[0].id,
    );
    onFocusElementRef.current(results[0]);
  }, [results]);

  const handleNext = () => {
    if (results.length === 0) return;
    const nextIndex = (safeIndex + 1) % results.length;
    setCurrentIndex(nextIndex);
    onFocusElement(results[nextIndex]);

    // Update current highlight
    if (onHighlightElements) {
      onHighlightElements(
        results.map((el) => el.id),
        results[nextIndex].id,
      );
    }
  };

  const handlePrevious = () => {
    if (results.length === 0) return;
    const prevIndex =
      safeIndex === 0 ? results.length - 1 : safeIndex - 1;
    setCurrentIndex(prevIndex);
    onFocusElement(results[prevIndex]);

    // Update current highlight
    if (onHighlightElements) {
      onHighlightElements(
        results.map((el) => el.id),
        results[prevIndex].id,
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevious();
      } else {
        handleNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50">
      <div
        ref={containerRef}
        className="bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-lg shadow-2xl p-3 w-96 max-w-[90vw]"
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
            placeholder="Find text on canvas..."
          />
          {results.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>
                {currentIndex + 1} / {results.length}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handlePrevious}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title="Previous (Shift+Enter)"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNext}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title="Next (Enter)"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
