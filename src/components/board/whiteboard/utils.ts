import type { BoardElement } from "@/lib/board-types";

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function getBoundingBox(element: BoardElement): BoundingBox | null {
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
        element.type === "ellipse"
    ) {
        // Account for stroke width - stroke is centered on the edge,
        // so half extends outside. Use outside edge for alignment.
        const strokeWidth = element.strokeWidth ?? 0;
        const halfStroke = strokeWidth / 2;
        return {
            x: (element.x ?? 0) - halfStroke,
            y: (element.y ?? 0) - halfStroke,
            width: (element.width ?? 0) + strokeWidth,
            height: (element.height ?? 0) + strokeWidth,
        };
    }

    if (
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

    return null;
}

export function translateElement(
    element: BoardElement,
    dx: number,
    dy: number,
): Partial<BoardElement> {
    if (
        element.type === "pen" ||
        element.type === "line" ||
        element.type === "arrow"
    ) {
        return {
            points: element.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        };
    }

    return {
        x: (element.x ?? 0) + dx,
        y: (element.y ?? 0) + dy,
    };
}
