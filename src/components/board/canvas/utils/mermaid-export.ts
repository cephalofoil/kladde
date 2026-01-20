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

    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel: "loose",
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      sequence: { htmlLabels: false },
    });

    const id = `mermaid-export-${Math.random().toString(36).slice(2, 11)}`;
    const { svg } = await mermaid.render(id, chart);

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
