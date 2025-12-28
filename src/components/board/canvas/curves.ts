import type { Point } from "@/lib/board-types";
import type { BoundingBox } from "./types";

export function getQuadraticBezierBounds(
  p0: Point,
  c: Point,
  p1: Point,
): BoundingBox {
  // Include endpoints and control point
  // Control point is always included because handle is positioned there
  const xs = [p0.x, p1.x, c.x];
  const ys = [p0.y, p1.y, c.y];

  // Include curve extrema (the actual bounds of the bezier curve)
  const denomX = p0.x - 2 * c.x + p1.x;
  if (denomX !== 0) {
    const t = (p0.x - c.x) / denomX;
    if (t > 0 && t < 1) {
      const mt = 1 - t;
      xs.push(mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x);
    }
  }

  const denomY = p0.y - 2 * c.y + p1.y;
  if (denomY !== 0) {
    const t = (p0.y - c.y) / denomY;
    if (t > 0 && t < 1) {
      const mt = 1 - t;
      ys.push(mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y);
    }
  }

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function getCubicBezierPoint(
  p0: Point,
  c1: Point,
  c2: Point,
  p1: Point,
  t: number,
): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x:
      p0.x * mt2 * mt + 3 * c1.x * mt2 * t + 3 * c2.x * mt * t2 + p1.x * t2 * t,
    y:
      p0.y * mt2 * mt + 3 * c1.y * mt2 * t + 3 * c2.y * mt * t2 + p1.y * t2 * t,
  };
}

export function getCatmullRomControlPoints(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
) {
  const t = 1; // tension
  return {
    c1: {
      x: p1.x + ((p2.x - p0.x) * t) / 6,
      y: p1.y + ((p2.y - p0.y) * t) / 6,
    },
    c2: {
      x: p2.x - ((p3.x - p1.x) * t) / 6,
      y: p2.y - ((p3.y - p1.y) * t) / 6,
    },
  };
}

export function getCatmullRomPath(points: Point[]): string | null {
  if (points.length < 2) return null;
  if (points.length === 2)
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const { c1, c2 } = getCatmullRomControlPoints(p0, p1, p2, p3);
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function getCatmullRomBounds(points: Point[]): BoundingBox | null {
  if (points.length === 0) return null;
  if (points.length === 1)
    return { x: points[0].x, y: points[0].y, width: 0, height: 0 };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  // Use more samples to accurately capture curve extrema
  const sampleSteps = 32;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const { c1, c2 } = getCatmullRomControlPoints(p0, p1, p2, p3);
    for (let s = 0; s <= sampleSteps; s++) {
      const t = s / sampleSteps;
      const p = getCubicBezierPoint(p1, c1, c2, p2, t);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function getElbowPolylineForVertices(points: Point[], eps = 0): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    const same = (u: number, v: number) => Math.abs(u - v) <= eps;

    // If the segment is (nearly) axis-aligned, keep it axis-aligned (and snap to avoid drift).
    if (same(dx, 0) || same(dy, 0)) {
      out.push({
        x: same(dx, 0) ? a.x : b.x,
        y: same(dy, 0) ? a.y : b.y,
      });
      continue;
    }
    const vertical = Math.abs(dx) >= Math.abs(dy);
    const mid = vertical ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    if (mid.x !== a.x || mid.y !== a.y) out.push(mid);
    out.push(b);
  }
  return out;
}

export function simplifyElbowPolyline(points: Point[], eps: number): Point[] {
  if (points.length < 2) return points;

  const cleaned = points.reduce<Point[]>((acc, p) => {
    const last = acc[acc.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > eps) acc.push(p);
    return acc;
  }, []);

  if (cleaned.length <= 2) return cleaned;

  const same = (a: number, b: number) => Math.abs(a - b) <= eps;
  const out: Point[] = [];
  for (const p of cleaned) {
    out.push(p);
    while (out.length >= 3) {
      const c = out[out.length - 1];
      const b = out[out.length - 2];
      const a = out[out.length - 3];
      const collinearVertical = same(a.x, b.x) && same(b.x, c.x);
      const collinearHorizontal = same(a.y, b.y) && same(b.y, c.y);
      if (collinearVertical || collinearHorizontal) {
        out.splice(out.length - 2, 1);
      } else {
        break;
      }
    }
  }

  const deduped = out.reduce<Point[]>((acc, p) => {
    const last = acc[acc.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > eps) acc.push(p);
    return acc;
  }, []);

  return deduped.length >= 2 ? deduped : points;
}
