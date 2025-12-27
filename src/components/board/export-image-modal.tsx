"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Copy, HelpCircle } from "lucide-react";
import type { BoardElement, Point } from "@/lib/board-types";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExportImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: BoardElement[];
  canvasBackground: "none" | "dots" | "lines" | "grid";
}

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
    return { x: minRX, y: minRY, width: maxRX - minRX, height: maxRY - minRY };
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
    return { x: minRX, y: minRY, width: maxRX - minRX, height: maxRY - minRY };
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
    return { x: minRX, y: minRY, width: maxRX - minRX, height: maxRY - minRY };
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

function getConnectorRoute(el: BoardElement, start: Point, end: Point) {
  return (
    el.elbowRoute ??
    (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
      ? "vertical"
      : "horizontal")
  );
}

function getArrowHeadPoints(tip: Point, from: Point, size: number) {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const spread = (28 * Math.PI) / 180;
  const a1 = angle + Math.PI - spread;
  const a2 = angle + Math.PI + spread;
  return [
    { x: tip.x + Math.cos(a1) * size, y: tip.y + Math.sin(a1) * size },
    { x: tip.x + Math.cos(a2) * size, y: tip.y + Math.sin(a2) * size },
  ];
}

function getMarkerBasis(tip: Point, from: Point) {
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
  if (marker === "none") return;

  const size = Math.max(6, strokeWidth * 3);
  const { bx, by, px, py } = getMarkerBasis(tip, from);

  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = strokeColor;
  ctx.lineWidth = Math.max(1.5, strokeWidth);
  ctx.lineCap = lineCap;
  ctx.lineJoin = "round";
  ctx.setLineDash([]);

  const outlineWidth = Math.min(ctx.lineWidth, 6);

  if (marker === "arrow") {
    const [a, b] = getArrowHeadPoints(tip, from, size);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(a.x, a.y);
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (marker === "triangle" || marker === "triangle-outline") {
    const back = size * 1.1;
    const spread = size * 0.85;
    const baseX = tip.x + bx * back;
    const baseY = tip.y + by * back;
    const p1 = { x: baseX + px * spread, y: baseY + py * spread };
    const p2 = { x: baseX - px * spread, y: baseY - py * spread };
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    if (marker === "triangle") ctx.fill();
    else {
      ctx.lineWidth = outlineWidth;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (marker === "diamond" || marker === "diamond-outline") {
    const back1 = size * 0.9;
    const back2 = size * 1.8;
    const spread = size * 0.75;
    const midX = tip.x + bx * back1;
    const midY = tip.y + by * back1;
    const rearX = tip.x + bx * back2;
    const rearY = tip.y + by * back2;
    const left = { x: midX + px * spread, y: midY + py * spread };
    const right = { x: midX - px * spread, y: midY - py * spread };
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(rearX, rearY);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    if (marker === "diamond") ctx.fill();
    else {
      ctx.lineWidth = outlineWidth;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (marker === "circle" || marker === "circle-outline") {
    const back = size * 0.9;
    const r = Math.max(3, size * 0.55);
    const cx = tip.x + bx * back;
    const cy = tip.y + by * back;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (marker === "circle") ctx.fill();
    else {
      ctx.lineWidth = outlineWidth;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (marker === "bar") {
    const half = size * 0.65;
    ctx.beginPath();
    ctx.moveTo(tip.x + px * half, tip.y + py * half);
    ctx.lineTo(tip.x - px * half, tip.y - py * half);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const crowfoot = (many: boolean) => {
    const back = size * 1.05;
    const spread = size * 0.85;
    const baseX = tip.x + bx * back;
    const baseY = tip.y + by * back;

    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(baseX + px * spread, baseY + py * spread);
    ctx.moveTo(tip.x, tip.y);
    if (many) ctx.lineTo(baseX, baseY);
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(baseX - px * spread, baseY - py * spread);
    ctx.stroke();
  };

  if (marker === "crowfoot-one") {
    crowfoot(false);
    ctx.restore();
    return;
  }
  if (marker === "crowfoot-many") {
    crowfoot(true);
    ctx.restore();
    return;
  }
  if (marker === "crowfoot-one-many") {
    const barOffset = size * 0.45;
    const movedTip = { x: tip.x + bx * barOffset, y: tip.y + by * barOffset };
    const half = size * 0.65;
    ctx.beginPath();
    ctx.moveTo(movedTip.x + px * half, movedTip.y + py * half);
    ctx.lineTo(movedTip.x - px * half, movedTip.y - py * half);
    ctx.stroke();
    crowfoot(true);
    ctx.restore();
    return;
  }

  ctx.restore();
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
        ? [start, { x: control.x, y: start.y }, { x: control.x, y: end.y }, end]
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
  const markerSize = Math.max(6, el.strokeWidth * 3);

  const headLines = (tip: Point, from: Point) => {
    const [a, b] = getArrowHeadPoints(tip, from, markerSize);
    return `
    <line x1="${tip.x}" y1="${tip.y}" x2="${a.x}" y2="${a.y}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="${cap}" opacity="${opacity}"/>
    <line x1="${tip.x}" y1="${tip.y}" x2="${b.x}" y2="${b.y}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="${cap}" opacity="${opacity}"/>`;
  };

  const svgMarker = (
    marker: NonNullable<BoardElement["arrowEnd"]>,
    tip: Point,
    from: Point,
  ) => {
    if (marker === "none") return "";

    const { bx, by, px, py } = getMarkerBasis(tip, from);
    const size = markerSize;
    const outline = Math.min(Math.max(1.5, el.strokeWidth), 6);

    if (marker === "arrow") return headLines(tip, from);

    if (marker === "triangle" || marker === "triangle-outline") {
      const back = size * 1.1;
      const spread = size * 0.85;
      const baseX = tip.x + bx * back;
      const baseY = tip.y + by * back;
      const p1 = { x: baseX + px * spread, y: baseY + py * spread };
      const p2 = { x: baseX - px * spread, y: baseY - py * spread };
      if (marker === "triangle") {
        return `
    <polygon points="${tip.x},${tip.y} ${p1.x},${p1.y} ${p2.x},${p2.y}" fill="${el.strokeColor}" opacity="${opacity}"/>`;
      }
      return `
    <polygon points="${tip.x},${tip.y} ${p1.x},${p1.y} ${p2.x},${p2.y}" fill="none" stroke="${el.strokeColor}" stroke-width="${outline}" stroke-linejoin="round" opacity="${opacity}"/>`;
    }

    if (marker === "diamond" || marker === "diamond-outline") {
      const back1 = size * 0.9;
      const back2 = size * 1.8;
      const spread = size * 0.75;
      const midX = tip.x + bx * back1;
      const midY = tip.y + by * back1;
      const rearX = tip.x + bx * back2;
      const rearY = tip.y + by * back2;
      const left = { x: midX + px * spread, y: midY + py * spread };
      const right = { x: midX - px * spread, y: midY - py * spread };
      if (marker === "diamond") {
        return `
    <polygon points="${tip.x},${tip.y} ${left.x},${left.y} ${rearX},${rearY} ${right.x},${right.y}" fill="${el.strokeColor}" opacity="${opacity}"/>`;
      }
      return `
    <polygon points="${tip.x},${tip.y} ${left.x},${left.y} ${rearX},${rearY} ${right.x},${right.y}" fill="none" stroke="${el.strokeColor}" stroke-width="${outline}" stroke-linejoin="round" opacity="${opacity}"/>`;
    }

    if (marker === "circle" || marker === "circle-outline") {
      const back = size * 0.9;
      const r = Math.max(3, size * 0.55);
      const cx = tip.x + bx * back;
      const cy = tip.y + by * back;
      if (marker === "circle") {
        return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${el.strokeColor}" opacity="${opacity}"/>`;
      }
      return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${el.strokeColor}" stroke-width="${outline}" opacity="${opacity}"/>`;
    }

    if (marker === "bar") {
      const half = size * 0.65;
      const x1 = tip.x + px * half;
      const y1 = tip.y + py * half;
      const x2 = tip.x - px * half;
      const y2 = tip.y - py * half;
      return `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="${cap}" opacity="${opacity}"/>`;
    }

    const crowfoot = (many: boolean) => {
      const back = size * 1.05;
      const spread = size * 0.85;
      const baseX = tip.x + bx * back;
      const baseY = tip.y + by * back;
      const lines = [
        { x: baseX + px * spread, y: baseY + py * spread },
        ...(many ? [{ x: baseX, y: baseY }] : []),
        { x: baseX - px * spread, y: baseY - py * spread },
      ];
      return lines
        .map(
          (p) =>
            `
    <line x1="${tip.x}" y1="${tip.y}" x2="${p.x}" y2="${p.y}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="${cap}" opacity="${opacity}"/>`,
        )
        .join("");
    };

    if (marker === "crowfoot-one") return crowfoot(false);
    if (marker === "crowfoot-many") return crowfoot(true);
    if (marker === "crowfoot-one-many") {
      const barOffset = size * 0.45;
      const movedTip = { x: tip.x + bx * barOffset, y: tip.y + by * barOffset };
      const half = size * 0.65;
      const barSvg = `
    <line x1="${movedTip.x + px * half}" y1="${movedTip.y + py * half}" x2="${movedTip.x - px * half}" y2="${movedTip.y - py * half}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="${cap}" opacity="${opacity}"/>`;
      return `${barSvg}${crowfoot(true)}`;
    }

    return "";
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
}: ExportImageModalProps) {
  const [includeBackground, setIncludeBackground] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [embedScene, setEmbedScene] = useState(false);
  const [scale, setScale] = useState<1 | 2 | 3>(2);
  const [fileName, setFileName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

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
  }, [isOpen, includeBackground, darkMode, elements, canvasBackground, scale]);

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

    const bounds = getSceneBounds(elements);
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

        if (canvasBackground === "grid" || canvasBackground === "lines") {
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

    elements.forEach((el) => {
      ctx.save();
      ctx.globalAlpha = (el.opacity ?? 100) / 100;

      const rot = getRotationTransform(el);
      if (rot) {
        ctx.translate(rot.cx, rot.cy);
        ctx.rotate(degToRad(rot.rotationDeg));
        ctx.translate(-rot.cx, -rot.cy);
      }

      if (el.type === "rectangle") {
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

    const bounds = getSceneBounds(elements);

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

        if (canvasBackground === "grid" || canvasBackground === "lines") {
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

    elements.forEach((el) => {
      ctx.save();
      ctx.globalAlpha = (el.opacity ?? 100) / 100;

      const rot = getRotationTransform(el);
      if (rot) {
        ctx.translate(rot.cx, rot.cy);
        ctx.rotate(degToRad(rot.rotationDeg));
        ctx.translate(-rot.cx, -rot.cy);
      }

      if (el.type === "rectangle") {
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
          const lineHeight = fontSize * 1.4;
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
    const bounds = getSceneBounds(elements);

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

    elements.forEach((el) => {
      const opacity = (el.opacity ?? 100) / 100;
      const rot = getRotationTransform(el);

      let content = "";
      if (el.type === "rectangle") {
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
        elements,
        appState: { canvasBackground },
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

    const bounds = getSceneBounds(elements);

    canvas.width = bounds.width * scale;
    canvas.height = bounds.height * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    if (includeBackground) {
      ctx.fillStyle = darkMode ? "#0a0a0a" : "#f2f2f2";
      ctx.fillRect(0, 0, bounds.width, bounds.height);
    }

    ctx.translate(-bounds.x, -bounds.y);

    elements.forEach((el) => {
      ctx.globalAlpha = (el.opacity ?? 100) / 100;

      if (el.type === "rectangle") {
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
      }
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
            Export the current canvas as PNG or SVG.
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
                    Scene data is saved inside the file so it can be restored
                    later.
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
                <ToggleGroupItem value="1" className={toggleGroupItemClassName}>
                  1x
                </ToggleGroupItem>
                <ToggleGroupItem value="2" className={toggleGroupItemClassName}>
                  2x
                </ToggleGroupItem>
                <ToggleGroupItem value="3" className={toggleGroupItemClassName}>
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
                <Button variant="secondary" onClick={() => exportImage("svg")}>
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
