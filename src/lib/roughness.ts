import type { BoardElement } from "@/lib/board-types";

function getPointsBounds(points: Array<{ x: number; y: number }>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  if (!Number.isFinite(minX)) {
    return { width: 0, height: 0 };
  }

  return { width: maxX - minX, height: maxY - minY };
}

export function getAdjustedRoughness(
  element: BoardElement,
  baseRoughness: number,
): number {
  if (baseRoughness <= 0) return 0;

  let width = Math.abs(element.width ?? 0);
  let height = Math.abs(element.height ?? 0);

  if ((element.type === "line" || element.type === "arrow") && element.points) {
    const bounds = getPointsBounds(element.points);
    width = Math.max(width, bounds.width);
    height = Math.max(height, bounds.height);
  }

  if (element.type === "pen" && element.points) {
    const bounds = getPointsBounds(element.points);
    width = Math.max(width, bounds.width);
    height = Math.max(height, bounds.height);
  }

  const maxSize = Math.max(width, height);
  const minSize = Math.min(width, height);

  const isLinear = element.type === "line" || element.type === "arrow";
  const isRounded =
    element.type === "ellipse" ||
    (("cornerRadius" in element && (element.cornerRadius ?? 0) > 0) ||
      element.type === "diamond");

  if (
    (minSize >= 20 && maxSize >= 50) ||
    (minSize >= 15 && isRounded) ||
    (isLinear && maxSize >= 50)
  ) {
    return baseRoughness;
  }

  const divisor = maxSize < 10 ? 3 : 2;
  return Math.min(baseRoughness / divisor, 2.5);
}
