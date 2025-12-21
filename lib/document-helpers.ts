import type { DocumentLayout, DocumentSection, TileData } from "@/types/canvas";
import { generateId } from "./id";

// A4 dimensions in millimeters
export const A4_DIMENSIONS = {
  width: 210, // mm
  height: 297, // mm
  margins: {
    top: 25,
    right: 25,
    bottom: 25,
    left: 25,
  },
};

// A4 dimensions in pixels at 96 DPI
// 1mm = 3.7795275591 pixels at 96 DPI
export const A4_DIMENSIONS_PX = {
  width: 794, // ~210mm
  height: 1123, // ~297mm
  margins: {
    top: 94, // ~25mm
    right: 94,
    bottom: 94,
    left: 94,
  },
};

export const SNAP_GRID = {
  horizontal: 10, // mm
  vertical: 10, // mm
};

/**
 * Snap a position to the grid
 */
export function snapToGrid(position: number, gridSize: number): number {
  return Math.round(position / gridSize) * gridSize;
}

/**
 * Calculate estimated height for a section based on its type and content
 */
export function calculateSectionHeight(
  sectionType: string,
  content: unknown,
): number {
  switch (sectionType) {
    case "heading":
      return 15; // mm
    case "text":
      // Estimate based on content length
      if (typeof content === "string") {
        const lines = Math.ceil(content.length / 80); // ~80 chars per line
        return Math.min(lines * 5 + 10, 60); // 5mm per line, max 60mm
      }
      return 30; // mm default
    case "tile-content":
      return 50; // mm (varies by tile type)
    case "spacer":
      return 10; // mm
    default:
      return 10;
  }
}

/**
 * Create a default document layout
 */
export function createDefaultDocumentLayout(): DocumentLayout {
  return {
    pageFormat: "A4",
    orientation: "portrait",
    margins: {
      top: 25,
      right: 25,
      bottom: 25,
      left: 25,
    },
    sections: [],
    createdDate: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

/**
 * Create a heading section
 */
export function createHeadingSection(
  text: string,
  level: 1 | 2 | 3,
  order: number,
): DocumentSection {
  return {
    id: generateId("section"),
    type: "heading",
    order,
    text,
    level,
    width: "full",
  };
}

/**
 * Create a text section
 */
export function createTextSection(text: string, order: number): DocumentSection {
  return {
    id: generateId("section"),
    type: "text",
    order,
    text,
    width: "full",
  };
}

/**
 * Create a spacer section
 */
export function createSpacerSection(
  order: number,
  height: number = 10,
): DocumentSection {
  return {
    id: generateId("section"),
    type: "spacer",
    order,
    height,
    width: "full",
  };
}

/**
 * Create a tile content section from a connected tile
 */
export function createTileContentSection(
  tile: TileData,
  order: number,
): DocumentSection {
  // Extract content based on tile type
  let content: string | object = "";

  switch (tile.type) {
    case "text":
      content = tile.content.text || "";
      break;
    case "code":
      content = {
        code: tile.content.code || "",
        language: tile.content.language || "javascript",
      };
      break;
    case "mermaid":
      content = {
        chart: tile.content.chart || "",
      };
      break;
    case "note":
      content = tile.content.text || "";
      break;
    default:
      content = JSON.stringify(tile.content);
  }

  return {
    id: generateId("section"),
    type: "tile-content",
    order,
    sourceTileId: tile.id,
    content,
    width: "full",
  };
}

/**
 * Get tile icon emoji based on type
 */
export function getTileIcon(tileType: string): string {
  switch (tileType) {
    case "text":
      return "📝";
    case "code":
      return "💻";
    case "mermaid":
      return "📊";
    case "note":
      return "🗒️";
    case "document":
      return "📄";
    case "bookmark":
      return "🔖";
    case "image":
      return "🖼️";
    default:
      return "📦";
  }
}

/**
 * Get a content preview snippet from a tile
 */
export function getTileContentPreview(tile: TileData, maxLength: number = 100): string {
  let preview = "";

  switch (tile.type) {
    case "text":
      preview = tile.content.text || "";
      break;
    case "code":
      preview = tile.content.code || "";
      break;
    case "note":
      preview = tile.content.text || tile.content.description || "";
      break;
    case "mermaid":
      preview = "Mermaid Diagram";
      break;
    default:
      preview = tile.title || "Content";
  }

  if (preview.length > maxLength) {
    return preview.substring(0, maxLength) + "...";
  }

  return preview;
}

/**
 * Calculate the total height of all sections in mm
 */
export function calculateTotalHeight(sections: DocumentSection[]): number {
  return sections.reduce((total, section) => {
    const height = section.height || calculateSectionHeight(section.type, section.content);
    return total + height;
  }, 0);
}

/**
 * Check if adding a section would overflow the page
 */
export function wouldOverflowPage(
  sections: DocumentSection[],
  newSection: DocumentSection,
  pageFormat: "A4" | "Letter" = "A4",
): boolean {
  const pageHeight = pageFormat === "A4" ? A4_DIMENSIONS.height : 279; // Letter height in mm
  const margins = A4_DIMENSIONS.margins;
  const availableHeight = pageHeight - margins.top - margins.bottom;

  const currentHeight = calculateTotalHeight(sections);
  const newSectionHeight =
    newSection.height || calculateSectionHeight(newSection.type, newSection.content);

  return currentHeight + newSectionHeight > availableHeight;
}

/**
 * Reorder sections based on drag and drop
 */
export function reorderSections(
  sections: DocumentSection[],
  fromIndex: number,
  toIndex: number,
): DocumentSection[] {
  const result = Array.from(sections);
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);

  // Update order numbers
  return result.map((section, index) => ({
    ...section,
    order: index,
  }));
}
