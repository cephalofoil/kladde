import type { BoardElement } from "@/lib/board-types";
import type { BoundingBox } from "./types";
import {
  getQuadraticBezierBounds,
  getCatmullRomBounds,
  getElbowPolylineForVertices,
} from "./curves";
import { isBoundsFullyInsideBox } from "./geometry";

// Get bounding box for any element
export function getBoundingBox(element: BoardElement): BoundingBox | null {
  if (
    element.type === "pen" ||
    element.type === "line" ||
    element.type === "arrow"
  ) {
    if (element.points.length === 0) return null;

    const style = element.connectorStyle || "sharp";
    const start = element.points[0];
    const end = element.points[element.points.length - 1] ?? start;
    const hasCorner = element.points.length >= 3;
    const control = hasCorner ? element.points[1] : null;
    const route =
      element.elbowRoute ||
      (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
        ? "vertical"
        : "horizontal");

    let xs: number[];
    let ys: number[];

    if (
      (element.type === "line" || element.type === "arrow") &&
      hasCorner &&
      control &&
      style === "curved"
    ) {
      // For curved connectors, use Catmull-Rom bounds (curve passes through all points)
      const b = getCatmullRomBounds(element.points);
      if (b) {
        xs = [b.x, b.x + b.width];
        ys = [b.y, b.y + b.height];
      } else {
        xs = element.points.map((p) => p.x);
        ys = element.points.map((p) => p.y);
      }
    } else if (
      (element.type === "line" || element.type === "arrow") &&
      hasCorner &&
      control &&
      style === "elbow"
    ) {
      if (element.points.length === 3) {
        const elbowPoints =
          route === "vertical"
            ? [
                start,
                { x: control.x, y: start.y },
                { x: control.x, y: end.y },
                end,
              ]
            : [
                start,
                { x: start.x, y: control.y },
                { x: end.x, y: control.y },
                end,
              ];
        xs = elbowPoints.map((p) => p.x);
        ys = elbowPoints.map((p) => p.y);
      } else {
        const elbowPoints = getElbowPolylineForVertices(element.points, 0.5);
        xs = elbowPoints.map((p) => p.x);
        ys = elbowPoints.map((p) => p.y);
      }
    } else {
      xs = element.points.map((p) => p.x);
      ys = element.points.map((p) => p.y);
    }

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const padding = element.strokeWidth * 2;
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
    const fontSize = element.strokeWidth * 4 + 12;
    if (element.isTextBox) {
      // For text boxes, use the defined dimensions
      return {
        x: element.x ?? 0,
        y: element.y ?? 0,
        width: element.width ?? 200,
        height: element.height ?? 100,
      };
    }
    const textWidth = (element.text?.length ?? 0) * fontSize * 0.55;
    const textHeight = fontSize * 1.2;
    return {
      x: element.x ?? 0,
      y: element.y ?? 0,
      width: Math.max(textWidth, 60),
      height: textHeight,
    };
  }

  if (element.type === "laser") {
    return null;
  }

  return null;
}

// Get combined bounding box for multiple elements
export function getCombinedBounds(
  elementIds: string[],
  elements: BoardElement[],
): BoundingBox | null {
  const boxes = elementIds
    .map((id) => elements.find((el) => el.id === id))
    .filter(Boolean)
    .map((el) => getBoundingBox(el!))
    .filter(Boolean) as BoundingBox[];

  if (boxes.length === 0) return null;

  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getGroupSelectionIds(
  element: BoardElement,
  elements: BoardElement[],
): string[] {
  if (!element.groupId) return [element.id];
  return elements
    .filter((el) => el.type !== "laser" && el.groupId === element.groupId)
    .map((el) => el.id);
}

export function getBoxSelectedIds(
  elements: BoardElement[],
  selectionBox: BoundingBox,
): string[] {
  const ungrouped: BoardElement[] = [];
  const groups = new Map<string, BoardElement[]>();

  for (const el of elements) {
    if (el.type === "laser") continue;
    if (!el.groupId) {
      ungrouped.push(el);
      continue;
    }
    const existing = groups.get(el.groupId) ?? [];
    existing.push(el);
    groups.set(el.groupId, existing);
  }

  const selected: string[] = [];

  for (const el of ungrouped) {
    const bounds = getBoundingBox(el);
    if (bounds && isBoundsFullyInsideBox(bounds, selectionBox)) {
      selected.push(el.id);
    }
  }

  for (const groupElements of groups.values()) {
    const allInside = groupElements.every((el) => {
      const bounds = getBoundingBox(el);
      return bounds ? isBoundsFullyInsideBox(bounds, selectionBox) : false;
    });
    if (allInside) {
      selected.push(...groupElements.map((el) => el.id));
    }
  }

  return selected;
}
