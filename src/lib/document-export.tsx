import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type {
  DocumentContent,
  DocumentSection,
  BoardElement,
  TileContentSection,
  HeadingSection,
  TextSection,
  SpacerSection,
  TileContent,
} from "./board-types";

// A4 dimensions in points (72 points per inch)
const MM_TO_POINTS = 2.835;
const PX_TO_POINTS = 72 / 96;
const MERMAID_UI_MAX_HEIGHT_PX = 180;
const MERMAID_UI_MAX_HEIGHT_PT = MERMAID_UI_MAX_HEIGHT_PX * PX_TO_POINTS;
const CONTENT_WIDTH_PX = 794 - (2 * 94);
const CONTENT_WIDTH_PT = CONTENT_WIDTH_PX * PX_TO_POINTS;
const MERMAID_SCALE_MIN = 0.5;
const MERMAID_SCALE_MAX = 2;

const clampMermaidScale = (value: number) =>
  Math.min(MERMAID_SCALE_MAX, Math.max(MERMAID_SCALE_MIN, value));

// Styles for the PDF document
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    paddingTop: 25 * MM_TO_POINTS,
    paddingBottom: 25 * MM_TO_POINTS,
    paddingLeft: 25 * MM_TO_POINTS,
    paddingRight: 25 * MM_TO_POINTS,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#111827",
  },
  description: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 16,
    lineHeight: 1.5,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 16,
  },
  section: {
    marginBottom: 8,
  },
  heading1: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    marginTop: 16,
    color: "#111827",
  },
  heading2: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
    marginTop: 12,
    color: "#1f2937",
  },
  heading3: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4,
    marginTop: 8,
    color: "#374151",
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#374151",
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
    color: "#374151",
    marginLeft: 12,
    marginBottom: 2,
  },
  tileContainer: {
    marginBottom: 8,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  tileIconContainer: {
    width: 12,
    height: 12,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  tileIcon: {
    width: 9,
    height: 9,
  },
  tileTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#4b5563",
  },
  tileContent: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#374151",
  },
  codeBlock: {
    backgroundColor: "#1f2937",
    padding: 10,
    borderRadius: 4,
    marginVertical: 4,
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
    backgroundColor: "#fef3c7",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    paddingLeft: 8,
    paddingVertical: 6,
    marginVertical: 4,
  },
  imageContainer: {
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
  "tile-text": "#3b82f6",
  "tile-note": "#eab308",
  "tile-code": "#22c55e",
  "tile-mermaid": "#a855f7",
  "tile-image": "#ec4899",
};

