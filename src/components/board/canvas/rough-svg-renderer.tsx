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
    const strokePaths: React.JSX.Element[] = [];
    const fillPaths: React.JSX.Element[] = [];
    let outlinePath: string | null = null;

    if (!drawable || !drawable.sets) {
        return { strokePaths, fillPaths, outlinePath };
    }

    drawable.sets.forEach((set: any, index: number) => {
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
function opsToPath(set: any): string {
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
            return `M ${cx} 0 L ${w} ${cy} L ${cx} ${h} L 0 ${cy} Z`;
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
    } = {},
): React.JSX.Element | null {
    const shape = generateElementShape(element);

    if (!shape) {
        return null;
    }

    const { opacity = 1, isMarkedForDeletion = false, transform } = options;
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
        allStrokePaths.push(...strokePaths);
        allFillPaths.push(...fillPaths);
    });

    if (allStrokePaths.length === 0 && allFillPaths.length === 0) {
        return null;
    }

    const clipId = `clip-${element.id}`;
    const clipPath = getClipPath(element);
    const hasFill = allFillPaths.length > 0 && clipPath;

    return (
        <g
            key={element.id}
            data-element-id={element.id}
            transform={transform}
            opacity={finalOpacity}
            style={{ pointerEvents: "auto" }}
        >
            {/* Define clip path for fill */}
            {hasFill && (
                <defs>
                    <clipPath id={clipId}>
                        <path d={clipPath} />
                    </clipPath>
                </defs>
            )}
            {/* Render fill paths clipped to shape outline */}
            {hasFill && <g clipPath={`url(#${clipId})`}>{allFillPaths}</g>}
            {/* Render stroke paths on top */}
            {allStrokePaths}
        </g>
    );
}
