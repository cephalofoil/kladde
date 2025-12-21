"use client";

import React, { useState, useEffect } from "react";
import type { TileData, Connection, DocumentLayout } from "@/types/canvas";
import { Button } from "@/components/ui/button";
import { X, Download, Loader2 } from "lucide-react";
import { ConnectedTilesPicker } from "./document-editor/connected-tiles-picker";
import { A4DocumentPreview } from "./document-editor/a4-document-preview";
import {
  createDefaultDocumentLayout,
  createTileContentSection,
} from "@/lib/document-helpers";
import {
  exportDocumentAsPDF,
  generateDocumentFilename,
} from "@/lib/document-export.tsx";
import { toast } from "sonner";

interface DocumentEditorPanelProps {
  isOpen: boolean;
  tileId: string;
  title: string;
  description?: string;
  layout?: DocumentLayout;
  linkedTileIds?: string[];
  allTiles: TileData[];
  connections: Connection[];
  onClose: () => void;
  onUpdate: (updates: {
    title?: string;
    description?: string;
    layout?: DocumentLayout;
    linkedTileIds?: string[];
  }) => void;
}

export function DocumentEditorPanel({
  isOpen,
  tileId,
  title: initialTitle,
  description: initialDescription,
  layout: initialLayout,
  linkedTileIds: initialLinkedTileIds,
  allTiles,
  connections,
  onClose,
  onUpdate,
}: DocumentEditorPanelProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Initialize layout if not provided
  const [layout, setLayout] = useState<DocumentLayout>(
    initialLayout || createDefaultDocumentLayout(),
  );

  const [linkedTileIds, setLinkedTileIds] = useState<string[]>(
    initialLinkedTileIds || [],
  );

  // Animation effect
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 50);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialLayout) {
      setLayout(initialLayout);
    }
  }, [initialLayout]);

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleLayoutUpdate = (newLayout: DocumentLayout) => {
    setLayout(newLayout);
    onUpdate({ layout: newLayout });
  };

  const handleTitleUpdate = (title: string) => {
    onUpdate({ title });
  };

  const handleDescriptionUpdate = (description: string) => {
    onUpdate({ description });
  };

  const handleAddTileSection = (tile: TileData) => {
    const newSection = createTileContentSection(tile, layout.sections.length);
    const updatedLayout = {
      ...layout,
      sections: [...layout.sections, newSection],
      lastModified: new Date().toISOString(),
    };

    // Add to linked tiles if not already linked
    const updatedLinkedTileIds = linkedTileIds.includes(tile.id)
      ? linkedTileIds
      : [...linkedTileIds, tile.id];

    setLayout(updatedLayout);
    setLinkedTileIds(updatedLinkedTileIds);
    onUpdate({
      layout: updatedLayout,
      linkedTileIds: updatedLinkedTileIds,
    });

    toast.success(`Added "${tile.title || "Untitled"}" to document`);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const filename = generateDocumentFilename(initialTitle);
      await exportDocumentAsPDF(
        initialTitle,
        initialDescription,
        layout,
        filename,
      );
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to export PDF",
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/20 flex items-start justify-end"
      onClick={handleClose}
    >
      <div
        className="w-[90%] h-full bg-white shadow-2xl overflow-hidden transform transition-transform duration-300 ease-in-out flex flex-col"
        style={{
          transform: isAnimating ? "translateX(100%)" : "translateX(0%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimal header with close and export buttons */}
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b bg-gray-50">
          <Button
            variant="default"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-1" />
                Export PDF
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left column: Connected Tiles Picker */}
          <div className="w-[35%] border-r bg-gray-50">
            <ConnectedTilesPicker
              documentTileId={tileId}
              allTiles={allTiles}
              connections={connections}
              onAddTileSection={handleAddTileSection}
            />
          </div>

          {/* Right column: A4 Document Preview */}
          <div className="flex-1">
            <A4DocumentPreview
              title={initialTitle}
              description={initialDescription}
              layout={layout}
              allTiles={allTiles}
              onUpdateLayout={handleLayoutUpdate}
              onUpdateTitle={handleTitleUpdate}
              onUpdateDescription={handleDescriptionUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
