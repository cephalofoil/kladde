"use client";

import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import {
  Plus,
  Heading1,
  Type,
  Minus,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  BoardElement,
  DocumentContent,
  DocumentSection,
} from "@/lib/board-types";
import { HeadingSectionRenderer } from "./section-renderers/heading-section";
import { TextSectionRenderer } from "./section-renderers/text-section";
import { SpacerSectionRenderer } from "./section-renderers/spacer-section";
import { TileContentSectionRenderer } from "./section-renderers/tile-content-section";
import { FrameImageSectionRenderer } from "./section-renderers/frame-image-section";

interface A4DocumentPreviewProps {
  documentContent: DocumentContent;
  allElements: BoardElement[];
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onAddSection: (type: "heading" | "text" | "spacer") => void;
  onRemoveSection: (sectionId: string) => void;
  onUpdateSection: (sectionId: string, updates: Partial<DocumentSection>) => void;
  onMoveSection: (fromIndex: number, toIndex: number) => void;
  onIncludeFrameContent: (frameId: string, sectionId: string) => void;
}

// A4 dimensions at 96 DPI
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const MARGIN_PX = 94; // ~25mm at 96 DPI
const CONTENT_HEIGHT_PX = A4_HEIGHT_PX - (2 * MARGIN_PX); // 935px usable content area
const SCALE_FACTOR = 1; // Match PDF scale (96 DPI vs 72 pt)

// Page content structure for multi-page support
interface PageContent {
  pageNumber: number;
  sectionIds: string[];
  showHeader: boolean;
}

