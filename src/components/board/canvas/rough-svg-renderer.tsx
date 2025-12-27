import React from "react";
import type { Drawable } from "roughjs/bin/core";
import type { BoardElement } from "@/lib/board-types";
import { generateElementShape } from "./rough-shape-cache";

/**
 * Render a rough.js Drawable to SVG path elements
 */
function renderDrawableToSVG(drawable: Drawable, key?: string) {
    const paths: React.JSX.Element[] = [];

    if (!drawable || !drawable.sets) {
        return null;
    }

    drawable.sets.forEach((set: any, index: number) => {
        if (set.type === "path") {
            const pathData = opsToPath(set);
            paths.push(
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
            paths.push(
                <path
                    key={`${key || "fill"}-${index}`}
                    d={pathData}
                    stroke="none"
                    fill={drawable.options.fill || "none"}
                />,
            );
        }
    });

    return paths;
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
    const allPaths: React.JSX.Element[] = [];

    shapes.forEach((drawable, index) => {
        const paths = renderDrawableToSVG(drawable, `shape-${index}`);
        if (paths) {
            allPaths.push(...paths);
        }
    });

    if (allPaths.length === 0) {
        return null;
    }

    return (
        <g
            key={element.id}
            data-element-id={element.id}
            transform={transform}
            opacity={finalOpacity}
            style={{ pointerEvents: "auto" }}
        >
            {allPaths}
        </g>
    );
}
