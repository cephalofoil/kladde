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
  tileBadge: {
    fontSize: 8,
    color: "#ffffff",
    backgroundColor: "#6b7280",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    marginRight: 6,
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
  const { type, title, content } = tileData;

  return (
    <View style={styles.tileContainer}>
      <View style={styles.tileHeader}>
        <Text style={[styles.tileBadge, { backgroundColor: badgeColor }]}>
          {type.replace("tile-", "").toUpperCase()}
        </Text>
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

      {type === "tile-mermaid" && preRenderedContent[section.tileId]?.mermaidDataUrl && (
        <View style={styles.imageContainer}>
          <Image
            style={styles.diagramImage}
            src={preRenderedContent[section.tileId].mermaidDataUrl}
          />
        </View>
      )}

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
async function renderMermaidToDataUrl(chart: string): Promise<string | null> {
  try {
    const mermaid = (await import("mermaid")).default;

    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
    });

    const id = `mermaid-export-${Math.random().toString(36).slice(2, 11)}`;
    const { svg } = await mermaid.render(id, chart);

    // Convert SVG to PNG using canvas
    return new Promise((resolve) => {
      const img = new window.Image();
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Use higher resolution for better quality
        const scale = 2;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } else {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
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
          const dataUrl = await renderMermaidToDataUrl(tileContent.chart);
          if (dataUrl) {
            preRenderedContent[tileSection.tileId] = { mermaidDataUrl: dataUrl };
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
