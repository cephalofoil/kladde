import { useCallback } from "react";
import { v4 as uuid } from "uuid";
import getStroke from "perfect-freehand";
import type {
    Dispatch,
    MouseEvent as ReactMouseEvent,
    RefObject,
    SetStateAction,
} from "react";
import type { BoardElement, Point } from "@/lib/board-types";
import type {
    BoundingBox,
    ConnectorDragKind,
    RemoteSelection,
    ResizeHandle,
    RotateHandleSide,
} from "../types";
import {
    expandBounds,
    getBoundsCenter,
    getContrastingTextColor,
    getResizeCursor,
    getWorldResizeHandle,
    rotatePoint,
} from "../geometry";
import {
    getSvgPathFromStroke,
    getArrowHeadPoints,
    getMarkerBasis,
} from "../drawing";
import {
    getCubicBezierPoint,
    getCatmullRomControlPoints,
    getCatmullRomPath,
    getElbowPolylineForVertices,
} from "../curves";
import { getBoundingBox } from "../shapes";
import {
    generateElbowRouteAroundObstacles,
    generateCurvedRouteAroundObstacles,
} from "../utils/connectionSnapping";
import { getMinSingleCharWidth, measureTextWidthPx } from "../text-utils";
import { renderRoughElement } from "../rough-svg-renderer";

interface UseCanvasRenderersProps {
    elements: BoardElement[];
    selectedIds: string[];
    selectedBounds: BoundingBox | null;
    highlightedElementIds: string[];
    currentHighlightId: string | null;
    remoteSelections: RemoteSelection[];
    remotelyEditingTextIds: Set<string>;
    editingTextElementId: string | null;
    eraserMarkedIds: Set<string>;
    snapTarget: {
        elementId: string;
        point: Point;
        outOfLineOfSight?: boolean;
    } | null;
    zoom: number;
    connectorStyle: "sharp" | "curved" | "elbow";
    isEditArrowMode: boolean;
    draggingConnectorPoint: {
        index: number;
        kind: ConnectorDragKind;
        axis?: "x" | "y";
        indices?: [number, number];
        range?: [number, number];
        edgeKey?: string;
        anchor?: Point;
    } | null;
    originalElements: BoardElement[];
    lastMousePos: Point;
    rotateHandleSide: RotateHandleSide;
    isRotating: boolean;
    nameTagWidthCacheRef: RefObject<Map<string, number>>;
    handDrawnMode: boolean;
    onStartTransform?: () => void;
    onUpdateElement: (id: string, updates: Partial<BoardElement>) => void;
    onDeleteElement: (id: string) => void;
    onAddElement: (element: BoardElement) => void;
    setOriginalElements: Dispatch<SetStateAction<BoardElement[]>>;
    setDraggingConnectorPoint: Dispatch<
        SetStateAction<{
            index: number;
            kind: ConnectorDragKind;
            axis?: "x" | "y";
            indices?: [number, number];
            range?: [number, number];
            edgeKey?: string;
            anchor?: Point;
        } | null>
    >;
    setSelectedIds: Dispatch<SetStateAction<string[]>>;
    getMousePosition: (e: ReactMouseEvent) => Point;
    // Arrow style props for creating arrows from handles
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
    strokeStyle: "solid" | "dashed" | "dotted";
    arrowStart: NonNullable<BoardElement["arrowStart"]>;
    arrowEnd: NonNullable<BoardElement["arrowEnd"]>;
}

