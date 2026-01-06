import type { CSSProperties } from "react";
import type { Tool, BoardElement } from "@/lib/board-types";
import { getRotatedResizeCursor } from "../geometry";
import type { ResizeHandle } from "../types";

interface CursorStyleOptions {
    tool: Tool;
    isDragging: boolean;
    isPanning: boolean;
    isRotating: boolean;
    isResizing: boolean;
    resizeHandle: ResizeHandle;
    selectedIds: string[];
    elements: BoardElement[];
    hoverCursor: string | null;
}

export function getCanvasCursorStyle({
    tool,
    isDragging,
    isPanning,
    isRotating,
    isResizing,
    resizeHandle,
    selectedIds,
    elements,
    hoverCursor,
}: CursorStyleOptions) {
    if (isDragging) return "grabbing";
    if (isPanning) return "grabbing";
    if (isRotating) return "grabbing";
    if (isResizing) {
        if (resizeHandle && selectedIds.length === 1) {
            const selectedElement = elements.find(
                (el) => el.id === selectedIds[0],
            );
            const rotationDeg = selectedElement?.rotation ?? 0;
            return getRotatedResizeCursor(resizeHandle, rotationDeg);
        }

        switch (resizeHandle) {
            case "nw":
            case "se":
                return "nwse-resize";
            case "ne":
            case "sw":
                return "nesw-resize";
            case "n":
            case "s":
                return "ns-resize";
            case "e":
            case "w":
                return "ew-resize";
        }
    }

    switch (tool) {
        case "hand":
            return "grab";
        case "pen":
        case "line":
        case "arrow":
        case "rectangle":
        case "diamond":
        case "ellipse":
        case "frame":
        case "lasso":
            return "crosshair";
        case "eraser":
            return "none";
        case "select":
            return (
                hoverCursor ?? (selectedIds.length > 0 ? "grab" : "crosshair")
            );
        case "text":
            return "text";
        case "laser":
            return "none";
        default:
            return "crosshair";
    }
}

interface BackgroundStyleOptions {
    canvasBackground: "none" | "dots" | "lines" | "grid";
    pan: { x: number; y: number };
    zoom: number;
}

export function getCanvasBackgroundStyle({
    canvasBackground,
    pan,
    zoom,
}: BackgroundStyleOptions): CSSProperties {
    const spacing = 40 * zoom;
    const position = `${pan.x}px ${pan.y}px`;
    const gridColor = "currentColor";

    switch (canvasBackground) {
        case "grid":
            return {
                backgroundImage: `\n            linear-gradient(to right, ${gridColor} 1px, transparent 1px),\n            linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)\n          `,
                backgroundSize: `${spacing}px ${spacing}px`,
                backgroundPosition: position,
            };
        case "dots":
            return {
                backgroundImage: `radial-gradient(circle, ${gridColor} 1.5px, transparent 1.5px)`,
                backgroundSize: `${spacing}px ${spacing}px`,
                backgroundPosition: position,
            };
        case "lines":
            return {
                backgroundImage: `linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
                backgroundSize: `${spacing}px ${spacing}px`,
                backgroundPosition: position,
            };
        case "none":
        default:
            return {
                backgroundImage: "none",
            };
    }
}
