import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
  Font,
} from "@react-pdf/renderer";
import type {
  DocumentContent,
  DocumentSection,
  BoardElement,
  TileContentSection,
  FrameImageSection,
  HeadingSection,
  TextSection,
  SpacerSection,
  TileContent,
} from "./board-types";
import {
  renderFrameImageDataUrl,
  type FrameImageResult,
} from "./frame-image";
import { getMermaidConfig } from "./mermaid-config";

// A4 dimensions in points (72 points per inch)
const MM_TO_POINTS = 2.835;
const PX_TO_POINTS = 72 / 96;
const MERMAID_UI_MAX_HEIGHT_PX = 180;
const MERMAID_UI_MAX_HEIGHT_PT = MERMAID_UI_MAX_HEIGHT_PX * PX_TO_POINTS;
const CONTENT_WIDTH_PX = 794 - (2 * 94);
const CONTENT_WIDTH_PT = CONTENT_WIDTH_PX * PX_TO_POINTS;
const TILE_CONTENT_PADDING_PT = 46;
const TILE_CONTENT_WIDTH_PT = CONTENT_WIDTH_PT - TILE_CONTENT_PADDING_PT;
const MERMAID_SCALE_MIN = 0.5;
const MERMAID_SCALE_MAX = 2;

const clampMermaidScale = (value: number) =>
  Math.min(MERMAID_SCALE_MAX, Math.max(MERMAID_SCALE_MIN, value));

let pdfFontsRegistered = false;

const getFontUrl = (path: string) => {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
};

const ensurePdfFonts = () => {
  if (pdfFontsRegistered) return;
  Font.register({
    family: "Switzer",
    fonts: [
      { src: getFontUrl("/fonts/switzer/Switzer-Regular.ttf"), fontWeight: 400 },
      { src: getFontUrl("/fonts/switzer/Switzer-Medium.ttf"), fontWeight: 500 },
      { src: getFontUrl("/fonts/switzer/Switzer-Semibold.ttf"), fontWeight: 600 },
      {
        src: getFontUrl("/fonts/switzer/Switzer-Italic.ttf"),
        fontStyle: "italic",
        fontWeight: 400,
      },
    ],
  });
  Font.register({
    family: "Outfit",
    fonts: [
      { src: getFontUrl("/fonts/outfit/Outfit-Regular.ttf") },
      { src: getFontUrl("/fonts/outfit/Outfit-SemiBold.ttf"), fontWeight: 600 },
      { src: getFontUrl("/fonts/outfit/Outfit-Bold.ttf"), fontWeight: 700 },
    ],
  });
  pdfFontsRegistered = true;
};

// Styles for the PDF document

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    paddingTop: 25 * MM_TO_POINTS,
    paddingBottom: 25 * MM_TO_POINTS,
    paddingLeft: 25 * MM_TO_POINTS,
    paddingRight: 25 * MM_TO_POINTS,
    fontFamily: "Switzer",
    color: "#0f172a",
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 4,
    color: "#0f172a",
    fontFamily: "Outfit",
  },
  description: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 18,
    lineHeight: 1.5,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginBottom: 18,
  },
  section: {
    marginBottom: 12,
  },
  heading1: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 8,
    marginTop: 16,
    color: "#0f172a",
    fontFamily: "Outfit",
  },
  heading2: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 6,
    marginTop: 12,
    color: "#1f2937",
    fontFamily: "Outfit",
  },
  heading3: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4,
    marginTop: 8,
    color: "#334155",
    fontFamily: "Outfit",
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#334155",
  },
  textBold: {
    fontWeight: "bold",
  },
  textItalic: {
    fontStyle: "italic",
  },
  listItem: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#334155",
    marginLeft: 12,
    marginBottom: 2,
  },
  tileContainer: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    padding: 10,
    paddingLeft: 14,
    position: "relative",
  },
  tileAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  tileIconContainer: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  tileIcon: {
    width: 10,
    height: 10,
  },
  tileIconText: {
    fontSize: 6.5,
    fontWeight: 700,
    color: "#ffffff",
    textAlign: "center",
    fontFamily: "Outfit",
  },
  tileTitleBlock: {
    flexDirection: "column",
    flexGrow: 1,
  },
  tileTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#0f172a",
    fontFamily: "Outfit",
  },
  tileTypeLabel: {
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  tileBody: {
    marginLeft: 22,
  },
  tileContent: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#334155",
  },
  codeBlock: {
    backgroundColor: "#0f172a",
    padding: 10,
    borderRadius: 6,
    marginVertical: 6,
  },
  codeText: {
    fontFamily: "Courier",
    fontSize: 9,
    lineHeight: 1.4,
    color: "#e5e7eb",
  },
  codeLanguage: {
    fontSize: 8,
    color: "#9ca3af",
    marginTop: 4,
  },
  noteBlock: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginVertical: 6,
  },
  imageContainer: {
    alignItems: "center",
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 6,
    backgroundColor: "#ffffff",
  },
  frameImageContainer: {
    alignItems: "center",
    marginVertical: 8,
  },
  diagramImage: {
    maxWidth: "100%",
    maxHeight: 300,
    objectFit: "contain",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 25 * MM_TO_POINTS,
    right: 25 * MM_TO_POINTS,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
});

