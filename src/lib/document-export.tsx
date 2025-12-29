import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Font,
} from "@react-pdf/renderer";
import type {
  DocumentContent,
  DocumentSection,
  BoardElement,
  TileContentSection,
  HeadingSection,
  TextSection,
  SpacerSection,
} from "./board-types";

// A4 dimensions in points (72 points per inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
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
  spacer: {
    // Height is set dynamically
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
    backgroundColor: "#f3f4f6",
    padding: 8,
    borderRadius: 4,
    fontFamily: "Courier",
    fontSize: 9,
    lineHeight: 1.4,
    color: "#1f2937",
  },
  noteBlock: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    paddingLeft: 8,
    paddingVertical: 4,
    marginVertical: 4,
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

interface DocumentPdfProps {
  documentContent: DocumentContent;
  allElements: BoardElement[];
}

function getTileContent(
  section: TileContentSection,
  allElements: BoardElement[]
): { type: string; title: string; content: string } | null {
  const tile = allElements.find((el) => el.id === section.tileId);
  const tileType = tile?.tileType || section.cachedTileType;
  const tileTitle = tile?.tileTitle || section.cachedTileTitle || "Untitled";
  const tileContent = tile?.tileContent || section.cachedContent;

  if (!tileContent) return null;

  let content = "";
  switch (tileType) {
    case "tile-text":
      content = tileContent.richText?.replace(/<[^>]*>/g, "") || "";
      break;
    case "tile-note":
      content = tileContent.noteText || "";
      break;
    case "tile-code":
      content = tileContent.code || "";
      break;
    case "tile-mermaid":
      content = "[Mermaid Diagram]";
      break;
    case "tile-image":
      content = tileContent.imageAlt || "[Image]";
      break;
    default:
      content = "";
  }

  return { type: tileType || "tile-text", title: tileTitle, content };
}

function RenderSection({
  section,
  allElements,
}: {
  section: DocumentSection;
  allElements: BoardElement[];
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
      return (
        <View style={{ height: spacerSection.height * MM_TO_POINTS }} />
      );
    }

    case "tile-content": {
      const tileSection = section as TileContentSection;
      const tileData = getTileContent(tileSection, allElements);
      if (!tileData) return null;

      const badgeColor = tileBadgeColors[tileData.type] || "#6b7280";
      const isCode = tileData.type === "tile-code";
      const isNote = tileData.type === "tile-note";

      return (
        <View style={styles.tileContainer}>
          <View style={styles.tileHeader}>
            <Text style={[styles.tileBadge, { backgroundColor: badgeColor }]}>
              {tileData.type.replace("tile-", "").toUpperCase()}
            </Text>
            <Text style={styles.tileTitle}>{tileData.title}</Text>
          </View>
          {isCode ? (
            <Text style={styles.codeBlock}>{tileData.content}</Text>
          ) : isNote ? (
            <View style={styles.noteBlock}>
              <Text style={styles.tileContent}>{tileData.content}</Text>
            </View>
          ) : (
            <Text style={styles.tileContent}>{tileData.content}</Text>
          )}
        </View>
      );
    }

    default:
      return null;
  }
}

function DocumentPdf({ documentContent, allElements }: DocumentPdfProps) {
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
            <RenderSection section={section} allElements={allElements} />
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

export async function exportDocumentToPdf(
  documentContent: DocumentContent,
  allElements: BoardElement[]
): Promise<void> {
  try {
    const blob = await pdf(
      <DocumentPdf
        documentContent={documentContent}
        allElements={allElements}
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
