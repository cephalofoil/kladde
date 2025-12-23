import type { Point } from "@/lib/board-types";

// Convert perfect-freehand points to SVG path
export function getSvgPathFromStroke(stroke: number[][]) {
    if (!stroke.length) return "";

    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ["M", ...stroke[0], "Q"],
    );

    d.push("Z");
    return d.join(" ");
}

export function getArrowHeadPoints(tip: Point, from: Point, size: number) {
    const dx = tip.x - from.x;
    const dy = tip.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    const spread = (28 * Math.PI) / 180;

    const a1 = angle + Math.PI - spread;
    const a2 = angle + Math.PI + spread;

    return [
        { x: tip.x + Math.cos(a1) * size, y: tip.y + Math.sin(a1) * size },
        { x: tip.x + Math.cos(a2) * size, y: tip.y + Math.sin(a2) * size },
    ];
}

export function getMarkerBasis(tip: Point, from: Point) {
    const dx = tip.x - from.x;
    const dy = tip.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const bx = -ux;
    const by = -uy;
    const px = -uy;
    const py = ux;
    return { ux, uy, bx, by, px, py };
}
