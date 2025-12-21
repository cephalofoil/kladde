"use client";

import React from "react";
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
import type { DocumentLayout, DocumentSection } from "@/types/canvas";
import mermaid from "mermaid";

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
});

/**
 * Convert SVG string to PNG data URL
 */
async function svgToPngDataUrl(
  svgString: string,
  width: number = 800,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Failed to get canvas context"));
      return;
    }

    img.onload = () => {
      // Set canvas size based on SVG dimensions
      canvas.width = width;
      canvas.height = (img.height / img.width) * width;

      // Draw white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw SVG
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert to data URL
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => reject(new Error("Failed to load SVG image"));

    // Convert SVG to data URL directly (avoids CORS/tainted canvas issues)
    const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
    const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;
    img.src = svgDataUrl;
  });
}

/**
 * Render mermaid diagram and convert to PNG data URL
 */
async function renderMermaidToPng(chart: string): Promise<string | null> {
  try {
    const id = `mermaid-pdf-${Date.now()}`;
    const { svg } = await mermaid.render(id, chart);
    const pngDataUrl = await svgToPngDataUrl(svg, 600);
    return pngDataUrl;
  } catch (error) {
    console.error("Failed to render mermaid diagram:", error);
    return null;
  }
}

// PDF Styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    paddingTop: 70.8, // 25mm in points (1mm = 2.83465 points)
    paddingRight: 70.8,
    paddingBottom: 70.8,
    paddingLeft: 70.8,
    fontFamily: "Helvetica",
  },
  section: {
    marginBottom: 12,
  },
  heading1: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#1a1a1a",
  },
  heading2: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#2a2a2a",
  },
  heading3: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#3a3a3a",
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#333333",
  },
  code: {
    fontFamily: "Courier",
    fontSize: 9,
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderRadius: 4,
    marginVertical: 8,
    lineHeight: 1.4,
  },
  tileContainer: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: "#fafafa",
    borderRadius: 4,
    borderLeft: "3px solid #3b82f6",
  },
  tileHeader: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#4b5563",
    textTransform: "uppercase",
  },
  tileContent: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#1f2937",
  },
  spacer: {
    marginVertical: 6,
  },
  diagramPlaceholder: {
    padding: 20,
    backgroundColor: "#e0f2fe",
    borderRadius: 4,
    textAlign: "center",
    fontSize: 10,
    color: "#075985",
  },
});

interface DocumentPDFProps {
  title: string;
  description?: string;
  layout: DocumentLayout;
  mermaidImages: Record<string, string>; // section.id -> PNG data URL
}

/**
 * Render a section for PDF export
 */
function renderSection(
  section: DocumentSection,
  mermaidImages: Record<string, string>,
) {
  switch (section.type) {
    case "heading": {
      const headingStyle =
        section.level === 1
          ? styles.heading1
          : section.level === 2
            ? styles.heading2
            : styles.heading3;
      return (
        <View key={section.id} style={styles.section}>
          <Text style={headingStyle}>{section.text || "Untitled Heading"}</Text>
        </View>
      );
    }

    case "text":
      return (
        <View key={section.id} style={styles.section}>
          <Text style={styles.text}>{section.text || ""}</Text>
        </View>
      );

    case "tile-content": {
      const content = section.content;

      // Handle different tile content types
      if (typeof content === "string") {
        // Simple text content
        return (
          <View key={section.id} style={styles.tileContainer}>
            <Text style={styles.tileHeader}>Content from Connected Tile</Text>
            <Text style={styles.tileContent}>{content}</Text>
          </View>
        );
      } else if (typeof content === "object" && content !== null) {
        // Code or Mermaid content
        if ("code" in content) {
          return (
            <View key={section.id} style={styles.section}>
              <Text style={styles.tileHeader}>
                Code ({(content as { language?: string }).language || "unknown"}
                )
              </Text>
              <Text style={styles.code}>
                {(content as { code: string }).code || ""}
              </Text>
            </View>
          );
        } else if ("chart" in content) {
          const imageDataUrl = mermaidImages[section.id];
          if (imageDataUrl) {
            return (
              <View key={section.id} style={styles.section}>
                <Image
                  src={imageDataUrl}
                  style={{
                    maxWidth: "100%",
                    maxHeight: 400,
                    objectFit: "contain",
                  }}
                />
              </View>
            );
          } else {
            return (
              <View key={section.id} style={styles.section}>
                <View style={styles.diagramPlaceholder}>
                  <Text>📊 Mermaid Diagram</Text>
                  <Text style={{ fontSize: 8, marginTop: 4 }}>
                    (Failed to render diagram)
                  </Text>
                </View>
              </View>
            );
          }
        }
      }

      return (
        <View key={section.id} style={styles.section}>
          <Text style={styles.text}>[Unsupported content type]</Text>
        </View>
      );
    }

    case "spacer": {
      const height = section.height || 10;
      // Convert mm to points (1mm = 2.83465 points)
      const heightPoints = height * 2.83465;
      return (
        <View
          key={section.id}
          style={[styles.spacer, { height: heightPoints }]}
        />
      );
    }

    default:
      return null;
  }
}

/**
 * PDF Document component
 */
export const DocumentPDF = ({
  title,
  description,
  layout,
  mermaidImages,
}: DocumentPDFProps) => {
  const sortedSections = [...layout.sections].sort((a, b) => a.order - b.order);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Document Title */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.heading1}>{title || "Untitled Document"}</Text>
          {description && (
            <Text style={[styles.text, { marginTop: 8, color: "#6b7280" }]}>
              {description}
            </Text>
          )}
        </View>

        {/* Render sections */}
        {sortedSections.map((section) => renderSection(section, mermaidImages))}

        {/* Footer */}
        <View
          style={{
            position: "absolute",
            bottom: 30,
            left: 70.8,
            right: 70.8,
            borderTop: "1px solid #e5e7eb",
            paddingTop: 8,
          }}
          fixed
        >
          <Text style={{ fontSize: 8, color: "#9ca3af", textAlign: "center" }}>
            Generated on {new Date().toLocaleDateString()} •{" "}
            {new Date().toLocaleTimeString()}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

/**
 * Export a document as PDF
 */
export async function exportDocumentAsPDF(
  title: string,
  description: string | undefined,
  layout: DocumentLayout,
  filename?: string,
): Promise<void> {
  try {
    // Pre-render all mermaid diagrams to PNG
    const mermaidImages: Record<string, string> = {};

    for (const section of layout.sections) {
      if (section.type === "tile-content" && section.content) {
        const content = section.content;
        if (
          typeof content === "object" &&
          content !== null &&
          "chart" in content
        ) {
          const chart = (content as { chart: string }).chart;
          if (chart) {
            const imageDataUrl = await renderMermaidToPng(chart);
            if (imageDataUrl) {
              mermaidImages[section.id] = imageDataUrl;
            }
          }
        }
      }
    }

    // Create the PDF document
    const doc = React.createElement(DocumentPDF, {
      title,
      description,
      layout,
      mermaidImages,
    });

    // Generate blob
    const blob = await pdf(doc).toBlob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      filename || `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
    link.click();

    // Cleanup
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting PDF:", error);
    throw new Error(
      `Failed to export PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Generate a timestamped filename for PDF export
 */
export function generateDocumentFilename(title: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, "");
  const cleanTitle = title.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  return `${cleanTitle}-${timestamp}.pdf`;
}