const tileIconSvgs: Record<string, string> = {
  "tile-text": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <path d="M22 3.5C22 3.78 21.78 4 21.5 4H2.5C2.22 4 2 3.78 2 3.5V2.5C2 2.22 2.22 2 2.5 2H21.5C21.78 2 22 2.22 22 2.5V3.5Z" fill="#ffffff"/>
    <path d="M8 7.5C8 7.22 7.78 7 7.5 7H3C2.72 7 2.5 7.22 2.5 7.5V8.5C2.5 8.78 2.72 9 3 9H7.5C7.78 9 8 8.78 8 8.5V7.5Z" fill="#ffffff"/>
    <path d="M10 11.5C10 11.22 9.78 11 9.5 11H3C2.72 11 2.5 11.22 2.5 11.5V12.5C2.5 12.78 2.72 13 3 13H9.5C9.78 13 10 12.78 10 12.5V11.5Z" fill="#ffffff"/>
    <path d="M8.5 15.5C8.5 15.22 8.28 15 8 15H3C2.72 15 2.5 15.22 2.5 15.5V16.5C2.5 16.78 2.72 17 3 17H8C8.28 17 8.5 16.78 8.5 16.5V15.5Z" fill="#ffffff"/>
    <path d="M22 21.5C22 21.78 21.78 22 21.5 22H2.5C2.22 22 2 21.78 2 21.5V20.5C2 20.22 2.22 20 2.5 20H21.5C21.78 20 22 20.22 22 20.5V21.5Z" fill="#ffffff"/>
    <path d="M15.5 9V16.5C15.5 16.78 15.72 17 16 17H17C17.28 17 17.5 16.78 17.5 16.5V9H15.5Z" fill="#ffffff"/>
    <path d="M12.5 7C12.22 7 12 7.22 12 7.5V8.5C12 8.78 12.22 9 12.5 9H15.5H17.5H20.5C20.78 9 21 8.78 21 8.5V7.5C21 7.22 20.78 7 20.5 7H12.5Z" fill="#ffffff"/>
  </svg>`,
  "tile-note": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/>
    <path d="M15 3v4a2 2 0 0 0 2 2h4"/>
  </svg>`,
  "tile-code": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m18 16 4-4-4-4"/>
    <path d="m6 8-4 4 4 4"/>
    <path d="m14.5 4-5 16"/>
  </svg>`,
  "tile-mermaid": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 16H6C5.44772 16 5 16.4477 5 17V21C5 21.5523 5.44772 22 6 22H10C10.5523 22 11 21.5523 11 21V17C11 16.4477 10.5523 16 10 16Z"/>
    <path d="M7 2H3C2.44772 2 2 2.44772 2 3V7C2 7.55228 2.44772 8 3 8H7C7.55228 8 8 7.55228 8 7V3C8 2.44772 7.55228 2 7 2Z"/>
    <path d="M5 9V11.25C5 11.4489 5.10435 11.6397 5.2901 11.7803C5.47585 11.921 5.72779 12 5.99048 12H13"/>
    <path d="M11 19H17.557C17.6745 19 17.7872 18.921 17.8702 18.7803C17.9533 18.6397 18 18.4489 18 18.25V16"/>
    <path d="M21.4497 10.6213L19.0355 8.20711C18.3689 7.54044 17.288 7.54044 16.6213 8.20711L14.2071 10.6213C13.5404 11.288 13.5404 12.3689 14.2071 13.0355L16.6213 15.4497C17.288 16.1164 18.3689 16.1164 19.0355 15.4497L21.4497 13.0355C22.1164 12.3689 22.1164 11.288 21.4497 10.6213Z"/>
  </svg>`,
  "tile-image": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    <circle cx="9" cy="9" r="2"/>
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>`,
};

const toSvgDataUrl = (svg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const getTileIconDataUrl = (tileType: string) => {
  const svg = tileIconSvgs[tileType];
  return svg ? toSvgDataUrl(svg) : null;
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
      result.push({ type: "list", content: "• " + cleanLine.replace(/^[-*] /, "") });
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

interface DocumentPdfProps {
  documentContent: DocumentContent;
  allElements: BoardElement[];
  preRenderedContent: PreRenderedContent;
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
  const iconDataUrl = getTileIconDataUrl(tileData.type);
  const { type, title, content } = tileData;

  return (
    <View style={styles.tileContainer}>
      <View style={styles.tileHeader}>
        <View style={[styles.tileIconContainer, { backgroundColor: badgeColor }]}>
          {iconDataUrl && <Image src={iconDataUrl} style={styles.tileIcon} />}
        </View>
        <Text style={styles.tileTitle}>{title}</Text>
      </View>

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
        const maxWidth = CONTENT_WIDTH_PT;
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
  );
}

function RenderSection({
  section,
  allElements,
  preRenderedContent,
}: {
  section: DocumentSection;
  allElements: BoardElement[];
  preRenderedContent: PreRenderedContent;
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

    default:
      return null;
  }
}

function DocumentPdf({
  documentContent,
  allElements,
  preRenderedContent,
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

    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      htmlLabels: false,
      flowchart: {
        htmlLabels: false,
      },
    });

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
    // Pre-render all Mermaid diagrams
    const preRenderedContent: PreRenderedContent = {};

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
    }

    const blob = await pdf(
      <DocumentPdf
        documentContent={documentContent}
        allElements={allElements}
        preRenderedContent={preRenderedContent}
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
