import type { Point } from "@/lib/board-types";

export type ArrowheadId =
  | "none"
  | "arrow"
  | "bar"
  | "dot"
  | "circle"
  | "circle_outline"
  | "triangle"
  | "triangle_outline"
  | "diamond"
  | "diamond_outline"
  | "crowfoot_one"
  | "crowfoot_many"
  | "crowfoot_one_or_many";

export type ArrowheadInput =
  | ArrowheadId
  | "triangle-outline"
  | "diamond-outline"
  | "circle-outline"
  | "crowfoot-one"
  | "crowfoot-many"
  | "crowfoot-one-many";

export function normalizeArrowhead(
  value: ArrowheadInput | null | undefined,
): ArrowheadId {
  switch (value) {
    case "triangle-outline":
      return "triangle_outline";
    case "diamond-outline":
      return "diamond_outline";
    case "circle-outline":
      return "circle_outline";
    case "crowfoot-one":
      return "crowfoot_one";
    case "crowfoot-many":
      return "crowfoot_many";
    case "crowfoot-one-many":
      return "crowfoot_one_or_many";
    case undefined:
    case null:
      return "none";
    default:
      return value;
  }
}

export function getArrowheadSize(marker: ArrowheadId): number {
  switch (marker) {
    case "arrow":
      return 25;
    case "diamond":
    case "diamond_outline":
      return 12;
    case "crowfoot_many":
    case "crowfoot_one":
    case "crowfoot_one_or_many":
      return 20;
    default:
      return 15;
  }
}

export function getArrowheadAngle(marker: ArrowheadId): number {
  switch (marker) {
    case "bar":
      return 90;
    case "arrow":
      return 20;
    default:
      return 25;
  }
}

function rotateAround(
  point: Point,
  center: Point,
  radians: number,
): Point {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function getArrowheadPoints(
  tip: Point,
  from: Point,
  marker: ArrowheadId,
  strokeWidth: number,
): number[] | null {
  if (marker === "none") return null;

  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (!distance) return null;

  const nx = dx / distance;
  const ny = dy / distance;

  const size = getArrowheadSize(marker);
  const lengthMultiplier =
    marker === "diamond" || marker === "diamond_outline" ? 0.25 : 0.5;
  const minSize = Math.min(size, distance * lengthMultiplier);
  const xs = tip.x - nx * minSize;
  const ys = tip.y - ny * minSize;

  if (marker === "dot" || marker === "circle" || marker === "circle_outline") {
    const diameter = Math.hypot(ys - tip.y, xs - tip.x) + strokeWidth - 2;
    return [tip.x, tip.y, diameter];
  }

  const angle = (getArrowheadAngle(marker) * Math.PI) / 180;

  if (marker === "crowfoot_many" || marker === "crowfoot_one_or_many") {
    const base = { x: xs, y: ys };
    const left = rotateAround(tip, base, -angle);
    const right = rotateAround(tip, base, angle);
    return [base.x, base.y, left.x, left.y, right.x, right.y];
  }

  const base = { x: xs, y: ys };
  const left = rotateAround(base, tip, -angle);
  const right = rotateAround(base, tip, angle);

  if (marker === "diamond" || marker === "diamond_outline") {
    const opposite = {
      x: tip.x - nx * minSize * 2,
      y: tip.y - ny * minSize * 2,
    };
    return [tip.x, tip.y, left.x, left.y, opposite.x, opposite.y, right.x, right.y];
  }

  return [tip.x, tip.y, left.x, left.y, right.x, right.y];
}
