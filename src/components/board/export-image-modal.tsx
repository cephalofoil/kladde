"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Copy, HelpCircle } from "lucide-react";
import type { BoardElement, Point } from "@/lib/board-types";
import { getArrowheadPoints, normalizeArrowhead } from "@/lib/arrowheads";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExportImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    elements: BoardElement[];
    canvasBackground: "none" | "dots" | "lines" | "grid";
    selectedFrameId?: string | null;
}

type ExportScope = "scene" | "frame";

// Get bounding box for any element
function getBoundingBox(
    element: BoardElement,
): { x: number; y: number; width: number; height: number } | null {
    const rotationDeg = element.rotation ?? 0;

    if (
        element.type === "pen" ||
        element.type === "line" ||
        element.type === "arrow" ||
        element.type === "laser"
    ) {
        if (element.points.length === 0) return null;
        const xs = element.points.map((p) => p.x);
        const ys = element.points.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const padding = (element.strokeWidth || 2) * 2;
        const base = {
            x: minX - padding,
            y: minY - padding,
            width: Math.max(maxX - minX + padding * 2, 20),
            height: Math.max(maxY - minY + padding * 2, 20),
        };

        if (!rotationDeg) return base;

        const cx = base.x + base.width / 2;
        const cy = base.y + base.height / 2;
        const r = degToRad(rotationDeg);
        const cos = Math.cos(r);
        const sin = Math.sin(r);
        const corners = [
            { x: base.x, y: base.y },
            { x: base.x + base.width, y: base.y },
            { x: base.x + base.width, y: base.y + base.height },
            { x: base.x, y: base.y + base.height },
        ].map((p) => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
        });

        const minRX = Math.min(...corners.map((p) => p.x));
        const minRY = Math.min(...corners.map((p) => p.y));
        const maxRX = Math.max(...corners.map((p) => p.x));
        const maxRY = Math.max(...corners.map((p) => p.y));
        return {
            x: minRX,
            y: minRY,
            width: maxRX - minRX,
            height: maxRY - minRY,
        };
    }

    if (
        element.type === "rectangle" ||
        element.type === "diamond" ||
        element.type === "ellipse" ||
        element.type === "frame" ||
        element.type === "web-embed"
    ) {
        const base = {
            x: element.x ?? 0,
            y: element.y ?? 0,
            width: element.width ?? 0,
            height: element.height ?? 0,
        };

        if (!rotationDeg) return base;

        const cx = base.x + base.width / 2;
        const cy = base.y + base.height / 2;
        const r = degToRad(rotationDeg);
        const cos = Math.cos(r);
        const sin = Math.sin(r);
        const corners = [
            { x: base.x, y: base.y },
            { x: base.x + base.width, y: base.y },
            { x: base.x + base.width, y: base.y + base.height },
            { x: base.x, y: base.y + base.height },
        ].map((p) => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
        });

        const minRX = Math.min(...corners.map((p) => p.x));
        const minRY = Math.min(...corners.map((p) => p.y));
        const maxRX = Math.max(...corners.map((p) => p.x));
        const maxRY = Math.max(...corners.map((p) => p.y));
        return {
            x: minRX,
            y: minRY,
            width: maxRX - minRX,
            height: maxRY - minRY,
        };
    }

    if (element.type === "text") {
        const fontSize = (element.strokeWidth || 1) * 4 + 12;
        if (element.width !== undefined && element.height !== undefined) {
            const base = {
                x: element.x ?? 0,
                y: element.y ?? 0,
                width: element.width,
                height: element.height,
            };

            if (!rotationDeg) return base;

            const cx = base.x + base.width / 2;
            const cy = base.y + base.height / 2;
            const r = degToRad(rotationDeg);
            const cos = Math.cos(r);
            const sin = Math.sin(r);
            const corners = [
                { x: base.x, y: base.y },
                { x: base.x + base.width, y: base.y },
                { x: base.x + base.width, y: base.y + base.height },
                { x: base.x, y: base.y + base.height },
            ].map((p) => {
                const dx = p.x - cx;
                const dy = p.y - cy;
                return {
                    x: cx + dx * cos - dy * sin,
                    y: cy + dx * sin + dy * cos,
                };
            });

            const minRX = Math.min(...corners.map((p) => p.x));
            const minRY = Math.min(...corners.map((p) => p.y));
            const maxRX = Math.max(...corners.map((p) => p.x));
            const maxRY = Math.max(...corners.map((p) => p.y));
            return {
                x: minRX,
                y: minRY,
                width: maxRX - minRX,
                height: maxRY - minRY,
            };
        }
        const textWidth = (element.text?.length ?? 0) * fontSize * 0.55;
        const textHeight = fontSize * 1.2;
        const base = {
            x: element.x ?? 0,
            y: element.y ?? 0,
            width: Math.max(textWidth, 60),
            height: textHeight,
        };

        if (!rotationDeg) return base;

        const cx = base.x + base.width / 2;
        const cy = base.y + base.height / 2;
        const r = degToRad(rotationDeg);
        const cos = Math.cos(r);
        const sin = Math.sin(r);
        const corners = [
            { x: base.x, y: base.y },
            { x: base.x + base.width, y: base.y },
            { x: base.x + base.width, y: base.y + base.height },
            { x: base.x, y: base.y + base.height },
        ].map((p) => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
        });

        const minRX = Math.min(...corners.map((p) => p.x));
        const minRY = Math.min(...corners.map((p) => p.y));
        const maxRX = Math.max(...corners.map((p) => p.x));
        const maxRY = Math.max(...corners.map((p) => p.y));
        return {
            x: minRX,
            y: minRY,
            width: maxRX - minRX,
            height: maxRY - minRY,
        };
    }

    return null;
}