// Badge colors for tile types
const tileBadgeColors: Record<string, string> = {
  "tile-text": "#2563eb",
  "tile-note": "#d97706",
  "tile-code": "#0f766e",
  "tile-mermaid": "#7c3aed",
  "tile-image": "#db2777",
  frame: "#059669",
};

const tileTypeLabels: Record<string, string> = {
  "tile-text": "Text Tile",
  "tile-note": "Note Tile",
  "tile-code": "Code Tile",
  "tile-mermaid": "Diagram Tile",
  "tile-image": "Image Tile",
  frame: "Frame",
};

const getFrameStyleLabel = (style?: string) => {
  switch (style) {
    case "cutting-mat":
      return "Cutting Mat";
    case "notebook":
      return "Notebook";
    case "minimal":
    default:
      return "Minimal";
  }
};

const tileIconLabels: Record<string, string> = {
  "tile-text": "T",
  "tile-note": "N",
  "tile-code": "</>",
  "tile-mermaid": "M",
  "tile-image": "IMG",
  frame: "F",
};
// Parse markdown text into structured content for PDF rendering
interface ParsedLine {
  type: "heading1" | "heading2" | "heading3" | "list" | "paragraph";
  content: string;
}

function parseMarkdownForPdf(text: string): ParsedLine[] {
  if (!text) return [];

  const lines = text.split("\n");
  const result: ParsedLine[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Strip inline markdown (bold, italic, etc.) for PDF
    let cleanLine = line
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      .replace(/~~(.+?)~~/g, "$1")
      .replace(/`(.+?)`/g, "$1");

    if (line.match(/^### /)) {
      result.push({ type: "heading3", content: cleanLine.replace(/^### /, "") });
    } else if (line.match(/^## /)) {
      result.push({ type: "heading2", content: cleanLine.replace(/^## /, "") });
    } else if (line.match(/^# /)) {
      result.push({ type: "heading1", content: cleanLine.replace(/^# /, "") });
    } else if (line.match(/^[-*] /)) {
      const withoutMarker = cleanLine.replace(/^[-*] /, "");
      const normalized = withoutMarker.trimStart();
      result.push({
        type: "list",
        content: normalized.startsWith("• ") ? withoutMarker : "• " + withoutMarker,
      });
    } else if (line.match(/^\d+\. /)) {
      result.push({ type: "list", content: cleanLine });
    } else {
      result.push({ type: "paragraph", content: cleanLine });
    }
  }

  return result;
}

// Render parsed markdown content
function RenderMarkdownContent({ text }: { text: string }) {
  const parsed = parseMarkdownForPdf(text);

  return (
    <View>
      {parsed.map((line, index) => {
        switch (line.type) {
          case "heading1":
            return <Text key={index} style={styles.heading1}>{line.content}</Text>;
          case "heading2":
            return <Text key={index} style={styles.heading2}>{line.content}</Text>;
          case "heading3":
            return <Text key={index} style={styles.heading3}>{line.content}</Text>;
          case "list":
            return <Text key={index} style={styles.listItem}>{line.content}</Text>;
          case "paragraph":
          default:
            return <Text key={index} style={styles.text}>{line.content}</Text>;
        }
      })}
    </View>
  );
}

interface PreRenderedContent {
  [tileId: string]: {
    mermaidDataUrl?: string;
    mermaidWidth?: number;
    mermaidHeight?: number;
  };
}

interface PreRenderedFrameImages {
  [sectionId: string]: FrameImageResult;
}

interface DocumentPdfProps {
  documentContent: DocumentContent;
  allElements: BoardElement[];
  preRenderedContent: PreRenderedContent;
  preRenderedFrames: PreRenderedFrameImages;
}

function getTileData(
  section: TileContentSection,
  allElements: BoardElement[]
): { type: string; title: string; content: TileContent | undefined } | null {
  const tile = allElements.find((el) => el.id === section.tileId);
  const tileType = tile?.tileType || section.cachedTileType;
  const tileTitle = tile?.tileTitle || section.cachedTileTitle || "Untitled";
  const tileContent = tile?.tileContent || section.cachedContent;

  if (!tileType) return null;

  return { type: tileType, title: tileTitle, content: tileContent };
}

function RenderTileContent({
  section,
  allElements,
  preRenderedContent,
}: {
  section: TileContentSection;
  allElements: BoardElement[];
  preRenderedContent: PreRenderedContent;
}) {
  const tileData = getTileData(section, allElements);
  if (!tileData || !tileData.content) return null;

  const badgeColor = tileBadgeColors[tileData.type] || "#6b7280";
  const iconLabel = tileIconLabels[tileData.type] || "";
  const { type, title, content } = tileData;

  return (
    <View style={styles.tileContainer}>
      <View style={[styles.tileAccent, { backgroundColor: badgeColor }]} />
      <View style={styles.tileHeader}>
        <View style={[styles.tileIconContainer, { backgroundColor: badgeColor }]}>
          <Text style={styles.tileIconText}>{iconLabel}</Text>
        </View>
        <View style={styles.tileTitleBlock}>
          <Text style={styles.tileTitle}>{title}</Text>
          <Text style={[styles.tileTypeLabel, { color: badgeColor }]}>
            {tileTypeLabels[type] || "Tile"}
          </Text>
        </View>
      </View>
      <View style={styles.tileBody}>
        {type === "tile-text" && content.richText && (
          <RenderMarkdownContent text={content.richText} />
        )}

        {type === "tile-note" && content.noteText && (
          <View style={styles.noteBlock}>
            <RenderMarkdownContent text={content.noteText} />
          </View>
        )}

        {type === "tile-code" && content.code && (
          <View style={styles.codeBlock}>
            <Text style={styles.codeText}>{content.code}</Text>
            {content.language && (
              <Text style={styles.codeLanguage}>{content.language}</Text>
            )}
          </View>
        )}

        {type === "tile-mermaid" && preRenderedContent[section.tileId]?.mermaidDataUrl && (() => {
          const originalWidth = preRenderedContent[section.tileId].mermaidWidth || 400;
          const originalHeight = preRenderedContent[section.tileId].mermaidHeight || 300;
          const userScale = clampMermaidScale(section.mermaidScale ?? 1);
        const maxWidth = TILE_CONTENT_WIDTH_PT;
          const maxHeight = MERMAID_UI_MAX_HEIGHT_PT * userScale;
          const widthScale = maxWidth / originalWidth;
          const heightScale = maxHeight / originalHeight;
          const scale = Math.min(widthScale, heightScale);
          const displayWidth = originalWidth * scale;
          const displayHeight = originalHeight * scale;

          return (
            <View style={styles.imageContainer}>
              <Image
                src={preRenderedContent[section.tileId].mermaidDataUrl}
                style={{
                  width: displayWidth,
                  height: displayHeight,
                }}
              />
            </View>
          );
        })()}

        {type === "tile-image" && content.imageSrc && (
          <View style={styles.imageContainer}>
            <Image style={styles.diagramImage} src={content.imageSrc} />
          </View>
        )}
      </View>
    </View>
  );
}

function RenderSection({
  section,
  allElements,
  preRenderedContent,
  preRenderedFrames,
}: {
  section: DocumentSection;
  allElements: BoardElement[];
  preRenderedContent: PreRenderedContent;
  preRenderedFrames: PreRenderedFrameImages;
}) {
  switch (section.type) {
    case "heading": {
      const headingSection = section as HeadingSection;
      const style =
        headingSection.level === 1
          ? styles.heading1
          : headingSection.level === 2
            ? styles.heading2
            : styles.heading3;
      return <Text style={style}>{headingSection.text}</Text>;
    }

    case "text": {
      const textSection = section as TextSection;
      return <Text style={styles.text}>{textSection.content}</Text>;
    }

    case "spacer": {
      const spacerSection = section as SpacerSection;
      return <View style={{ height: spacerSection.height * MM_TO_POINTS }} />;
    }

    case "tile-content": {
      return (
        <RenderTileContent
          section={section as TileContentSection}
          allElements={allElements}
          preRenderedContent={preRenderedContent}
        />
      );
    }

    case "frame-image": {
      const frameSection = section as FrameImageSection;
      const frameImage = preRenderedFrames[frameSection.id];
      const badgeColor = tileBadgeColors.frame;
      const iconLabel = tileIconLabels.frame;
      const frameTitle = frameSection.cachedFrameLabel || "Frame";
      const frameStyleLabel = getFrameStyleLabel(frameSection.cachedFrameStyle);
      if (!frameImage) {
        return (
          <View style={styles.tileContainer}>
            <View style={[styles.tileAccent, { backgroundColor: badgeColor }]} />
            <View style={styles.tileHeader}>
              <View style={[styles.tileIconContainer, { backgroundColor: badgeColor }]}>
                <Text style={styles.tileIconText}>{iconLabel}</Text>
              </View>
              <View style={styles.tileTitleBlock}>
                <Text style={styles.tileTitle}>{frameTitle}</Text>
                <Text style={[styles.tileTypeLabel, { color: badgeColor }]}>
                  {tileTypeLabels.frame}
                </Text>
              </View>
            </View>
            <View style={styles.tileBody}>
              <Text style={styles.text}>Frame image unavailable.</Text>
            </View>
          </View>
        );
      }
        const maxWidth = TILE_CONTENT_WIDTH_PT;
      const widthScale =
        frameImage.sourceWidth > 0
          ? maxWidth / frameImage.sourceWidth
          : 1;
      const scale = Math.min(1, widthScale);
      const displayWidth = frameImage.sourceWidth * scale;
      const displayHeight = frameImage.sourceHeight * scale;

      return (
        <View style={styles.tileContainer}>
          <View style={[styles.tileAccent, { backgroundColor: badgeColor }]} />
          <View style={styles.tileHeader}>
            <View style={[styles.tileIconContainer, { backgroundColor: badgeColor }]}>
              <Text style={styles.tileIconText}>{iconLabel}</Text>
            </View>
            <View style={styles.tileTitleBlock}>
              <Text style={styles.tileTitle}>{frameTitle}</Text>
              <Text style={[styles.tileTypeLabel, { color: badgeColor }]}>
                {tileTypeLabels.frame}
              </Text>
            </View>
            <Text style={[styles.tileTypeLabel, { color: "#64748b" }]}>•</Text>
            <Text style={[styles.tileTypeLabel, { color: "#64748b" }]}>
              {frameStyleLabel}
            </Text>
          </View>
          <View style={styles.tileBody}>
            <View style={styles.frameImageContainer}>
              <Image
                src={frameImage.dataUrl}
                style={{ width: displayWidth, height: displayHeight }}
              />
            </View>
          </View>
        </View>
      );
    }

    default:
      return null;
  }
}

function DocumentPdf({
  documentContent,
  allElements,
  preRenderedContent,
  preRenderedFrames,
}: DocumentPdfProps) {
  const timestamp = new Date().toLocaleString();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>{documentContent.title}</Text>

        {/* Description */}
        {documentContent.description && (
          <Text style={styles.description}>{documentContent.description}</Text>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Sections */}
        {documentContent.layout.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <RenderSection
              section={section}
              allElements={allElements}
              preRenderedContent={preRenderedContent}
              preRenderedFrames={preRenderedFrames}
            />
          </View>
        ))}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated on {timestamp} • Created with Kladde
        </Text>
      </Page>
    </Document>
  );
}

// Render Mermaid diagram to PNG data URL
interface MermaidRenderResult {
  dataUrl: string;
  width: number;
  height: number;
}

async function renderMermaidToDataUrl(chart: string): Promise<MermaidRenderResult | null> {
  try {
    const mermaid = (await import("mermaid")).default;

    mermaid.initialize(getMermaidConfig({ forExport: true }));

    const id = `mermaid-export-${Math.random().toString(36).slice(2, 11)}`;
    const { svg } = await mermaid.render(id, chart);

    // Parse SVG to get actual viewBox dimensions
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");

    let svgWidth = 400;
    let svgHeight = 300;

    if (svgElement) {
      // Try to get dimensions from viewBox first
      const viewBox = svgElement.getAttribute("viewBox");
      if (viewBox) {
        const parts = viewBox.split(" ").map(Number);
        if (parts.length === 4) {
          svgWidth = parts[2];
          svgHeight = parts[3];
        }
      } else {
        // Fall back to width/height attributes
        const widthAttr = svgElement.getAttribute("width");
        const heightAttr = svgElement.getAttribute("height");
        if (widthAttr) svgWidth = parseFloat(widthAttr) || 400;
        if (heightAttr) svgHeight = parseFloat(heightAttr) || 300;
      }

      // Ensure SVG has explicit width and height for proper rendering
      svgElement.setAttribute("width", String(svgWidth));
      svgElement.setAttribute("height", String(svgHeight));
    }

    const fixedSvg = svgElement ? new XMLSerializer().serializeToString(svgElement) : svg;

    // Convert SVG to PNG using canvas
    return new Promise((resolve) => {
      const img = new window.Image();
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fixedSvg)}`;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Render at 2x scale for high quality
        const scale = 2;
        canvas.width = svgWidth * scale;
        canvas.height = svgHeight * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
          try {
            const dataUrl = canvas.toDataURL("image/png");
            resolve({
              dataUrl,
              width: svgWidth,
              height: svgHeight,
            });
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };

      img.onerror = () => {
        resolve(null);
      };

      img.src = svgDataUrl;
    });
  } catch (error) {
    console.error("Failed to render Mermaid diagram:", error);
    return null;
  }
}

export async function exportDocumentToPdf(
  documentContent: DocumentContent,
  allElements: BoardElement[]
): Promise<void> {
  try {
    ensurePdfFonts();
    // Pre-render all Mermaid diagrams
    const preRenderedContent: PreRenderedContent = {};
    const preRenderedFrames: PreRenderedFrameImages = {};

    for (const section of documentContent.layout.sections) {
      if (section.type === "tile-content") {
        const tileSection = section as TileContentSection;
        const tile = allElements.find((el) => el.id === tileSection.tileId);
        const tileContent = tile?.tileContent || tileSection.cachedContent;
        const tileType = tile?.tileType || tileSection.cachedTileType;

        if (tileType === "tile-mermaid" && tileContent?.chart) {
          const result = await renderMermaidToDataUrl(tileContent.chart);
          if (result) {
            preRenderedContent[tileSection.tileId] = {
              mermaidDataUrl: result.dataUrl,
              mermaidWidth: result.width,
              mermaidHeight: result.height,
            };
          }
        }
      }
      if (section.type === "frame-image") {
        const frameSection = section as FrameImageSection;
        const result = renderFrameImageDataUrl({
          frameId: frameSection.frameId,
          elements: allElements,
          scale: 2,
        });
        if (result) {
          preRenderedFrames[frameSection.id] = result;
        }
      }
    }

    const blob = await pdf(
      <DocumentPdf
        documentContent={documentContent}
        allElements={allElements}
        preRenderedContent={preRenderedContent}
        preRenderedFrames={preRenderedFrames}
      />
    ).toBlob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `${documentContent.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}.pdf`;
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to export PDF:", error);
    throw error;
  }
}
