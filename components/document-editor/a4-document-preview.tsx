"use client";

import React, { useState } from "react";
import type { DocumentLayout, DocumentSection, TileData } from "@/types/canvas";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { A4_DIMENSIONS_PX, reorderSections } from "@/lib/document-helpers";
import { TileContentSection } from "./section-renderers/tile-content-section";
import { HeadingSection } from "./section-renderers/heading-section";
import { TextSection } from "./section-renderers/text-section";
import { SpacerSection } from "./section-renderers/spacer-section";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface A4DocumentPreviewProps {
  title: string;
  description?: string;
  layout: DocumentLayout;
  allTiles: TileData[];
  onUpdateLayout: (layout: DocumentLayout) => void;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string) => void;
}

interface SortableSectionProps {
  section: DocumentSection;
  allTiles: TileData[];
  onUpdate: (updates: Partial<DocumentSection>) => void;
  onRemove: () => void;
}

function SortableSection({
  section,
  allTiles,
  onUpdate,
  onRemove,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const renderSection = () => {
    switch (section.type) {
      case "tile-content":
        const tile = allTiles.find((t) => t.id === section.sourceTileId);
        return (
          <TileContentSection
            section={section}
            tile={tile}
            onRemove={onRemove}
            isDragging={isDragging}
            dragHandleProps={{ ...listeners, ...attributes }}
          />
        );
      case "heading":
        return (
          <HeadingSection
            section={section}
            onUpdate={onUpdate}
            onRemove={onRemove}
            isDragging={isDragging}
            dragHandleProps={{ ...listeners, ...attributes }}
          />
        );
      case "text":
        return (
          <TextSection
            section={section}
            onUpdate={onUpdate}
            onRemove={onRemove}
            isDragging={isDragging}
            dragHandleProps={{ ...listeners, ...attributes }}
          />
        );
      case "spacer":
        return (
          <SpacerSection
            section={section}
            onUpdate={onUpdate}
            onRemove={onRemove}
            isDragging={isDragging}
            dragHandleProps={{ ...listeners, ...attributes }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      {renderSection()}
    </div>
  );
}

export function A4DocumentPreview({
  title,
  description,
  layout,
  allTiles,
  onUpdateLayout,
  onUpdateTitle,
  onUpdateDescription,
}: A4DocumentPreviewProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description || "");
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = layout.sections.findIndex((s) => s.id === active.id);
      const newIndex = layout.sections.findIndex((s) => s.id === over.id);

      const reorderedSections = reorderSections(
        layout.sections,
        oldIndex,
        newIndex,
      );

      onUpdateLayout({
        ...layout,
        sections: reorderedSections,
        lastModified: new Date().toISOString(),
      });
    }
  };

  const handleAddSection = (type: "heading" | "text" | "spacer") => {
    const newSection: DocumentSection = {
      id: `section-${Date.now()}`,
      type,
      order: layout.sections.length,
      ...(type === "heading" && { text: "New Heading", level: 2 as 1 | 2 | 3 }),
      ...(type === "text" && { text: "" }),
      ...(type === "spacer" && { height: 10 }),
      width: "full",
    };

    onUpdateLayout({
      ...layout,
      sections: [...layout.sections, newSection],
      lastModified: new Date().toISOString(),
    });
  };

  const handleUpdateSection = (
    sectionId: string,
    updates: Partial<DocumentSection>,
  ) => {
    const updatedSections = layout.sections.map((section) =>
      section.id === sectionId ? { ...section, ...updates } : section,
    );

    onUpdateLayout({
      ...layout,
      sections: updatedSections,
      lastModified: new Date().toISOString(),
    });
  };

  const handleRemoveSection = (sectionId: string) => {
    const updatedSections = layout.sections
      .filter((section) => section.id !== sectionId)
      .map((section, index) => ({ ...section, order: index }));

    onUpdateLayout({
      ...layout,
      sections: updatedSections,
      lastModified: new Date().toISOString(),
    });
  };

  const sortedSections = [...layout.sections].sort((a, b) => a.order - b.order);

  const handleTitleSave = () => {
    const trimmedTitle = editTitle.trim();
    if (trimmedTitle.length >= 2 && trimmedTitle !== title) {
      onUpdateTitle(trimmedTitle);
    } else if (trimmedTitle.length < 2) {
      setEditTitle(title);
    }
    setIsEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (editDescription !== description) {
      onUpdateDescription(editDescription);
    }
    setIsEditingDescription(false);
  };

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-gray-700">
            A4 Document Preview
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {sortedSections.length}{" "}
            {sortedSections.length === 1 ? "section" : "sections"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-3 h-3 mr-1" />
              Add Section
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleAddSection("heading")}>
              <FileText className="w-4 h-4 mr-2" />
              Heading
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddSection("text")}>
              <FileText className="w-4 h-4 mr-2" />
              Text Block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddSection("spacer")}>
              <FileText className="w-4 h-4 mr-2" />
              Spacer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* A4 Page Container */}
      <ScrollArea className="flex-1 p-6">
        <div className="mx-auto" style={{ width: A4_DIMENSIONS_PX.width }}>
          {/* A4 Page */}
          <div
            className="bg-white shadow-2xl rounded-sm overflow-hidden"
            style={{
              width: A4_DIMENSIONS_PX.width,
              minHeight: A4_DIMENSIONS_PX.height,
            }}
          >
            {/* Page Content Area with margins */}
            <div
              style={{
                paddingTop: A4_DIMENSIONS_PX.margins.top,
                paddingRight: A4_DIMENSIONS_PX.margins.right,
                paddingBottom: A4_DIMENSIONS_PX.margins.bottom,
                paddingLeft: A4_DIMENSIONS_PX.margins.left,
                minHeight: A4_DIMENSIONS_PX.height,
              }}
            >
              {/* Document Title */}
              <div className="mb-6">
                {isEditingTitle ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTitleSave();
                      if (e.key === "Escape") {
                        setEditTitle(title);
                        setIsEditingTitle(false);
                      }
                    }}
                    placeholder="Document Title"
                    className="text-3xl font-bold border-none shadow-none p-0 focus-visible:ring-0"
                    autoFocus
                  />
                ) : (
                  <h1
                    className="text-3xl font-bold text-gray-900 cursor-text hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {editTitle || "Untitled Document"}
                  </h1>
                )}
              </div>

              {/* Document Description */}
              <div className="mb-8">
                {isEditingDescription ? (
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    onBlur={handleDescriptionSave}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setEditDescription(description || "");
                        setIsEditingDescription(false);
                      }
                    }}
                    placeholder="Add a description..."
                    className="text-sm border-none shadow-none p-0 focus-visible:ring-0 resize-none"
                    rows={2}
                    autoFocus
                  />
                ) : (
                  <p
                    className="text-sm text-gray-600 cursor-text hover:bg-gray-50 px-2 py-1 rounded transition-colors min-h-[40px]"
                    onClick={() => setIsEditingDescription(true)}
                  >
                    {editDescription || "Click to add a description"}
                  </p>
                )}
              </div>

              {/* Divider */}
              {sortedSections.length > 0 && <div className="border-b mb-6" />}

              {/* Sections */}
              {sortedSections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="font-medium text-gray-700 mb-1">
                    Empty document
                  </h4>
                  <p className="text-sm text-gray-500 max-w-[300px] mb-4">
                    Add connected tiles from the left panel or create new
                    sections
                  </p>
                  <Button size="sm" onClick={() => handleAddSection("heading")}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add Your First Section
                  </Button>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sortedSections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {sortedSections.map((section) => (
                      <SortableSection
                        key={section.id}
                        section={section}
                        allTiles={allTiles}
                        onUpdate={(updates) =>
                          handleUpdateSection(section.id, updates)
                        }
                        onRemove={() => handleRemoveSection(section.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* Page dimensions indicator */}
          <div className="text-center text-xs text-gray-400 mt-4 mb-8">
            A4 Format: 210mm × 297mm ({A4_DIMENSIONS_PX.width}px ×{" "}
            {A4_DIMENSIONS_PX.height}px)
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
