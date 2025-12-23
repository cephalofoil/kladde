import type { Point } from "@/lib/board-types";
import type { BoundingBox, ResizeHandle, RotateHandleSide } from "./types";

export function degToRad(deg: number) {
    return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number) {
    return (rad * 180) / Math.PI;
}

export function normalizeAngleDeg(angleDeg: number) {
    let a = angleDeg % 360;
    if (a >= 180) a -= 360;
    if (a < -180) a += 360;
    return a;
}

export function rotatePoint(point: Point, center: Point, angleDeg: number): Point {
    const r = degToRad(angleDeg);
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
    };
}

export function rotateVector(vector: Point, angleDeg: number): Point {
    const r = degToRad(angleDeg);
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    return {
        x: vector.x * cos - vector.y * sin,
        y: vector.x * sin + vector.y * cos,
    };
}

export function getBoundsCenter(bounds: BoundingBox): Point {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function expandBounds(bounds: BoundingBox, padding: number): BoundingBox {
    const p = Math.max(0, padding);
    return {
        x: bounds.x - p,
        y: bounds.y - p,
        width: bounds.width + p * 2,
        height: bounds.height + p * 2,
    };
}

export function isBoundsFullyInsideBox(bounds: BoundingBox, box: BoundingBox) {
    return (
        bounds.x >= box.x &&
        bounds.y >= box.y &&
        bounds.x + bounds.width <= box.x + box.width &&
        bounds.y + bounds.height <= box.y + box.height
    );
}

export function getHandlePointFromBounds(
    bounds: BoundingBox,
    handle: Exclude<ResizeHandle, null>,
): Point {
    switch (handle) {
        case "nw":
            return { x: bounds.x, y: bounds.y };
        case "n":
            return { x: bounds.x + bounds.width / 2, y: bounds.y };
        case "ne":
            return { x: bounds.x + bounds.width, y: bounds.y };
        case "e":
            return {
                x: bounds.x + bounds.width,
                y: bounds.y + bounds.height / 2,
            };
        case "se":
            return { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
        case "s":
            return {
                x: bounds.x + bounds.width / 2,
                y: bounds.y + bounds.height,
            };
        case "sw":
            return { x: bounds.x, y: bounds.y + bounds.height };
        case "w":
            return { x: bounds.x, y: bounds.y + bounds.height / 2 };
    }
}

export function getHandleLocalOffset(
    handle: Exclude<ResizeHandle, null>,
    width: number,
    height: number,
): Point {
    const hw = width / 2;
    const hh = height / 2;
    switch (handle) {
        case "nw":
            return { x: -hw, y: -hh };
        case "n":
            return { x: 0, y: -hh };
        case "ne":
            return { x: hw, y: -hh };
        case "e":
            return { x: hw, y: 0 };
        case "se":
            return { x: hw, y: hh };
        case "s":
            return { x: 0, y: hh };
        case "sw":
            return { x: -hw, y: hh };
        case "w":
            return { x: -hw, y: 0 };
    }
}

export function getOppositeResizeHandle(
    handle: Exclude<ResizeHandle, null>,
): Exclude<ResizeHandle, null> {
    switch (handle) {
        case "n":
            return "s";
        case "ne":
            return "sw";
        case "e":
            return "w";
        case "se":
            return "nw";
        case "s":
            return "n";
        case "sw":
            return "ne";
        case "w":
            return "e";
        case "nw":
            return "se";
    }
}

export function getWorldResizeHandle(
    pos: Point,
    center: Point,
): Exclude<ResizeHandle, null> {
    const angleDeg = radToDeg(Math.atan2(pos.y - center.y, pos.x - center.x));
    const candidates: Array<{ h: Exclude<ResizeHandle, null>; a: number }> = [
        { h: "e", a: 0 },
        { h: "se", a: 45 },
        { h: "s", a: 90 },
        { h: "sw", a: 135 },
        { h: "w", a: 180 },
        { h: "nw", a: -135 },
        { h: "n", a: -90 },
        { h: "ne", a: -45 },
    ];

    let best = candidates[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
        const dist = Math.abs(normalizeAngleDeg(angleDeg - c.a));
        if (dist < bestDist) {
            bestDist = dist;
            best = c;
        }
    }
    return best.h;
}

export function getResizeCursor(handle: Exclude<ResizeHandle, null>) {
    switch (handle) {
        case "n":
        case "s":
            return "ns-resize";
        case "e":
        case "w":
            return "ew-resize";
        case "ne":
        case "sw":
            return "nesw-resize";
        case "nw":
        case "se":
            return "nwse-resize";
    }
}

export function getHandleDirection(handle: Exclude<ResizeHandle, null>): Point {
    switch (handle) {
        case "n":
            return { x: 0, y: -1 };
        case "ne":
            return { x: 1, y: -1 };
        case "e":
            return { x: 1, y: 0 };
        case "se":
            return { x: 1, y: 1 };
        case "s":
            return { x: 0, y: 1 };
        case "sw":
            return { x: -1, y: 1 };
        case "w":
            return { x: -1, y: 0 };
        case "nw":
            return { x: -1, y: -1 };
    }
}

export function getRotatedResizeCursor(
    handle: Exclude<ResizeHandle, null>,
    rotationDeg: number,
) {
    if (!rotationDeg) return getResizeCursor(handle);
    const world = rotateVector(getHandleDirection(handle), rotationDeg);
    const worldHandle = getWorldResizeHandle(world, { x: 0, y: 0 });
    return getResizeCursor(worldHandle);
}

export function getResizeHandleFromSelectionEdge(
    point: Point,
    bounds: BoundingBox,
    rotationDeg: number,
    threshold: number,
): Exclude<ResizeHandle, null> | null {
    const center = getBoundsCenter(bounds);
    const local = rotationDeg
        ? rotatePoint(point, center, -rotationDeg)
        : point;

    const left = bounds.x;
    const right = bounds.x + bounds.width;
    const top = bounds.y;
    const bottom = bounds.y + bounds.height;

    const withinX = local.x >= left - threshold && local.x <= right + threshold;
    const withinY = local.y >= top - threshold && local.y <= bottom + threshold;

    if (!withinX || !withinY) return null;

    const dLeft = Math.abs(local.x - left);
    const dRight = Math.abs(local.x - right);
    const dTop = Math.abs(local.y - top);
    const dBottom = Math.abs(local.y - bottom);

    const candidates: Array<{ h: Exclude<ResizeHandle, null>; d: number }> = [];
    if (local.y >= top - threshold && local.y <= bottom + threshold) {
        if (dLeft <= threshold) candidates.push({ h: "w", d: dLeft });
        if (dRight <= threshold) candidates.push({ h: "e", d: dRight });
    }
    if (local.x >= left - threshold && local.x <= right + threshold) {
        if (dTop <= threshold) candidates.push({ h: "n", d: dTop });
        if (dBottom <= threshold) candidates.push({ h: "s", d: dBottom });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.d - b.d);
    return candidates[0].h;
}

export function chooseRotateHandleSide(rotationDeg: number): RotateHandleSide {
    const targetWorldAngle = -90; // screen "up"
    const candidates: Array<{ side: RotateHandleSide; normalDeg: number }> = [
        { side: "n", normalDeg: -90 },
        { side: "e", normalDeg: 0 },
        { side: "s", normalDeg: 90 },
        { side: "w", normalDeg: 180 },
    ];

    let best = candidates[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
        const worldAngle = rotationDeg + c.normalDeg;
        const dist = Math.abs(normalizeAngleDeg(worldAngle - targetWorldAngle));
        if (dist < bestDist) {
            bestDist = dist;
            best = c;
        }
    }
    return best.side;
}

export function getContrastingTextColor(bgColor: string): string {
    const hex = bgColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
}
