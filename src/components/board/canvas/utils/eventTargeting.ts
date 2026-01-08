import type { MouseEvent as ReactMouseEvent } from "react";

export const SELECTORS = {
    elementId: "[data-element-id]",
    tileHeader: '[data-tile-header="true"]',
    frameLabel: '[data-frame-label="true"]',
    interactive:
        '[data-canvas-interactive="true"], [contenteditable="true"], input, textarea',
} as const;

export function getEventTargetInfo(e: MouseEvent | ReactMouseEvent) {
    const target = e.target as Element | null;
    return {
        elementId:
            target?.closest?.(SELECTORS.elementId)?.getAttribute(
                "data-element-id",
            ) ?? null,
        isInteractive: !!target?.closest?.(SELECTORS.interactive),
        isTileHeader: !!target?.closest?.(SELECTORS.tileHeader),
        frameLabel: target?.closest?.(SELECTORS.frameLabel),
        target,
    };
}
