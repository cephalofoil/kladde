import type { BoundingBox } from "../types";

export function isInViewport(
    bounds: BoundingBox,
    viewport: BoundingBox,
    margin = 0,
): boolean {
    return !(
        bounds.x + bounds.width < viewport.x - margin ||
        bounds.x > viewport.x + viewport.width + margin ||
        bounds.y + bounds.height < viewport.y - margin ||
        bounds.y > viewport.y + viewport.height + margin
    );
}
