"use client";

import { useCallback, useState } from "react";
import { X, FileText, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  BoardElement,
  DocumentContent,
  DocumentSection,
} from "@/lib/board-types";
import { TilesPicker } from "./tiles-picker";
import { A4DocumentPreview } from "./a4-document-preview";
import {
  createHeadingSection,
  createTextSection,
  createSpacerSection,
  createTileContentSection,
  removeSection,
  updateSection,
  moveSection,
} from "@/lib/tile-utils";

interface DocumentEditorPanelProps {
  documentElement: BoardElement;
  allElements: BoardElement[];
  onClose: () => void;
  onUpdateDocument: (updates: Partial<BoardElement>) => void;
}

export function DocumentEditorPanel({
  documentElement,
  allElements,
  onClose,
  onUpdateDocument,
}: DocumentEditorPanelProps) {
  const [isExporting, setIsExporting] = useState(false);

  const documentContent: DocumentContent = documentElement.tileContent
    ?.documentContent || {
    title: "Untitled Document",
    description: "",
    layout: {
      pageFormat: "A4",
      orientation: "portrait",
      margins: { top: 25, right: 25, bottom: 25, left: 25 },
      sections: [],
    },
    metadata: {
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    },
  };

  const updateDocumentContent = useCallback(
    (updates: Partial<DocumentContent>) => {
      const newContent: DocumentContent = {
        ...documentContent,
        ...updates,
        metadata: {
          ...documentContent.metadata,
          modifiedAt: Date.now(),
        },
      };
      onUpdateDocument({
        tileContent: {
          ...documentElement.tileContent,
          documentContent: newContent,
        },
      });
    },
    [documentContent, documentElement.tileContent, onUpdateDocument]
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      updateDocumentContent({ title });
      onUpdateDocument({ tileTitle: title });
    },
    [updateDocumentContent, onUpdateDocument]
  );

  const handleDescriptionChange = useCallback(
    (description: string) => {
      updateDocumentContent({ description });
    },
    [updateDocumentContent]
  );

  const handleAddTileToDocument = useCallback(
    (tile: BoardElement) => {
      const newSection = createTileContentSection(
        tile.id,
        tile.tileType,
        tile.tileTitle,
        tile.tileContent
      );
      const newSections = [...documentContent.layout.sections, newSection];
      updateDocumentContent({
        layout: { ...documentContent.layout, sections: newSections },
      });
    },
    [documentContent, updateDocumentContent]
  );

  const handleAddSection = useCallback(
    (type: "heading" | "text" | "spacer") => {
      let newSection: DocumentSection;
      switch (type) {
        case "heading":
          newSection = createHeadingSection(2, "");
          break;
        case "text":
          newSection = createTextSection("");
          break;
        case "spacer":
          newSection = createSpacerSection(10);
          break;
      }
      const newSections = [...documentContent.layout.sections, newSection];
      updateDocumentContent({
        layout: { ...documentContent.layout, sections: newSections },
      });
    },
    [documentContent, updateDocumentContent]
  );

  const handleRemoveSection = useCallback(
    (sectionId: string) => {
      const newSections = removeSection(
        documentContent.layout.sections,
        sectionId
      );
      updateDocumentContent({
        layout: { ...documentContent.layout, sections: newSections },
      });
    },
    [documentContent, updateDocumentContent]
  );

  const handleUpdateSection = useCallback(
    (sectionId: string, updates: Partial<DocumentSection>) => {
      const newSections = updateSection(
        documentContent.layout.sections,
        sectionId,
        updates
      );
      updateDocumentContent({
        layout: { ...documentContent.layout, sections: newSections },
      });
    },
    [documentContent, updateDocumentContent]
  );

  const handleMoveSection = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newSections = moveSection(
        documentContent.layout.sections,
        fromIndex,
        toIndex
      );
      updateDocumentContent({
        layout: { ...documentContent.layout, sections: newSections },
      });
    },
    [documentContent, updateDocumentContent]
  );

  const handleExportPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      const { exportDocumentToPdf } = await import("@/lib/document-export");
      await exportDocumentToPdf(documentContent, allElements);
    } catch (error) {
      console.error("Failed to export PDF:", error);
    } finally {
      setIsExporting(false);
    }
  }, [documentContent, allElements]);

  // Filter available tiles (exclude the document itself and other documents)
  const availableTiles = allElements.filter(
    (el) =>
      el.type === "tile" &&
      el.id !== documentElement.id &&
      el.tileType !== "tile-document"
  );

  return (
    <div className="fixed top-0 right-0 h-full w-[1800px] max-w-[95vw] bg-card border-l border-border shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Document Editor</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              "bg-orange-500 hover:bg-orange-600 text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export PDF
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            aria-label="Close document editor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Two-column layout - 1:2 ratio */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Tiles Picker (1/3 width) */}
        <div className="w-1/3 border-r border-border flex-shrink-0 overflow-hidden">
          <TilesPicker
            tiles={availableTiles}
            onAddTile={handleAddTileToDocument}
            documentSections={documentContent.layout.sections}
          />
        </div>

        {/* Right Panel: A4 Document Preview (2/3 width) */}
        <div className="w-2/3 overflow-hidden">
          <A4DocumentPreview
            documentContent={documentContent}
            allElements={allElements}
            onTitleChange={handleTitleChange}
            onDescriptionChange={handleDescriptionChange}
            onAddSection={handleAddSection}
            onRemoveSection={handleRemoveSection}
            onUpdateSection={handleUpdateSection}
            onMoveSection={handleMoveSection}
          />
        </div>
      </div>
    </div>
  );
}
