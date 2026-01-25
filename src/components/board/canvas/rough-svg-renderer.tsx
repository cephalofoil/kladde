import React from "react";
import type { Drawable } from "roughjs/bin/core";
import type { BoardElement } from "@/lib/board-types";
import { generateElementShape } from "./rough-shape-cache";

/**
 * Render a rough.js Drawable to SVG path elements
 * Returns { strokePaths, fillPaths, outlinePath } for clipping support
 */
function renderDrawableToSVG(
  drawable: Drawable,
  key?: string,
): {
  strokePaths: React.JSX.Element[];
  fillPaths: React.JSX.Element[];
  outlinePath: string | null;
} {
  type DrawableSet = {
    type: string;
    ops: Array<{ op: string; data: number[] }>;
  };
  const strokePaths: React.JSX.Element[] = [];
  const fillPaths: React.JSX.Element[] = [];
  let outlinePath: string | null = null;

  if (!drawable || !drawable.sets) {
    return { strokePaths, fillPaths, outlinePath };
  }

  drawable.sets.forEach((set: DrawableSet, index: number) => {
    if (set.type === "path") {
      const pathData = opsToPath(set);
      // Save the first path as the outline for clipping
      if (outlinePath === null) {
        outlinePath = pathData;
      }
      strokePaths.push(
        <path
          key={`${key || "path"}-${index}`}
          d={pathData}
          stroke={drawable.options.stroke || "currentColor"}
          strokeWidth={drawable.options.strokeWidth || 1}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
      );
    } else if (set.type === "fillPath") {
      const pathData = opsToPath(set);
      fillPaths.push(
        <path
          key={`${key || "fill"}-${index}`}
          d={pathData}
          stroke="none"
          fill={drawable.options.fill || "none"}
        />,
      );
    } else if (set.type === "fillSketch") {
      // Hachure/cross-hatch fill patterns
      const pathData = opsToPath(set);
      fillPaths.push(
        <path
          key={`${key || "fillSketch"}-${index}`}
          d={pathData}
          stroke={drawable.options.fill || "none"}
          strokeWidth={drawable.options.fillWeight || 1}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
      );
    }
  });

  return { strokePaths, fillPaths, outlinePath };
}

/**
 * Convert rough.js ops to SVG path data
 */
function opsToPath(set: { ops: Array<{ op: string; data: number[] }> }): string {
  if (!set.ops || set.ops.length === 0) {
    return "";
  }

  const ops = set.ops;
  let path = "";

  for (const op of ops) {
    const data = op.data;
    switch (op.op) {
      case "move":
        path += `M ${data[0]} ${data[1]} `;
        break;
      case "bcurveTo":
        path += `C ${data[0]} ${data[1]}, ${data[2]} ${data[3]}, ${data[4]} ${data[5]} `;
        break;
      case "lineTo":
        path += `L ${data[0]} ${data[1]} `;
        break;
    }
  }

  return path.trim();
}

/**
 * Generate a clean geometric clip path based on element type
 */
