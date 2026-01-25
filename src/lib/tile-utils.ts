import type {
    TileType,
    DocumentContent,
    DocumentLayout,
    DocumentSection,
    HeadingSection,
    TextSection,
    SpacerSection,
    TileContentSection,
    FrameImageSection,
    FrameStyle,
} from "./board-types";

/**
 * Get minimum tile size based on tile type
 */
export function getMinTileSize(tileType: TileType): {
    width: number;
    height: number;
} {
    switch (tileType) {
        case "tile-text":
            return { width: 500, height: 250 };
        case "tile-note":
            return { width: 200, height: 150 };
        case "tile-code":
            return { width: 600, height: 350 };
        case "tile-mermaid":
            return { width: 600, height: 450 };
        case "tile-image":
            return { width: 200, height: 200 };
        case "tile-document":
            return { width: 200, height: 280 };
        default:
            return { width: 200, height: 150 };
    }
}

/**
 * Get default tile size based on tile type
 */
export function getDefaultTileSize(tileType: TileType): {
    width: number;
    height: number;
} {
    switch (tileType) {
        case "tile-text":
            return { width: 600, height: 250 };
        case "tile-note":
            return { width: 250, height: 200 };
        case "tile-code":
            return { width: 600, height: 400 };
        case "tile-mermaid":
            return { width: 600, height: 450 };
        case "tile-image":
            return { width: 300, height: 300 };
        case "tile-document":
            return { width: 200, height: 280 };
        default:
            return { width: 300, height: 200 };
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
    };
}

/**
 * Create a default document content
 */
export function createDefaultDocumentContent(title?: string): DocumentContent {
    const now = Date.now();
    return {
        title: title || "Untitled Document",
        description: "",
        layout: createDefaultDocumentLayout(),
        metadata: {
            createdAt: now,
            modifiedAt: now,
        },
    };
}

/**
 * Generate a unique section ID
 */
export function generateSectionId(): string {
    return `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a heading section
 */
export function createHeadingSection(
    level: 1 | 2 | 3 = 2,
    text: string = "",
): HeadingSection {
    return {
        id: generateSectionId(),
        type: "heading",
        level,
        text,
    };
}

/**
 * Create a text section
 */
export function createTextSection(content: string = ""): TextSection {
    return {
        id: generateSectionId(),
        type: "text",
        content,
    };
}

/**
 * Create a spacer section
 */
export function createSpacerSection(height: number = 10): SpacerSection {
    return {
        id: generateSectionId(),
        type: "spacer",
        height,
    };
}

/**
 * Create a tile content section
 */
export function createTileContentSection(
    tileId: string,
    cachedTileType?: TileType,
    cachedTileTitle?: string,
    cachedContent?: import("./board-types").TileContent,
): TileContentSection {
    return {
        id: generateSectionId(),
        type: "tile-content",
        tileId,
        cachedTileType,
        cachedTileTitle,
        cachedContent,
    };
}

/**
 * Create a frame image section
 */
export function createFrameImageSection(
    frameId: string,
    cachedFrameLabel?: string,
    cachedFrameStyle?: FrameStyle,
): FrameImageSection {
    return {
        id: generateSectionId(),
        type: "frame-image",
        frameId,
        cachedFrameLabel,
        cachedFrameStyle,
    };
}

/**
 * Move a section within the sections array
 */
export function moveSection(
    sections: DocumentSection[],
    fromIndex: number,
    toIndex: number,
): DocumentSection[] {
    const newSections = [...sections];
    const [removed] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex, 0, removed);
    return newSections;
}

/**
 * Remove a section from the sections array
 */
export function removeSection(
    sections: DocumentSection[],
    sectionId: string,
): DocumentSection[] {
    return sections.filter((s) => s.id !== sectionId);
}

/**
 * Update a section in the sections array
 */
export function updateSection(
    sections: DocumentSection[],
    sectionId: string,
    updates: Partial<DocumentSection>,
): DocumentSection[] {
    return sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates } : s,
    ) as DocumentSection[];
}

/**
 * Get tile type display info
 */
export function getTileTypeInfo(tileType: TileType): {
    label: string;
    icon: string;
    color: string;
} {
    switch (tileType) {
        case "tile-text":
            return { label: "Text", icon: "Type", color: "#3b82f6" };
        case "tile-note":
            return { label: "Note", icon: "StickyNote", color: "#eab308" };
        case "tile-code":
            return { label: "Code", icon: "Code2", color: "#22c55e" };
        case "tile-mermaid":
            return { label: "Diagram", icon: "GitBranch", color: "#a855f7" };
        case "tile-image":
            return { label: "Image", icon: "Image", color: "#ec4899" };
        case "tile-document":
            return { label: "Document", icon: "FileText", color: "#f97316" };
        default:
            return { label: "Tile", icon: "Square", color: "#6b7280" };
    }
}