// Get combined bounding box for all elements
function getSceneBounds(elements: BoardElement[]): {
    x: number;
    y: number;
    width: number;
    height: number;
} {
    const boxes = elements.map((el) => getBoundingBox(el)).filter(Boolean) as {
        x: number;
        y: number;
        width: number;
        height: number;
    }[];

    if (boxes.length === 0) {
        return { x: 0, y: 0, width: 800, height: 600 };
    }

    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.width));
    const maxY = Math.max(...boxes.map((b) => b.y + b.height));

    const padding = 40;

    return {
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
    };
}

function getFrameBounds(
    elements: BoardElement[],
    frameId: string,
): { x: number; y: number; width: number; height: number } | null {
    const frame = elements.find(
        (el) => el.type === "frame" && el.id === frameId,
    );
    if (!frame) return null;
    return getBoundingBox(frame);
}

function getFrameElements(elements: BoardElement[], frameId: string) {
    return elements.filter((el) => el.id === frameId || el.frameId === frameId);
}

function resolveExportTargets(
    elements: BoardElement[],
    scope: ExportScope,
    frameId: string | null,
) {
    if (scope === "frame" && frameId) {
        const bounds = getFrameBounds(elements, frameId);
        if (bounds) {
            return {
                bounds,
                elements: getFrameElements(elements, frameId),
            };
        }
    }
    return {
        bounds: getSceneBounds(elements),
        elements,
    };
}

function degToRad(deg: number) {
    return (deg * Math.PI) / 180;
}

function getRotationTransform(el: BoardElement) {
    const rotationDeg = el.rotation ?? 0;
    if (!rotationDeg) return null;
    const b = getBoundingBox(el);
    if (!b) return null;
    return { rotationDeg, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
}

function getStrokeDash(el: BoardElement) {
    const style = el.strokeStyle || "solid";
    if (style === "dashed") return [10, 10];
    if (style === "dotted") return [2, 6];
    return [];
}

function seededRandom(seed: number) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
    };
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
    ctx.roundRect(x, y, width, height, cornerRadius);
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
            ctx.fillText(
                String(i * 5),
                innerX + innerW - barSize + 2,
                labelY + 3,
            );
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

