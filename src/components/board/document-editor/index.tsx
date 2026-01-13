"use client";

import { useCallback, useState, useEffect } from "react";
import { ChevronRight, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  BoardElement,
  DocumentContent,
  DocumentSection,
} from "@/lib/board-types";
import { TilesPicker } from "./tiles-picker";
import { FramesPicker } from "./frames-picker";
import { A4DocumentPreview } from "./a4-document-preview";
import {
  createHeadingSection,
  createTextSection,
  createSpacerSection,
  createTileContentSection,
  createFrameImageSection,
  removeSection,
  updateSection,
  moveSection,
} from "@/lib/tile-utils";
import { tileHasContent } from "./tile-card";

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
  const [isAnimating, setIsAnimating] = useState(true);
  const [activePickerTab, setActivePickerTab] = useState<"tiles" | "frames">(
    "tiles"
  );

  // Swipe-in animation on mount
  useEffect(() => {
    // Small delay to trigger the animation
    const timer = setTimeout(() => setIsAnimating(false), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  // Use tileTitle as the source of truth for the document title
  const storedDocContent = documentElement.tileContent?.documentContent;
  const documentContent: DocumentContent = storedDocContent
    ? {
        ...storedDocContent,
        // Always sync title from tileTitle (single source of truth)
        title: documentElement.tileTitle || storedDocContent.title,
      }
    : {
        title: documentElement.tileTitle || "Untitled Document",
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
      // Prevent adding empty tiles
      if (!tileHasContent(tile)) {
        return;
      }
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

  const handleAddFrameToDocument = useCallback(
    (frame: BoardElement) => {
      const newSection = createFrameImageSection(
        frame.id,
        frame.label,
        frame.frameStyle
      );
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
  const availableFrames = allElements.filter((el) => el.type === "frame");

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/20"
      onClick={handleClose}
    >
      <div
        className={cn(
          "absolute top-4 bottom-4 right-4 w-[1400px] max-w-[calc(85vw-2rem)]",
          "bg-card rounded-2xl shadow-2xl flex flex-col overflow-hidden",
          "transform transition-transform duration-300 ease-in-out"
        )}
        style={{
          transform: isAnimating ? "translateX(calc(100% + 1rem))" : "translateX(0)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimal Header - Close on left, Export on right */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
          <button
            onClick={handleClose}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close document editor"
          >
            <ChevronRight className="w-5 h-5" />
            <span className="text-sm">Close</span>
          </button>
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
        </div>

        {/* Two-column layout - 1:2 ratio */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Tiles Picker (1/3 width) */}
          <div className="w-1/3 border-r border-border flex-shrink-0 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
                <span className="text-sm font-medium text-muted-foreground">
                  Available
                </span>
                <div className="grid w-full max-w-[220px] grid-cols-2 overflow-hidden rounded-md border border-border bg-background text-[13px] font-semibold">
                  <button
                    onClick={() => setActivePickerTab("tiles")}
                    className={cn(
                      "px-4 py-1.5 transition-colors border-r border-border",
                      activePickerTab === "tiles"
                        ? "bg-muted/70 text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    Tiles
                  </button>
                  <button
                    onClick={() => setActivePickerTab("frames")}
                    className={cn(
                      "px-4 py-1.5 transition-colors",
                      activePickerTab === "frames"
                        ? "bg-muted/70 text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    Frames
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                {activePickerTab === "tiles" ? (
                  <TilesPicker
                    tiles={availableTiles}
                    onAddTile={handleAddTileToDocument}
                    documentSections={documentContent.layout.sections}
                  />
                ) : (
                  <FramesPicker
                    frames={availableFrames}
                    onAddFrame={handleAddFrameToDocument}
                    documentSections={documentContent.layout.sections}
                  />
                )}
              </div>
            </div>
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
    </div>
  );
}