function getClipPath(element: BoardElement): string | null {
  const w = element.width ?? 0;
  const h = element.height ?? 0;

  switch (element.type) {
    case "rectangle": {
      const r = element.cornerRadius ?? 0;
      if (r > 0) {
        const maxRadius = Math.min(w / 2, h / 2);
        const radius = Math.min(r, maxRadius);
        return (
          `M ${radius} 0 ` +
          `L ${w - radius} 0 ` +
          `Q ${w} 0, ${w} ${radius} ` +
          `L ${w} ${h - radius} ` +
          `Q ${w} ${h}, ${w - radius} ${h} ` +
          `L ${radius} ${h} ` +
          `Q 0 ${h}, 0 ${h - radius} ` +
          `L 0 ${radius} ` +
          `Q 0 0, ${radius} 0 Z`
        );
      }
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    }
    case "ellipse": {
      const cx = w / 2;
      const cy = h / 2;
      const rx = w / 2;
      const ry = h / 2;
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    case "diamond": {
      const cx = w / 2;
      const cy = h / 2;
      const r = element.cornerRadius ?? 0;
      if (r > 0) {
        const edgeLength = Math.hypot(w - cx, cy);
        const maxRadius = edgeLength / 3;
        const radius = Math.min(r, maxRadius);
        const top = { x: cx, y: 0 };
        const right = { x: w, y: cy };
        const bottom = { x: cx, y: h };
        const left = { x: 0, y: cy };

        const getPointAlongEdge = (
          from: { x: number; y: number },
          to: { x: number; y: number },
          dist: number,
        ) => {
          const len = Math.hypot(to.x - from.x, to.y - from.y);
          const t = len === 0 ? 0 : dist / len;
          return {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
          };
        };

        const topToRight = getPointAlongEdge(top, right, radius);
        const rightFromTop = getPointAlongEdge(right, top, radius);
        const rightToBottom = getPointAlongEdge(right, bottom, radius);
        const bottomFromRight = getPointAlongEdge(bottom, right, radius);
        const bottomToLeft = getPointAlongEdge(bottom, left, radius);
        const leftFromBottom = getPointAlongEdge(left, bottom, radius);
        const leftToTop = getPointAlongEdge(left, top, radius);
        const topFromLeft = getPointAlongEdge(top, left, radius);

        return (
          `M ${topToRight.x} ${topToRight.y} ` +
          `L ${rightFromTop.x} ${rightFromTop.y} ` +
          `Q ${right.x} ${right.y}, ${rightToBottom.x} ${rightToBottom.y} ` +
          `L ${bottomFromRight.x} ${bottomFromRight.y} ` +
          `Q ${bottom.x} ${bottom.y}, ${bottomToLeft.x} ${bottomToLeft.y} ` +
          `L ${leftFromBottom.x} ${leftFromBottom.y} ` +
          `Q ${left.x} ${left.y}, ${leftToTop.x} ${leftToTop.y} ` +
          `L ${topFromLeft.x} ${topFromLeft.y} ` +
          `Q ${top.x} ${top.y}, ${topToRight.x} ${topToRight.y} ` +
          `Z`
        );
      }
      return `M ${cx} 0 L ${w} ${cy} L ${cx} ${h} L 0 ${cy} Z`;
    }
    case "pen": {
      if (!element.isClosed || !element.points || element.points.length < 3)
        return null;
      const points = element.points.map((p) => `${p.x} ${p.y}`).join(" L ");
      return `M ${points} Z`;
    }
    default:
      return null;
  }
}

/**
 * Render a rough.js element to SVG
 */
export function renderRoughElement(
  element: BoardElement,
  options: {
    opacity?: number;
    isMarkedForDeletion?: boolean;
    transform?: string;
    fillOnly?: boolean;
    strokeOnly?: boolean;
    roughness?: number;
    bowing?: number;
  } = {},
): React.JSX.Element | null {
  const shape = generateElementShape(element, {
    roughness: options.roughness,
    bowing: options.bowing,
  });

  if (!shape) {
    return null;
  }

  const {
    opacity = 1,
    isMarkedForDeletion = false,
    transform,
    fillOnly = false,
    strokeOnly = false,
  } = options;
  const elOpacity = ((element.opacity ?? 100) / 100) * opacity;
  const finalOpacity = isMarkedForDeletion ? elOpacity * 0.3 : elOpacity;

  const shapes = Array.isArray(shape) ? shape : [shape];
  const allStrokePaths: React.JSX.Element[] = [];
  const allFillPaths: React.JSX.Element[] = [];

  shapes.forEach((drawable, index) => {
    const { strokePaths, fillPaths } = renderDrawableToSVG(
      drawable,
      `shape-${index}`,
    );
    if (!fillOnly) {
      allStrokePaths.push(...strokePaths);
    }
    if (!strokeOnly) {
      allFillPaths.push(...fillPaths);
    }
  });

  if (allStrokePaths.length === 0 && allFillPaths.length === 0) {
    return null;
  }

  const clipId = `clip-${element.id}`;
  const clipPath = getClipPath(element);
  const hasFill = allFillPaths.length > 0;
  const useClipPath = hasFill && clipPath;

  return (
    <g
      key={element.id}
      data-element-id={element.id}
      transform={transform}
      opacity={finalOpacity}
      style={{ pointerEvents: "auto" }}
    >
      {/* Define clip path for fill */}
      {useClipPath && (
        <defs>
          <clipPath id={clipId}>
            <path d={clipPath} />
          </clipPath>
        </defs>
      )}
      {/* Render fill paths clipped to shape outline */}
      {useClipPath ? (
        <g clipPath={`url(#${clipId})`}>{allFillPaths}</g>
      ) : (
        hasFill && allFillPaths
      )}
      {/* Render stroke paths on top */}
      {allStrokePaths}
    </g>
  );
}
