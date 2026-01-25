import type { BoardElement, Point } from "./board-types";
import { getArrowheadPoints, normalizeArrowhead } from "./arrowheads";
import { getTileTypeInfo } from "./tile-utils";

export interface FrameImageResult {
  dataUrl: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
}

interface RenderFrameImageOptions {
  frameId: string;
  elements: BoardElement[];
  scale?: number;
  includeBackground?: boolean;
}

const DEFAULT_TILE_HEADER_HEIGHT = 24;
const TILE_BODY_LINE_HEIGHT = 12;
const TILE_HEADER_FONT = "600 10px sans-serif";
const TILE_BODY_FONT = "10px sans-serif";

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function getFrameBounds(frame: BoardElement) {
  return {
    x: frame.x ?? 0,
    y: frame.y ?? 0,
    width: frame.width ?? 0,
    height: frame.height ?? 0,
  };
}

function getFrameElements(elements: BoardElement[], frameId: string) {
  return elements.filter(
    (el) =>
      el.type !== "laser" &&
      !el.hidden &&
      (el.id === frameId || el.frameId === frameId),
  );
}

function getElementBounds(
  element: BoardElement,
): { x: number; y: number; width: number; height: number } | null {
  if (
    element.type === "pen" ||
    element.type === "line" ||
    element.type === "arrow"
  ) {
    if (element.points.length === 0) return null;
    const xs = element.points.map((p) => p.x);
    const ys = element.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const padding = (element.strokeWidth || 2) * 2;
    return {
      x: minX - padding,
      y: minY - padding,
      width: Math.max(maxX - minX + padding * 2, 20),
      height: Math.max(maxY - minY + padding * 2, 20),
    };
  }

  if (
    element.type === "rectangle" ||
    element.type === "diamond" ||
    element.type === "ellipse" ||
    element.type === "frame" ||
    element.type === "web-embed" ||
    element.type === "tile"
  ) {
    return {
      x: element.x ?? 0,
      y: element.y ?? 0,
      width: element.width ?? 0,
      height: element.height ?? 0,
    };
  }

  if (element.type === "text") {
    if (element.width !== undefined && element.height !== undefined) {
      return {
        x: element.x ?? 0,
        y: element.y ?? 0,
        width: element.width,
        height: element.height,
      };
    }
    const fontSize = element.fontSize ?? (element.strokeWidth || 1) * 4 + 12;
    const textWidth = (element.text?.length ?? 0) * fontSize * 0.55;
    const textHeight = fontSize * 1.2;
    return {
      x: element.x ?? 0,
      y: element.y ?? 0,
      width: Math.max(textWidth, 60),
      height: textHeight,
    };
  }

  return null;
}

function getRotationTransform(el: BoardElement) {
  const rotationDeg = el.rotation ?? 0;
  if (!rotationDeg) return null;
  const bounds = getElementBounds(el);
  if (!bounds) return null;
  return {
    rotationDeg,
    cx: bounds.x + bounds.width / 2,
    cy: bounds.y + bounds.height / 2,
  };
}