export function useCanvasRenderers({
    elements,
    selectedIds,
    selectedBounds,
    highlightedElementIds,
    currentHighlightId,
    remoteSelections,
    remotelyEditingTextIds,
    editingTextElementId,
    eraserMarkedIds,
    snapTarget,
    zoom,
    connectorStyle,
    isEditArrowMode,
    draggingConnectorPoint,
    originalElements,
    lastMousePos,
    rotateHandleSide,
    isRotating,
    nameTagWidthCacheRef,
    handDrawnMode,
    onStartTransform,
    onUpdateElement,
    onDeleteElement,
    onAddElement,
    setOriginalElements,
    setDraggingConnectorPoint,
    setSelectedIds,
    getMousePosition,
    strokeColor,
    strokeWidth,
    opacity,
    strokeStyle,
    arrowStart,
    arrowEnd,
}: UseCanvasRenderersProps) {
    const getConnectorDragPreviewElement = useCallback(
        (element: BoardElement): BoardElement => {
            if (!draggingConnectorPoint || originalElements.length !== 1)
                return element;

            const originalElement = originalElements[0];
            if (originalElement.id !== element.id) return element;
            if (
                originalElement.type !== "line" &&
                originalElement.type !== "arrow"
            )
                return element;
            if (!lastMousePos) return element;

            const rotationDeg = originalElement.rotation ?? 0;
            let localPoint = lastMousePos;
            if (rotationDeg) {
                const bounds = getBoundingBox(originalElement);
                if (bounds) {
                    const center = getBoundsCenter(bounds);
                    localPoint = rotatePoint(
                        lastMousePos,
                        center,
                        -rotationDeg,
                    );
                }
            }

            const style = originalElement.connectorStyle ?? connectorStyle;
            const index = draggingConnectorPoint.index;
            const originalPoints = originalElement.points;

            // Preview for simple point drags (covers edit-arrow inserted points too).
            if (
                draggingConnectorPoint.kind === "normal" &&
                index >= 0 &&
                index < originalPoints.length
            ) {
                // Check if we have a snap target for curved arrows
                const isEndpoint =
                    index === 0 || index === originalPoints.length - 1;
                if (style === "curved" && snapTarget && isEndpoint) {
                    const otherEndpointIndex =
                        index === 0 ? originalPoints.length - 1 : 0;
                    const otherEndpoint = originalPoints[otherEndpointIndex];
                    // Get existing connection on the other end
                    const otherConnection =
                        index === 0
                            ? originalElement.endConnection?.elementId
                            : originalElement.startConnection?.elementId;
                    const routedPoints = generateCurvedRouteAroundObstacles(
                        otherEndpoint,
                        snapTarget.point,
                        elements,
                        originalElement.id,
                        snapTarget.elementId,
                        otherConnection ?? null,
                    );

                    // Reverse if dragging start point
                    const finalPoints =
                        index === 0 ? routedPoints.reverse() : routedPoints;

                    return {
                        ...element,
                        points: finalPoints,
                        connectorStyle: "curved",
                    };
                }

                // For sharp mode with out-of-sight snap, show elbow preview
                // This previews the elbow routing before mouse up finalizes it
                if (
                    connectorStyle === "sharp" &&
                    snapTarget?.outOfLineOfSight &&
                    isEndpoint
                ) {
                    const otherEndpointIndex =
                        index === 0 ? originalPoints.length - 1 : 0;
                    const otherEndpoint = originalPoints[otherEndpointIndex];

                    // Get existing connection on the other end
                    const otherConnection =
                        index === 0
                            ? originalElement.endConnection?.elementId
                            : originalElement.startConnection?.elementId;

                    const routedPoints = generateElbowRouteAroundObstacles(
                        otherEndpoint,
                        snapTarget.point,
                        elements,
                        originalElement.id,
                        snapTarget.elementId,
                        otherConnection ?? null,
                    );

                    // Reverse if dragging start point
                    const finalPoints =
                        index === 0 ? routedPoints.reverse() : routedPoints;

                    return {
                        ...element,
                        points: finalPoints,
                        connectorStyle: "elbow",
                        elbowRoute: undefined,
                    };
                }

                // For arrows with existing connection (from handle creation),
                // show simple L-path preview during drag (no snap target)
                const hasExistingConnection =
                    originalElement.startConnection ||
                    originalElement.endConnection;
                if (hasExistingConnection && isEndpoint && !snapTarget) {
                    const otherEndpointIndex =
                        index === 0 ? originalPoints.length - 1 : 0;
                    const connectedPoint = originalPoints[otherEndpointIndex];
                    const freePoint = localPoint;

                    // Get the connection position to determine exit direction
                    const connectedPosition =
                        index === 0
                            ? originalElement.endConnection?.position
                            : originalElement.startConnection?.position;

                    const isHorizontalExit =
                        connectedPosition === "e" || connectedPosition === "w";
                    const isVerticalExit =
                        connectedPosition === "n" || connectedPosition === "s";

                    let routedPoints: Point[];
                    if (isHorizontalExit) {
                        routedPoints = [
                            connectedPoint,
                            { x: freePoint.x, y: connectedPoint.y },
                            freePoint,
                        ];
                    } else if (isVerticalExit) {
                        routedPoints = [
                            connectedPoint,
                            { x: connectedPoint.x, y: freePoint.y },
                            freePoint,
                        ];
                    } else {
                        const dx = Math.abs(freePoint.x - connectedPoint.x);
                        const dy = Math.abs(freePoint.y - connectedPoint.y);
                        if (dx > dy) {
                            routedPoints = [
                                connectedPoint,
                                { x: freePoint.x, y: connectedPoint.y },
                                freePoint,
                            ];
                        } else {
                            routedPoints = [
                                connectedPoint,
                                { x: connectedPoint.x, y: freePoint.y },
                                freePoint,
                            ];
                        }
                    }

                    // Reverse if dragging start point
                    const finalPoints =
                        index === 0 ? routedPoints.reverse() : routedPoints;

                    return {
                        ...element,
                        points: finalPoints,
                        connectorStyle: "elbow",
                        elbowRoute: undefined,
                    };
                }

                // For elbow mode with snap target, use full routing
                if (style === "elbow" && isEndpoint && snapTarget) {
                    const otherEndpointIndex =
                        index === 0 ? originalPoints.length - 1 : 0;
                    const otherEndpoint = originalPoints[otherEndpointIndex];

                    const otherConnection =
                        index === 0
                            ? originalElement.endConnection?.elementId
                            : originalElement.startConnection?.elementId;

                    const routedPoints = generateElbowRouteAroundObstacles(
                        otherEndpoint,
                        snapTarget.point,
                        elements,
                        originalElement.id,
                        snapTarget.elementId,
                        otherConnection ?? null,
                    );

                    const finalPoints =
                        index === 0 ? routedPoints.reverse() : routedPoints;

                    return {
                        ...element,
                        points: finalPoints,
                        connectorStyle: "elbow",
                        elbowRoute: undefined,
                    };
                }

                const nextPoints = originalPoints.map((p) => ({ ...p }));
                nextPoints[index] = localPoint;
                return { ...element, points: nextPoints };
            }

            if (
                draggingConnectorPoint.kind === "curvedMid" &&
                style === "curved" &&
                index === 1 &&
                originalPoints.length >= 3
            ) {
                const nextPoints = originalPoints.map((p) => ({ ...p }));
                // Set control point directly to cursor position for 1:1 movement
                nextPoints[1] = {
                    x: localPoint.x,
                    y: localPoint.y,
                };
                return {
                    ...element,
                    points: nextPoints,
                    connectorStyle: "curved",
                };
            }

            if (
                draggingConnectorPoint.kind === "elbowHandle" &&
                style === "elbow" &&
                index === 1 &&
                originalPoints.length >= 3
            ) {
                const pStart = originalPoints[0];
                const pEnd = originalPoints[originalPoints.length - 1];
                const route =
                    originalElement.elbowRoute ??
                    (Math.abs(pEnd.x - pStart.x) >= Math.abs(pEnd.y - pStart.y)
                        ? "vertical"
                        : "horizontal");
                const existingControl = originalPoints[1];
                const nextPoints = originalPoints.map((p) => ({ ...p }));
                nextPoints[1] =
                    route === "vertical"
                        ? { x: localPoint.x, y: existingControl.y }
                        : { x: existingControl.x, y: localPoint.y };
                return {
                    ...element,
                    points: nextPoints,
                    connectorStyle: "elbow",
                    elbowRoute: originalElement.elbowRoute,
                };
            }

            if (
                draggingConnectorPoint.kind === "elbowOrtho" &&
                style === "elbow" &&
                index >= 0 &&
                index < originalPoints.length
            ) {
                const axis = draggingConnectorPoint.axis ?? "x";
                const eps = 0.5 / zoom;
                const current = originalPoints[index];
                const delta =
                    axis === "x"
                        ? localPoint.x - current.x
                        : localPoint.y - current.y;
                const same = (a: number, b: number) => Math.abs(a - b) <= eps;

                let left = index;
                let right = index;
                if (axis === "x") {
                    const base = current.x;
                    while (left > 0 && same(originalPoints[left - 1].x, base))
                        left--;
                    while (
                        right < originalPoints.length - 1 &&
                        same(originalPoints[right + 1].x, base)
                    )
                        right++;
                } else {
                    const base = current.y;
                    while (left > 0 && same(originalPoints[left - 1].y, base))
                        left--;
                    while (
                        right < originalPoints.length - 1 &&
                        same(originalPoints[right + 1].y, base)
                    )
                        right++;
                }

                const nextPoints = originalPoints.map((p) => ({ ...p }));
                for (let i = left; i <= right; i++) {
                    nextPoints[i] =
                        axis === "x"
                            ? { x: nextPoints[i].x + delta, y: nextPoints[i].y }
                            : {
                                  x: nextPoints[i].x,
                                  y: nextPoints[i].y + delta,
                              };
                }
                return {
                    ...element,
                    points: nextPoints,
                    connectorStyle: "elbow",
                    elbowRoute: undefined,
                };
            }

            // Preview for elbow edge dragging (including insert handles)
            if (
                draggingConnectorPoint.kind === "elbowEdge" &&
                style === "elbow" &&
                draggingConnectorPoint.range &&
                draggingConnectorPoint.anchor
            ) {
                const [r0, r1] = draggingConnectorPoint.range;
                if (r0 >= 0 && r1 >= r0 && r1 < originalPoints.length) {
                    const axis = draggingConnectorPoint.axis ?? "x";
                    const delta =
                        axis === "x"
                            ? localPoint.x - draggingConnectorPoint.anchor.x
                            : localPoint.y - draggingConnectorPoint.anchor.y;
                    const nextPoints = originalPoints.map((p) => ({ ...p }));
                    for (let i = r0; i <= r1; i++) {
                        nextPoints[i] =
                            axis === "x"
                                ? {
                                      x: nextPoints[i].x + delta,
                                      y: nextPoints[i].y,
                                  }
                                : {
                                      x: nextPoints[i].x,
                                      y: nextPoints[i].y + delta,
                                  };
                    }
                    return {
                        ...element,
                        points: nextPoints,
                        connectorStyle: "elbow",
                        elbowRoute: undefined,
                    };
                }
            }

            // Preview for elbow endpoint dragging (moves endpoint + adjacent point)
            if (
                draggingConnectorPoint.kind === "elbowEndpoint" &&
                style === "elbow" &&
                originalPoints.length >= 3
            ) {
                const isStart = index === 0;
                const isEnd = index === originalPoints.length - 1;

                // If we have a snap target, use the routed preview
                if (snapTarget) {
                    const otherEndpointIndex = isStart
                        ? originalPoints.length - 1
                        : 0;
                    const otherEndpoint = originalPoints[otherEndpointIndex];
                    // Get existing connection on the other end
                    const otherConnection = isStart
                        ? originalElement.endConnection?.elementId
                        : originalElement.startConnection?.elementId;
                    const routedPoints = generateElbowRouteAroundObstacles(
                        otherEndpoint,
                        snapTarget.point,
                        elements,
                        originalElement.id,
                        snapTarget.elementId,
                        otherConnection ?? null,
                    );

                    // Reverse if dragging start point
                    const finalPoints = isStart
                        ? routedPoints.reverse()
                        : routedPoints;

                    return {
                        ...element,
                        points: finalPoints,
                        connectorStyle: "elbow",
                        elbowRoute: undefined,
                    };
                }

                // No snap target - use manual endpoint adjustment
                const nextPoints = originalPoints.map((p) => ({ ...p }));
                const eps = 0.5 / zoom;

                if (isStart) {
                    const p1 = originalPoints[1];
                    const p2 = originalPoints[2];
                    const edge12Horizontal = Math.abs(p1.y - p2.y) <= eps;
                    const edge12Vertical = Math.abs(p1.x - p2.x) <= eps;

                    nextPoints[0] = localPoint;

                    if (edge12Vertical) {
                        nextPoints[1] = { x: p2.x, y: localPoint.y };
                    } else if (edge12Horizontal) {
                        nextPoints[1] = { x: localPoint.x, y: p2.y };
                    }
                } else if (isEnd) {
                    const lastIdx = originalPoints.length - 1;
                    const p1 = originalPoints[lastIdx - 1];
                    const p2 = originalPoints[lastIdx - 2];
                    const edgeHorizontal = Math.abs(p1.y - p2.y) <= eps;
                    const edgeVertical = Math.abs(p1.x - p2.x) <= eps;

                    nextPoints[lastIdx] = localPoint;

                    if (edgeVertical) {
                        nextPoints[lastIdx - 1] = { x: p2.x, y: localPoint.y };
                    } else if (edgeHorizontal) {
                        nextPoints[lastIdx - 1] = { x: localPoint.x, y: p2.y };
                    }
                }

                return {
                    ...element,
                    points: nextPoints,
                    connectorStyle: "elbow",
                    elbowRoute: undefined,
                };
            }

            // Preview for initial corner creation (so the handle doesn't "stick" until mouseup in collab mode)
            if (
                draggingConnectorPoint.kind === "createCorner" &&
                index === 1 &&
                originalPoints.length === 2
            ) {
                const pStart = originalPoints[0];
                const pEnd = originalPoints[1];

                if (style === "curved") {
                    // Use cursor position directly - Catmull-Rom passes through control point
                    const nextPoints = [
                        pStart,
                        {
                            x: localPoint.x,
                            y: localPoint.y,
                        },
                        pEnd,
                    ];
                    return {
                        ...element,
                        points: nextPoints,
                        connectorStyle: "curved",
                    };
                }

                const nextUpdates: Partial<BoardElement> = {
                    points: [pStart, localPoint, pEnd],
                };
                if (
                    style === "elbow" &&
                    originalElement.elbowRoute === undefined
                ) {
                    nextUpdates.elbowRoute =
                        Math.abs(pEnd.x - pStart.x) >=
                        Math.abs(pEnd.y - pStart.y)
                            ? "vertical"
                            : "horizontal";
                }
                return { ...element, ...nextUpdates, connectorStyle: style };
            }

            return element;
        },
        [
            connectorStyle,
            draggingConnectorPoint,
            elements,
            lastMousePos,
            originalElements,
            snapTarget,
            zoom,
        ],
    );

    const renderElement = (element: BoardElement, isPreview = false) => {
        const effectiveElement = !isPreview
            ? getConnectorDragPreviewElement(element)
            : element;
        const opacity = isPreview ? 0.7 : 1;
        const isMarkedForDeletion = eraserMarkedIds.has(effectiveElement.id);
        const rotationDeg = effectiveElement.rotation ?? 0;
        const boundsForRotation = rotationDeg
            ? getBoundingBox(effectiveElement)
            : null;
        const rotationTransform =
            boundsForRotation && rotationDeg
                ? `rotate(${rotationDeg} ${boundsForRotation.x + boundsForRotation.width / 2} ${boundsForRotation.y + boundsForRotation.height / 2})`
                : undefined;

        switch (effectiveElement.type) {
            case "pen": {
                const elOpacity = (effectiveElement.opacity ?? 100) / 100;
                const elStrokeStyle = effectiveElement.strokeStyle || "solid";
                const elFillPattern = effectiveElement.fillPattern || "none";
                const elFillColor = effectiveElement.fillColor || "#d1d5db";
                const shouldFill =
                    effectiveElement.isClosed && elFillPattern !== "none";

                // For solid strokes, use the filled path approach
                if (elStrokeStyle === "solid") {
                    const stroke = getStroke(
                        effectiveElement.points.map((p) => [p.x, p.y]),
                        {
                            size: effectiveElement.strokeWidth * 2,
                            thinning: 0.5,
                            smoothing: 0.5,
                            streamline: 0.5,
                        },
                    );
                    const pathData = getSvgPathFromStroke(stroke);

                    // Create a simple polygon path from the original points for the fill
                    const fillPath = shouldFill
                        ? `M ${effectiveElement.points.map((p) => `${p.x},${p.y}`).join(" L ")} Z`
                        : "";

                    return (
                        <g
                            key={effectiveElement.id}
                            transform={rotationTransform}
                        >
                            {/* Fill layer - renders under stroke using original points */}
                            {shouldFill && (
                                <path
                                    d={fillPath}
                                    fill={
                                        elFillPattern === "solid"
                                            ? elFillColor
                                            : `url(#fill-pattern-${elFillPattern})`
                                    }
                                    style={{ color: elFillColor }}
                                    opacity={elOpacity * 0.7}
                                    pointerEvents="none"
                                />
                            )}
                            {/* Stroke layer */}
                            <path
                                data-element-id={effectiveElement.id}
                                d={pathData}
                                fill={effectiveElement.strokeColor}
                                opacity={
                                    isMarkedForDeletion
                                        ? elOpacity * 0.3
                                        : elOpacity
                                }
                                pointerEvents="auto"
                            />
                            {isMarkedForDeletion && (
                                <path
                                    d={pathData}
                                    fill="rgba(0, 0, 0, 0.6)"
                                    pointerEvents="none"
                                />
                            )}
                        </g>
                    );
                }

                // For dashed/dotted strokes, use polyline with stroke
                const strokeDasharray =
                    elStrokeStyle === "dashed"
                        ? "10,10"
                        : elStrokeStyle === "dotted"
                          ? "2,6"
                          : "none";
                const points = effectiveElement.points
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ");
                const elLineCap = effectiveElement.lineCap || "round";
                // Create a wider invisible hitbox for easier clicking (minimum 16px)
                const hitboxWidth = Math.max(
                    effectiveElement.strokeWidth * 6,
                    16,
                );
                return (
                    <g key={effectiveElement.id} transform={rotationTransform}>
                        {/* Fill layer for dashed/dotted strokes */}
                        {shouldFill && (
                            <polygon
                                points={points}
                                fill={
                                    elFillPattern === "solid"
                                        ? elFillColor
                                        : `url(#fill-pattern-${elFillPattern})`
                                }
                                style={{ color: elFillColor }}
                                opacity={elOpacity * 0.7}
                                pointerEvents="none"
                            />
                        )}
                        {/* Invisible wider hitbox for easier clicking */}
                        <polyline
                            data-element-id={effectiveElement.id}
                            points={points}
                            stroke="transparent"
                            strokeWidth={hitboxWidth}
                            strokeLinecap={elLineCap}
                            strokeLinejoin="round"
                            fill="none"
                            pointerEvents="stroke"
                        />
                        {/* Visible dashed/dotted stroke */}
                        <polyline
                            points={points}
                            stroke={effectiveElement.strokeColor}
                            strokeWidth={effectiveElement.strokeWidth}
                            strokeLinecap={elLineCap}
                            strokeLinejoin="round"
                            strokeDasharray={strokeDasharray}
                            fill="none"
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.3
                                    : elOpacity
                            }
                            pointerEvents="none"
                        />
                        {isMarkedForDeletion && (
                            <polyline
                                points={points}
                                stroke="rgba(0, 0, 0, 0.6)"
                                strokeWidth={element.strokeWidth}
                                strokeLinecap={elLineCap}
                                strokeLinejoin="round"
                                fill="none"
                                pointerEvents="none"
                            />
                        )}
                    </g>
                );
            }
            case "line":
            case "arrow": {
                if (effectiveElement.points.length < 2) return null;
                const isArrow = effectiveElement.type === "arrow";
                const elOpacity = (effectiveElement.opacity ?? 100) / 100;
                const elStrokeStyle = effectiveElement.strokeStyle || "solid";
                const elLineCap = effectiveElement.lineCap || "round";
                const strokeDasharray =
                    elStrokeStyle === "dashed"
                        ? "10,10"
                        : elStrokeStyle === "dotted"
                          ? "2,6"
                          : "none";
                const hitboxWidth = Math.max(
                    effectiveElement.strokeWidth * 6,
                    16,
                );

                const start = effectiveElement.points[0];
                const end =
                    effectiveElement.points[effectiveElement.points.length - 1];
                const hasCorner = effectiveElement.points.length >= 3;
                const style = effectiveElement.connectorStyle || "sharp";
                const route =
                    effectiveElement.elbowRoute ||
                    (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
                        ? "vertical"
                        : "horizontal");
                const control = hasCorner ? effectiveElement.points[1] : null;

                let pathD: string | null = null;
                let polyPoints: Point[] | null = null;

                if (hasCorner && control) {
                    if (style === "curved") {
                        // Use Catmull-Rom for all curved connectors so curve passes through control point
                        pathD = getCatmullRomPath(effectiveElement.points);
                    } else if (style === "elbow") {
                        const elbowEps = 0.5 / zoom;
                        // Always use getElbowPolylineForVertices for elbow arrows
                        // This correctly handles both:
                        // - 3-point paths from generateElbowRouteAroundObstacles (already axis-aligned)
                        // - 3-point paths with a control point that needs expansion
                        polyPoints = getElbowPolylineForVertices(
                            effectiveElement.points,
                            elbowEps,
                        );
                    } else {
                        polyPoints = effectiveElement.points;
                    }
                }

                const markerSize = Math.max(
                    6,
                    effectiveElement.strokeWidth * 3,
                );
                const markerStart = effectiveElement.arrowStart || "none";
                const markerEnd = effectiveElement.arrowEnd || "arrow";

                const arrowTangentForEnd = () => {
                    if (pathD && control) return { tip: end, from: control };
                    if (polyPoints && polyPoints.length >= 2)
                        return {
                            tip: end,
                            from: polyPoints[polyPoints.length - 2],
                        };
                    return { tip: end, from: start };
                };
                const arrowTangentForStart = () => {
                    if (pathD && control) return { tip: start, from: control };
                    if (polyPoints && polyPoints.length >= 2)
                        return { tip: start, from: polyPoints[1] };
                    return { tip: start, from: end };
                };

                const markerOpacity = isMarkedForDeletion
                    ? elOpacity * 0.3
                    : elOpacity;

                const renderMarker = (
                    marker: NonNullable<BoardElement["arrowEnd"]>,
                    tip: Point,
                    from: Point,
                ) => {
                    if (marker === "none") return null;

                    const { bx, by, px, py, ux, uy } = getMarkerBasis(
                        tip,
                        from,
                    );
                    const size = markerSize;
                    const stroke = effectiveElement.strokeColor;
                    const strokeWidth = Math.max(
                        1.5,
                        effectiveElement.strokeWidth,
                    );
                    const outlineStrokeWidth = Math.min(strokeWidth, 6);

                    // Push arrowhead forward to sit at the very end of the line
                    // Different offsets for different marker types
                    let offsetMultiplier = 4; // Default for most shapes
                    if (
                        marker === "diamond-outline" ||
                        marker === "circle-outline"
                    ) {
                        offsetMultiplier = 5; // Diamond and circle outlines need more offset
                    } else if (marker === "bar") {
                        offsetMultiplier = 0; // Bar sits at the line endpoint
                    }
                    const offset = strokeWidth * offsetMultiplier;
                    const offsetTip = {
                        x: tip.x + ux * offset,
                        y: tip.y + uy * offset,
                    };

                    const line = (x2: number, y2: number) => (
                        <line
                            x1={offsetTip.x}
                            y1={offsetTip.y}
                            x2={x2}
                            y2={y2}
                            stroke={stroke}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            opacity={markerOpacity}
                        />
                    );

                    const bar = () => {
                        const half = size * 0.65;
                        const x1 = offsetTip.x + px * half;
                        const y1 = offsetTip.y + py * half;
                        const x2 = offsetTip.x - px * half;
                        const y2 = offsetTip.y - py * half;
                        return (
                            <line
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={stroke}
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                opacity={markerOpacity}
                            />
                        );
                    };

                    const arrow = () => {
                        const [pA, pB] = getArrowHeadPoints(
                            offsetTip,
                            from,
                            markerSize,
                        );
                        return (
                            <polygon
                                pointerEvents="none"
                                points={`${offsetTip.x},${offsetTip.y} ${pA.x},${pA.y} ${pB.x},${pB.y}`}
                                fill={stroke}
                                opacity={markerOpacity}
                            />
                        );
                    };

                    const triangle = () => {
                        const [pA, pB] = getArrowHeadPoints(
                            offsetTip,
                            from,
                            markerSize,
                        );
                        return (
                            <polygon
                                pointerEvents="none"
                                points={`${offsetTip.x},${offsetTip.y} ${pA.x},${pA.y} ${pB.x},${pB.y}`}
                                fill={stroke}
                                opacity={markerOpacity}
                            />
                        );
                    };

                    const triangleOutline = () => {
                        const [pA, pB] = getArrowHeadPoints(
                            offsetTip,
                            from,
                            markerSize,
                        );
                        return (
                            <polygon
                                pointerEvents="none"
                                points={`${offsetTip.x},${offsetTip.y} ${pA.x},${pA.y} ${pB.x},${pB.y}`}
                                fill="none"
                                stroke={stroke}
                                strokeWidth={strokeWidth}
                                strokeLinejoin="round"
                                opacity={markerOpacity}
                            />
                        );
                    };

                    const diamond = () => {
                        const spread = size * 0.5;
                        const back1 = size * 0.7;
                        const back2 = size * 1.4;
                        const midX = offsetTip.x + bx * back1;
                        const midY = offsetTip.y + by * back1;
                        const rearX = offsetTip.x + bx * back2;
                        const rearY = offsetTip.y + by * back2;
                        const left = {
                            x: midX + px * spread,
                            y: midY + py * spread,
                        };
                        const right = {
                            x: midX - px * spread,
                            y: midY - py * spread,
                        };
                        return (
                            <polygon
                                pointerEvents="none"
                                points={`${offsetTip.x},${offsetTip.y} ${left.x},${left.y} ${rearX},${rearY} ${right.x},${right.y}`}
                                fill={marker === "diamond" ? stroke : "none"}
                                stroke={
                                    marker === "diamond-outline"
                                        ? stroke
                                        : "none"
                                }
                                strokeWidth={
                                    marker === "diamond-outline"
                                        ? outlineStrokeWidth
                                        : undefined
                                }
                                strokeLinejoin="round"
                                opacity={markerOpacity}
                            />
                        );
                    };

                    if (marker === "circle" || marker === "circle-outline") {
                        const back = size * 0.9;
                        const r = Math.max(3, size * 0.55);
                        const cx = offsetTip.x + bx * back;
                        const cy = offsetTip.y + by * back;
                        return (
                            <circle
                                pointerEvents="none"
                                cx={cx}
                                cy={cy}
                                r={r}
                                fill={marker === "circle" ? stroke : "none"}
                                stroke={
                                    marker === "circle-outline"
                                        ? stroke
                                        : "none"
                                }
                                strokeWidth={
                                    marker === "circle-outline"
                                        ? outlineStrokeWidth
                                        : undefined
                                }
                                opacity={markerOpacity}
                            />
                        );
                    }

                    if (marker === "bar")
                        return <g pointerEvents="none">{bar()}</g>;

                    if (marker === "arrow") return arrow();
                    if (marker === "triangle") return triangle();
                    if (marker === "triangle-outline") return triangleOutline();
                    if (marker === "diamond" || marker === "diamond-outline")
                        return diamond();

                    if (marker === "line") {
                        const endPoint = {
                            x: offsetTip.x + bx * size,
                            y: offsetTip.y + by * size,
                        };
                        return line(endPoint.x, endPoint.y);
                    }

                    return null;
                };

                // Use rough.js for hand-drawn rendering
                if (handDrawnMode) {
                    const roughElement = renderRoughElement(effectiveElement, {
                        opacity,
                        isMarkedForDeletion,
                        transform: rotationTransform,
                    });

                    if (roughElement) {
                        return (
                            <g key={effectiveElement.id}>
                                {/* Invisible wider hitbox for easier clicking */}
                                {pathD ? (
                                    <path
                                        data-element-id={effectiveElement.id}
                                        d={pathD}
                                        fill="none"
                                        stroke="transparent"
                                        strokeWidth={hitboxWidth}
                                        strokeLinecap={elLineCap}
                                        strokeLinejoin="round"
                                        pointerEvents="stroke"
                                        transform={rotationTransform}
                                    />
                                ) : (
                                    <polyline
                                        data-element-id={effectiveElement.id}
                                        points={(
                                            polyPoints ||
                                            effectiveElement.points
                                        )
                                            .map((p) => `${p.x},${p.y}`)
                                            .join(" ")}
                                        fill="none"
                                        stroke="transparent"
                                        strokeWidth={hitboxWidth}
                                        strokeLinecap={elLineCap}
                                        strokeLinejoin="round"
                                        pointerEvents="stroke"
                                        transform={rotationTransform}
                                    />
                                )}
                                {/* Rough.js rendered line/arrow with arrowheads */}
                                {roughElement}
                            </g>
                        );
                    }
                }

                return (
                    <g key={element.id} transform={rotationTransform}>
                        {/* Invisible wider hitbox for easier clicking */}
                        {!hasCorner ? (
                            <line
                                data-element-id={element.id}
                                x1={start.x}
                                y1={start.y}
                                x2={end.x}
                                y2={end.y}
                                stroke="transparent"
                                strokeWidth={hitboxWidth}
                                strokeLinecap={elLineCap}
                                pointerEvents="stroke"
                            />
                        ) : pathD ? (
                            <path
                                data-element-id={element.id}
                                d={pathD}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={hitboxWidth}
                                strokeLinecap={elLineCap}
                                strokeLinejoin="round"
                                pointerEvents="stroke"
                            />
                        ) : (
                            <polyline
                                data-element-id={element.id}
                                points={(polyPoints || [])
                                    .map((p) => `${p.x},${p.y}`)
                                    .join(" ")}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={hitboxWidth}
                                strokeLinecap={elLineCap}
                                strokeLinejoin="round"
                                pointerEvents="stroke"
                            />
                        )}

                        {/* Visible connector */}
                        {!hasCorner ? (
                            <line
                                x1={start.x}
                                y1={start.y}
                                x2={end.x}
                                y2={end.y}
                                stroke={element.strokeColor}
                                strokeWidth={element.strokeWidth}
                                strokeLinecap={elLineCap}
                                strokeDasharray={strokeDasharray}
                                opacity={
                                    isMarkedForDeletion
                                        ? elOpacity * 0.3
                                        : elOpacity
                                }
                                pointerEvents="none"
                            />
                        ) : pathD ? (
                            <path
                                d={pathD}
                                fill="none"
                                stroke={element.strokeColor}
                                strokeWidth={element.strokeWidth}
                                strokeLinecap={elLineCap}
                                strokeLinejoin="round"
                                strokeDasharray={strokeDasharray}
                                opacity={
                                    isMarkedForDeletion
                                        ? elOpacity * 0.3
                                        : elOpacity
                                }
                                pointerEvents="none"
                            />
                        ) : (
                            <polyline
                                points={(polyPoints || [])
                                    .map((p) => `${p.x},${p.y}`)
                                    .join(" ")}
                                fill="none"
                                stroke={element.strokeColor}
                                strokeWidth={element.strokeWidth}
                                strokeLinecap={elLineCap}
                                strokeLinejoin="round"
                                strokeDasharray={strokeDasharray}
                                opacity={
                                    isMarkedForDeletion
                                        ? elOpacity * 0.3
                                        : elOpacity
                                }
                                pointerEvents="none"
                            />
                        )}

                        {/* Arrowheads */}
                        {isArrow &&
                            (() => {
                                const { tip, from } = arrowTangentForStart();
                                return renderMarker(markerStart, tip, from);
                            })()}
                        {isArrow &&
                            (() => {
                                const { tip, from } = arrowTangentForEnd();
                                return renderMarker(markerEnd, tip, from);
                            })()}

                        {isMarkedForDeletion &&
                            (!hasCorner ? (
                                <line
                                    x1={start.x}
                                    y1={start.y}
                                    x2={end.x}
                                    y2={end.y}
                                    stroke="rgba(0, 0, 0, 0.7)"
                                    strokeWidth={element.strokeWidth}
                                    strokeLinecap={elLineCap}
                                    pointerEvents="none"
                                />
                            ) : pathD ? (
                                <path
                                    d={pathD}
                                    fill="none"
                                    stroke="rgba(0, 0, 0, 0.7)"
                                    strokeWidth={element.strokeWidth}
                                    strokeLinecap={elLineCap}
                                    strokeLinejoin="round"
                                    pointerEvents="none"
                                />
                            ) : (
                                <polyline
                                    points={(polyPoints || [])
                                        .map((p) => `${p.x},${p.y}`)
                                        .join(" ")}
                                    fill="none"
                                    stroke="rgba(0, 0, 0, 0.6)"
                                    strokeWidth={element.strokeWidth}
                                    strokeLinecap={elLineCap}
                                    strokeLinejoin="round"
                                    pointerEvents="none"
                                />
                            ))}
                    </g>
                );
            }
            case "rectangle": {
                const elOpacity = (element.opacity ?? 100) / 100;
                const elStrokeStyle = element.strokeStyle || "solid";
                const strokeDasharray =
                    elStrokeStyle === "dashed"
                        ? "10,10"
                        : elStrokeStyle === "dotted"
                          ? "2,6"
                          : "none";
                const elCornerRadius = element.cornerRadius ?? 4;
                const elFillColor = element.fillColor || "none";
                // Treat 'transparent' same as 'none' for hit detection - invisible fills shouldn't be clickable
                const hasVisibleFill =
                    elFillColor !== "none" && elFillColor !== "transparent";
                // Convert transparent to none for proper pointer-events behavior in SVG
                const fillValue =
                    elFillColor === "transparent" ? "none" : elFillColor;
                // Only visible parts should be clickable: if has fill AND stroke, allow both; if only stroke, only stroke; if only fill, only fill
                const pointerEventsValue =
                    hasVisibleFill && element.strokeWidth > 0
                        ? "visible"
                        : hasVisibleFill
                          ? "fill"
                          : element.strokeWidth > 0
                            ? "stroke"
                            : "none";
                // Create wider invisible hitbox for easier clicking on stroke-only shapes
                const hitboxStrokeWidth = Math.max(element.strokeWidth * 6, 16);
                const hitboxOffset =
                    (hitboxStrokeWidth - element.strokeWidth) / 2;

                // Use rough.js for hand-drawn rendering
                if (handDrawnMode) {
                    const roughElement = renderRoughElement(element, {
                        opacity,
                        isMarkedForDeletion,
                        transform: `${rotationTransform || ""} translate(${element.x}, ${element.y})`,
                    });

                    if (roughElement) {
                        return (
                            <g key={element.id}>
                                {/* Invisible hitbox */}
                                {!hasVisibleFill && element.strokeWidth > 0 && (
                                    <rect
                                        data-element-id={element.id}
                                        x={(element.x ?? 0) - hitboxOffset}
                                        y={(element.y ?? 0) - hitboxOffset}
                                        width={
                                            (element.width ?? 0) +
                                            hitboxOffset * 2
                                        }
                                        height={
                                            (element.height ?? 0) +
                                            hitboxOffset * 2
                                        }
                                        stroke="transparent"
                                        strokeWidth={hitboxStrokeWidth}
                                        fill="none"
                                        rx={elCornerRadius}
                                        pointerEvents="stroke"
                                    />
                                )}
                                {roughElement}
                                {isMarkedForDeletion && (
                                    <rect
                                        x={element.x}
                                        y={element.y}
                                        width={element.width}
                                        height={element.height}
                                        fill="rgba(0, 0, 0, 0.7)"
                                        rx={elCornerRadius}
                                        pointerEvents="none"
                                        transform={rotationTransform}
                                    />
                                )}
                            </g>
                        );
                    }
                }

                return (
                    <g key={element.id} transform={rotationTransform}>
                        {/* Invisible wider hitbox for easier clicking (stroke-only shapes) */}
                        {!hasVisibleFill && element.strokeWidth > 0 && (
                            <rect
                                data-element-id={element.id}
                                x={(element.x ?? 0) - hitboxOffset}
                                y={(element.y ?? 0) - hitboxOffset}
                                width={(element.width ?? 0) + hitboxOffset * 2}
                                height={
                                    (element.height ?? 0) + hitboxOffset * 2
                                }
                                stroke="transparent"
                                strokeWidth={hitboxStrokeWidth}
                                fill="none"
                                rx={elCornerRadius}
                                pointerEvents="stroke"
                            />
                        )}
                        {/* Visible rectangle */}
                        <rect
                            data-element-id={
                                !hasVisibleFill && element.strokeWidth > 0
                                    ? undefined
                                    : element.id
                            }
                            x={element.x}
                            y={element.y}
                            width={element.width}
                            height={element.height}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeDasharray={strokeDasharray}
                            fill={fillValue}
                            rx={elCornerRadius}
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.3
                                    : elOpacity
                            }
                            pointerEvents={
                                !hasVisibleFill && element.strokeWidth > 0
                                    ? "none"
                                    : pointerEventsValue
                            }
                        />
                        {isMarkedForDeletion && (
                            <rect
                                x={element.x}
                                y={element.y}
                                width={element.width}
                                height={element.height}
                                fill="rgba(0, 0, 0, 0.7)"
                                rx={elCornerRadius}
                                pointerEvents="none"
                            />
                        )}
                    </g>
                );
            }
            case "diamond": {
                const elOpacity = (element.opacity ?? 100) / 100;
                const elStrokeStyle = element.strokeStyle || "solid";
                const strokeDasharray =
                    elStrokeStyle === "dashed"
                        ? "10,10"
                        : elStrokeStyle === "dotted"
                          ? "2,6"
                          : "none";
                const elFillColor = element.fillColor || "none";
                const hasVisibleFill =
                    elFillColor !== "none" && elFillColor !== "transparent";
                const fillValue =
                    elFillColor === "transparent" ? "none" : elFillColor;
                const pointerEventsValue =
                    hasVisibleFill && element.strokeWidth > 0
                        ? "visible"
                        : hasVisibleFill
                          ? "fill"
                          : element.strokeWidth > 0
                            ? "stroke"
                            : "none";
                const hitboxStrokeWidth = Math.max(element.strokeWidth * 6, 16);
                const elCornerRadius = element.cornerRadius ?? 0;

                // Diamond points: top, right, bottom, left
                const x = element.x ?? 0;
                const y = element.y ?? 0;
                const w = element.width ?? 0;
                const h = element.height ?? 0;
                const cx = x + w / 2;
                const cy = y + h / 2;

                // Create diamond path with optional rounded corners
                const top = { x: cx, y: y };
                const right = { x: x + w, y: cy };
                const bottom = { x: cx, y: y + h };
                const left = { x: x, y: cy };

                let diamondPath: string;
                if (elCornerRadius > 0) {
                    // Calculate the maximum radius based on the shortest edge
                    const edgeLength = Math.min(
                        Math.hypot(right.x - top.x, right.y - top.y),
                        Math.hypot(bottom.x - right.x, bottom.y - right.y),
                    );
                    const maxRadius = edgeLength / 3;
                    const r = Math.min(elCornerRadius, maxRadius);

                    // Helper to get point along edge at distance from corner
                    const getPointAlongEdge = (
                        from: { x: number; y: number },
                        to: { x: number; y: number },
                        dist: number,
                    ) => {
                        const len = Math.hypot(to.x - from.x, to.y - from.y);
                        const t = dist / len;
                        return {
                            x: from.x + (to.x - from.x) * t,
                            y: from.y + (to.y - from.y) * t,
                        };
                    };

                    // Points before and after each corner
                    const topToRight = getPointAlongEdge(top, right, r);
                    const rightFromTop = getPointAlongEdge(right, top, r);
                    const rightToBottom = getPointAlongEdge(right, bottom, r);
                    const bottomFromRight = getPointAlongEdge(bottom, right, r);
                    const bottomToLeft = getPointAlongEdge(bottom, left, r);
                    const leftFromBottom = getPointAlongEdge(left, bottom, r);
                    const leftToTop = getPointAlongEdge(left, top, r);
                    const topFromLeft = getPointAlongEdge(top, left, r);

                    diamondPath = `
            M ${topToRight.x},${topToRight.y}
            L ${rightFromTop.x},${rightFromTop.y}
            Q ${right.x},${right.y} ${rightToBottom.x},${rightToBottom.y}
            L ${bottomFromRight.x},${bottomFromRight.y}
            Q ${bottom.x},${bottom.y} ${bottomToLeft.x},${bottomToLeft.y}
            L ${leftFromBottom.x},${leftFromBottom.y}
            Q ${left.x},${left.y} ${leftToTop.x},${leftToTop.y}
            L ${topFromLeft.x},${topFromLeft.y}
            Q ${top.x},${top.y} ${topToRight.x},${topToRight.y}
            Z
          `;
                } else {
                    diamondPath = `M ${top.x},${top.y} L ${right.x},${right.y} L ${bottom.x},${bottom.y} L ${left.x},${left.y} Z`;
                }

                // Simple polygon points for hitbox
                const diamondPoints = `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`;

                // Use rough.js for hand-drawn rendering
                if (handDrawnMode) {
                    const roughElement = renderRoughElement(element, {
                        opacity,
                        isMarkedForDeletion,
                        transform: `${rotationTransform || ""} translate(${element.x}, ${element.y})`,
                    });

                    if (roughElement) {
                        return (
                            <g key={element.id}>
                                {roughElement}
                                {isMarkedForDeletion && (
                                    <path
                                        d={diamondPath}
                                        fill="rgba(0, 0, 0, 0.7)"
                                        pointerEvents="none"
                                        transform={rotationTransform}
                                    />
                                )}
                            </g>
                        );
                    }
                }

                return (
                    <g key={element.id} transform={rotationTransform}>
                        {/* Invisible wider hitbox for easier clicking (stroke-only shapes) */}
                        {!hasVisibleFill && element.strokeWidth > 0 && (
                            <polygon
                                data-element-id={element.id}
                                points={diamondPoints}
                                stroke="transparent"
                                strokeWidth={hitboxStrokeWidth}
                                fill="none"
                                pointerEvents="stroke"
                            />
                        )}
                        {/* Visible diamond */}
                        <path
                            data-element-id={
                                !hasVisibleFill && element.strokeWidth > 0
                                    ? undefined
                                    : element.id
                            }
                            d={diamondPath}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeDasharray={strokeDasharray}
                            fill={fillValue}
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.3
                                    : elOpacity
                            }
                            pointerEvents={
                                !hasVisibleFill && element.strokeWidth > 0
                                    ? "none"
                                    : pointerEventsValue
                            }
                        />
                        {isMarkedForDeletion && (
                            <path
                                d={diamondPath}
                                fill="rgba(0, 0, 0, 0.7)"
                                pointerEvents="none"
                            />
                        )}
                    </g>
                );
            }
            case "ellipse": {
                const elOpacity = (element.opacity ?? 100) / 100;
                const elStrokeStyle = element.strokeStyle || "solid";
                const strokeDasharray =
                    elStrokeStyle === "dashed"
                        ? "10,10"
                        : elStrokeStyle === "dotted"
                          ? "2,6"
                          : "none";
                const elFillColor = element.fillColor || "none";
                const hasVisibleFill =
                    elFillColor !== "none" && elFillColor !== "transparent";
                const fillValue =
                    elFillColor === "transparent" ? "none" : elFillColor;
                const pointerEventsValue =
                    hasVisibleFill && element.strokeWidth > 0
                        ? "visible"
                        : hasVisibleFill
                          ? "fill"
                          : element.strokeWidth > 0
                            ? "stroke"
                            : "none";

                const x = element.x ?? 0;
                const y = element.y ?? 0;
                const w = element.width ?? 0;
                const h = element.height ?? 0;
                const cx = x + w / 2;
                const cy = y + h / 2;

                // Create wider invisible hitbox for easier clicking on stroke-only shapes
                const hitboxStrokeWidth = Math.max(element.strokeWidth * 6, 16);
                const hitboxOffset =
                    (hitboxStrokeWidth - element.strokeWidth) / 2;

                // Use rough.js for hand-drawn rendering
                if (handDrawnMode) {
                    const roughElement = renderRoughElement(element, {
                        opacity,
                        isMarkedForDeletion,
                        transform: `${rotationTransform || ""} translate(${element.x}, ${element.y})`,
                    });

                    if (roughElement) {
                        return (
                            <g key={element.id}>
                                {roughElement}
                                {isMarkedForDeletion && (
                                    <ellipse
                                        cx={cx}
                                        cy={cy}
                                        rx={(element.width || 0) / 2}
                                        ry={(element.height || 0) / 2}
                                        fill="rgba(0, 0, 0, 0.7)"
                                        pointerEvents="none"
                                        transform={rotationTransform}
                                    />
                                )}
                            </g>
                        );
                    }
                }

                return (
                    <g key={element.id} transform={rotationTransform}>
                        {/* Invisible wider hitbox for easier clicking (stroke-only shapes) */}
                        {!hasVisibleFill && element.strokeWidth > 0 && (
                            <ellipse
                                data-element-id={element.id}
                                cx={cx}
                                cy={cy}
                                rx={(element.width || 0) / 2 + hitboxOffset}
                                ry={(element.height || 0) / 2 + hitboxOffset}
                                stroke="transparent"
                                strokeWidth={hitboxStrokeWidth}
                                fill="none"
                                pointerEvents="stroke"
                            />
                        )}
                        {/* Visible ellipse */}
                        <ellipse
                            data-element-id={
                                !hasVisibleFill && element.strokeWidth > 0
                                    ? undefined
                                    : element.id
                            }
                            cx={cx}
                            cy={cy}
                            rx={(element.width || 0) / 2}
                            ry={(element.height || 0) / 2}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeDasharray={strokeDasharray}
                            fill={fillValue}
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.3
                                    : elOpacity
                            }
                            pointerEvents={
                                !hasVisibleFill && element.strokeWidth > 0
                                    ? "none"
                                    : pointerEventsValue
                            }
                        />
                        {isMarkedForDeletion && (
                            <ellipse
                                cx={cx}
                                cy={cy}
                                rx={(element.width || 0) / 2}
                                ry={(element.height || 0) / 2}
                                fill="rgba(0, 0, 0, 0.7)"
                                pointerEvents="none"
                            />
                        )}
                    </g>
                );
            }
            case "text": {
                if (
                    editingTextElementId &&
                    element.id === editingTextElementId
                ) {
                    return null;
                }
                if (remotelyEditingTextIds.has(element.id)) {
                    return null;
                }

                const elOpacity = (element.opacity ?? 100) / 100;
                const fontSize =
                    element.fontSize ?? element.strokeWidth * 4 + 12;
                const elLetterSpacing = element.letterSpacing ?? 0;
                const elLineHeight = element.lineHeight ?? 1.4;
                const scaleX = element.scaleX ?? 1;
                const scaleY = element.scaleY ?? 1;
                const x = element.x ?? 0;
                const y = element.y ?? 0;
                const baselineOffset = fontSize * 0.82;

                // Calculate minimum width to check if at single-character width
                const minCharWidth = getMinSingleCharWidth(
                    element.text || "",
                    fontSize,
                    element.fontFamily || "var(--font-inter)",
                    elLetterSpacing,
                );
                // Force left alignment when at minimum width (1 char per line)
                const isAtMinWidth =
                    element.width !== undefined &&
                    element.width <= minCharWidth + 1;
                const effectiveTextAlign = isAtMinWidth
                    ? "left"
                    : element.textAlign || "left";

                if (element.isTextBox && element.width && element.height) {
                    // Render text box using HTML inside SVG for true WYSIWYG alignment.
                    return (
                        <g
                            key={element.id}
                            transform={rotationTransform}
                            data-element-id={element.id}
                        >
                            {/* Clickable area for the entire text box */}
                            <rect
                                x={x}
                                y={y}
                                width={element.width}
                                height={element.height}
                                fill="transparent"
                                stroke="transparent"
                                strokeWidth={1}
                                pointerEvents="fill"
                            />
                            <foreignObject
                                x={x}
                                y={y}
                                width={element.width}
                                height={element.height}
                                pointerEvents="none"
                                opacity={
                                    isMarkedForDeletion
                                        ? elOpacity * 0.3
                                        : elOpacity
                                }
                            >
                                <div
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        color: element.strokeColor,
                                        fontFamily:
                                            element.fontFamily ||
                                            "var(--font-inter)",
                                        fontSize: `${fontSize}px`,
                                        lineHeight: `${elLineHeight}`,
                                        // At minimum width, use 0 letter-spacing to force 1 char per line
                                        letterSpacing: isAtMinWidth
                                            ? "0px"
                                            : `${elLetterSpacing}px`,
                                        whiteSpace: "pre-wrap",
                                        overflowWrap: "anywhere",
                                        // At minimum width, use break-all to force each character to wrap
                                        wordBreak: isAtMinWidth
                                            ? "break-all"
                                            : "break-word",
                                        textAlign: effectiveTextAlign,
                                        padding: 0,
                                        margin: 0,
                                        boxSizing: "border-box",
                                        overflow: "hidden",
                                    }}
                                >
                                    {element.text || ""}
                                </div>
                            </foreignObject>
                            {isMarkedForDeletion && (
                                <rect
                                    x={x}
                                    y={y}
                                    width={element.width}
                                    height={element.height}
                                    fill="rgba(0, 0, 0, 0.7)"
                                    pointerEvents="none"
                                />
                            )}
                        </g>
                    );
                }

                // Render simple single-line text
                const elTextAlign = element.textAlign || "left";
                let textX = 0;
                let textAnchor: "start" | "middle" | "end" = "start";

                if (elTextAlign === "center") {
                    textX = (element.width ?? 0) / 2;
                    textAnchor = "middle";
                } else if (elTextAlign === "right") {
                    textX = element.width ?? 0;
                    textAnchor = "end";
                }

                return (
                    <g key={element.id} transform={rotationTransform}>
                        <text
                            data-element-id={element.id}
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.3
                                    : elOpacity
                            }
                            fill={element.strokeColor}
                            fontSize={fontSize}
                            fontFamily={
                                element.fontFamily || "var(--font-inter)"
                            }
                            textAnchor={textAnchor}
                            letterSpacing={`${elLetterSpacing}px`}
                            x={textX}
                            y={baselineOffset}
                            transform={`translate(${x}, ${y}) scale(${scaleX}, ${scaleY})`}
                            pointerEvents="auto"
                        >
                            {element.text}
                        </text>
                        {isMarkedForDeletion && (
                            <rect
                                x={x}
                                y={y}
                                width={element.width ?? 100}
                                height={element.height ?? 30}
                                fill="rgba(0, 0, 0, 0.7)"
                                transform={`scale(${scaleX}, ${scaleY})`}
                                pointerEvents="none"
                            />
                        )}
                    </g>
                );
            }
            case "frame": {
                const elOpacity = (element.opacity ?? 100) / 100;
                const elStrokeStyle = element.strokeStyle || "solid";
                const strokeDasharray =
                    elStrokeStyle === "dashed"
                        ? "8,4"
                        : elStrokeStyle === "dotted"
                          ? "2,6"
                          : "8,4"; // Frame defaults to dashed
                const elCornerRadius = element.cornerRadius ?? 8;
                const elFillColor = element.fillColor || "none";
                // Treat 'transparent' same as 'none' for hit detection - invisible fills shouldn't be clickable
                const hasVisibleFill =
                    elFillColor !== "none" && elFillColor !== "transparent";
                // Convert transparent to none for proper pointer-events behavior in SVG
                const fillValue =
                    elFillColor === "transparent" ? "none" : elFillColor;
                // Only visible parts should be clickable: if has fill AND stroke, allow both; if only stroke, only stroke; if only fill, only fill
                const pointerEventsValue =
                    hasVisibleFill && element.strokeWidth > 0
                        ? "visible"
                        : hasVisibleFill
                          ? "fill"
                          : element.strokeWidth > 0
                            ? "stroke"
                            : "none";
                // Create wider invisible hitbox for easier clicking on stroke-only shapes
                const hitboxStrokeWidth = Math.max(element.strokeWidth * 6, 16);
                const hitboxOffset =
                    (hitboxStrokeWidth - element.strokeWidth) / 2;
                return (
                    <g key={element.id} transform={rotationTransform}>
                        {/* Invisible wider hitbox for easier clicking (stroke-only shapes) */}
                        {!hasVisibleFill && element.strokeWidth > 0 && (
                            <rect
                                data-element-id={element.id}
                                x={(element.x ?? 0) - hitboxOffset}
                                y={(element.y ?? 0) - hitboxOffset}
                                width={(element.width ?? 0) + hitboxOffset * 2}
                                height={
                                    (element.height ?? 0) + hitboxOffset * 2
                                }
                                stroke="transparent"
                                strokeWidth={hitboxStrokeWidth}
                                fill="none"
                                rx={elCornerRadius}
                                strokeDasharray={strokeDasharray}
                                pointerEvents="stroke"
                            />
                        )}
                        {/* Visible frame */}
                        <rect
                            data-element-id={
                                !hasVisibleFill && element.strokeWidth > 0
                                    ? undefined
                                    : element.id
                            }
                            x={element.x}
                            y={element.y}
                            width={element.width}
                            height={element.height}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            fill={fillValue}
                            rx={elCornerRadius}
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.3
                                    : elOpacity
                            }
                            strokeDasharray={strokeDasharray}
                            pointerEvents={
                                !hasVisibleFill && element.strokeWidth > 0
                                    ? "none"
                                    : pointerEventsValue
                            }
                        />
                        {element.label && (
                            <text
                                x={(element.x ?? 0) + 8}
                                y={(element.y ?? 0) - 4}
                                fill={element.strokeColor}
                                fontSize={14}
                                fontFamily="inherit"
                                fontWeight="600"
                                opacity={
                                    isMarkedForDeletion
                                        ? elOpacity * 0.3
                                        : elOpacity
                                }
                                pointerEvents="none"
                            >
                                {element.label}
                            </text>
                        )}
                        {isMarkedForDeletion && (
                            <rect
                                x={element.x}
                                y={element.y}
                                width={element.width}
                                height={element.height}
                                fill="rgba(0, 0, 0, 0.7)"
                                rx={elCornerRadius}
                                pointerEvents="none"
                            />
                        )}
                    </g>
                );
            }
            case "web-embed": {
                const elOpacity = (element.opacity ?? 100) / 100;
                const elStrokeStyle = element.strokeStyle || "solid";
                const strokeDasharray =
                    elStrokeStyle === "dashed"
                        ? "10,10"
                        : elStrokeStyle === "dotted"
                          ? "2,6"
                          : "none";
                const elCornerRadius = element.cornerRadius ?? 4;
                const elFillColor =
                    element.fillColor || "rgba(100, 100, 255, 0.05)";
                return (
                    <g key={element.id} transform={rotationTransform}>
                        <rect
                            data-element-id={element.id}
                            x={element.x}
                            y={element.y}
                            width={element.width}
                            height={element.height}
                            stroke={element.strokeColor}
                            strokeWidth={element.strokeWidth}
                            strokeDasharray={strokeDasharray}
                            fill={elFillColor}
                            rx={elCornerRadius}
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.3
                                    : elOpacity
                            }
                            pointerEvents="auto"
                        />
                        <text
                            x={(element.x ?? 0) + 10}
                            y={(element.y ?? 0) + 20}
                            fill={element.strokeColor}
                            fontSize={12}
                            fontFamily="inherit"
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.3
                                    : elOpacity
                            }
                            pointerEvents="none"
                        >
                            {element.url || "Web Embed"}
                        </text>
                        {isMarkedForDeletion && (
                            <rect
                                x={element.x}
                                y={element.y}
                                width={element.width}
                                height={element.height}
                                fill="rgba(0, 0, 0, 0.7)"
                                rx={elCornerRadius}
                                pointerEvents="none"
                            />
                        )}
                    </g>
                );
            }
            case "laser": {
                const elOpacity = (element.opacity ?? 100) / 100;
                const now = Date.now();
                const age = element.timestamp ? now - element.timestamp : 0;
                const hold = 3000;
                const fade = 800;
                const fadeProgress = Math.max(0, (age - hold) / fade);
                const fadeOpacity = 1 - Math.min(1, fadeProgress);

                if (fadeOpacity <= 0) return null;

                const stroke = getStroke(
                    element.points.map((p) => [p.x, p.y]),
                    {
                        size: element.strokeWidth * 2.2,
                        thinning: 0.3,
                        smoothing: 0.8,
                        streamline: 0.6,
                    },
                );
                const pathData = getSvgPathFromStroke(stroke);

                // Create a smooth center line using getStroke with smaller size
                const centerStroke = getStroke(
                    element.points.map((p) => [p.x, p.y]),
                    {
                        size: 1.5,
                        thinning: 0,
                        smoothing: 0.5,
                        streamline: 0.5,
                    },
                );
                const centerLineData = getSvgPathFromStroke(centerStroke);

                return (
                    <g
                        key={element.id}
                        transform={rotationTransform}
                        pointerEvents="none"
                        className="select-none"
                    >
                        {/* Main red glowing path */}
                        <path
                            data-element-id={element.id}
                            d={pathData}
                            fill="#ef4444"
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.8 * 0.3
                                    : elOpacity * 0.8
                            }
                            filter="url(#laser-glow)"
                            pointerEvents="none"
                        />
                        {/* Smooth white center line */}
                        <path
                            d={centerLineData}
                            fill="#ffffff"
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.3
                                    : elOpacity * 0.9
                            }
                            pointerEvents="none"
                        />
                        {isMarkedForDeletion && (
                            <path
                                d={pathData}
                                fill="rgba(0, 0, 0, 0.7)"
                                pointerEvents="none"
                            />
                        )}
                    </g>
                );
            }
            case "tile": {
                // Tiles render in the HTML overlay layer (Canvas) to support rich DOM editors.
                return null;
            }

            default:
                return null;
        }
    };

    // Render connector (line/arrow) control points
    const renderConnectorControls = useCallback(
        (element: BoardElement) => {
            const el = getConnectorDragPreviewElement(element);
            if (el.points.length < 2) return null;

            const start = el.points[0];
            const end = el.points[el.points.length - 1];
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;

            const rotationDeg = el.rotation ?? 0;
            const boundsForRotation = rotationDeg ? getBoundingBox(el) : null;
            const rotationTransform =
                boundsForRotation && rotationDeg
                    ? `rotate(${rotationDeg} ${boundsForRotation.x + boundsForRotation.width / 2} ${boundsForRotation.y + boundsForRotation.height / 2})`
                    : undefined;

            const style = el.connectorStyle ?? connectorStyle;
            const route =
                el.elbowRoute ??
                (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
                    ? "vertical"
                    : "horizontal");
            const control =
                el.points.length >= 3 ? el.points[1] : { x: midX, y: midY };

            const dotSize = 8 / zoom;
            const dotStrokeWidth = 2 / zoom;
            const baseRadius = dotSize / 2;
            const hitboxRadius = 16 / zoom; // Larger invisible hitbox for easier grabbing
            const existingRadius = isEditArrowMode
                ? baseRadius * 1.6
                : baseRadius;

            // Position handle at the control point for both modes
            const handlePosCurved = control;
            const handlePosElbow =
                route === "vertical"
                    ? { x: control.x, y: midY }
                    : { x: midX, y: control.y };

            const getQuadraticPoint = (
                p0: Point,
                c: Point,
                p1: Point,
                t: number,
            ): Point => {
                const mt = 1 - t;
                return {
                    x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
                    y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
                };
            };

            const approxQuadraticLength = (
                p0: Point,
                c: Point,
                p1: Point,
                t0: number,
                t1: number,
                steps = 12,
            ) => {
                let len = 0;
                let prev = getQuadraticPoint(p0, c, p1, t0);
                for (let s = 1; s <= steps; s++) {
                    const t = t0 + ((t1 - t0) * s) / steps;
                    const next = getQuadraticPoint(p0, c, p1, t);
                    len += Math.hypot(next.x - prev.x, next.y - prev.y);
                    prev = next;
                }
                return len;
            };

            const approxCubicLength = (
                p0: Point,
                c1: Point,
                c2: Point,
                p1: Point,
                steps = 12,
            ) => {
                let len = 0;
                let prev = getCubicBezierPoint(p0, c1, c2, p1, 0);
                for (let s = 1; s <= steps; s++) {
                    const t = s / steps;
                    const next = getCubicBezierPoint(p0, c1, c2, p1, t);
                    len += Math.hypot(next.x - prev.x, next.y - prev.y);
                    prev = next;
                }
                return len;
            };

            const toLocalPoint = (worldPoint: Point) => {
                if (!rotationDeg) return worldPoint;
                const b = getBoundingBox(el);
                if (!b) return worldPoint;
                const center = getBoundsCenter(b);
                return rotatePoint(worldPoint, center, -rotationDeg);
            };

            // Special elbow UI: hide corner points; show start/end big + one insert handle per edge.
            if (style === "elbow") {
                const baseRadius = dotSize / 2;
                const bigRadius = baseRadius * 1.6;
                const eps = 0.5 / zoom;
                const isDraggingThisElbow =
                    originalElements.length === 1 &&
                    originalElements[0].id === element.id;

                // Always use getElbowPolylineForVertices for 3+ point elbows
                // This correctly handles paths from generateElbowRouteAroundObstacles
                const elbowPolylineRaw =
                    el.points.length === 2
                        ? [start, end]
                        : getElbowPolylineForVertices(el.points, eps);

                // Normalize: remove consecutive duplicate points (avoids zero-length segments causing duplicate handles).
                const elbowPolyline = elbowPolylineRaw.reduce<Point[]>(
                    (acc, p) => {
                        const last = acc[acc.length - 1];
                        if (
                            !last ||
                            Math.hypot(p.x - last.x, p.y - last.y) > eps
                        )
                            acc.push(p);
                        return acc;
                    },
                    [],
                );

                const runs: Array<{
                    startIdx: number;
                    endIdx: number;
                    orientation: "h" | "v";
                }> = [];
                for (let i = 0; i < elbowPolyline.length - 1; i++) {
                    const a = elbowPolyline[i];
                    const b = elbowPolyline[i + 1];
                    const dx = Math.abs(a.x - b.x);
                    const dy = Math.abs(a.y - b.y);
                    if (dx <= eps && dy <= eps) continue;
                    const orientation: "h" | "v" =
                        dy <= eps
                            ? "h"
                            : dx <= eps
                              ? "v"
                              : dx >= dy
                                ? "h"
                                : "v";
                    if (runs.length === 0) {
                        runs.push({ startIdx: i, endIdx: i + 1, orientation });
                        continue;
                    }
                    const last = runs[runs.length - 1];
                    if (last.endIdx === i && last.orientation === orientation) {
                        last.endIdx = i + 1;
                    } else {
                        runs.push({ startIdx: i, endIdx: i + 1, orientation });
                    }
                }

                const startDragWithExplicit = (
                    e: ReactMouseEvent,
                    drag: { kind: ConnectorDragKind; index: number },
                ) => {
                    e.stopPropagation();
                    onStartTransform?.();
                    const updates: Partial<BoardElement> = {
                        points: elbowPolyline,
                        connectorStyle: "elbow",
                        elbowRoute: undefined,
                    };
                    setOriginalElements([
                        { ...element, ...updates, points: elbowPolyline },
                    ]);
                    setDraggingConnectorPoint(drag);
                    onUpdateElement(element.id, updates);
                };

                const startElbowMoveEdge = (
                    e: ReactMouseEvent,
                    segIndex: number,
                ) => {
                    e.stopPropagation();
                    onStartTransform?.();

                    const a = elbowPolyline[segIndex];
                    const b = elbowPolyline[segIndex + 1];
                    const dx = Math.abs(b.x - a.x);
                    const dy = Math.abs(b.y - a.y);
                    const isHorizontal =
                        dy <= eps ? true : dx <= eps ? false : dx >= dy;
                    const axis: "x" | "y" = isHorizontal ? "y" : "x";

                    // Expand to the full contiguous run (so dragging moves the entire edge, not a sub-segment).
                    let left = segIndex;
                    let right = segIndex + 1;
                    if (isHorizontal) {
                        const baseY = a.y;
                        while (
                            left > 0 &&
                            Math.abs(elbowPolyline[left - 1].y - baseY) <= eps
                        )
                            left--;
                        while (
                            right < elbowPolyline.length - 1 &&
                            Math.abs(elbowPolyline[right + 1].y - baseY) <= eps
                        )
                            right++;
                    } else {
                        const baseX = a.x;
                        while (
                            left > 0 &&
                            Math.abs(elbowPolyline[left - 1].x - baseX) <= eps
                        )
                            left--;
                        while (
                            right < elbowPolyline.length - 1 &&
                            Math.abs(elbowPolyline[right + 1].x - baseX) <= eps
                        )
                            right++;
                    }

                    const pointerWorld = getMousePosition(e);
                    const anchor = toLocalPoint(pointerWorld);
                    const edgeKey = `${element.id}-elbow-edge-${segIndex}`;

                    // Only global start/end are anchored. If the dragged run touches either endpoint,
                    // insert a duplicate point next to the endpoint so the run can move while the endpoint stays fixed.
                    const pointsForDrag = [...elbowPolyline];
                    let leftIdx = left;
                    let rightIdx = right;

                    if (leftIdx === 0 && pointsForDrag.length >= 2) {
                        const first = pointsForDrag[0];
                        const next = pointsForDrag[1];
                        if (
                            Math.hypot(
                                (next?.x ?? first.x) - first.x,
                                (next?.y ?? first.y) - first.y,
                            ) > eps
                        ) {
                            pointsForDrag.splice(1, 0, { ...first });
                            rightIdx += 1;
                        }
                        leftIdx = 1;
                    }

                    const lastIndexBefore = pointsForDrag.length - 1;
                    if (
                        rightIdx === lastIndexBefore &&
                        pointsForDrag.length >= 2
                    ) {
                        const last = pointsForDrag[lastIndexBefore];
                        const prev = pointsForDrag[lastIndexBefore - 1];
                        if (
                            Math.hypot(
                                (prev?.x ?? last.x) - last.x,
                                (prev?.y ?? last.y) - last.y,
                            ) > eps
                        ) {
                            pointsForDrag.splice(lastIndexBefore, 0, {
                                ...last,
                            });
                        }
                        rightIdx = pointsForDrag.length - 2; // the inserted duplicate (just before the true end)
                    }

                    const updates: Partial<BoardElement> = {
                        points: pointsForDrag,
                        connectorStyle: "elbow",
                        elbowRoute: undefined,
                    };
                    setOriginalElements([
                        { ...element, ...updates, points: pointsForDrag },
                    ]);
                    setDraggingConnectorPoint({
                        kind: "elbowEdge",
                        index: segIndex,
                        range: [leftIdx, rightIdx],
                        axis,
                        edgeKey,
                        anchor,
                    });
                    onUpdateElement(element.id, updates);
                };

                const minGapPx = 6;
                const existingDiameterPx = bigRadius * 2 * zoom;
                const insertDiameterPx = baseRadius * 2 * zoom;
                const minDistFromEndpointPx =
                    (bigRadius + baseRadius) * zoom + 2;

                const insertCenters: Point[] = [];
                const renderInsertForRun = (run: {
                    startIdx: number;
                    endIdx: number;
                    orientation: "h" | "v";
                }) => {
                    // While dragging an elbow edge/insert, hide insert handles (prevents a "left behind" small circle).
                    if (
                        isDraggingThisElbow &&
                        (draggingConnectorPoint?.kind === "elbowEdge" ||
                            draggingConnectorPoint?.kind === "createCorner" ||
                            draggingConnectorPoint?.kind === "elbowOrtho")
                    ) {
                        return null;
                    }

                    const a = elbowPolyline[run.startIdx];
                    const b = elbowPolyline[run.endIdx];
                    const segLenPx = Math.hypot(b.x - a.x, b.y - a.y) * zoom;
                    const canShow =
                        segLenPx >=
                        existingDiameterPx + insertDiameterPx + minGapPx;
                    if (!canShow) return null;

                    const cx = (a.x + b.x) / 2;
                    const cy = (a.y + b.y) / 2;
                    const dStart =
                        Math.hypot(
                            cx - elbowPolyline[0].x,
                            cy - elbowPolyline[0].y,
                        ) * zoom;
                    const dEnd =
                        Math.hypot(
                            cx - elbowPolyline[elbowPolyline.length - 1].x,
                            cy - elbowPolyline[elbowPolyline.length - 1].y,
                        ) * zoom;
                    if (
                        dStart < minDistFromEndpointPx ||
                        dEnd < minDistFromEndpointPx
                    )
                        return null;

                    // Avoid inserts on top of existing points (big or small).
                    const overlapsPoint = elbowPolyline.some((p, idx) => {
                        if (idx === run.startIdx || idx === run.endIdx)
                            return false;
                        return (
                            Math.hypot(cx - p.x, cy - p.y) * zoom <
                            insertDiameterPx + 2
                        );
                    });
                    if (overlapsPoint) return null;

                    // Avoid double circles on elbow: no insert if too close to another insert.
                    const overlapsInsert = insertCenters.some(
                        (p) =>
                            Math.hypot(cx - p.x, cy - p.y) * zoom <
                            insertDiameterPx + 2,
                    );
                    if (overlapsInsert) return null;
                    insertCenters.push({ x: cx, y: cy });

                    return (
                        <circle
                            key={`${element.id}-elbow-insert-${run.startIdx}-${run.endIdx}`}
                            cx={cx}
                            cy={cy}
                            r={baseRadius}
                            fill="var(--accent)"
                            stroke="var(--background)"
                            strokeWidth={dotStrokeWidth}
                            style={{
                                cursor:
                                    run.orientation === "h"
                                        ? "ns-resize"
                                        : "ew-resize",
                            }}
                            onMouseDown={(e) =>
                                startElbowMoveEdge(e, run.startIdx)
                            }
                        />
                    );
                };

                const activeEdgeCircle =
                    draggingConnectorPoint?.kind === "elbowEdge" &&
                    draggingConnectorPoint?.range &&
                    draggingConnectorPoint.edgeKey?.startsWith(
                        `${element.id}-elbow-`,
                    )
                        ? (() => {
                              const [i1, i2] = draggingConnectorPoint.range;
                              const p1 = el.points[i1];
                              const p2 = el.points[i2];
                              if (!p1 || !p2) return null;
                              const cx = (p1.x + p2.x) / 2;
                              const cy = (p1.y + p2.y) / 2;
                              return (
                                  <circle
                                      cx={cx}
                                      cy={cy}
                                      r={bigRadius}
                                      fill="var(--background)"
                                      stroke="var(--accent)"
                                      strokeWidth={dotStrokeWidth}
                                      pointerEvents="none"
                                  />
                              );
                          })()
                        : null;

                const activeCreateCornerCircle =
                    draggingConnectorPoint?.kind === "createCorner" &&
                    isDraggingThisElbow ? (
                        <circle
                            cx={handlePosElbow.x}
                            cy={handlePosElbow.y}
                            r={bigRadius}
                            fill="var(--background)"
                            stroke="var(--accent)"
                            strokeWidth={dotStrokeWidth}
                            pointerEvents="none"
                        />
                    ) : null;

                return (
                    <g transform={rotationTransform}>
                        {/* Edge hitboxes (drag entire edge) */}
                        {element.points.length >= 3 &&
                            runs.map((run, idx) => {
                                const p = elbowPolyline[run.startIdx];
                                const q = elbowPolyline[run.endIdx];
                                const isHorizontal = run.orientation === "h";
                                const cursor = isHorizontal
                                    ? "ns-resize"
                                    : "ew-resize";
                                return (
                                    <line
                                        key={`${element.id}-elbow-hit-run-${idx}`}
                                        x1={p.x}
                                        y1={p.y}
                                        x2={q.x}
                                        y2={q.y}
                                        stroke="transparent"
                                        strokeWidth={Math.max(
                                            12 / zoom,
                                            18 / zoom,
                                        )}
                                        pointerEvents="stroke"
                                        style={{ cursor }}
                                        onMouseDown={(e) =>
                                            startElbowMoveEdge(e, run.startIdx)
                                        }
                                    />
                                );
                            })}

                        {/* Endpoints (always big for elbow) */}
                        {/* Start endpoint - invisible hitbox */}
                        <circle
                            cx={elbowPolyline[0].x}
                            cy={elbowPolyline[0].y}
                            r={hitboxRadius}
                            fill="transparent"
                            style={{ cursor: "move" }}
                            onMouseDown={(e) =>
                                startDragWithExplicit(e, {
                                    kind: "elbowEndpoint",
                                    index: 0,
                                })
                            }
                        />
                        {/* Start endpoint - visible dot */}
                        <circle
                            cx={elbowPolyline[0].x}
                            cy={elbowPolyline[0].y}
                            r={bigRadius}
                            fill="var(--background)"
                            stroke="var(--accent)"
                            strokeWidth={dotStrokeWidth}
                            pointerEvents="none"
                        />
                        {/* End endpoint - invisible hitbox */}
                        <circle
                            cx={elbowPolyline[elbowPolyline.length - 1].x}
                            cy={elbowPolyline[elbowPolyline.length - 1].y}
                            r={hitboxRadius}
                            fill="transparent"
                            style={{ cursor: "move" }}
                            onMouseDown={(e) =>
                                startDragWithExplicit(e, {
                                    kind: "elbowEndpoint",
                                    index: elbowPolyline.length - 1,
                                })
                            }
                        />
                        {/* End endpoint - visible dot */}
                        <circle
                            cx={elbowPolyline[elbowPolyline.length - 1].x}
                            cy={elbowPolyline[elbowPolyline.length - 1].y}
                            r={bigRadius}
                            fill="var(--background)"
                            stroke="var(--accent)"
                            strokeWidth={dotStrokeWidth}
                            pointerEvents="none"
                        />

                        {/* Insert handles: one per edge */}
                        {el.points.length >= 3 ? (
                            <g>{runs.map((r) => renderInsertForRun(r))}</g>
                        ) : (
                            <circle
                                cx={(start.x + end.x) / 2}
                                cy={(start.y + end.y) / 2}
                                r={baseRadius}
                                fill="var(--accent)"
                                stroke="var(--background)"
                                strokeWidth={dotStrokeWidth}
                                style={{ cursor: "copy" }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    onStartTransform?.();
                                    setDraggingConnectorPoint({
                                        index: 1,
                                        kind: "createCorner",
                                    });
                                    setOriginalElements([{ ...element }]);
                                }}
                            />
                        )}

                        {/* Active dragged edge handle (big) */}
                        {activeEdgeCircle}
                        {activeCreateCornerCircle}
                    </g>
                );
            }

            const handles: Array<{
                pos: Point;
                index: number;
                kind: ConnectorDragKind;
            }> =
                element.points.length === 2
                    ? [
                          { pos: start, index: 0, kind: "normal" },
                          {
                              pos: { x: midX, y: midY },
                              index: 1,
                              kind: "createCorner",
                          },
                          { pos: end, index: 1, kind: "normal" },
                      ]
                    : style === "curved" && element.points.length === 3
                      ? [
                            { pos: start, index: 0, kind: "normal" },
                            {
                                pos: handlePosCurved,
                                index: 1,
                                kind: "curvedMid",
                            },
                            { pos: end, index: 2, kind: "normal" },
                        ]
                      : element.points.map((p, i) => ({
                            pos: p,
                            index: i,
                            kind: "normal" as const,
                        }));

            const startDrag = (
                e: ReactMouseEvent,
                index: number,
                kind: ConnectorDragKind,
            ) => {
                e.stopPropagation();
                onStartTransform?.();

                const actualStyle = element.connectorStyle ?? connectorStyle;
                if (
                    actualStyle === "elbow" &&
                    kind === "normal" &&
                    index > 0 &&
                    index < element.points.length - 1
                ) {
                    const eps = 0.5 / zoom;
                    const p = element.points[index];
                    const prev = element.points[index - 1];
                    const next = element.points[index + 1];
                    const collinearHorizontal =
                        Math.abs(prev.y - p.y) <= eps &&
                        Math.abs(next.y - p.y) <= eps;
                    const collinearVertical =
                        Math.abs(prev.x - p.x) <= eps &&
                        Math.abs(next.x - p.x) <= eps;

                    if (collinearHorizontal) {
                        setDraggingConnectorPoint({
                            index,
                            kind: "elbowOrtho",
                            axis: "y",
                        });
                        setOriginalElements([{ ...element }]);
                        return;
                    }
                    if (collinearVertical) {
                        setDraggingConnectorPoint({
                            index,
                            kind: "elbowOrtho",
                            axis: "x",
                        });
                        setOriginalElements([{ ...element }]);
                        return;
                    }
                }

                setDraggingConnectorPoint({ index, kind });
                setOriginalElements([{ ...element }]);
            };

            const insertCornerBetween = (
                e: ReactMouseEvent,
                segmentIndex: number,
            ) => {
                e.stopPropagation();
                onStartTransform?.();

                const pointerWorld = getMousePosition(e);
                const pointerLocal = toLocalPoint(pointerWorld);

                const basePoints =
                    style === "curved" && element.points.length === 3
                        ? [start, handlePosCurved, end]
                        : element.points;

                const insertIndex = Math.max(
                    1,
                    Math.min(basePoints.length - 1, segmentIndex + 1),
                );
                const nextPoints = [...basePoints];
                nextPoints.splice(insertIndex, 0, pointerLocal);

                const updates: Partial<BoardElement> = {
                    points: nextPoints,
                    connectorStyle: style,
                    elbowRoute:
                        element.points.length === 3
                            ? element.elbowRoute
                            : undefined,
                };

                setOriginalElements([
                    { ...element, ...updates, points: nextPoints },
                ]);
                setDraggingConnectorPoint({
                    index: insertIndex,
                    kind: "normal",
                });
                onUpdateElement(element.id, updates);
            };

            const getInsertPointForSegment = (segmentIndex: number): Point => {
                if (style === "curved" && element.points.length === 3) {
                    return getQuadraticPoint(
                        start,
                        control,
                        end,
                        segmentIndex === 0 ? 0.25 : 0.75,
                    );
                }

                if (style === "curved" && element.points.length > 3) {
                    const pts = element.points;
                    const p0 = pts[segmentIndex - 1] ?? pts[segmentIndex];
                    const p1 = pts[segmentIndex];
                    const p2 = pts[segmentIndex + 1];
                    const p3 = pts[segmentIndex + 2] ?? p2;
                    const { c1, c2 } = getCatmullRomControlPoints(
                        p0,
                        p1,
                        p2,
                        p3,
                    );
                    return getCubicBezierPoint(p1, c1, c2, p2, 0.5);
                }

                const a = handles[segmentIndex].pos;
                const b = handles[segmentIndex + 1].pos;
                return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            };

            return (
                <g transform={rotationTransform}>
                    {handles.map((h, i) => (
                        <circle
                            key={`${element.id}-pt-${h.index}-${h.kind}-${i}`}
                            cx={h.pos.x}
                            cy={h.pos.y}
                            r={existingRadius}
                            fill="var(--background)"
                            stroke="var(--accent)"
                            strokeWidth={dotStrokeWidth}
                            style={{ cursor: "move" }}
                            onMouseDown={(e) => startDrag(e, h.index, h.kind)}
                        />
                    ))}

                    {/* Insert controls (edit arrow mode) */}
                    {isEditArrowMode &&
                        handles.length >= 3 &&
                        !(
                            draggingConnectorPoint &&
                            originalElements.length === 1 &&
                            originalElements[0].id === element.id
                        ) && (
                            <g>
                                {handles.slice(0, -1).map((h, i) => {
                                    const next = handles[i + 1];

                                    // Use distance *along* the rendered connector, so curved behaves correctly.
                                    let segLenWorld = Math.hypot(
                                        next.pos.x - h.pos.x,
                                        next.pos.y - h.pos.y,
                                    );
                                    if (
                                        style === "curved" &&
                                        element.points.length === 3 &&
                                        handles.length === 3
                                    ) {
                                        segLenWorld = approxQuadraticLength(
                                            start,
                                            control,
                                            end,
                                            i === 0 ? 0 : 0.5,
                                            i === 0 ? 0.5 : 1,
                                        );
                                    } else if (
                                        style === "curved" &&
                                        element.points.length > 3
                                    ) {
                                        const pts = element.points;
                                        const p0 = pts[i - 1] ?? pts[i];
                                        const p1 = pts[i];
                                        const p2 = pts[i + 1];
                                        const p3 = pts[i + 2] ?? p2;
                                        const { c1, c2 } =
                                            getCatmullRomControlPoints(
                                                p0,
                                                p1,
                                                p2,
                                                p3,
                                            );
                                        segLenWorld = approxCubicLength(
                                            p1,
                                            c1,
                                            c2,
                                            p2,
                                        );
                                    }

                                    const segLenPx = segLenWorld * zoom;
                                    const existingDiameterPx =
                                        existingRadius * 2 * zoom;
                                    const insertDiameterPx =
                                        baseRadius * 2 * zoom;
                                    const minGapPx = 6;
                                    const canShow =
                                        segLenPx >=
                                        existingDiameterPx +
                                            insertDiameterPx +
                                            minGapPx;
                                    if (!canShow) return null;
                                    const pos = getInsertPointForSegment(i);
                                    const cx = pos.x;
                                    const cy = pos.y;
                                    return (
                                        <circle
                                            key={`${element.id}-ins-${i}`}
                                            cx={cx}
                                            cy={cy}
                                            r={baseRadius}
                                            fill="var(--accent)"
                                            stroke="var(--background)"
                                            strokeWidth={dotStrokeWidth}
                                            style={{ cursor: "copy" }}
                                            onMouseDown={(e) =>
                                                insertCornerBetween(e, i)
                                            }
                                        />
                                    );
                                })}
                            </g>
                        )}
                </g>
            );
        },
        [
            getConnectorDragPreviewElement,
            onStartTransform,
            connectorStyle,
            zoom,
            isEditArrowMode,
            getMousePosition,
            onUpdateElement,
            draggingConnectorPoint,
            originalElements,
        ],
    );

    const renderRemoteSelections = () => {
        if (remoteSelections.length === 0) return null;

        const selectionPadding = 6 / zoom;

        return (
            <g pointerEvents="none">
                {remoteSelections.map((selection) => {
                    return selection.elementIds.map((elementId) => {
                        const element = elements.find(
                            (el) => el.id === elementId,
                        );
                        if (!element) return null;

                        const bounds = getBoundingBox(element);
                        if (!bounds) return null;

                        const visualBounds = expandBounds(
                            bounds,
                            selectionPadding,
                        );
                        const rotationDeg = element.rotation ?? 0;
                        const center = getBoundsCenter(visualBounds);

                        // Calculate label position (top-left corner of bounds, accounting for rotation)
                        const labelOffset = 4 / zoom;
                        const labelFontSize = 11 / zoom;
                        const labelPadding = { x: 6 / zoom, y: 3 / zoom };
                        const labelFontSizePx = labelFontSize * zoom;
                        const labelFont = `500 ${labelFontSizePx}px system-ui, sans-serif`;
                        const labelCacheKey = `${selection.userName}@@${labelFont}`;
                        let labelTextWidthPx =
                            nameTagWidthCacheRef.current.get(labelCacheKey);
                        if (labelTextWidthPx === undefined) {
                            labelTextWidthPx = measureTextWidthPx(
                                selection.userName,
                                labelFont,
                            );
                            nameTagWidthCacheRef.current.set(
                                labelCacheKey,
                                labelTextWidthPx,
                            );
                        }
                        const labelWidth =
                            labelTextWidthPx / zoom + labelPadding.x * 2;

                        return (
                            <g key={`${selection.userId}-${elementId}`}>
                                {/* Selection frame */}
                                <rect
                                    x={visualBounds.x}
                                    y={visualBounds.y}
                                    width={visualBounds.width}
                                    height={visualBounds.height}
                                    fill="none"
                                    stroke={selection.userColor}
                                    strokeWidth={2 / zoom}
                                    rx={4 / zoom}
                                    transform={
                                        rotationDeg
                                            ? `rotate(${rotationDeg}, ${center.x}, ${center.y})`
                                            : undefined
                                    }
                                />
                                {/* Name tag background */}
                                <g
                                    transform={
                                        rotationDeg
                                            ? `rotate(${rotationDeg}, ${center.x}, ${center.y})`
                                            : undefined
                                    }
                                >
                                    <rect
                                        x={visualBounds.x}
                                        y={
                                            visualBounds.y -
                                            labelFontSize -
                                            labelPadding.y * 2 -
                                            labelOffset
                                        }
                                        width={labelWidth}
                                        height={
                                            labelFontSize + labelPadding.y * 2
                                        }
                                        fill={selection.userColor}
                                        rx={3 / zoom}
                                    />
                                    {/* Name tag text */}
                                    <text
                                        x={visualBounds.x + labelPadding.x}
                                        y={
                                            visualBounds.y -
                                            labelOffset -
                                            labelPadding.y
                                        }
                                        fontSize={labelFontSize}
                                        fill={getContrastingTextColor(
                                            selection.userColor,
                                        )}
                                        fontFamily="system-ui, sans-serif"
                                        fontWeight="500"
                                        dominantBaseline="text-after-edge"
                                    >
                                        {selection.userName}
                                    </text>
                                </g>
                            </g>
                        );
                    });
                })}
            </g>
        );
    };

    // Render selection box with handles
    const renderSelectionBox = () => {
        if (!selectedBounds || selectedIds.length === 0) return null;

        // For single line selection, use line-specific controls instead
        if (selectedIds.length === 1) {
            const selectedElement = elements.find(
                (el) => el.id === selectedIds[0],
            );
            if (
                selectedElement &&
                (selectedElement.type === "line" ||
                    selectedElement.type === "arrow")
            ) {
                const hasCorner = selectedElement.points.length >= 3;
                const style = selectedElement.connectorStyle ?? connectorStyle;
                // For elbow connectors or lines without corners, use connector controls (no frame)
                if (!hasCorner || style === "elbow") {
                    return renderConnectorControls(selectedElement);
                }
            }
        }

        const selectionPadding = 6 / zoom;

        // For multi-selection, draw individual (solid) frames around each selected element.
        if (selectedIds.length > 1) {
            const combinedVisualBounds = expandBounds(
                selectedBounds,
                selectionPadding,
            );
            const handleSize = 8 / zoom;
            const handlePoints: Array<{
                pos: ResizeHandle;
                x: number;
                y: number;
                cursor: string;
            }> = [
                {
                    pos: "nw",
                    x: combinedVisualBounds.x,
                    y: combinedVisualBounds.y,
                    cursor: "nwse-resize",
                },
                {
                    pos: "n",
                    x: combinedVisualBounds.x + combinedVisualBounds.width / 2,
                    y: combinedVisualBounds.y,
                    cursor: "ns-resize",
                },
                {
                    pos: "ne",
                    x: combinedVisualBounds.x + combinedVisualBounds.width,
                    y: combinedVisualBounds.y,
                    cursor: "nesw-resize",
                },
                {
                    pos: "e",
                    x: combinedVisualBounds.x + combinedVisualBounds.width,
                    y: combinedVisualBounds.y + combinedVisualBounds.height / 2,
                    cursor: "ew-resize",
                },
                {
                    pos: "se",
                    x: combinedVisualBounds.x + combinedVisualBounds.width,
                    y: combinedVisualBounds.y + combinedVisualBounds.height,
                    cursor: "nwse-resize",
                },
                {
                    pos: "s",
                    x: combinedVisualBounds.x + combinedVisualBounds.width / 2,
                    y: combinedVisualBounds.y + combinedVisualBounds.height,
                    cursor: "ns-resize",
                },
                {
                    pos: "sw",
                    x: combinedVisualBounds.x,
                    y: combinedVisualBounds.y + combinedVisualBounds.height,
                    cursor: "nesw-resize",
                },
                {
                    pos: "w",
                    x: combinedVisualBounds.x,
                    y: combinedVisualBounds.y + combinedVisualBounds.height / 2,
                    cursor: "ew-resize",
                },
            ];
            return (
                <g>
                    {selectedIds.map((id) => {
                        const el = elements.find((e) => e.id === id);
                        if (!el) return null;
                        const bounds = getBoundingBox(el);
                        if (!bounds) return null;
                        const vb = expandBounds(bounds, selectionPadding);
                        return (
                            <rect
                                key={id}
                                x={vb.x}
                                y={vb.y}
                                width={vb.width}
                                height={vb.height}
                                fill="none"
                                stroke="var(--accent)"
                                strokeWidth={2 / zoom}
                                pointerEvents="none"
                            />
                        );
                    })}
                    {/* Combined multi-selection frame */}
                    <rect
                        x={combinedVisualBounds.x}
                        y={combinedVisualBounds.y}
                        width={combinedVisualBounds.width}
                        height={combinedVisualBounds.height}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth={2 / zoom}
                        strokeDasharray={`${5 / zoom},${5 / zoom}`}
                        pointerEvents="none"
                    />
                    {handlePoints.map((h) => (
                        <rect
                            key={h.pos}
                            x={h.x - handleSize / 2}
                            y={h.y - handleSize / 2}
                            width={handleSize}
                            height={handleSize}
                            fill="var(--background)"
                            stroke="var(--accent)"
                            strokeWidth={2 / zoom}
                            rx={2 / zoom}
                            style={{ cursor: h.cursor }}
                        />
                    ))}
                </g>
            );
        }

        const handleSize = 8 / zoom;
        const visualBounds = expandBounds(selectedBounds, selectionPadding);
        const selectedElement =
            selectedIds.length === 1
                ? elements.find((el) => el.id === selectedIds[0])
                : null;
        const rotationDeg = selectedElement?.rotation ?? 0;
        const center = getBoundsCenter(visualBounds);
        const selectionTransform = rotationDeg
            ? `rotate(${rotationDeg} ${center.x} ${center.y})`
            : undefined;

        const baseHandles: Array<{
            pos: Exclude<ResizeHandle, null>;
            x: number;
            y: number;
        }> = [
            { pos: "nw", x: visualBounds.x, y: visualBounds.y },
            {
                pos: "ne",
                x: visualBounds.x + visualBounds.width,
                y: visualBounds.y,
            },
            {
                pos: "se",
                x: visualBounds.x + visualBounds.width,
                y: visualBounds.y + visualBounds.height,
            },
            {
                pos: "sw",
                x: visualBounds.x,
                y: visualBounds.y + visualBounds.height,
            },
        ];

        const handles: Array<{
            keyId: Exclude<ResizeHandle, null>;
            pos: Exclude<ResizeHandle, null>;
            x: number;
            y: number;
            cursor: string;
        }> = baseHandles.map((h) => {
            const p = rotationDeg
                ? rotatePoint({ x: h.x, y: h.y }, center, rotationDeg)
                : { x: h.x, y: h.y };
            const worldPos = getWorldResizeHandle(p, center);
            return {
                keyId: h.pos,
                pos: worldPos,
                x: p.x,
                y: p.y,
                cursor: getResizeCursor(worldPos),
            };
        });

        const rotateHandleDistance = 28 / zoom;
        const rotateHandleRadius = handleSize / 2;

        const hasRotateHandle =
            !!selectedElement &&
            selectedElement.type !== "laser" &&
            selectedElement.type !== "tile" &&
            (selectedElement.type !== "line" && selectedElement.type !== "arrow"
                ? true
                : selectedElement.points.length >= 3);

        const localRotateAnchor: Point | null = hasRotateHandle
            ? rotateHandleSide === "n"
                ? {
                      x: visualBounds.x + visualBounds.width / 2,
                      y: visualBounds.y,
                  }
                : rotateHandleSide === "e"
                  ? {
                        x: visualBounds.x + visualBounds.width,
                        y: visualBounds.y + visualBounds.height / 2,
                    }
                  : rotateHandleSide === "s"
                    ? {
                          x: visualBounds.x + visualBounds.width / 2,
                          y: visualBounds.y + visualBounds.height,
                      }
                    : {
                          x: visualBounds.x,
                          y: visualBounds.y + visualBounds.height / 2,
                      }
            : null;

        const localRotateOutward: Point | null = hasRotateHandle
            ? rotateHandleSide === "n"
                ? { x: 0, y: -1 }
                : rotateHandleSide === "e"
                  ? { x: 1, y: 0 }
                  : rotateHandleSide === "s"
                    ? { x: 0, y: 1 }
                    : { x: -1, y: 0 }
            : null;

        const localRotateHandle: Point | null =
            localRotateAnchor && localRotateOutward
                ? {
                      x:
                          localRotateAnchor.x +
                          localRotateOutward.x * rotateHandleDistance,
                      y:
                          localRotateAnchor.y +
                          localRotateOutward.y * rotateHandleDistance,
                  }
                : null;

        const rotateAnchorPos = localRotateAnchor
            ? rotationDeg
                ? rotatePoint(localRotateAnchor, center, rotationDeg)
                : localRotateAnchor
            : null;
        const rotateHandlePos = localRotateHandle
            ? rotationDeg
                ? rotatePoint(localRotateHandle, center, rotationDeg)
                : localRotateHandle
            : null;

        return (
            <g>
                {/* Selection border */}
                <rect
                    x={visualBounds.x}
                    y={visualBounds.y}
                    width={visualBounds.width}
                    height={visualBounds.height}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={2 / zoom}
                    strokeDasharray={
                        selectedIds.length === 1
                            ? undefined
                            : `${5 / zoom},${5 / zoom}`
                    }
                    pointerEvents="none"
                    transform={selectionTransform}
                />

                {/* Rotate handle (hovering, further out than resize handles) */}
                {rotateAnchorPos && rotateHandlePos && (
                    <g>
                        <circle
                            cx={rotateHandlePos.x}
                            cy={rotateHandlePos.y}
                            r={rotateHandleRadius}
                            fill="var(--background)"
                            stroke="var(--accent)"
                            strokeWidth={2 / zoom}
                            style={{ cursor: isRotating ? "grabbing" : "grab" }}
                        />
                    </g>
                )}

                {/* Connector controls (line/arrow w/ corner) */}
                {selectedElement &&
                (selectedElement.type === "line" ||
                    selectedElement.type === "arrow") &&
                selectedElement.points.length >= 3
                    ? renderConnectorControls(selectedElement)
                    : null}

                {/* Resize handles (only for single selection) */}
                {handles.map((handle) => (
                    <rect
                        key={handle.keyId}
                        x={handle.x - handleSize / 2}
                        y={handle.y - handleSize / 2}
                        width={handleSize}
                        height={handleSize}
                        fill="var(--background)"
                        stroke="var(--accent)"
                        strokeWidth={2 / zoom}
                        rx={2 / zoom}
                        style={{ cursor: handle.cursor }}
                    />
                ))}

                {/* Arrow creation handles on edge midpoints */}
                {selectedElement &&
                    selectedElement.type !== "line" &&
                    selectedElement.type !== "arrow" &&
                    selectedElement.type !== "pen" &&
                    selectedElement.type !== "laser" &&
                    (() => {
                        const arrowHandleDistance = 24 / zoom;
                        const arrowHandleSize = 22 / zoom;
                        const arrowIconSize = 16 / zoom;

                        // Edge midpoints with outward directions
                        const edgeHandles: Array<{
                            position: "n" | "e" | "s" | "w";
                            localPoint: Point;
                            outward: Point;
                        }> = [
                            {
                                position: "n",
                                localPoint: {
                                    x: visualBounds.x + visualBounds.width / 2,
                                    y: visualBounds.y,
                                },
                                outward: { x: 0, y: -1 },
                            },
                            {
                                position: "e",
                                localPoint: {
                                    x: visualBounds.x + visualBounds.width,
                                    y: visualBounds.y + visualBounds.height / 2,
                                },
                                outward: { x: 1, y: 0 },
                            },
                            {
                                position: "s",
                                localPoint: {
                                    x: visualBounds.x + visualBounds.width / 2,
                                    y: visualBounds.y + visualBounds.height,
                                },
                                outward: { x: 0, y: 1 },
                            },
                            {
                                position: "w",
                                localPoint: {
                                    x: visualBounds.x,
                                    y: visualBounds.y + visualBounds.height / 2,
                                },
                                outward: { x: -1, y: 0 },
                            },
                        ];

                        return edgeHandles.map((edge) => {
                            // Calculate handle position (outside the frame)
                            const localHandlePos = {
                                x:
                                    edge.localPoint.x +
                                    edge.outward.x * arrowHandleDistance,
                                y:
                                    edge.localPoint.y +
                                    edge.outward.y * arrowHandleDistance,
                            };

                            // Apply rotation if element is rotated
                            const handlePos = rotationDeg
                                ? rotatePoint(
                                      localHandlePos,
                                      center,
                                      rotationDeg,
                                  )
                                : localHandlePos;

                            // Calculate the snap point on the element edge (where arrow will connect)
                            const snapPoint = rotationDeg
                                ? rotatePoint(
                                      edge.localPoint,
                                      center,
                                      rotationDeg,
                                  )
                                : edge.localPoint;

                            // Calculate arrow icon rotation based on edge direction + element rotation
                            const baseRotation =
                                edge.position === "n"
                                    ? -90
                                    : edge.position === "e"
                                      ? 0
                                      : edge.position === "s"
                                        ? 90
                                        : 180;
                            const iconRotation = baseRotation + rotationDeg;

                            const handleArrowCreate = (e: ReactMouseEvent) => {
                                e.stopPropagation();
                                e.preventDefault();

                                // Create a new arrow element connected to this edge
                                const newArrow: BoardElement = {
                                    id: uuid(),
                                    type: "arrow",
                                    points: [snapPoint, snapPoint], // Start with both points at snap point
                                    strokeColor,
                                    strokeWidth,
                                    opacity,
                                    strokeStyle,
                                    connectorStyle,
                                    arrowStart: "none",
                                    arrowEnd,
                                    startConnection: {
                                        elementId: selectedElement.id,
                                        position: edge.position,
                                    },
                                };

                                // Add the arrow to elements
                                onAddElement(newArrow);

                                // Select the new arrow
                                setSelectedIds([newArrow.id]);

                                // Store original element for dragging
                                setOriginalElements([newArrow]);

                                // Start dragging the end point (index 1)
                                setDraggingConnectorPoint({
                                    index: 1,
                                    kind: "normal",
                                });

                                // Trigger transform start for undo tracking
                                onStartTransform?.();
                            };

                            return (
                                <g
                                    key={edge.position}
                                    className="arrow-create-handle"
                                    style={{ cursor: "pointer" }}
                                    onMouseDown={handleArrowCreate}
                                >
                                    {/* Invisible larger hit area */}
                                    <circle
                                        cx={handlePos.x}
                                        cy={handlePos.y}
                                        r={arrowHandleSize}
                                        fill="transparent"
                                        pointerEvents="auto"
                                    />
                                    {/* Hover background circle (visible on hover) */}
                                    <circle
                                        className="arrow-handle-bg"
                                        cx={handlePos.x}
                                        cy={handlePos.y}
                                        r={arrowHandleSize / 2 + 2 / zoom}
                                        fill="var(--accent)"
                                        opacity={0}
                                        pointerEvents="none"
                                    />
                                    {/* Arrow icon pointing outward */}
                                    <g
                                        className="arrow-handle-icon"
                                        transform={`translate(${handlePos.x}, ${handlePos.y}) rotate(${iconRotation})`}
                                        pointerEvents="none"
                                    >
                                        {/* Arrow line */}
                                        <line
                                            x1={-arrowIconSize / 3}
                                            y1={0}
                                            x2={arrowIconSize / 3}
                                            y2={0}
                                            stroke="var(--accent)"
                                            strokeWidth={1.5 / zoom}
                                            strokeLinecap="round"
                                        />
                                        {/* Arrow head */}
                                        <path
                                            d={`M ${arrowIconSize / 6} ${-arrowIconSize / 4} L ${arrowIconSize / 2.5} 0 L ${arrowIconSize / 6} ${arrowIconSize / 4}`}
                                            fill="none"
                                            stroke="var(--accent)"
                                            strokeWidth={1.5 / zoom}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </g>
                                </g>
                            );
                        });
                    })()}
            </g>
        );
    };

    // Render highlight boxes for search results
    const renderHighlights = () => {
        if (highlightedElementIds.length === 0) return null;

        return (
            <g>
                {highlightedElementIds.map((id) => {
                    const element = elements.find((el) => el.id === id);
                    if (!element) return null;

                    const bounds = getBoundingBox(element);
                    if (!bounds) return null;

                    const isCurrent = id === currentHighlightId;
                    const padding = isCurrent ? 6 : 8;

                    return (
                        <rect
                            key={`highlight-${id}`}
                            x={bounds.x - padding}
                            y={bounds.y - padding}
                            width={bounds.width + padding * 2}
                            height={bounds.height + padding * 2}
                            fill={isCurrent ? "var(--accent)" : "none"}
                            fillOpacity={isCurrent ? 0.1 : 0}
                            stroke="var(--accent)"
                            strokeWidth={isCurrent ? 3 : 2}
                            strokeDasharray={isCurrent ? "none" : "4,4"}
                            pointerEvents="none"
                            opacity={isCurrent ? 1 : 0.6}
                            rx={4}
                        />
                    );
                })}
            </g>
        );
    };

    // Render snap target highlight
    const renderSnapTargetHighlight = () => {
        if (!snapTarget) return null;

        const element = elements.find((el) => el.id === snapTarget.elementId);
        if (!element) return null;

        const bounds = getBoundingBox(element);
        if (!bounds) return null;

        const padding = 4 / zoom;
        const strokeWidth = 3 / zoom;
        const rotationDeg = element.rotation ?? 0;
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        // Render shape-specific highlight
        let shapeHighlight: React.ReactNode;

        if (element.type === "ellipse") {
            // Ellipse highlight
            const rx = bounds.width / 2 + padding;
            const ry = bounds.height / 2 + padding;
            shapeHighlight = (
                <ellipse
                    cx={centerX}
                    cy={centerY}
                    rx={rx}
                    ry={ry}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={strokeWidth}
                    pointerEvents="none"
                    transform={
                        rotationDeg
                            ? `rotate(${rotationDeg} ${centerX} ${centerY})`
                            : undefined
                    }
                />
            );
        } else if (element.type === "diamond") {
            // Diamond highlight - rotated rectangle
            const halfWidth = bounds.width / 2 + padding;
            const halfHeight = bounds.height / 2 + padding;
            const diamondPoints = `${centerX},${centerY - halfHeight} ${centerX + halfWidth},${centerY} ${centerX},${centerY + halfHeight} ${centerX - halfWidth},${centerY}`;
            shapeHighlight = (
                <polygon
                    points={diamondPoints}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={strokeWidth}
                    pointerEvents="none"
                    transform={
                        rotationDeg
                            ? `rotate(${rotationDeg} ${centerX} ${centerY})`
                            : undefined
                    }
                />
            );
        } else {
            // Default rectangle highlight for other shapes
            shapeHighlight = (
                <rect
                    x={bounds.x - padding}
                    y={bounds.y - padding}
                    width={bounds.width + padding * 2}
                    height={bounds.height + padding * 2}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={strokeWidth}
                    pointerEvents="none"
                    rx={4 / zoom}
                    transform={
                        rotationDeg
                            ? `rotate(${rotationDeg} ${centerX} ${centerY})`
                            : undefined
                    }
                />
            );
        }

        return (
            <g>
                {/* Highlight frame around the snap target */}
                {shapeHighlight}
                {/* Small circle at the snap point */}
                <circle
                    cx={snapTarget.point.x}
                    cy={snapTarget.point.y}
                    r={4 / zoom}
                    fill="var(--accent)"
                    stroke="var(--background)"
                    strokeWidth={2 / zoom}
                    pointerEvents="none"
                />
            </g>
        );
    };

    return {
        renderElement,
        renderConnectorControls,
        renderRemoteSelections,
        renderSelectionBox,
        renderHighlights,
        renderSnapTargetHighlight,
    };
}