function frameToSvg(el: BoardElement) {
    if (el.type !== "frame") return "";
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
              : el.fillColor || "none";
    const frameId = el.id.replace(/[^a-zA-Z0-9_-]/g, "");
    const defs: string[] = [];
    const overlays: string[] = [];

    if (frameStyle === "cutting-mat") {
        const gridSize = 20;
        const markerStep = gridSize * 5;
        const innerW = Math.max(width - strokeWidth * 2, 0);
        const innerH = Math.max(height - strokeWidth * 2, 0);
        defs.push(
            `<pattern id="cm-grid-${frameId}" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#5cb89f" stroke-width="1" opacity="0.45"/>
      </pattern>`,
        );
        defs.push(
            `<filter id="cm-noise-${frameId}">
        <feTurbulence type="fractalNoise" baseFrequency="2" numOctaves="3" stitchTiles="stitch"/>
      </filter>`,
        );
        overlays.push(
            `<rect x="${x + strokeWidth}" y="${y + strokeWidth}" width="${innerW}" height="${innerH}" fill="url(#cm-grid-${frameId})"/>`,
        );
        overlays.push(
            `<rect x="${x + strokeWidth}" y="${y + strokeWidth}" width="${innerW}" height="${Math.min(
                16,
                innerH,
            )}" fill="#2a685a" opacity="0.75"/>`,
        );
        overlays.push(
            `<rect x="${
                x + strokeWidth + Math.max(innerW - 16, 0)
            }" y="${y + strokeWidth}" width="${Math.min(
                16,
                innerW,
            )}" height="${Math.max(innerH, 0)}" fill="#2a685a" opacity="0.75"/>`,
        );
        overlays.push(
            `<rect x="${x + strokeWidth}" y="${y + strokeWidth}" width="${innerW}" height="${innerH}" fill="#ffffff" opacity="0.16" filter="url(#cm-noise-${frameId})"/>`,
        );
        overlays.push(
            `<line x1="${x + strokeWidth + 40}" y1="${
                y + strokeWidth + 70
            }" x2="${x + strokeWidth + 160}" y2="${
                y + strokeWidth + 90
            }" stroke="#1a4a3d" stroke-width="2" opacity="0.25"/>`,
        );
        overlays.push(
            `<text x="${x + strokeWidth + 8}" y="${
                y + height - strokeWidth - 12
            }" fill="#5cb89f" font-size="10" font-weight="800" opacity="0.6">SDi</text>`,
        );
        overlays.push(
            `<text x="${x + strokeWidth + 8}" y="${
                y + height - strokeWidth - 4
            }" fill="#5cb89f" font-size="6" font-weight="700" opacity="0.6">CUTTING MAT</text>`,
        );

        const topMarkers = Math.floor(innerW / markerStep);
        for (let i = 1; i <= topMarkers; i += 1) {
            const labelX = x + strokeWidth + i * markerStep;
            if (labelX > x + strokeWidth + innerW - 16) continue;
            overlays.push(
                `<text x="${labelX}" y="${y + strokeWidth + 11}" fill="#5cb89f" font-size="8" font-weight="700" opacity="0.8" text-anchor="middle">${i * 5}</text>`,
            );
        }
        const rightMarkers = Math.floor(innerH / markerStep);
        for (let i = 1; i <= rightMarkers; i += 1) {
            const labelY = y + strokeWidth + i * markerStep;
            if (labelY > y + strokeWidth + innerH - 16) continue;
            overlays.push(
                `<text x="${
                    x + strokeWidth + innerW - 4
                }" y="${labelY}" fill="#5cb89f" font-size="8" font-weight="700" opacity="0.8" text-anchor="end" dominant-baseline="middle">${i * 5}</text>`,
            );
        }
    }

    if (frameStyle === "notebook") {
        const spineWidth = Math.min(24, width * 0.18);
        overlays.push(
            `<rect x="${x + strokeWidth}" y="${y + strokeWidth}" width="${spineWidth}" height="${Math.max(
                height - strokeWidth * 2,
                0,
            )}" fill="#1e5a5a" opacity="0.65"/>`,
        );
        overlays.push(
            `<rect x="${
                x + width - strokeWidth - Math.min(24, width * 0.2)
            }" y="${y + strokeWidth + height * 0.3}" width="${Math.min(
                24,
                width * 0.2,
            )}" height="${Math.min(36, height * 0.2)}" fill="#e8dcc8"/>`,
        );
    }

    return `
    ${defs.length ? `<defs>${defs.join("")}</defs>` : ""}
    <rect x="${x}" y="${y}" width="${width}" height="${height}" stroke="${el.strokeColor}" stroke-width="${strokeWidth}" fill="${baseFill}" rx="${cornerRadius}" opacity="${(el.opacity ?? 100) / 100}"/>
    ${overlays.join("")}
  `;
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

    if (
        normalized === "crowfoot_many" ||
        normalized === "crowfoot_one_or_many"
    ) {
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

function svgConnector(el: BoardElement, opacity: number) {
    if ((el.type !== "line" && el.type !== "arrow") || el.points.length < 2)
        return "";

    const start = el.points[0];
    const end = el.points[el.points.length - 1];
    const hasCorner = el.points.length >= 3;
    const control = hasCorner ? el.points[1] : null;
    const style = el.connectorStyle || "sharp";
    const route = getConnectorRoute(el, start, end);
    const cap = el.lineCap || "round";
    const dash =
        (el.strokeStyle || "solid") === "dashed"
            ? "10,10"
            : (el.strokeStyle || "solid") === "dotted"
              ? "2,6"
              : "";
    const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";

    let base = "";
    if (!hasCorner || !control) {
        base = `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="${cap}" opacity="${opacity}"${dashAttr}/>`;
    } else if (style === "curved") {
        const d = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
        base = `<path d="${d}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" fill="none" stroke-linecap="${cap}" stroke-linejoin="round" opacity="${opacity}"${dashAttr}/>`;
    } else if (style === "elbow") {
        const pts =
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
        base = `<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(" ")}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" fill="none" stroke-linecap="${cap}" stroke-linejoin="round" opacity="${opacity}"${dashAttr}/>`;
    } else {
        base = `<polyline points="${[start, control, end].map((p) => `${p.x},${p.y}`).join(" ")}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" fill="none" stroke-linecap="${cap}" stroke-linejoin="round" opacity="${opacity}"${dashAttr}/>`;
    }

    if (el.type !== "arrow") return base;

    const markerStart = el.arrowStart || "none";
    const markerEnd = el.arrowEnd || "arrow";

    const svgMarker = (
        marker: NonNullable<BoardElement["arrowEnd"]>,
        tip: Point,
        from: Point,
    ) => {
        const normalized = normalizeArrowhead(marker);
        if (normalized === "none") return "";

        const points = getArrowheadPoints(
            tip,
            from,
            normalized,
            el.strokeWidth,
        );
        if (!points) return "";

        const outline = Math.min(Math.max(1.5, el.strokeWidth), 6);
        const line = (x1: number, y1: number, x2: number, y2: number) =>
            `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="${cap}" opacity="${opacity}"/>`;

        if (
            normalized === "circle" ||
            normalized === "circle_outline" ||
            normalized === "dot"
        ) {
            const [cx, cy, diameter] = points;
            const r = diameter / 2;
            if (normalized === "circle_outline") {
                return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${el.strokeColor}" stroke-width="${outline}" opacity="${opacity}"/>`;
            }
            return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${el.strokeColor}" opacity="${opacity}"/>`;
        }

        if (normalized === "triangle" || normalized === "triangle_outline") {
            const [x1, y1, x2, y2, x3, y3] = points;
            if (normalized === "triangle_outline") {
                return `
    <polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="none" stroke="${el.strokeColor}" stroke-width="${outline}" stroke-linejoin="round" opacity="${opacity}"/>`;
            }
            return `
    <polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${el.strokeColor}" opacity="${opacity}"/>`;
        }

        if (normalized === "diamond" || normalized === "diamond_outline") {
            const [x1, y1, x2, y2, x3, y3, x4, y4] = points;
            if (normalized === "diamond_outline") {
                return `
    <polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}" fill="none" stroke="${el.strokeColor}" stroke-width="${outline}" stroke-linejoin="round" opacity="${opacity}"/>`;
            }
            return `
    <polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}" fill="${el.strokeColor}" opacity="${opacity}"/>`;
        }

        if (normalized === "bar") {
            const [, , x2, y2, x3, y3] = points;
            return line(x2, y2, x3, y3);
        }

        if (normalized === "crowfoot_one") {
            const [, , x2, y2, x3, y3] = points;
            return line(x2, y2, x3, y3);
        }

        if (
            normalized === "crowfoot_many" ||
            normalized === "crowfoot_one_or_many"
        ) {
            const [x1, y1, x2, y2, x3, y3] = points;
            const base = `${line(x1, y1, x2, y2)}${line(x1, y1, x3, y3)}`;
            if (normalized === "crowfoot_one_or_many") {
                const barPoints = getArrowheadPoints(
                    tip,
                    from,
                    "crowfoot_one",
                    el.strokeWidth,
                );
                if (barPoints) {
                    const [, , bx1, by1, bx2, by2] = barPoints;
                    return `${base}${line(bx1, by1, bx2, by2)}`;
                }
            }
            return base;
        }

        const [x1, y1, x2, y2, x3, y3] = points;
        return `${line(x1, y1, x2, y2)}${line(x1, y1, x3, y3)}`;
    };

    const fromForStart =
        style === "curved" && control
            ? control
            : style === "elbow" && control
              ? route === "vertical"
                  ? { x: control.x, y: start.y }
                  : { x: start.x, y: control.y }
              : control || end;

    const fromForEnd =
        style === "curved" && control
            ? control
            : style === "elbow" && control
              ? route === "vertical"
                  ? { x: control.x, y: end.y }
                  : { x: end.x, y: control.y }
              : control || start;

    return `${base}${svgMarker(markerStart, start, fromForStart)}${svgMarker(markerEnd, end, fromForEnd)}`;
}

export function ExportImageModal({
    isOpen,
    onClose,
    elements,
    canvasBackground,
    selectedFrameId = null,
}: ExportImageModalProps) {
    const [includeBackground, setIncludeBackground] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [embedScene, setEmbedScene] = useState(false);
    const [scale, setScale] = useState<1 | 2 | 3>(2);
    const [fileName, setFileName] = useState("");
    const [exportScope, setExportScope] = useState<ExportScope>("scene");
    const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const frameOptions = elements.filter((el) => el.type === "frame");

    useEffect(() => {
        if (!isOpen) return;
        if (frameOptions.length === 0) {
            setExportScope("scene");
            setActiveFrameId(null);
            return;
        }
        if (
            selectedFrameId &&
            frameOptions.some((f) => f.id === selectedFrameId)
        ) {
            setExportScope("frame");
            setActiveFrameId(selectedFrameId);
            return;
        }
        if (frameOptions.length > 0 && !activeFrameId) {
            setActiveFrameId(frameOptions[0].id);
        }
    }, [isOpen, selectedFrameId, frameOptions, activeFrameId]);

    useEffect(() => {
        if (exportScope !== "frame") return;
        if (activeFrameId) return;
        if (frameOptions.length === 0) return;
        setActiveFrameId(frameOptions[0].id);
    }, [exportScope, activeFrameId, frameOptions]);

    useEffect(() => {
        if (!isOpen) return;
        const date = new Date().toISOString().split("T")[0];
        setFileName(`kladde-${date}`);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const frame = requestAnimationFrame(() => {
            updatePreview();
        });
        return () => cancelAnimationFrame(frame);
    }, [
        isOpen,
        includeBackground,
        darkMode,
        elements,
        canvasBackground,
        scale,
        exportScope,
        activeFrameId,
    ]);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
        }
    };
    const toggleClassName =
        "border border-border/60 data-[state=on]:bg-muted/70 data-[state=on]:text-foreground data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm";
    const toggleGroupItemClassName = `w-full ${toggleClassName}`;

    const updatePreview = () => {
        const canvas = previewCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const { bounds, elements: exportElements } = resolveExportTargets(
            elements,
            exportScope,
            activeFrameId,
        );
        const orderedElements = [...exportElements].sort(
            (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
        );
        const maxPreviewWidth = 520;
        const maxPreviewHeight = 320;
        const exportWidth = bounds.width * scale;
        const exportHeight = bounds.height * scale;
        const fitScale = Math.min(
            maxPreviewWidth / exportWidth,
            maxPreviewHeight / exportHeight,
            1,
        );
        const previewScale = fitScale * scale;

        canvas.width = Math.max(1, Math.floor(bounds.width * previewScale));
        canvas.height = Math.max(1, Math.floor(bounds.height * previewScale));

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background
        if (includeBackground) {
            ctx.fillStyle = darkMode ? "#0a0a0a" : "#f2f2f2";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw grid pattern if enabled
            if (canvasBackground !== "none") {
                ctx.save();
                ctx.strokeStyle = darkMode
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.08)";
                ctx.lineWidth = 1;

                const spacing = 40 * previewScale;

                if (
                    canvasBackground === "grid" ||
                    canvasBackground === "lines"
                ) {
                    for (let x = 0; x <= canvas.width; x += spacing) {
                        ctx.beginPath();
                        ctx.moveTo(x, 0);
                        ctx.lineTo(x, canvas.height);
                        ctx.stroke();
                    }
                }

                if (canvasBackground === "grid") {
                    for (let y = 0; y <= canvas.height; y += spacing) {
                        ctx.beginPath();
                        ctx.moveTo(0, y);
                        ctx.lineTo(canvas.width, y);
                        ctx.stroke();
                    }
                }

                if (canvasBackground === "dots") {
                    ctx.fillStyle = darkMode
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.08)";
                    for (let x = 0; x <= canvas.width; x += spacing) {
                        for (let y = 0; y <= canvas.height; y += spacing) {
                            ctx.beginPath();
                            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }

                ctx.restore();
            }
        }

        // Draw elements (simplified preview)
        ctx.save();
        ctx.scale(previewScale, previewScale);
        ctx.translate(-bounds.x, -bounds.y);

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
                ctx.roundRect(
                    el.x!,
                    el.y!,
                    el.width!,
                    el.height!,
                    el.cornerRadius ?? 0,
                );
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
            } else if (el.type === "text") {
                const fontSize = (el.strokeWidth || 1) * 4 + 12;
                ctx.fillStyle = el.strokeColor;
                ctx.font = `${fontSize}px sans-serif`;
                ctx.fillText(el.text || "", el.x ?? 0, (el.y ?? 0) + fontSize);
            }

            ctx.restore();
        });

        ctx.restore();
    };

    const exportImage = async (format: "png" | "svg") => {
        if (format === "png") {
            await exportPNG();
        } else {
            await exportSVG();
        }
    };

    const exportPNG = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const { bounds, elements: exportElements } = resolveExportTargets(
            elements,
            exportScope,
            activeFrameId,
        );
        const orderedElements = [...exportElements].sort(
            (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
        );

        canvas.width = bounds.width * scale;
        canvas.height = bounds.height * scale;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);

        // Draw background
        if (includeBackground) {
            ctx.fillStyle = darkMode ? "#0a0a0a" : "#f2f2f2";
            ctx.fillRect(0, 0, bounds.width, bounds.height);

            // Draw grid pattern
            if (canvasBackground !== "none") {
                ctx.save();
                ctx.strokeStyle = darkMode
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.08)";
                ctx.lineWidth = 1;

                const spacing = 40;

                if (
                    canvasBackground === "grid" ||
                    canvasBackground === "lines"
                ) {
                    for (let x = 0; x <= bounds.width; x += spacing) {
                        ctx.beginPath();
                        ctx.moveTo(x, 0);
                        ctx.lineTo(x, bounds.height);
                        ctx.stroke();
                    }
                }

                if (canvasBackground === "grid") {
                    for (let y = 0; y <= bounds.height; y += spacing) {
                        ctx.beginPath();
                        ctx.moveTo(0, y);
                        ctx.lineTo(bounds.width, y);
                        ctx.stroke();
                    }
                }

                if (canvasBackground === "dots") {
                    ctx.fillStyle = darkMode
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.08)";
                    for (let x = 0; x <= bounds.width; x += spacing) {
                        for (let y = 0; y <= bounds.height; y += spacing) {
                            ctx.beginPath();
                            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }

                ctx.restore();
            }
        }

        // Draw elements
        ctx.translate(-bounds.x, -bounds.y);

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
                ctx.roundRect(
                    el.x!,
                    el.y!,
                    el.width!,
                    el.height!,
                    el.cornerRadius ?? 0,
                );
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
            } else if (el.type === "pen") {
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
                const fontSize = (el.strokeWidth || 1) * 4 + 12;
                ctx.fillStyle = el.strokeColor;
                ctx.font = `${fontSize}px sans-serif`;
                ctx.textBaseline = "top";

                if (el.isTextBox && el.width && el.height) {
                    const padding = 8;
                    const lineHeight = fontSize * 1.25;
                    const lines = (el.text || "").split("\n");
                    let yOffset = (el.y ?? 0) + padding;

                    lines.forEach((line) => {
                        ctx.fillText(line, (el.x ?? 0) + padding, yOffset);
                        yOffset += lineHeight;
                    });
                } else {
                    ctx.fillText(el.text || "", el.x ?? 0, el.y ?? 0);
                }
            }

            ctx.restore();
        });

        // Convert to blob and download
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${fileName || "export"}.png`;
            link.click();
            URL.revokeObjectURL(url);
        });
    };

    const exportSVG = async () => {
        const { bounds, elements: exportElements } = resolveExportTargets(
            elements,
            exportScope,
            activeFrameId,
        );
        const orderedElements = [...exportElements].sort(
            (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
        );

        let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${bounds.width * scale}" height="${bounds.height * scale}" viewBox="0 0 ${bounds.width} ${bounds.height}" xmlns="http://www.w3.org/2000/svg">`;

        // Add background
        if (includeBackground) {
            svgContent += `\n  <rect width="${bounds.width}" height="${bounds.height}" fill="${darkMode ? "#0a0a0a" : "#f2f2f2"}"/>`;

            // Add grid pattern
            if (canvasBackground !== "none") {
                const spacing = 40;
                const color = darkMode
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.08)";

                if (canvasBackground === "grid") {
                    svgContent += `\n  <defs>
    <pattern id="grid" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
      <path d="M ${spacing} 0 L 0 0 0 ${spacing}" fill="none" stroke="${color}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${bounds.width}" height="${bounds.height}" fill="url(#grid)"/>`;
                } else if (canvasBackground === "dots") {
                    svgContent += `\n  <defs>
    <pattern id="dots" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
      <circle cx="0" cy="0" r="1.5" fill="${color}"/>
    </pattern>
  </defs>
  <rect width="${bounds.width}" height="${bounds.height}" fill="url(#dots)"/>`;
                } else if (canvasBackground === "lines") {
                    svgContent += `\n  <defs>
    <pattern id="lines" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
      <path d="M ${spacing} 0 L 0 0" fill="none" stroke="${color}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${bounds.width}" height="${bounds.height}" fill="url(#lines)"/>`;
                }
            }
        }

        // Add elements
        svgContent += `\n  <g transform="translate(${-bounds.x}, ${-bounds.y})">`;

        orderedElements.forEach((el) => {
            const opacity = (el.opacity ?? 100) / 100;
            const rot = getRotationTransform(el);

            let content = "";
            if (el.type === "frame") {
                content = frameToSvg(el);
            } else if (el.type === "rectangle") {
                content = `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" fill="${el.fillColor || "none"}" rx="${el.cornerRadius ?? 0}" opacity="${opacity}"/>`;
            } else if (el.type === "ellipse") {
                const cx = (el.x ?? 0) + (el.width ?? 0) / 2;
                const cy = (el.y ?? 0) + (el.height ?? 0) / 2;
                content = `<ellipse cx="${cx}" cy="${cy}" rx="${(el.width ?? 0) / 2}" ry="${(el.height ?? 0) / 2}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" fill="${el.fillColor || "none"}" opacity="${opacity}"/>`;
            } else if (
                (el.type === "line" || el.type === "arrow") &&
                el.points.length >= 2
            ) {
                content = svgConnector(el, opacity);
            } else if (el.type === "pen" && el.points.length > 0) {
                const pathData = `M ${el.points.map((p) => `${p.x},${p.y}`).join(" L ")}`;
                content = `<path d="${pathData}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
            } else if (el.type === "text") {
                const fontSize = (el.strokeWidth || 1) * 4 + 12;
                content = `<text x="${el.x}" y="${(el.y ?? 0) + fontSize}" fill="${el.strokeColor}" font-size="${fontSize}" font-family="sans-serif" opacity="${opacity}">${el.text || ""}</text>`;
            }

            if (!content) return;

            if (rot) {
                svgContent += `\n    <g transform="rotate(${rot.rotationDeg} ${rot.cx} ${rot.cy})">\n      ${content}\n    </g>`;
            } else {
                svgContent += `\n    ${content}`;
            }
        });

        svgContent += "\n  </g>";

        // Embed scene data if requested
        if (embedScene) {
            const sceneData = JSON.stringify({
                type: "kladde",
                version: 1,
                elements: exportElements,
                appState: { canvasBackground },
                exportScope,
                frameId: exportScope === "frame" ? activeFrameId : null,
            });
            svgContent += `\n  <metadata>
    <kladde>${sceneData}</kladde>
  </metadata>`;
        }

        svgContent += "\n</svg>";

        // Download SVG
        const blob = new Blob([svgContent], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileName || "export"}.svg`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const copyToClipboard = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const { bounds, elements: exportElements } = resolveExportTargets(
            elements,
            exportScope,
            activeFrameId,
        );
        const orderedElements = [...exportElements].sort(
            (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
        );

        canvas.width = bounds.width * scale;
        canvas.height = bounds.height * scale;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);

        if (includeBackground) {
            ctx.fillStyle = darkMode ? "#0a0a0a" : "#f2f2f2";
            ctx.fillRect(0, 0, bounds.width, bounds.height);
        }

        ctx.translate(-bounds.x, -bounds.y);

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
                ctx.roundRect(
                    el.x!,
                    el.y!,
                    el.width!,
                    el.height!,
                    el.cornerRadius ?? 0,
                );
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
            } else if (el.type === "pen") {
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
                const fontSize = (el.strokeWidth || 1) * 4 + 12;
                ctx.fillStyle = el.strokeColor;
                ctx.font = `${fontSize}px sans-serif`;
                ctx.textBaseline = "top";

                if (el.isTextBox && el.width && el.height) {
                    const padding = 8;
                    const lineHeight = fontSize * 1.25;
                    const lines = (el.text || "").split("\n");
                    let yOffset = (el.y ?? 0) + padding;

                    lines.forEach((line) => {
                        ctx.fillText(line, (el.x ?? 0) + padding, yOffset);
                        yOffset += lineHeight;
                    });
                } else {
                    ctx.fillText(el.text || "", el.x ?? 0, el.y ?? 0);
                }
            }

            ctx.restore();
        });

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": blob }),
                ]);
            } catch (err) {
                console.error("Failed to copy to clipboard:", err);
            }
        });
    };

    if (!isOpen) {
        return <Dialog open={false} onOpenChange={handleOpenChange} />;
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-5xl w-[min(960px,95vw)] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Export image</DialogTitle>
                    <DialogDescription>
                        Export the canvas or a frame as PNG or SVG.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="space-y-4">
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 flex min-h-[220px] items-center justify-center">
                            <canvas
                                ref={previewCanvasRef}
                                className="max-h-[320px] max-w-full rounded-md"
                                style={{ imageRendering: "auto" }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="export-file-name">File name</Label>
                            <Input
                                id="export-file-name"
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                placeholder="File name"
                                data-dialog-initial-focus
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {frameOptions.length > 0 && (
                            <div className="space-y-2">
                                <Label>Scope</Label>
                                <ToggleGroup
                                    type="single"
                                    value={exportScope}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        setExportScope(value as ExportScope);
                                    }}
                                    className="grid grid-cols-2 gap-2"
                                >
                                    <ToggleGroupItem
                                        value="scene"
                                        className={toggleGroupItemClassName}
                                    >
                                        Canvas
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="frame"
                                        className={toggleGroupItemClassName}
                                    >
                                        Frame
                                    </ToggleGroupItem>
                                </ToggleGroup>
                                {exportScope === "frame" && (
                                    <Select
                                        value={activeFrameId ?? ""}
                                        onValueChange={(value) =>
                                            setActiveFrameId(value)
                                        }
                                    >
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select frame" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {frameOptions.map(
                                                (frame, index) => (
                                                    <SelectItem
                                                        key={frame.id}
                                                        value={frame.id}
                                                    >
                                                        {(
                                                            frame.label ??
                                                            "Frame"
                                                        ).trim() ||
                                                            `Frame ${index + 1}`}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label>Background</Label>
                                <p className="text-xs text-muted-foreground">
                                    Include the canvas background.
                                </p>
                            </div>
                            <Toggle
                                pressed={includeBackground}
                                onPressedChange={setIncludeBackground}
                                size="sm"
                                className={toggleClassName}
                            >
                                {includeBackground ? "On" : "Off"}
                            </Toggle>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label>Dark mode</Label>
                                <p className="text-xs text-muted-foreground">
                                    Export with a dark background.
                                </p>
                            </div>
                            <Toggle
                                pressed={darkMode}
                                onPressedChange={setDarkMode}
                                size="sm"
                                className={toggleClassName}
                            >
                                {darkMode ? "On" : "Off"}
                            </Toggle>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Label>Embed scene</Label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground"
                                            aria-label="Embed scene info"
                                        >
                                            <HelpCircle className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" sideOffset={8}>
                                        Scene data is saved inside the file so
                                        it can be restored later.
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Toggle
                                pressed={embedScene}
                                onPressedChange={setEmbedScene}
                                size="sm"
                                className={toggleClassName}
                            >
                                {embedScene ? "On" : "Off"}
                            </Toggle>
                        </div>

                        <div className="space-y-2">
                            <Label>Scale</Label>
                            <ToggleGroup
                                type="single"
                                value={scale.toString()}
                                onValueChange={(value) => {
                                    if (!value) return;
                                    setScale(Number(value) as 1 | 2 | 3);
                                }}
                                className="grid grid-cols-3 gap-2"
                            >
                                <ToggleGroupItem
                                    value="1"
                                    className={toggleGroupItemClassName}
                                >
                                    1x
                                </ToggleGroupItem>
                                <ToggleGroupItem
                                    value="2"
                                    className={toggleGroupItemClassName}
                                >
                                    2x
                                </ToggleGroupItem>
                                <ToggleGroupItem
                                    value="3"
                                    className={toggleGroupItemClassName}
                                >
                                    3x
                                </ToggleGroupItem>
                            </ToggleGroup>
                            <p className="text-xs text-muted-foreground">
                                Higher scales create larger images.
                            </p>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <Button onClick={() => exportImage("png")}>
                                    <Download className="h-4 w-4" />
                                    PNG
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => exportImage("svg")}
                                >
                                    <Download className="h-4 w-4" />
                                    SVG
                                </Button>
                            </div>
                            <Button variant="outline" onClick={copyToClipboard}>
                                <Copy className="h-4 w-4" />
                                Copy to clipboard
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>

            {/* Hidden canvas for export */}
            <canvas ref={canvasRef} className="hidden" />
        </Dialog>
    );
}