function getStrokeDash(el: BoardElement) {
  const style = el.strokeStyle || "solid";
  if (style === "dashed") return [10, 10];
  if (style === "dotted") return [2, 6];
  return [];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFrameToCanvas(ctx: CanvasRenderingContext2D, el: BoardElement) {
  if (el.type !== "frame") return;
  const x = el.x ?? 0;
  const y = el.y ?? 0;
  const width = el.width ?? 0;
  const height = el.height ?? 0;
  const strokeWidth = el.strokeWidth || 2;
  const cornerRadius = el.cornerRadius ?? 8;
  const frameStyle = el.frameStyle ?? "minimal";
  const baseFill =
    frameStyle === "cutting-mat"
      ? "#2d6f5e"
      : frameStyle === "notebook"
        ? "#f5f0e5"
        : el.fillColor || "transparent";

  ctx.save();
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = el.strokeColor;
  ctx.beginPath();
  drawRoundedRect(ctx, x, y, width, height, cornerRadius);
  if (baseFill !== "transparent") {
    ctx.fillStyle = baseFill;
    ctx.fill();
  }
  ctx.stroke();

  if (frameStyle === "cutting-mat") {
    const inset = Math.max(strokeWidth, 1);
    const innerX = x + inset;
    const innerY = y + inset;
    const innerW = Math.max(width - inset * 2, 0);
    const innerH = Math.max(height - inset * 2, 0);
    const gridSize = 20;
    const barSize = 16;
    ctx.save();
    ctx.beginPath();
    ctx.rect(innerX, innerY, innerW, innerH);
    ctx.clip();

    ctx.strokeStyle = "rgba(92, 184, 159, 0.45)";
    ctx.lineWidth = 1;
    for (let gx = innerX; gx <= innerX + innerW; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, innerY);
      ctx.lineTo(gx, innerY + innerH);
      ctx.stroke();
    }
    for (let gy = innerY; gy <= innerY + innerH; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(innerX, gy);
      ctx.lineTo(innerX + innerW, gy);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(42, 104, 90, 0.75)";
    ctx.fillRect(innerX, innerY, innerW, Math.min(barSize, innerH));
    ctx.fillRect(
      innerX + Math.max(innerW - barSize, 0),
      innerY,
      Math.min(barSize, innerW),
      innerH,
    );

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    const rand = seededRandom(el.id.length * 9973);
    for (let i = 0; i < 120; i += 1) {
      const rx = innerX + rand() * innerW;
      const ry = innerY + rand() * innerH;
      ctx.fillRect(rx, ry, 1, 1);
    }

    ctx.strokeStyle = "rgba(26, 74, 61, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(innerX + 40, innerY + 70);
    ctx.lineTo(innerX + 160, innerY + 90);
    ctx.stroke();

    ctx.strokeStyle = "rgba(26, 74, 61, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(innerX + 120, innerY + innerH - 80);
    ctx.lineTo(innerX + 220, innerY + innerH - 60);
    ctx.stroke();

    ctx.strokeStyle = "rgba(26, 74, 61, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerX + 200, innerY + 160);
    ctx.lineTo(innerX + 260, innerY + 140);
    ctx.stroke();

    ctx.fillStyle = "rgba(92, 184, 159, 0.8)";
    ctx.font = "700 8px sans-serif";
    const markerStep = gridSize * 5;
    const topMarkers = Math.floor(innerW / markerStep);
    for (let i = 1; i <= topMarkers; i += 1) {
      const labelX = innerX + i * markerStep;
      if (labelX > innerX + innerW - barSize) continue;
      ctx.fillText(String(i * 5), labelX - 4, innerY + 10);
    }
    const rightMarkers = Math.floor(innerH / markerStep);
    for (let i = 1; i <= rightMarkers; i += 1) {
      const labelY = innerY + i * markerStep;
      if (labelY > innerY + innerH - barSize) continue;
      ctx.fillText(String(i * 5), innerX + innerW - barSize + 2, labelY + 3);
    }

    ctx.fillStyle = "rgba(92, 184, 159, 0.6)";
    ctx.font = "800 10px sans-serif";
    ctx.fillText("SDi", innerX + 8, innerY + innerH - 10);
    ctx.font = "700 6px sans-serif";
    ctx.fillText("CUTTING MAT", innerX + 8, innerY + innerH - 2);

    ctx.restore();
  }

  if (frameStyle === "notebook") {
    const inset = Math.max(strokeWidth, 1);
    const innerX = x + inset;
    const innerY = y + inset;
    const innerW = Math.max(width - inset * 2, 0);
    const innerH = Math.max(height - inset * 2, 0);
    const spineWidth = Math.min(24, innerW * 0.18);
    ctx.save();
    ctx.beginPath();
    ctx.rect(innerX, innerY, innerW, innerH);
    ctx.clip();

    ctx.fillStyle = "rgba(30, 90, 90, 0.65)";
    ctx.fillRect(innerX, innerY, spineWidth, innerH);
    ctx.strokeStyle = "rgba(139, 115, 85, 0.6)";
    for (let i = 1; i <= 6; i += 1) {
      const stitchY = innerY + (i * innerH) / 7;
      ctx.beginPath();
      ctx.moveTo(innerX + spineWidth / 2, stitchY);
      ctx.lineTo(innerX + spineWidth / 2, stitchY + 6);
      ctx.stroke();
    }
    ctx.fillStyle = "#e8dcc8";
    ctx.fillRect(
      innerX + innerW - Math.min(24, innerW * 0.2),
      innerY + innerH * 0.3,
      Math.min(24, innerW * 0.2),
      Math.min(36, innerH * 0.2),
    );
    ctx.restore();
  }

  ctx.restore();
}

function getConnectorRoute(el: BoardElement, start: Point, end: Point) {
  return (
    el.elbowRoute ??
    (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
      ? "vertical"
      : "horizontal")
  );
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  marker: NonNullable<BoardElement["arrowEnd"]>,
  tip: Point,
  from: Point,
  strokeColor: string,
  strokeWidth: number,
  opacity: number,
  lineCap: CanvasLineCap,
) {
  const normalized = normalizeArrowhead(marker);
  if (normalized === "none") return;

  const points = getArrowheadPoints(tip, from, normalized, strokeWidth);
  if (!points) return;

  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = strokeColor;
  ctx.lineWidth = Math.max(1.5, strokeWidth);
  ctx.lineCap = lineCap;
  ctx.lineJoin = "round";
  ctx.setLineDash([]);

  const outlineWidth = Math.min(ctx.lineWidth, 6);

  if (
    normalized === "circle" ||
    normalized === "circle_outline" ||
    normalized === "dot"
  ) {
    const [cx, cy, diameter] = points;
    ctx.beginPath();
    ctx.arc(cx, cy, diameter / 2, 0, Math.PI * 2);
    if (normalized === "circle_outline") {
      ctx.lineWidth = outlineWidth;
      ctx.stroke();
    } else {
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (normalized === "triangle" || normalized === "triangle_outline") {
    const [x1, y1, x2, y2, x3, y3] = points;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    if (normalized === "triangle_outline") {
      ctx.lineWidth = outlineWidth;
      ctx.stroke();
    } else {
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (normalized === "diamond" || normalized === "diamond_outline") {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = points;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    if (normalized === "diamond_outline") {
      ctx.lineWidth = outlineWidth;
      ctx.stroke();
    } else {
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (normalized === "bar") {
    const [, , x2, y2, x3, y3] = points;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (normalized === "crowfoot_one") {
    const [, , x2, y2, x3, y3] = points;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (normalized === "crowfoot_many" || normalized === "crowfoot_one_or_many") {
    const [x1, y1, x2, y2, x3, y3] = points;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x3, y3);
    ctx.stroke();
    if (normalized === "crowfoot_one_or_many") {
      const barPoints = getArrowheadPoints(
        tip,
        from,
        "crowfoot_one",
        strokeWidth,
      );
      if (barPoints) {
        const [, , bx1, by1, bx2, by2] = barPoints;
        ctx.beginPath();
        ctx.moveTo(bx1, by1);
        ctx.lineTo(bx2, by2);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  const [x1, y1, x2, y2, x3, y3] = points;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x3, y3);
  ctx.stroke();
  ctx.restore();
  return;
}

function drawConnector(ctx: CanvasRenderingContext2D, el: BoardElement) {
  if ((el.type !== "line" && el.type !== "arrow") || el.points.length < 2)
    return;

  const start = el.points[0];
  const end = el.points[el.points.length - 1];
  const hasCorner = el.points.length >= 3;
  const control = hasCorner ? el.points[1] : null;
  const style = el.connectorStyle || "sharp";
  const route = getConnectorRoute(el, start, end);
  const cap = el.lineCap || "round";

  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = cap as CanvasLineCap;
  ctx.lineJoin = "round";
  ctx.setLineDash(getStrokeDash(el));

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  if (!hasCorner || !control) {
    ctx.lineTo(end.x, end.y);
  } else if (style === "curved") {
    ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
  } else if (style === "elbow") {
    if (route === "vertical") {
      ctx.lineTo(control.x, start.y);
      ctx.lineTo(control.x, end.y);
      ctx.lineTo(end.x, end.y);
    } else {
      ctx.lineTo(start.x, control.y);
      ctx.lineTo(end.x, control.y);
      ctx.lineTo(end.x, end.y);
    }
  } else {
    ctx.lineTo(control.x, control.y);
    ctx.lineTo(end.x, end.y);
  }
  ctx.stroke();

  ctx.setLineDash([]);

  if (el.type !== "arrow") return;

  const markerStart = el.arrowStart || "none";
  const markerEnd = el.arrowEnd || "arrow";
  const markerOpacity = 1;

  const tangentForStart = () => {
    if (!control) return { tip: start, from: end };
    if (style === "curved") return { tip: start, from: control };
    if (style === "elbow") {
      if (route === "vertical")
        return { tip: start, from: { x: control.x, y: start.y } };
      return { tip: start, from: { x: start.x, y: control.y } };
    }
    return { tip: start, from: control };
  };

  const tangentForEnd = () => {
    if (!control) return { tip: end, from: start };
    if (style === "curved") return { tip: end, from: control };
    if (style === "elbow") {
      if (route === "vertical")
        return { tip: end, from: { x: control.x, y: end.y } };
      return { tip: end, from: { x: end.x, y: control.y } };
    }
    return { tip: end, from: control };
  };

  const { tip: sTip, from: sFrom } = tangentForStart();
  const { tip: eTip, from: eFrom } = tangentForEnd();
  drawMarker(
    ctx,
    markerStart,
    sTip,
    sFrom,
    el.strokeColor,
    el.strokeWidth,
    markerOpacity,
    cap as CanvasLineCap,
  );
  drawMarker(
    ctx,
    markerEnd,
    eTip,
    eFrom,
    el.strokeColor,
    el.strokeWidth,
    markerOpacity,
    cap as CanvasLineCap,
  );
}

function getReadableTextColor(hex: string) {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#111827";
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.7 ? "#111827" : "#f9fafb";
}

function stripHtml(input: string) {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (
    trimmed.length > 0 &&
    ctx.measureText(`${trimmed}...`).width > maxWidth
  ) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      lines.push(word);
      if (lines.length >= maxLines) break;
      current = "";
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines.length === maxLines) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = truncateText(ctx, lines[lastIndex], maxWidth);
  }

  return lines;
}

function getTilePreviewText(tile: BoardElement) {
  const content = tile.tileContent;
  if (!content) return "";
  if (content.richText) return stripHtml(content.richText);
  if (content.noteText) return content.noteText.trim();
  if (content.code) return content.code.trim();
  if (content.chart) return "Mermaid diagram";
  if (content.imageSrc) return "Image";
  if (content.documentContent) return "Document";
  return "";
}

export function drawTileToCanvas(ctx: CanvasRenderingContext2D, el: BoardElement) {
  if (el.type !== "tile") return;
  const x = el.x ?? 0;
  const y = el.y ?? 0;
  const width = el.width ?? 0;
  const height = el.height ?? 0;
  if (width <= 0 || height <= 0) return;

  const cornerRadius = Math.min(10, Math.min(width, height) / 6);
  const headerHeight = Math.min(DEFAULT_TILE_HEADER_HEIGHT, height * 0.25);
  const baseHeaderColor =
    el.tileContent?.headerBgColor ||
    getTileTypeInfo(el.tileType || "tile-text").color;
  const headerTextColor =
    el.tileContent?.headerTextColor || getReadableTextColor(baseHeaderColor);
  const title = el.tileTitle || "Untitled";

  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, x, y, width, height, cornerRadius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "rgba(17, 24, 39, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = baseHeaderColor;
  ctx.fillRect(x, y, width, headerHeight);

  ctx.font = TILE_HEADER_FONT;
  ctx.fillStyle = headerTextColor;
  ctx.textBaseline = "middle";
  ctx.fillText(
    truncateText(ctx, title, width - 12),
    x + 6,
    y + headerHeight / 2,
  );

  const previewText = getTilePreviewText(el);
  if (previewText) {
    ctx.font = TILE_BODY_FONT;
    ctx.fillStyle = "#374151";
    ctx.textBaseline = "top";
    const lines = wrapText(ctx, previewText, width - 12, 4);
    let textY = y + headerHeight + 6;
    for (const line of lines) {
      if (textY + TILE_BODY_LINE_HEIGHT > y + height - 6) break;
      ctx.fillText(line, x + 6, textY);
      textY += TILE_BODY_LINE_HEIGHT;
    }
  }

  ctx.restore();
}

export function renderFrameImageDataUrl(
  options: RenderFrameImageOptions,
): FrameImageResult | null {
  if (typeof document === "undefined") return null;
  const frame = options.elements.find(
    (el) => el.type === "frame" && el.id === options.frameId,
  );
  if (!frame) return null;

  const bounds = getFrameBounds(frame);
  if (!bounds.width || !bounds.height) return null;

  const renderScale = options.scale && options.scale > 0 ? options.scale : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(bounds.width * renderScale));
  canvas.height = Math.max(1, Math.floor(bounds.height * renderScale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (options.includeBackground) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.save();
  ctx.scale(renderScale, renderScale);
  ctx.translate(-bounds.x, -bounds.y);

  const renderElements = getFrameElements(options.elements, options.frameId);
  const orderedElements = [...renderElements].sort(
    (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
  );

  orderedElements.forEach((el) => {
    ctx.save();
    ctx.globalAlpha = (el.opacity ?? 100) / 100;

    const rot = getRotationTransform(el);
    if (rot) {
      ctx.translate(rot.cx, rot.cy);
      ctx.rotate(degToRad(rot.rotationDeg));
      ctx.translate(-rot.cx, -rot.cy);
    }

    if (el.type === "frame") {
      drawFrameToCanvas(ctx, el);
    } else if (el.type === "rectangle") {
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.fillStyle = el.fillColor || "transparent";
      ctx.beginPath();
      drawRoundedRect(
        ctx,
        el.x ?? 0,
        el.y ?? 0,
        el.width ?? 0,
        el.height ?? 0,
        el.cornerRadius ?? 0,
      );
      if (el.fillColor && el.fillColor !== "transparent") ctx.fill();
      ctx.stroke();
    } else if (el.type === "diamond") {
      const x = el.x ?? 0;
      const y = el.y ?? 0;
      const width = el.width ?? 0;
      const height = el.height ?? 0;
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.fillStyle = el.fillColor || "transparent";
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(x + width, y + height / 2);
      ctx.lineTo(x + width / 2, y + height);
      ctx.lineTo(x, y + height / 2);
      ctx.closePath();
      if (el.fillColor && el.fillColor !== "transparent") ctx.fill();
      ctx.stroke();
    } else if (el.type === "ellipse") {
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.fillStyle = el.fillColor || "transparent";
      ctx.beginPath();
      ctx.ellipse(
        (el.x ?? 0) + (el.width ?? 0) / 2,
        (el.y ?? 0) + (el.height ?? 0) / 2,
        (el.width ?? 0) / 2,
        (el.height ?? 0) / 2,
        0,
        0,
        Math.PI * 2,
      );
      if (el.fillColor && el.fillColor !== "transparent") ctx.fill();
      ctx.stroke();
    } else if (
      (el.type === "line" || el.type === "arrow") &&
      el.points.length >= 2
    ) {
      drawConnector(ctx, el);
    } else if (el.type === "pen" && el.points.length >= 2) {
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      el.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    } else if (el.type === "text") {
      const fontSize = el.fontSize ?? (el.strokeWidth || 1) * 4 + 12;
      const fontFamily = el.fontFamily || "sans-serif";
      const padding = 6;
      ctx.fillStyle = el.strokeColor;
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = "top";
      ctx.textAlign = el.textAlign || "left";

      if (el.isTextBox && el.width && el.height) {
        const content = el.text || "";
        const maxWidth = Math.max(el.width - padding * 2, 10);
        const lines = wrapText(ctx, content, maxWidth, 20);
        let yOffset = (el.y ?? 0) + padding;
        const xBase =
          el.textAlign === "center"
            ? (el.x ?? 0) + el.width / 2
            : el.textAlign === "right"
              ? (el.x ?? 0) + el.width - padding
              : (el.x ?? 0) + padding;
        for (const line of lines) {
          ctx.fillText(line, xBase, yOffset);
          yOffset += fontSize * 1.4;
          if (yOffset > (el.y ?? 0) + el.height) break;
        }
      } else {
        ctx.fillText(el.text || "", el.x ?? 0, el.y ?? 0);
      }
    } else if (el.type === "tile") {
      drawTileToCanvas(ctx, el);
    } else if (el.type === "web-embed") {
      const x = el.x ?? 0;
      const y = el.y ?? 0;
      const width = el.width ?? 0;
      const height = el.height ?? 0;
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#cbd5f5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      drawRoundedRect(ctx, x, y, width, height, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.font = "600 11px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("Embed", x + 8, y + height / 2);
    }

    ctx.restore();
  });

  ctx.restore();

  const dataUrl = canvas.toDataURL("image/png");
  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    sourceWidth: bounds.width,
    sourceHeight: bounds.height,
    scale: renderScale,
  };
}

export interface RenderFrameToBlobOptions {
  frameId: string;
  elements: BoardElement[];
  scale?: number;
  includeBackground?: boolean;
}

export async function renderFrameToBlob(
  options: RenderFrameToBlobOptions,
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const frame = options.elements.find(
    (el) => el.type === "frame" && el.id === options.frameId,
  );
  if (!frame) return null;

  const bounds = getFrameBounds(frame);
  if (!bounds.width || !bounds.height) return null;

  const renderScale = options.scale && options.scale > 0 ? options.scale : 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(bounds.width * renderScale));
  canvas.height = Math.max(1, Math.floor(bounds.height * renderScale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (options.includeBackground) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.save();
  ctx.scale(renderScale, renderScale);
  ctx.translate(-bounds.x, -bounds.y);

  const renderElements = getFrameElements(options.elements, options.frameId);
  const orderedElements = [...renderElements].sort(
    (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
  );

  orderedElements.forEach((el) => {
    ctx.save();
    ctx.globalAlpha = (el.opacity ?? 100) / 100;

    const rot = getRotationTransform(el);
    if (rot) {
      ctx.translate(rot.cx, rot.cy);
      ctx.rotate(degToRad(rot.rotationDeg));
      ctx.translate(-rot.cx, -rot.cy);
    }

    if (el.type === "frame") {
      drawFrameToCanvas(ctx, el);
    } else if (el.type === "rectangle") {
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.fillStyle = el.fillColor || "transparent";
      ctx.beginPath();
      drawRoundedRect(
        ctx,
        el.x ?? 0,
        el.y ?? 0,
        el.width ?? 0,
        el.height ?? 0,
        el.cornerRadius ?? 0,
      );
      if (el.fillColor && el.fillColor !== "transparent") ctx.fill();
      ctx.stroke();
    } else if (el.type === "diamond") {
      const x = el.x ?? 0;
      const y = el.y ?? 0;
      const width = el.width ?? 0;
      const height = el.height ?? 0;
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.fillStyle = el.fillColor || "transparent";
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(x + width, y + height / 2);
      ctx.lineTo(x + width / 2, y + height);
      ctx.lineTo(x, y + height / 2);
      ctx.closePath();
      if (el.fillColor && el.fillColor !== "transparent") ctx.fill();
      ctx.stroke();
    } else if (el.type === "ellipse") {
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.fillStyle = el.fillColor || "transparent";
      ctx.beginPath();
      ctx.ellipse(
        (el.x ?? 0) + (el.width ?? 0) / 2,
        (el.y ?? 0) + (el.height ?? 0) / 2,
        (el.width ?? 0) / 2,
        (el.height ?? 0) / 2,
        0,
        0,
        Math.PI * 2,
      );
      if (el.fillColor && el.fillColor !== "transparent") ctx.fill();
      ctx.stroke();
    } else if (
      (el.type === "line" || el.type === "arrow") &&
      el.points.length >= 2
    ) {
      drawConnector(ctx, el);
    } else if (el.type === "pen" && el.points.length >= 2) {
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      el.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    } else if (el.type === "text") {
      const fontSize = el.fontSize ?? (el.strokeWidth || 1) * 4 + 12;
      const fontFamily = el.fontFamily || "sans-serif";
      const padding = 6;
      ctx.fillStyle = el.strokeColor;
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = "top";
      ctx.textAlign = el.textAlign || "left";

      if (el.isTextBox && el.width && el.height) {
        const content = el.text || "";
        const maxWidth = Math.max(el.width - padding * 2, 10);
        const lines = wrapText(ctx, content, maxWidth, 20);
        let yOffset = (el.y ?? 0) + padding;
        const xBase =
          el.textAlign === "center"
            ? (el.x ?? 0) + el.width / 2
            : el.textAlign === "right"
              ? (el.x ?? 0) + el.width - padding
              : (el.x ?? 0) + padding;
        for (const line of lines) {
          ctx.fillText(line, xBase, yOffset);
          yOffset += fontSize * 1.4;
          if (yOffset > (el.y ?? 0) + el.height) break;
        }
      } else {
        ctx.fillText(el.text || "", el.x ?? 0, el.y ?? 0);
      }
    } else if (el.type === "tile") {
      drawTileToCanvas(ctx, el);
    } else if (el.type === "web-embed") {
      const x = el.x ?? 0;
      const y = el.y ?? 0;
      const width = el.width ?? 0;
      const height = el.height ?? 0;
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#cbd5f5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      drawRoundedRect(ctx, x, y, width, height, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.font = "600 11px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("Embed", x + 8, y + height / 2);
    }

    ctx.restore();
  });

  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