export function A4DocumentPreview({
  documentContent,
  allElements,
  onTitleChange,
  onDescriptionChange,
  onAddSection,
  onRemoveSection,
  onUpdateSection,
  onMoveSection,
  onIncludeFrameContent,
}: A4DocumentPreviewProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [sectionHeights, setSectionHeights] = useState<Map<string, number>>(new Map());
  const headerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [headerHeight, setHeaderHeight] = useState(100);

  const { sections } = documentContent.layout;

  // Measure header height
  useEffect(() => {
    if (!headerRef.current) return;

    const updateHeaderHeight = () => {
      setHeaderHeight(headerRef.current ? headerRef.current.offsetHeight / SCALE_FACTOR : 100);
    };

    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  // Measure section heights
  useEffect(() => {
    const updateSectionHeights = () => {
      const newHeights = new Map<string, number>();
      sectionRefs.current.forEach((element, sectionId) => {
        if (element) {
          newHeights.set(sectionId, element.offsetHeight / SCALE_FACTOR);
        }
      });
      setSectionHeights(newHeights);
    };

    updateSectionHeights();
    const observers: ResizeObserver[] = [];
    sectionRefs.current.forEach((element) => {
      if (!element) return;
      const observer = new ResizeObserver(updateSectionHeights);
      observer.observe(element);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [sections, documentContent]);

  // Calculate page layout based on measured heights
  const pageLayout = useMemo<PageContent[]>(() => {
    if (sections.length === 0) {
      return [{ pageNumber: 1, sectionIds: [], showHeader: true }];
    }

    const pages: PageContent[] = [];
    let currentPage: PageContent = { pageNumber: 1, sectionIds: [], showHeader: true };
    let currentHeight = headerHeight + 60; // Header + divider + margins

    for (const section of sections) {
      const sectionHeight = sectionHeights.get(section.id) || 50; // Default estimate
      const availableHeight = CONTENT_HEIGHT_PX - (currentPage.showHeader ? 0 : 0);

      if (currentHeight + sectionHeight > availableHeight && currentPage.sectionIds.length > 0) {
        // Start new page
        pages.push(currentPage);
        currentPage = {
          pageNumber: pages.length + 1,
          sectionIds: [section.id],
          showHeader: false,
        };
        currentHeight = sectionHeight;
      } else {
        currentPage.sectionIds.push(section.id);
        currentHeight += sectionHeight;
      }
    }

    // Add the last page
    pages.push(currentPage);
    return pages;
  }, [sections, sectionHeights, headerHeight]);

  const registerSectionRef = useCallback((sectionId: string, element: HTMLDivElement | null) => {
    if (element) {
      sectionRefs.current.set(sectionId, element);
    } else {
      sectionRefs.current.delete(sectionId);
    }
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex]
  );

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null) {
      onMoveSection(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, onMoveSection]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Preview Header */}
      <div className="p-3 border-b border-border bg-card flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Document Preview
        </h3>
      </div>

      {/* Scrollable Preview Area */}
      <div
        className="flex-1 overflow-auto p-6 flex justify-center"
        style={{ background: "repeating-conic-gradient(#80808008 0% 25%, transparent 0% 50%) 50% / 20px 20px" }}
      >
        <div className="flex flex-col items-center gap-6">
          {pageLayout.map((page, pageIndex) => (
            <div key={`page-${page.pageNumber}`} className="flex flex-col items-center gap-4">
                <div
                  className="bg-white shadow-xl rounded-sm transition-all duration-150 flex-shrink-0 font-[var(--font-sans)]"
                  style={{
                    width: A4_WIDTH_PX * SCALE_FACTOR,
                    minHeight: A4_HEIGHT_PX * SCALE_FACTOR,
                    padding: MARGIN_PX * SCALE_FACTOR,
                  }}
                >
                {page.showHeader && (
                  <div ref={headerRef}>
                    {/* Document Title */}
                      <input
                        type="text"
                        value={documentContent.title}
                        onChange={(e) => onTitleChange(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        placeholder="Document Title"
                        className="w-full font-semibold text-slate-900 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-300 cursor-text font-[var(--font-heading)]"
                        style={{ fontSize: "32px", lineHeight: 1.3, marginBottom: "5.3px" }}
                      />

                    {/* Document Description */}
                      <textarea
                        value={documentContent.description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        placeholder="Add a description..."
                        rows={1}
                        className="w-full text-slate-600 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-300 resize-none cursor-text font-[var(--font-sans)]"
                        style={{ fontSize: "16px", lineHeight: 1.5, marginBottom: "21.3px" }}
                      />

                    {/* Divider */}
                    <div className="border-b border-slate-200" style={{ marginBottom: "21.3px" }} />
                  </div>
                )}

                {/* Sections */}
                <div className="space-y-3">
                  {page.sectionIds.map((sectionId) => {
                    const index = sections.findIndex((section) => section.id === sectionId);
                    const section = sections[index];
                    if (!section) return null;

                    return (
                      <div
                        key={section.id}
                        ref={(element) => registerSectionRef(section.id, element)}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragLeave={handleDragLeave}
                        className={cn(
                          "relative group transition-all",
                          draggedIndex === index && "opacity-50",
                          dragOverIndex === index && "border-t-2 border-orange-500"
                        )}
                      >
                        {section.type === "heading" && (
                          <HeadingSectionRenderer
                            section={section}
                            onUpdate={(updates) => onUpdateSection(section.id, updates)}
                            onRemove={() => onRemoveSection(section.id)}
                          />
                        )}
                        {section.type === "text" && (
                          <TextSectionRenderer
                            section={section}
                            onUpdate={(updates) => onUpdateSection(section.id, updates)}
                            onRemove={() => onRemoveSection(section.id)}
                          />
                        )}
                        {section.type === "spacer" && (
                          <SpacerSectionRenderer
                            section={section}
                            onUpdate={(updates) => onUpdateSection(section.id, updates)}
                            onRemove={() => onRemoveSection(section.id)}
                          />
                        )}
                        {section.type === "tile-content" && (
                          <TileContentSectionRenderer
                            section={section}
                            allElements={allElements}
                            onUpdate={(updates) => onUpdateSection(section.id, updates)}
                            onRemove={() => onRemoveSection(section.id)}
                          />
                        )}
                        {section.type === "frame-image" && (
                          <FrameImageSectionRenderer
                            section={section}
                            allElements={allElements}
                            onUpdate={(updates) => onUpdateSection(section.id, updates)}
                            onRemove={() => onRemoveSection(section.id)}
                            onIncludeContent={() => onIncludeFrameContent(section.frameId, section.id)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Section Button (last page only) */}
                {pageIndex === pageLayout.length - 1 && (
                  <div className="relative mt-4">
                    <button
                      onClick={() => setShowAddMenu(!showAddMenu)}
                      className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors text-xs"
                    >
                      <Plus className="w-3 h-3" />
                      Add Section
                      <ChevronDown className={cn("w-3 h-3 transition-transform", showAddMenu && "rotate-180")} />
                    </button>

                    {/* Dropdown Menu */}
                    {showAddMenu && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10">
                        <button
                          onClick={() => {
                            onAddSection("heading");
                            setShowAddMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-xs text-gray-700"
                        >
                          <Heading1 className="w-3 h-3" />
                          Heading
                        </button>
                        <button
                          onClick={() => {
                            onAddSection("text");
                            setShowAddMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-xs text-gray-700"
                        >
                          <Type className="w-3 h-3" />
                          Text Block
                        </button>
                        <button
                          onClick={() => {
                            onAddSection("spacer");
                            setShowAddMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-xs text-gray-700"
                        >
                          <Minus className="w-3 h-3" />
                          Spacer
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {pageIndex < pageLayout.length - 1 && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px w-32 bg-border" />
                  Page {page.pageNumber}
                  <div className="h-px w-32 bg-border" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
