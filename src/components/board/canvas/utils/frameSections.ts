import type { BoardElement } from "@/lib/board-types";
import { getBoundingBox } from "../shapes";
import { isBoundsFullyInsideBox } from "../geometry";

type FrameCandidate = {
    id: string;
    bounds: { x: number; y: number; width: number; height: number };
    area: number;
    zIndex: number;
    order: number;
};

export function getFrameMembershipUpdates(elements: BoardElement[]) {
    const frames = elements.filter((el) => el.type === "frame");
    const frameCandidates: FrameCandidate[] = [];

    frames.forEach((frame, index) => {
        const bounds = getBoundingBox(frame);
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
        frameCandidates.push({
            id: frame.id,
            bounds,
            area: bounds.width * bounds.height,
            zIndex: frame.zIndex ?? 0,
            order: index,
        });
    });

    const frameById = new Map(frames.map((frame) => [frame.id, frame]));
    const candidateById = new Map(
        frameCandidates.map((candidate) => [candidate.id, candidate]),
    );

    const resolvedFrameIds = new Map<string, string | undefined>();
    const elementUpdates: Array<{
        id: string;
        updates: Partial<BoardElement>;
    }> = [];

    for (const element of elements) {
        if (element.type === "frame" || element.type === "laser") continue;
        const bounds = getBoundingBox(element);
        if (!bounds) continue;

        let nextFrameId = element.frameId;

        if (nextFrameId) {
            const currentFrame = frameById.get(nextFrameId);
            const currentCandidate = candidateById.get(nextFrameId);
            if (
                !currentFrame ||
                !currentCandidate ||
                !isBoundsFullyInsideBox(bounds, currentCandidate.bounds)
            ) {
                nextFrameId = undefined;
            }
        }

        if (!nextFrameId) {
            let best: FrameCandidate | null = null;
            for (const candidate of frameCandidates) {
                if (!isBoundsFullyInsideBox(bounds, candidate.bounds)) continue;
                if (!best) {
                    best = candidate;
                    continue;
                }
                if (candidate.area < best.area) {
                    best = candidate;
                    continue;
                }
                if (
                    candidate.area === best.area &&
                    (candidate.zIndex > best.zIndex ||
                        (candidate.zIndex === best.zIndex &&
                            candidate.order < best.order))
                ) {
                    best = candidate;
                }
            }
            nextFrameId = best?.id;
        }

        resolvedFrameIds.set(element.id, nextFrameId);
        if (nextFrameId !== element.frameId) {
            elementUpdates.push({
                id: element.id,
                updates: { frameId: nextFrameId },
            });
        }
    }

    const frameMinZ = new Map<string, number>();
    for (const element of elements) {
        if (element.type === "frame" || element.type === "laser") continue;
        const frameId = resolvedFrameIds.get(element.id);
        if (!frameId) continue;
        const zIndex = element.zIndex ?? 0;
        const currentMin = frameMinZ.get(frameId);
        if (currentMin === undefined || zIndex < currentMin) {
            frameMinZ.set(frameId, zIndex);
        }
    }

    const frameUpdates: Array<{
        id: string;
        updates: Partial<BoardElement>;
    }> = [];

    for (const frame of frames) {
        const minZ = frameMinZ.get(frame.id);
        if (minZ === undefined) continue;
        const currentZ = frame.zIndex ?? 0;
        if (currentZ >= minZ) {
            frameUpdates.push({
                id: frame.id,
                updates: { zIndex: minZ - 1 },
            });
        }
    }

    return [...elementUpdates, ...frameUpdates];
}
