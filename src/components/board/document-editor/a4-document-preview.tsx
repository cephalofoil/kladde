"use client";

import { useCallback, useState, useRef } from "react";
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

interface A4DocumentPreviewProps {
  documentContent: DocumentContent;
  allElements: BoardElement[];
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onAddSection: (type: "heading" | "text" | "spacer") => void;
  onRemoveSection: (sectionId: string) => void;
  onUpdateSection: (sectionId: string, updates: Partial<DocumentSection>) => void;
  onMoveSection: (fromIndex: number, toIndex: number) => void;
}

// A4 dimensions at 96 DPI
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const MARGIN_PX = 94; // ~25mm at 96 DPI

export function A4DocumentPreview({
  documentContent,
  allElements,
  onTitleChange,
  onDescriptionChange,
  onAddSection,
  onRemoveSection,
  onUpdateSection,
  onMoveSection,
}: A4DocumentPreviewProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const { sections } = documentContent.layout;

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Preview Header */}
      <div className="p-3 border-b border-border bg-card">
        <h3 className="text-sm font-medium text-muted-foreground">
          Document Preview
        </h3>
      </div>

      {/* Scrollable Preview Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6"
        style={{ background: "repeating-conic-gradient(#80808008 0% 25%, transparent 0% 50%) 50% / 20px 20px" }}
      >
        {/* A4 Page Container */}
        <div
          className="mx-auto bg-white shadow-xl rounded-sm"
          style={{
            width: A4_WIDTH_PX * 0.5,
            minHeight: A4_HEIGHT_PX * 0.5,
            padding: MARGIN_PX * 0.5,
          }}
        >
          {/* Document Title */}
          <input
            type="text"
            value={documentContent.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Document Title"
            className="w-full text-xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 placeholder:text-gray-300 mb-1"
            style={{ fontSize: "16px", lineHeight: 1.3 }}
          />

          {/* Document Description */}
          <textarea
            value={documentContent.description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Add a description..."
            rows={1}
            className="w-full text-sm text-gray-600 bg-transparent border-none outline-none focus:ring-0 placeholder:text-gray-300 resize-none mb-4"
            style={{ fontSize: "10px", lineHeight: 1.5 }}
          />

          {/* Divider */}
          <div className="border-b border-gray-200 mb-4" />

          {/* Sections */}
          <div className="space-y-2">
            {sections.map((section, index) => (
              <div
                key={section.id}
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
                    onRemove={() => onRemoveSection(section.id)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Add Section Button */}
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
        </div>
      </div>
    </div>
  );
}
