"use client";

interface RenderMermaidPngOptions {
  chart: string;
  theme?: "default" | "neutral" | "dark";
  scale?: number;
  pixelRatio?: number;
}

export async function renderMermaidToPngBlob({
  chart,
  theme = "neutral",
  scale = 1,
  pixelRatio = 2,
}: RenderMermaidPngOptions): Promise<Blob | null> {
  if (!chart.trim()) return null;

  try {
    const mermaid = (await import("mermaid")).default;
    const normalizedChart = normalizeMermaidChartForExport(chart);

    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel: "loose",
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      sequence: { htmlLabels: false },
    });

    const id = `mermaid-export-${Math.random().toString(36).slice(2, 11)}`;
    const { svg } = await mermaid.render(id, normalizedChart);

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");

    let svgWidth = 400;
    let svgHeight = 300;

    if (svgElement) {
      const viewBox = svgElement.getAttribute("viewBox");
      if (viewBox) {
        const parts = viewBox.split(/\s+/).map(Number);
        if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
          svgWidth = parts[2];
          svgHeight = parts[3];
        }
      } else {
        const widthAttr = svgElement.getAttribute("width");
        const heightAttr = svgElement.getAttribute("height");
        if (widthAttr) svgWidth = parseFloat(widthAttr) || svgWidth;
        if (heightAttr) svgHeight = parseFloat(heightAttr) || svgHeight;
      }

      svgElement.setAttribute("width", String(svgWidth));
      svgElement.setAttribute("height", String(svgHeight));
      svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }

    const svgString = svgElement
      ? new XMLSerializer().serializeToString(svgElement)
      : svg;
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

    const normalizedScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const normalizedPixelRatio =
      Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 2;

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const targetWidth = Math.max(1, svgWidth * normalizedScale);
        const targetHeight = Math.max(1, svgHeight * normalizedScale);
        canvas.width = Math.ceil(targetWidth * normalizedPixelRatio);
        canvas.height = Math.ceil(targetHeight * normalizedPixelRatio);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.scale(normalizedPixelRatio * normalizedScale, normalizedPixelRatio * normalizedScale);
        ctx.drawImage(img, 0, 0, svgWidth, svgHeight);

        canvas.toBlob((blob) => resolve(blob), "image/png");
      };
      img.onerror = () => resolve(null);
      img.src = svgDataUrl;
    });
  } catch (error) {
    console.error("Failed to render Mermaid export:", error);
    return null;
  }
}

function normalizeMermaidChartForExport(chart: string): string {
  const chartWithoutNewlinesInLabels = stripLabelNewlines(chart);
  return sanitizeHtmlLabelsInQuotes(chartWithoutNewlinesInLabels);
}

function stripLabelNewlines(chart: string): string {
  let result = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;
  let bracketDepth = 0;

  for (let i = 0; i < chart.length; i += 1) {
    const char = chart[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      result += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === "[" || char === "(" || char === "{" || char === "<") {
        bracketDepth += 1;
      } else if (
        char === "]" ||
        char === ")" ||
        char === "}" ||
        char === ">"
      ) {
        bracketDepth = Math.max(0, bracketDepth - 1);
      }
    }

    if ((char === "\n" || char === "\r") && (inSingleQuote || inDoubleQuote || bracketDepth > 0)) {
      if (char === "\r" && chart[i + 1] === "\n") {
        i += 1;
      }
      result += " ";
      continue;
    }

    result += char;
  }

  return result;
}

function sanitizeHtmlLabelsInQuotes(chart: string): string {
  let result = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;
  let buffer = "";

  const flushBuffer = () => {
    if (!buffer) return "";
    const withLineBreaks = buffer.replace(/<br\s*\/?>/gi, " ");
    const withoutTags = withLineBreaks.replace(/<\/?[^>]+>/g, "");
    const collapsed = withoutTags.replace(/\s+/g, " ");
    const output = collapsed;
    buffer = "";
    return output;
  };

  for (let i = 0; i < chart.length; i += 1) {
    const char = chart[i];

    if (escapeNext) {
      if (inSingleQuote || inDoubleQuote) {
        buffer += char;
      } else {
        result += char;
      }
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      if (inSingleQuote || inDoubleQuote) {
        buffer += char;
      } else {
        result += char;
      }
      escapeNext = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      if (inSingleQuote) {
        result += flushBuffer();
        inSingleQuote = false;
      } else {
        inSingleQuote = true;
      }
      result += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      if (inDoubleQuote) {
        result += flushBuffer();
        inDoubleQuote = false;
      } else {
        inDoubleQuote = true;
      }
      result += char;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      buffer += char;
    } else {
      result += char;
    }
  }

  if (buffer) {
    result += flushBuffer();
  }

  return result;
}
