import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { v4 as uuid } from "uuid";
import type { Tool, BoardElement, Point, TileType, NoteStyle } from "@/lib/board-types";
import { areEndpointsNear, isClosedShape } from "@/lib/board-types";
import type { CollaborationManager } from "@/lib/collaboration";
import type { CanvasState } from "../hooks/useCanvasState";
import type { BoundingBox, ConnectorDragKind, ResizeHandle } from "../types";
import {
    expandBounds,
    getBoundsCenter,
    getOppositeResizeHandle,
    getHandlePointFromBounds,
    getResizeHandleFromSelectionEdge,
    getRotatedResizeCursor,
    radToDeg,
    rotatePoint,
    rotateVector,
} from "../geometry";
import {
    getCubicBezierPoint,
    getCatmullRomControlPoints,
    getElbowPolylineForVertices,
    simplifyElbowPolyline,
} from "../curves";
import {
    getBoundingBox,
    getBoxSelectedIds,
    getGroupSelectionIds,
    getLassoSelectedIds,
} from "../shapes";
import {
    findNearestSnapTarget,
    generateElbowRouteAroundObstacles,
    generateCurvedRouteAroundObstacles,
    getConnectedArrowUpdates,
} from "../utils/connectionSnapping";
import { getMinTileSize, getDefaultTileSize } from "@/lib/tile-utils";
import {
    getMinSingleCharWidth,
    measureWrappedTextHeightPx,
} from "../text-utils";
import { getEventTargetInfo } from "../utils/eventTargeting";

function throttleWithResult<T extends (...args: any[]) => any>(
    fn: T,
    waitMs: number,
) {
    let lastCall = 0;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;
    let lastResult: ReturnType<T>;

    const invoke = () => {
        lastCall = Date.now();
        timeout = null;
        if (!lastArgs) return;
        lastResult = fn(...lastArgs);
        lastArgs = null;
    };

    return (...args: Parameters<T>): ReturnType<T> => {
        const now = Date.now();
        const remaining = waitMs - (now - lastCall);
        lastArgs = args;

        if (remaining <= 0 || remaining > waitMs) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            lastCall = now;
            lastResult = fn(...args);
            lastArgs = null;
        } else if (!timeout) {
            timeout = setTimeout(invoke, remaining);
        }

        return lastResult;
    };
}

interface UseCanvasHandlersProps {
    state: CanvasState;
    tool: Tool;
    strokeColor: string;
    strokeWidth: number;
    fillColor: string;
    opacity: number;
    strokeStyle: "solid" | "dashed" | "dotted";
    lineCap: "butt" | "round";
    connectorStyle: "sharp" | "curved" | "elbow";
    arrowStart: NonNullable<BoardElement["arrowStart"]>;
    arrowEnd: NonNullable<BoardElement["arrowEnd"]>;
    cornerRadius: number;
    fontFamily: string;
    textAlign: "left" | "center" | "right";
    fontSize: number;
    letterSpacing: number;
    lineHeight: number;
    fillPattern: "none" | "solid";
    frameStyle: BoardElement["frameStyle"];
    selectedTileType?: TileType | null;
    selectedNoteStyle?: NoteStyle;
    handDrawnMode?: boolean;
    collaboration: CollaborationManager | null;
    elements: BoardElement[];
    selectedBounds: BoundingBox | null;
    selectedElements: BoardElement[];
    onAddElement: (element: BoardElement) => void;
    onUpdateElement: (id: string, updates: Partial<BoardElement>) => void;
    onBatchUpdateElements?: (
        updates: Array<{ id: string; updates: Partial<BoardElement> }>,
    ) => void;
    onDeleteElement: (id: string) => void;
    onDeleteMultiple?: (ids: string[]) => void;
    onStartTransform?: () => void;
    onToolChange?: (tool: Tool) => void;
    onManualViewportChange?: () => void;
    isToolLocked: boolean;
    isReadOnly: boolean;
}

export function useCanvasHandlers({
    state,
    tool,
    strokeColor,
    strokeWidth,
    fillColor,
    opacity,
    strokeStyle,
    lineCap,
    connectorStyle,
    arrowStart,
    arrowEnd,
    cornerRadius,
    fontFamily,
    textAlign,
    fontSize,
    letterSpacing,
    lineHeight,
    fillPattern,
    frameStyle = "minimal",
    selectedTileType,
    selectedNoteStyle = "classic",
    handDrawnMode = false,
    collaboration,
    elements,
    selectedBounds,
    selectedElements,
    onAddElement,
    onUpdateElement,
    onBatchUpdateElements,
    onDeleteElement,
    onDeleteMultiple,
    onStartTransform,
    onToolChange,
    onManualViewportChange,
    isToolLocked,
    isReadOnly,
}: UseCanvasHandlersProps) {
    const {
        drawing,
        selection,
        transform,
        viewport,
        text,
        eraser,
        laser,
        snapping,
        ui,
        refs,
    } = state;
    const {
        isDrawing,
        setIsDrawing,
        currentElement,
        setCurrentElement,
        startPoint,
        setStartPoint,
    } = drawing;
    const { selectedIds, setSelectedIds, remotelySelectedIds } = selection;
    const {
        isDragging,
        setIsDragging,
        hasDragMoved,
        setHasDragMoved,
        isResizing,
        setIsResizing,
        isRotating,
        setIsRotating,
        dragStart,
        setDragStart,
        resizeHandle,
        setResizeHandle,
        originalElements,
        setOriginalElements,
        originalBounds,
        setOriginalBounds,
        rotateStart,
        setRotateStart,
        rotateHandleSide,
        draggingConnectorPoint,
        setDraggingConnectorPoint,
    } = transform;
    const {
        pan,
        setPan,
        zoom,
        isPanning,
        setIsPanning,
        panStart,
        setPanStart,
    } = viewport;
    const {
        textInput,
        setTextInput,
        textValue,
        setTextValue,
        editingTextElementId,
        setEditingTextElementId,
        editingTextStyle,
        setEditingTextStyle,
    } = text;
    const { eraserMarkedIds, setEraserMarkedIds, setEraserCursorPos } = eraser;
    const { setLaserCursorPos } = laser;
    const { snapTarget, setSnapTarget, startSnapTarget, setStartSnapTarget } =
        snapping;
    const {
        hoverCursor,
        setHoverCursor,
        lastMousePos,
        setLastMousePos,
        isBoxSelecting,
        setIsBoxSelecting,
        selectionBox,
        setSelectionBox,
        isLassoSelecting,
        setIsLassoSelecting,
        lassoPoints,
        setLassoPoints,
        setEditingFrameLabelId,
        setFrameLabelValue,
        shiftPressed,
    } = ui;
    const {
        svgRef,
        eraserTrailRef,
        textInputRef,
        pendingCursorPosRef,
        cursorBroadcastRafRef,
        textSaveTimeoutRef,
        elementsRef,
    } = refs;

    const throttledFindSnapTarget = useMemo(
        () => throttleWithResult(findNearestSnapTarget, 32),
        [],
    );

    const throttledArrowUpdates = useMemo(
        () => throttleWithResult(getConnectedArrowUpdates, 16),
        [],
    );

    const getMousePosition = useCallback(
        (e: ReactMouseEvent): Point => {
            const svg = svgRef.current;
            if (!svg) return { x: 0, y: 0 };

            const rect = svg.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left - pan.x) / zoom,
                y: (e.clientY - rect.top - pan.y) / zoom,
            };
        },
        [pan, zoom, svgRef],
    );

    // Helper function to check if a point is near a line segment
    const pointToLineDistance = (
        point: Point,
        lineStart: Point,
        lineEnd: Point,
    ): number => {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            // Line segment is actually a point
            return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
        }

        // Calculate projection of point onto line segment
        let t =
            ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
            lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const projX = lineStart.x + t * dx;
        const projY = lineStart.y + t * dy;

        return Math.hypot(point.x - projX, point.y - projY);
    };

    // Helper function to find elements at a point that should be erased
    const getElementsToErase = useCallback(
        (point: Point): string[] => {
            const eraseRadius = strokeWidth * 2;
            const toErase: string[] = [];
            const currentElements = elementsRef.current;

            currentElements.forEach((el) => {
                // Skip elements that are selected by remote users
                if (remotelySelectedIds.has(el.id)) return;
                if (
                    el.type === "pen" ||
                    el.type === "line" ||
                    el.type === "arrow"
                ) {
                    const getConnectorHitTestPoints = (): Point[] => {
                        if (
                            (el.type !== "line" && el.type !== "arrow") ||
                            el.points.length < 2
                        ) {
                            return el.points;
                        }

                        const style = el.connectorStyle || "sharp";

                        if (style === "elbow") {
                            if (el.points.length === 2) return el.points;

                            const start = el.points[0];
                            const end =
                                el.points[el.points.length - 1] ?? start;
                            const control = el.points[1] ?? start;
                            const route =
                                el.elbowRoute ||
                                (Math.abs(end.x - start.x) >=
                                Math.abs(end.y - start.y)
                                    ? "vertical"
                                    : "horizontal");

                            const elbowEps = 0.5 / zoom;
                            const points =
                                el.points.length === 3
                                    ? route === "vertical"
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
                                          ]
                                    : getElbowPolylineForVertices(
                                          el.points,
                                          elbowEps,
                                      );
                            return points;
                        }

                        if (style === "curved") {
                            const sampleQuadratic = (
                                p0: Point,
                                c: Point,
                                p1: Point,
                                segments: number,
                            ): Point[] => {
                                const pts: Point[] = [];
                                for (let i = 0; i <= segments; i++) {
                                    const t = i / segments;
                                    const mt = 1 - t;
                                    pts.push({
                                        x:
                                            mt * mt * p0.x +
                                            2 * mt * t * c.x +
                                            t * t * p1.x,
                                        y:
                                            mt * mt * p0.y +
                                            2 * mt * t * c.y +
                                            t * t * p1.y,
                                    });
                                }
                                return pts;
                            };

                            const sampleCatmullRom = (
                                points: Point[],
                                stepsPerSegment: number,
                            ): Point[] => {
                                if (points.length < 2) return points;
                                const out: Point[] = [];
                                for (let i = 0; i < points.length - 1; i++) {
                                    const p0 = points[i - 1] ?? points[i];
                                    const p1 = points[i];
                                    const p2 = points[i + 1];
                                    const p3 = points[i + 2] ?? p2;
                                    const { c1, c2 } =
                                        getCatmullRomControlPoints(
                                            p0,
                                            p1,
                                            p2,
                                            p3,
                                        );
                                    const startStep = i === 0 ? 0 : 1;
                                    for (
                                        let s = startStep;
                                        s <= stepsPerSegment;
                                        s++
                                    ) {
                                        const t = s / stepsPerSegment;
                                        out.push(
                                            getCubicBezierPoint(
                                                p1,
                                                c1,
                                                c2,
                                                p2,
                                                t,
                                            ),
                                        );
                                    }
                                }
                                return out;
                            };

                            const start = el.points[0];
                            const end =
                                el.points[el.points.length - 1] ?? start;
                            const control = el.points[1] ?? start;

                            if (el.points.length === 3) {
                                return sampleQuadratic(start, control, end, 32);
                            }

                            return sampleCatmullRom(el.points, 12);
                        }

                        return el.points;
                    };

                    const pointsToCheck =
                        el.type === "pen"
                            ? el.points
                            : getConnectorHitTestPoints();
                    // Check if eraser intersects with any segment of the path
                    let isNear = false;
                    for (let i = 0; i < pointsToCheck.length - 1; i++) {
                        const distance = pointToLineDistance(
                            point,
                            pointsToCheck[i],
                            pointsToCheck[i + 1],
                        );
                        if (distance < eraseRadius + (el.strokeWidth || 2)) {
                            isNear = true;
                            break;
                        }
                    }
                    // Also check if eraser is near any single point (for pen strokes with single points)
                    if (!isNear && pointsToCheck.length === 1) {
                        isNear =
                            Math.hypot(
                                point.x - pointsToCheck[0].x,
                                point.y - pointsToCheck[0].y,
                            ) < eraseRadius;
                    }
                    if (isNear) toErase.push(el.id);
                } else if (
                    el.type === "rectangle" ||
                    el.type === "diamond" ||
                    el.type === "ellipse"
                ) {
                    if (
                        el.x !== undefined &&
                        el.y !== undefined &&
                        el.width !== undefined &&
                        el.height !== undefined
                    ) {
                        // Check if eraser circle intersects with the shape bounds
                        const closestX = Math.max(
                            el.x,
                            Math.min(point.x, el.x + el.width),
                        );
                        const closestY = Math.max(
                            el.y,
                            Math.min(point.y, el.y + el.height),
                        );
                        const distance = Math.hypot(
                            point.x - closestX,
                            point.y - closestY,
                        );
                        if (distance < eraseRadius) toErase.push(el.id);
                    }
                } else if (el.type === "text") {
                    const bounds = getBoundingBox(el);
                    if (bounds) {
                        // Check if eraser circle intersects with text bounds
                        const closestX = Math.max(
                            bounds.x,
                            Math.min(point.x, bounds.x + bounds.width),
                        );
                        const closestY = Math.max(
                            bounds.y,
                            Math.min(point.y, bounds.y + bounds.height),
                        );
                        const distance = Math.hypot(
                            point.x - closestX,
                            point.y - closestY,
                        );
                        if (distance < eraseRadius) toErase.push(el.id);
                    }
                } else if (el.type === "frame" || el.type === "web-embed") {
                    if (
                        el.x !== undefined &&
                        el.y !== undefined &&
                        el.width !== undefined &&
                        el.height !== undefined
                    ) {
                        // Check if eraser circle intersects with the frame bounds
                        const closestX = Math.max(
                            el.x,
                            Math.min(point.x, el.x + el.width),
                        );
                        const closestY = Math.max(
                            el.y,
                            Math.min(point.y, el.y + el.height),
                        );
                        const distance = Math.hypot(
                            point.x - closestX,
                            point.y - closestY,
                        );
                        if (distance < eraseRadius) toErase.push(el.id);
                    }
                }
            });

            return toErase;
        },
        [elementsRef, strokeWidth, remotelySelectedIds, zoom],
    );

    const handleMouseMove = useCallback(
        (e: ReactMouseEvent) => {
            if (isReadOnly && !isPanning) return;

            const point = getMousePosition(e);
            setLastMousePos(point);
            const currentElements = elementsRef.current;

            // Track eraser cursor position
            if (tool === "eraser") {
                setEraserCursorPos(point);
            }

            // Track laser cursor position
            if (tool === "laser") {
                setLaserCursorPos(point);
            }

            if (!isReadOnly && collaboration) {
                pendingCursorPosRef.current = point;
                if (cursorBroadcastRafRef.current === null) {
                    cursorBroadcastRafRef.current = requestAnimationFrame(
                        () => {
                            cursorBroadcastRafRef.current = null;
                            const pending = pendingCursorPosRef.current;
                            if (pending) {
                                collaboration.updateCursor(
                                    pending.x,
                                    pending.y,
                                );
                            }
                        },
                    );
                }
            }

            // Handle panning
            if (isPanning) {
                setPan({
                    x: e.clientX - panStart.x,
                    y: e.clientY - panStart.y,
                });
                return;
            }

            if (isLassoSelecting) {
                const minDistance = 4;
                const lastPoint = lassoPoints[lassoPoints.length - 1];
                const nextPoints =
                    !lastPoint ||
                    Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >=
                        minDistance
                        ? [...lassoPoints, point]
                        : lassoPoints;

                if (nextPoints !== lassoPoints) {
                    setLassoPoints(nextPoints);
                }

                if (nextPoints.length >= 3) {
                    const lassoSelected = getLassoSelectedIds(
                        currentElements,
                        nextPoints,
                    ).filter((id) => !remotelySelectedIds.has(id));
                    setSelectedIds(lassoSelected);
                } else {
                    setSelectedIds([]);
                }
                return;
            }

            // Handle box selection
            if (isBoxSelecting && startPoint) {
                const x = Math.min(startPoint.x, point.x);
                const y = Math.min(startPoint.y, point.y);
                const width = Math.abs(point.x - startPoint.x);
                const height = Math.abs(point.y - startPoint.y);
                const nextSelectionBox = { x, y, width, height };
                setSelectionBox(nextSelectionBox);

                // Live-update selection while dragging: only select elements that are fully inside the box.
                const minBoxSize = 5;
                if (
                    nextSelectionBox.width >= minBoxSize ||
                    nextSelectionBox.height >= minBoxSize
                ) {
                    // Filter out remotely selected elements from box selection
                    const boxSelected = getBoxSelectedIds(
                        currentElements,
                        nextSelectionBox,
                    ).filter((id) => !remotelySelectedIds.has(id));
                    setSelectedIds(boxSelected);
                } else {
                    setSelectedIds([]);
                }
                return;
            }

            // Handle rotate dragging (single selection)
            if (isRotating && rotateStart) {
                const currentPointerAngleRad = Math.atan2(
                    point.y - rotateStart.center.y,
                    point.x - rotateStart.center.x,
                );
                const deltaDeg = radToDeg(
                    currentPointerAngleRad - rotateStart.startPointerAngleRad,
                );
                let nextRotationDeg = rotateStart.startRotationDeg + deltaDeg;

                if (shiftPressed) {
                    const snap = 15;
                    nextRotationDeg = Math.round(nextRotationDeg / snap) * snap;
                }

                // Create a temporary elements array with the updated rotation
                const tempElements = currentElements.map((el) => {
                    if (el.id === rotateStart.elementId) {
                        return { ...el, rotation: nextRotationDeg };
                    }
                    return el;
                });

                // Get updates for connected arrows
                const arrowUpdates =
                    throttledArrowUpdates(
                        [rotateStart.elementId],
                        tempElements,
                    ) ?? [];

                // Batch update the rotated element and its connected arrows
                const batchUpdates = [
                    {
                        id: rotateStart.elementId,
                        updates: { rotation: nextRotationDeg },
                    },
                    ...arrowUpdates,
                ];

                if (onBatchUpdateElements) {
                    onBatchUpdateElements(batchUpdates);
                } else {
                    batchUpdates.forEach(({ id, updates }) => {
                        onUpdateElement(id, updates);
                    });
                }
                return;
            }

            // Hover feedback for selection border resize / rotate handle (single selection)
            if (
                tool === "select" &&
                !isDragging &&
                !isResizing &&
                !isRotating &&
                !isBoxSelecting &&
                selectedBounds &&
                selectedIds.length === 1
            ) {
                const selectionPadding = 6 / zoom;
                const visualBounds = expandBounds(
                    selectedBounds,
                    selectionPadding,
                );
                const selectedElement = currentElements.find(
                    (el) => el.id === selectedIds[0],
                );
                const rotationDeg = selectedElement?.rotation ?? 0;

                const edgeHandle = getResizeHandleFromSelectionEdge(
                    point,
                    visualBounds,
                    rotationDeg,
                    10 / zoom,
                );
                if (edgeHandle) {
                    setHoverCursor(
                        getRotatedResizeCursor(edgeHandle, rotationDeg),
                    );
                } else if (
                    selectedElement &&
                    selectedElement.type !== "laser" &&
                    (selectedElement.type !== "line" &&
                    selectedElement.type !== "arrow"
                        ? true
                        : selectedElement.points.length >= 3)
                ) {
                    const center = getBoundsCenter(visualBounds);
                    const rotateHandleDistance = 28 / zoom;
                    const rotateHandleRadius = 4 / zoom;

                    const localAnchor: Point =
                        rotateHandleSide === "n"
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
                                      x:
                                          visualBounds.x +
                                          visualBounds.width / 2,
                                      y: visualBounds.y + visualBounds.height,
                                  }
                                : {
                                      x: visualBounds.x,
                                      y:
                                          visualBounds.y +
                                          visualBounds.height / 2,
                                  };

                    const outward: Point =
                        rotateHandleSide === "n"
                            ? { x: 0, y: -1 }
                            : rotateHandleSide === "e"
                              ? { x: 1, y: 0 }
                              : rotateHandleSide === "s"
                                ? { x: 0, y: 1 }
                                : { x: -1, y: 0 };

                    const localHandle: Point = {
                        x: localAnchor.x + outward.x * rotateHandleDistance,
                        y: localAnchor.y + outward.y * rotateHandleDistance,
                    };

                    const handlePos = rotationDeg
                        ? rotatePoint(localHandle, center, rotationDeg)
                        : localHandle;
                    if (
                        Math.hypot(
                            point.x - handlePos.x,
                            point.y - handlePos.y,
                        ) <=
                        rotateHandleRadius * 2.25
                    ) {
                        setHoverCursor("grab");
                    } else {
                        setHoverCursor(null);
                    }
                } else {
                    setHoverCursor(null);
                }
            } else if (hoverCursor) {
                setHoverCursor(null);
            }

            // Handle connector point dragging (line/arrow)
            if (draggingConnectorPoint && originalElements.length === 1) {
                const originalElement = originalElements[0];
                if (
                    (originalElement.type === "line" ||
                        originalElement.type === "arrow") &&
                    originalElement.points.length >= 2
                ) {
                    const rotationDeg = originalElement.rotation ?? 0;
                    let localPoint = point;
                    if (rotationDeg) {
                        const bounds = getBoundingBox(originalElement);
                        if (bounds) {
                            const center = getBoundsCenter(bounds);
                            localPoint = rotatePoint(
                                point,
                                center,
                                -rotationDeg,
                            );
                        }
                    }

                    const style =
                        originalElement.connectorStyle ?? connectorStyle;
                    const index = draggingConnectorPoint.index;
                    let newPoints = [...originalElement.points];

                    if (
                        draggingConnectorPoint.kind === "elbowOrtho" &&
                        style === "elbow" &&
                        index >= 0 &&
                        index < newPoints.length
                    ) {
                        const axis = draggingConnectorPoint.axis ?? "x";
                        const current = newPoints[index];
                        const eps = 0.5 / zoom;

                        const delta =
                            axis === "x"
                                ? localPoint.x - current.x
                                : localPoint.y - current.y;
                        const same = (a: number, b: number) =>
                            Math.abs(a - b) <= eps;

                        let left = index;
                        let right = index;

                        if (axis === "x") {
                            const base = current.x;
                            while (
                                left > 0 &&
                                same(newPoints[left - 1].x, base)
                            )
                                left--;
                            while (
                                right < newPoints.length - 1 &&
                                same(newPoints[right + 1].x, base)
                            )
                                right++;

                            for (let i = left; i <= right; i++) {
                                newPoints[i] = {
                                    x: newPoints[i].x + delta,
                                    y: newPoints[i].y,
                                };
                            }
                        } else {
                            const base = current.y;
                            while (
                                left > 0 &&
                                same(newPoints[left - 1].y, base)
                            )
                                left--;
                            while (
                                right < newPoints.length - 1 &&
                                same(newPoints[right + 1].y, base)
                            )
                                right++;

                            for (let i = left; i <= right; i++) {
                                newPoints[i] = {
                                    x: newPoints[i].x,
                                    y: newPoints[i].y + delta,
                                };
                            }
                        }

                        onUpdateElement(originalElement.id, {
                            points: newPoints,
                        });
                        return;
                    }

                    if (
                        draggingConnectorPoint.kind === "elbowEdge" &&
                        style === "elbow" &&
                        draggingConnectorPoint.range &&
                        draggingConnectorPoint.anchor
                    ) {
                        const [r0, r1] = draggingConnectorPoint.range;
                        if (r0 >= 0 && r1 >= r0 && r1 < newPoints.length) {
                            const axis = draggingConnectorPoint.axis ?? "x";
                            const delta =
                                axis === "x"
                                    ? localPoint.x -
                                      draggingConnectorPoint.anchor.x
                                    : localPoint.y -
                                      draggingConnectorPoint.anchor.y;
                            const orig = originalElement.points;
                            const nextPoints = orig.map((p) => ({ ...p }));
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
                            onUpdateElement(originalElement.id, {
                                points: nextPoints,
                            });
                            return;
                        }
                    }

                    if (
                        draggingConnectorPoint.kind === "createCorner" &&
                        index === 1 &&
                        newPoints.length === 2
                    ) {
                        const pStart = newPoints[0];
                        const pEnd = newPoints[newPoints.length - 1];

                        if (style === "curved") {
                            // Use cursor position directly - Catmull-Rom passes through control point
                            newPoints = [
                                pStart,
                                {
                                    x: localPoint.x,
                                    y: localPoint.y,
                                },
                                pEnd,
                            ];
                            onUpdateElement(originalElement.id, {
                                points: newPoints,
                            });
                            return;
                        }

                        const updates: Partial<BoardElement> = {
                            points: [pStart, localPoint, pEnd],
                        };
                        if (
                            style === "elbow" &&
                            originalElement.elbowRoute === undefined
                        ) {
                            updates.elbowRoute =
                                Math.abs(pEnd.x - pStart.x) >=
                                Math.abs(pEnd.y - pStart.y)
                                    ? "vertical"
                                    : "horizontal";
                        }
                        onUpdateElement(originalElement.id, updates);
                        return;
                    }

                    if (
                        draggingConnectorPoint.kind === "curvedMid" &&
                        style === "curved" &&
                        index === 1 &&
                        newPoints.length >= 3
                    ) {
                        // Set control point directly to cursor position for 1:1 movement
                        newPoints[1] = {
                            x: localPoint.x,
                            y: localPoint.y,
                        };
                    } else if (
                        draggingConnectorPoint.kind === "elbowHandle" &&
                        style === "elbow" &&
                        index === 1 &&
                        newPoints.length >= 3
                    ) {
                        const pStart = newPoints[0];
                        const pEnd = newPoints[newPoints.length - 1];
                        const route =
                            originalElement.elbowRoute ??
                            (Math.abs(pEnd.x - pStart.x) >=
                            Math.abs(pEnd.y - pStart.y)
                                ? "vertical"
                                : "horizontal");
                        const existingControl = newPoints[1];
                        newPoints[1] =
                            route === "vertical"
                                ? { x: localPoint.x, y: existingControl.y }
                                : { x: existingControl.x, y: localPoint.y };
                    } else if (
                        draggingConnectorPoint.kind === "elbowEndpoint" &&
                        style === "elbow" &&
                        newPoints.length >= 3
                    ) {
                        // For elbow endpoints: move endpoint, adjust adjacent point to maintain
                        // the second edge's axis. All other edges stay completely fixed.
                        const isStart = index === 0;
                        const isEnd = index === newPoints.length - 1;
                        const eps = 0.5 / zoom;

                        // Check for snapping first
                        let finalPoint = localPoint;
                        const snapDistance = 20 / zoom;
                        const otherEndpointIndex = isStart
                            ? newPoints.length - 1
                            : 0;
                        const otherEndpoint = newPoints[otherEndpointIndex];

                        const snapResult = throttledFindSnapTarget(
                            localPoint,
                            currentElements,
                            originalElement.id,
                            snapDistance,
                            style,
                            otherEndpoint,
                        );

                        if (snapResult) {
                            finalPoint = snapResult.snapPoint.point;
                            setSnapTarget({
                                elementId: snapResult.elementId,
                                point: snapResult.snapPoint.point,
                                position: snapResult.snapPoint.position,
                                outOfLineOfSight: snapResult.outOfLineOfSight,
                            });

                            // Generate elbow routing around obstacles
                            // When snapping to a new shape, also consider the existing connection on the other end
                            const otherConnection = isStart
                                ? originalElement.endConnection?.elementId
                                : originalElement.startConnection?.elementId;
                            const routedPoints =
                                generateElbowRouteAroundObstacles(
                                    otherEndpoint,
                                    finalPoint,
                                    currentElements,
                                    originalElement.id,
                                    snapResult.elementId,
                                    otherConnection ?? null,
                                );

                            // Update all points with the routed path
                            const updatedPoints = isStart
                                ? routedPoints.reverse()
                                : routedPoints;

                            onUpdateElement(originalElement.id, {
                                points: updatedPoints,
                                connectorStyle: "elbow",
                                elbowRoute: undefined,
                            });
                            return; // Skip the manual endpoint adjustment below
                        } else {
                            setSnapTarget(null);
                        }

                        if (isStart) {
                            // Dragging start (point 0):
                            // - Point 0 moves freely
                            // - Point 1 adjusts to maintain edge 1→2 on its axis
                            // - Points 2+ stay fixed
                            const p1 = newPoints[1];
                            const p2 = newPoints[2];

                            // Determine if edge 1→2 is horizontal or vertical
                            const edge12Horizontal =
                                Math.abs(p1.y - p2.y) <= eps;
                            const edge12Vertical = Math.abs(p1.x - p2.x) <= eps;

                            newPoints[0] = finalPoint;

                            if (edge12Vertical) {
                                // Edge 1→2 is vertical (same X), so point 1 keeps X from point 2
                                // but takes Y from new point 0 to connect the first edge
                                newPoints[1] = { x: p2.x, y: finalPoint.y };
                            } else if (edge12Horizontal) {
                                // Edge 1→2 is horizontal (same Y), so point 1 keeps Y from point 2
                                // but takes X from new point 0 to connect the first edge
                                newPoints[1] = { x: finalPoint.x, y: p2.y };
                            } else {
                                // Not axis-aligned, keep point 1 fixed
                            }
                        } else if (isEnd) {
                            // Dragging end (last point):
                            // - Last point moves freely
                            // - Second-to-last adjusts to maintain its edge to the third-to-last
                            // - All other points stay fixed
                            const lastIdx = newPoints.length - 1;
                            const p1 = newPoints[lastIdx - 1]; // second to last
                            const p2 = newPoints[lastIdx - 2]; // third to last

                            // Determine if edge p2→p1 is horizontal or vertical
                            const edgeHorizontal = Math.abs(p1.y - p2.y) <= eps;
                            const edgeVertical = Math.abs(p1.x - p2.x) <= eps;

                            newPoints[lastIdx] = finalPoint;

                            if (edgeVertical) {
                                // Edge p2→p1 is vertical (same X), so p1 keeps X from p2
                                // but takes Y from new endpoint to connect the last edge
                                newPoints[lastIdx - 1] = {
                                    x: p2.x,
                                    y: finalPoint.y,
                                };
                            } else if (edgeHorizontal) {
                                // Edge p2→p1 is horizontal (same Y), so p1 keeps Y from p2
                                // but takes X from new endpoint to connect the last edge
                                newPoints[lastIdx - 1] = {
                                    x: finalPoint.x,
                                    y: p2.y,
                                };
                            } else {
                                // Not axis-aligned, keep p1 fixed
                            }
                        }
                    } else if (index >= 0 && index < newPoints.length) {
                        // Check for snapping to other elements
                        let finalPoint = localPoint;
                        const snapDistance = 20 / zoom; // 20px in screen space

                        // Only snap endpoints (first or last point)
                        const isEndpoint =
                            index === 0 || index === newPoints.length - 1;

                        if (isEndpoint) {
                            // Get the other endpoint for line-of-sight checking
                            const otherEndpointIndex =
                                index === 0 ? newPoints.length - 1 : 0;
                            const otherEndpoint = newPoints[otherEndpointIndex];

                            const snapResult = throttledFindSnapTarget(
                                localPoint,
                                currentElements,
                                originalElement.id,
                                snapDistance,
                                style,
                                otherEndpoint,
                            );

                            if (snapResult) {
                                // Snap to the target point
                                finalPoint = snapResult.snapPoint.point;
                                setSnapTarget({
                                    elementId: snapResult.elementId,
                                    point: snapResult.snapPoint.point,
                                    position: snapResult.snapPoint.position,
                                    outOfLineOfSight:
                                        snapResult.outOfLineOfSight,
                                });

                                // Get the existing connection on the other end (used for both elbow and curved)
                                const otherConnection =
                                    index === 0
                                        ? originalElement.endConnection
                                              ?.elementId
                                        : originalElement.startConnection
                                              ?.elementId;

                                // For elbow mode, generate routing around obstacles
                                if (style === "elbow") {
                                    const routedPoints =
                                        generateElbowRouteAroundObstacles(
                                            otherEndpoint,
                                            finalPoint,
                                            currentElements,
                                            originalElement.id,
                                            snapResult.elementId,
                                            otherConnection ?? null,
                                        );

                                    // Update all points with the routed path
                                    if (index === 0) {
                                        // Dragging start point - reverse the route
                                        newPoints = routedPoints.reverse();
                                    } else {
                                        // Dragging end point - use route as-is
                                        newPoints = routedPoints;
                                    }

                                    // Update with routed points for elbow mode
                                    onUpdateElement(originalElement.id, {
                                        points: newPoints,
                                        connectorStyle: "elbow",
                                        elbowRoute: undefined,
                                    });
                                    return; // Skip the normal point update below
                                }

                                // For curved mode, generate routing around obstacles
                                if (style === "curved") {
                                    const routedPoints =
                                        generateCurvedRouteAroundObstacles(
                                            otherEndpoint,
                                            finalPoint,
                                            currentElements,
                                            originalElement.id,
                                            snapResult.elementId,
                                            otherConnection ?? null,
                                        );

                                    // Update all points with the routed path
                                    if (index === 0) {
                                        // Dragging start point - reverse the route
                                        newPoints = routedPoints.reverse();
                                    } else {
                                        // Dragging end point - use route as-is
                                        newPoints = routedPoints;
                                    }

                                    // Update with routed points for curved mode
                                    onUpdateElement(originalElement.id, {
                                        points: newPoints,
                                        connectorStyle: "curved",
                                    });
                                    return; // Skip the normal point update below
                                }

                                // For sharp mode with out-of-sight snap, DON'T update the element yet.
                                // Just set the snap target - the preview will show the elbow routing.
                                // The actual connectorStyle change will happen on mouse up.
                                // This matches the behavior during arrow creation.
                                if (
                                    connectorStyle === "sharp" &&
                                    snapResult.outOfLineOfSight
                                ) {
                                    // Don't update the element - let the preview handle the visual
                                    // The snapTarget is already set above with outOfLineOfSight: true
                                    return;
                                }

                                // For sharp mode with existing connection (from handle creation),
                                // use elbow routing to avoid edge riding
                                if (
                                    style === "sharp" &&
                                    (originalElement.startConnection ||
                                        originalElement.endConnection)
                                ) {
                                    const routedPoints =
                                        generateElbowRouteAroundObstacles(
                                            otherEndpoint,
                                            finalPoint,
                                            currentElements,
                                            originalElement.id,
                                            snapResult.elementId,
                                            otherConnection ?? null,
                                        );

                                    // Update all points with the routed path
                                    if (index === 0) {
                                        newPoints = routedPoints.reverse();
                                    } else {
                                        newPoints = routedPoints;
                                    }

                                    onUpdateElement(originalElement.id, {
                                        points: newPoints,
                                        connectorStyle: "elbow",
                                        elbowRoute: undefined,
                                    });
                                    return;
                                }
                            } else {
                                setSnapTarget(null);

                                // Check if arrow has an existing connection (from handle creation)
                                const hasExistingConnection =
                                    originalElement.startConnection ||
                                    originalElement.endConnection;

                                // For arrows with existing connections, use generateElbowRouteAroundObstacles
                                // to ensure proper margins and avoid edge riding
                                if (hasExistingConnection) {
                                    const otherConnection =
                                        index === 0
                                            ? originalElement.endConnection
                                                  ?.elementId
                                            : originalElement.startConnection
                                                  ?.elementId;

                                    const routedPoints =
                                        generateElbowRouteAroundObstacles(
                                            otherEndpoint,
                                            finalPoint,
                                            currentElements,
                                            originalElement.id,
                                            null, // No snap target
                                            otherConnection ?? null,
                                        );

                                    // If dragging start point, we need to reverse
                                    const finalPoints =
                                        index === 0
                                            ? routedPoints.reverse()
                                            : routedPoints;

                                    onUpdateElement(originalElement.id, {
                                        points: finalPoints,
                                        connectorStyle: "elbow",
                                        elbowRoute: undefined,
                                    });
                                    return;
                                }

                                // For elbow mode without connection, use full routing
                                if (style === "elbow") {
                                    const otherConnection =
                                        index === 0
                                            ? originalElement.endConnection
                                                  ?.elementId
                                            : originalElement.startConnection
                                                  ?.elementId;

                                    const routedPoints =
                                        generateElbowRouteAroundObstacles(
                                            otherEndpoint,
                                            finalPoint,
                                            currentElements,
                                            originalElement.id,
                                            null, // No snap target
                                            otherConnection ?? null,
                                        );

                                    // Update all points with the routed path
                                    if (index === 0) {
                                        newPoints = routedPoints.reverse();
                                    } else {
                                        newPoints = routedPoints;
                                    }

                                    onUpdateElement(originalElement.id, {
                                        points: newPoints,
                                        connectorStyle: "elbow",
                                        elbowRoute: undefined,
                                    });
                                    return;
                                }

                                // No snap - reset to the toolbar's connector style
                                // This handles switching back to sharp when moving away from
                                // an out-of-sight snap point
                                if (connectorStyle === "sharp") {
                                    newPoints[index] = finalPoint;
                                    onUpdateElement(originalElement.id, {
                                        points: [
                                            newPoints[0],
                                            newPoints[newPoints.length - 1],
                                        ],
                                        connectorStyle: "sharp",
                                    });
                                    return;
                                }
                            }
                        } else {
                            setSnapTarget(null);
                        }

                        // For sharp/curved modes without out-of-sight issues, just update the endpoint
                        newPoints[index] = finalPoint;
                    }

                    onUpdateElement(originalElement.id, { points: newPoints });
                }
                return;
            }

            // Handle dragging (moving elements)
            if (isDragging && dragStart && originalElements.length > 0) {
                const dx = point.x - dragStart.x;
                const dy = point.y - dragStart.y;

                // Set hasDragMoved once user has moved beyond a small threshold
                if (!hasDragMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                    setHasDragMoved(true);
                }

                // Collect IDs of shapes/tiles being moved (not arrows/lines/pen)
                const movedShapeIds: string[] = [];

                // Build updates for all elements being dragged
                const batchUpdates: Array<{
                    id: string;
                    updates: Partial<BoardElement>;
                }> = originalElements.map((origEl) => {
                    if (
                        origEl.type === "pen" ||
                        origEl.type === "line" ||
                        origEl.type === "arrow"
                    ) {
                        const newPoints = origEl.points.map((p) => ({
                            x: p.x + dx,
                            y: p.y + dy,
                        }));
                        return {
                            id: origEl.id,
                            updates: { points: newPoints },
                        };
                    } else {
                        movedShapeIds.push(origEl.id);
                        const newX = (origEl.x ?? 0) + dx;
                        const newY = (origEl.y ?? 0) + dy;
                        return {
                            id: origEl.id,
                            updates: { x: newX, y: newY },
                        };
                    }
                });

                // Get updates for connected arrows
                if (movedShapeIds.length > 0) {
                    // Create a temporary elements array with the updated positions
                    const tempElements = currentElements.map((el) => {
                        const update = batchUpdates.find((u) => u.id === el.id);
                        if (update) {
                            return { ...el, ...update.updates };
                        }
                        return el;
                    });
                    const arrowUpdates =
                        throttledArrowUpdates(movedShapeIds, tempElements) ??
                        [];
                    // Add arrow updates to batch, but only if the arrow isn't already being moved
                    const movedIds = new Set(
                        originalElements.map((el) => el.id),
                    );
                    arrowUpdates.forEach((au) => {
                        if (!movedIds.has(au.id)) {
                            batchUpdates.push(au);
                        }
                    });
                }

                // Use batch update if available, otherwise fall back to individual updates
                if (onBatchUpdateElements) {
                    onBatchUpdateElements(batchUpdates);
                } else {
                    // Fallback to individual updates
                    batchUpdates.forEach(({ id, updates }) => {
                        onUpdateElement(id, updates);
                    });
                }
                return;
            }

            // Handle resizing (single element or multi-selection group)
            if (
                isResizing &&
                dragStart &&
                originalBounds &&
                resizeHandle &&
                originalElements.length > 0
            ) {
                const originalElement =
                    originalElements.length === 1 ? originalElements[0] : null;
                const rotationDeg = originalElement?.rotation ?? 0;
                const supportsRotatedResize =
                    !!originalElement &&
                    (originalElement.type === "rectangle" ||
                        originalElement.type === "diamond" ||
                        originalElement.type === "ellipse" ||
                        originalElement.type === "frame" ||
                        originalElement.type === "web-embed" ||
                        originalElement.type === "tile");

                const centerForResize = supportsRotatedResize
                    ? getBoundsCenter(originalBounds)
                    : null;

                // Rotated resize for box-like elements: keep opposite handle fixed in world space,
                // compute size in local space (similar to Excalidraw).
                if (
                    supportsRotatedResize &&
                    centerForResize &&
                    rotationDeg &&
                    selectedIds.length === 1 &&
                    originalElements.length === 1
                ) {
                    const startHandle = resizeHandle as Exclude<
                        ResizeHandle,
                        null
                    >;
                    const fixedHandle = getOppositeResizeHandle(startHandle);

                    const fixedLocalPoint = getHandlePointFromBounds(
                        originalBounds,
                        fixedHandle,
                    );
                    const fixedWorldPoint = rotatePoint(
                        fixedLocalPoint,
                        centerForResize,
                        rotationDeg,
                    );

                    const vWorld = {
                        x: point.x - fixedWorldPoint.x,
                        y: point.y - fixedWorldPoint.y,
                    };
                    const vLocal = rotateVector(vWorld, -rotationDeg);

                    // Calculate minimum width based on the widest character in the actual text
                    const minAbsWidth =
                        originalElement?.type === "text"
                            ? getMinSingleCharWidth(
                                  originalElement.text || "",
                                  originalElement.fontSize ??
                                      originalElement.strokeWidth * 4 + 12,
                                  originalElement.fontFamily ||
                                      "var(--font-inter)",
                                  originalElement.letterSpacing ?? 0,
                              )
                            : 0;
                    const minAbsHeight =
                        originalElement?.type === "text"
                            ? Math.max(
                                  2,
                                  (originalElement.fontSize ??
                                      originalElement.strokeWidth * 4 + 12) *
                                      (originalElement.lineHeight ?? 1.4),
                              )
                            : 0;

                    const expectedSignX = startHandle.includes("w")
                        ? -1
                        : startHandle.includes("e")
                          ? 1
                          : 0;
                    const expectedSignY = startHandle.includes("n")
                        ? -1
                        : startHandle.includes("s")
                          ? 1
                          : 0;
                    const clampDirectional = (
                        value: number,
                        expectedSign: -1 | 0 | 1,
                        minAbs: number,
                    ) => {
                        if (expectedSign === 0) return value;
                        const projected = expectedSign * value;
                        return expectedSign * Math.max(minAbs, projected);
                    };

                    let widthSigned = originalBounds.width;
                    let heightSigned = originalBounds.height;

                    const isCorner = startHandle.length === 2;
                    if (isCorner) {
                        widthSigned = clampDirectional(
                            vLocal.x,
                            expectedSignX,
                            minAbsWidth,
                        );
                        heightSigned = clampDirectional(
                            vLocal.y,
                            expectedSignY,
                            minAbsHeight,
                        );

                        if (shiftPressed) {
                            const aspect =
                                originalBounds.height === 0
                                    ? 1
                                    : originalBounds.width /
                                      originalBounds.height;
                            const signX =
                                widthSigned === 0 ? 1 : Math.sign(widthSigned);
                            const signY =
                                heightSigned === 0
                                    ? 1
                                    : Math.sign(heightSigned);
                            const absW = Math.abs(widthSigned);
                            const absH = Math.abs(heightSigned);
                            const wFromH = absH * aspect;
                            const hFromW = absW / aspect;
                            if (
                                Math.abs(wFromH - absW) <
                                Math.abs(hFromW - absH)
                            ) {
                                widthSigned = signX * wFromH;
                            } else {
                                heightSigned = signY * hFromW;
                            }
                        }
                    } else if (startHandle === "e" || startHandle === "w") {
                        widthSigned = clampDirectional(
                            vLocal.x,
                            expectedSignX,
                            minAbsWidth,
                        );
                        heightSigned = originalBounds.height;
                    } else if (startHandle === "n" || startHandle === "s") {
                        widthSigned = originalBounds.width;
                        heightSigned = clampDirectional(
                            vLocal.y,
                            expectedSignY,
                            minAbsHeight,
                        );
                    }

                    const nextW = Math.abs(widthSigned);
                    const nextH = Math.abs(heightSigned);

                    const centerOffsetLocal = isCorner
                        ? { x: widthSigned / 2, y: heightSigned / 2 }
                        : startHandle === "e" || startHandle === "w"
                          ? { x: widthSigned / 2, y: 0 }
                          : { x: 0, y: heightSigned / 2 };

                    const centerOffsetWorld = rotateVector(
                        centerOffsetLocal,
                        rotationDeg,
                    );
                    const nextCenter = {
                        x: fixedWorldPoint.x + centerOffsetWorld.x,
                        y: fixedWorldPoint.y + centerOffsetWorld.y,
                    };

                    const nextX = nextCenter.x - nextW / 2;
                    const nextY = nextCenter.y - nextH / 2;

                    if (
                        originalElement.type === "rectangle" ||
                        originalElement.type === "diamond" ||
                        originalElement.type === "ellipse" ||
                        originalElement.type === "frame" ||
                        originalElement.type === "web-embed"
                    ) {
                        onUpdateElement(selectedIds[0], {
                            x: nextX,
                            y: nextY,
                            width: nextW,
                            height: nextH,
                        });
                        return;
                    }

                    if (originalElement.type === "text") {
                        onUpdateElement(selectedIds[0], {
                            x: nextX,
                            y: nextY,
                            width: nextW,
                            height: nextH,
                        });
                        return;
                    }
                }

                const dx = point.x - dragStart.x;
                const dy = point.y - dragStart.y;

                let newX = originalBounds.x;
                let newY = originalBounds.y;
                let newWidth = originalBounds.width;
                let newHeight = originalBounds.height;

                const aspectRatio =
                    originalBounds.height === 0
                        ? 1
                        : originalBounds.width / originalBounds.height;
                const originalLeft = originalBounds.x;
                const originalTop = originalBounds.y;
                const originalRight = originalBounds.x + originalBounds.width;
                const originalBottom = originalBounds.y + originalBounds.height;

                switch (resizeHandle) {
                    case "nw":
                        newX = originalBounds.x + dx;
                        newY = originalBounds.y + dy;
                        newWidth = originalBounds.width - dx;
                        newHeight = originalBounds.height - dy;
                        if (shiftPressed) {
                            const avgDelta = (dx + dy) / 2;
                            newX = originalBounds.x + avgDelta;
                            newY = originalBounds.y + avgDelta / aspectRatio;
                            newWidth = originalBounds.width - avgDelta;
                            newHeight = newWidth / aspectRatio;
                        }
                        break;
                    case "n":
                        newY = originalBounds.y + dy;
                        newHeight = originalBounds.height - dy;
                        if (shiftPressed) {
                            newWidth = newHeight * aspectRatio;
                            newX =
                                originalBounds.x +
                                (originalBounds.width - newWidth) / 2;
                        }
                        break;
                    case "ne":
                        newY = originalBounds.y + dy;
                        newWidth = originalBounds.width + dx;
                        newHeight = originalBounds.height - dy;
                        if (shiftPressed) {
                            const avgDelta = (dx - dy) / 2;
                            newWidth = originalBounds.width + avgDelta;
                            newHeight = newWidth / aspectRatio;
                            newY =
                                originalBounds.y +
                                originalBounds.height -
                                newHeight;
                        }
                        break;
                    case "e":
                        newWidth = originalBounds.width + dx;
                        if (shiftPressed) {
                            newHeight = newWidth / aspectRatio;
                            newY =
                                originalBounds.y +
                                (originalBounds.height - newHeight) / 2;
                        }
                        break;
                    case "se":
                        newWidth = originalBounds.width + dx;
                        newHeight = originalBounds.height + dy;
                        if (shiftPressed) {
                            const avgDelta = (dx + dy) / 2;
                            newWidth = originalBounds.width + avgDelta;
                            newHeight = newWidth / aspectRatio;
                        }
                        break;
                    case "s":
                        newHeight = originalBounds.height + dy;
                        if (shiftPressed) {
                            newWidth = newHeight * aspectRatio;
                            newX =
                                originalBounds.x +
                                (originalBounds.width - newWidth) / 2;
                        }
                        break;
                    case "sw":
                        newX = originalBounds.x + dx;
                        newWidth = originalBounds.width - dx;
                        newHeight = originalBounds.height + dy;
                        if (shiftPressed) {
                            const avgDelta = (-dx + dy) / 2;
                            newWidth = originalBounds.width + avgDelta;
                            newHeight = newWidth / aspectRatio;
                            newX =
                                originalBounds.x +
                                originalBounds.width -
                                newWidth;
                        }
                        break;
                    case "w":
                        newX = originalBounds.x + dx;
                        newWidth = originalBounds.width - dx;
                        if (shiftPressed) {
                            newHeight = newWidth / aspectRatio;
                            newY =
                                originalBounds.y +
                                (originalBounds.height - newHeight) / 2;
                        }
                        break;
                }

                // Text should never flip/invert. Clamp to minimum size and keep the opposite edge fixed.
                if (selectedIds.length === 1 && originalElements.length === 1) {
                    const originalElement = originalElements[0];
                    if (originalElement.type === "text") {
                        const fs =
                            originalElement.fontSize ??
                            originalElement.strokeWidth * 4 + 12;
                        const ff =
                            originalElement.fontFamily || "var(--font-inter)";
                        const elLetterSpacing =
                            originalElement.letterSpacing ?? 0;
                        const textContent = originalElement.text || "";
                        // Calculate minimum width based on the widest character in the actual text
                        const minW = getMinSingleCharWidth(
                            textContent,
                            fs,
                            ff,
                            elLetterSpacing,
                        );
                        const lh = originalElement.lineHeight ?? 1.4;
                        const lineHeightPx = fs * lh;
                        const minH = Math.max(2, lineHeightPx);

                        const effectiveWidth = Math.max(minW, newWidth);
                        // Always calculate required height based on current width, not stored height
                        // This ensures height shrinks back when width expands
                        const requiredHeight = Math.max(
                            minH,
                            measureWrappedTextHeightPx({
                                text: textContent,
                                width: effectiveWidth,
                                fontSize: fs,
                                lineHeight: lh,
                                fontFamily: ff,
                                letterSpacing: elLetterSpacing,
                                textAlign: originalElement.textAlign ?? "left",
                            }),
                        );

                        if (newWidth < minW) {
                            newWidth = minW;
                            if (
                                resizeHandle.includes("w") &&
                                !resizeHandle.includes("e")
                            ) {
                                newX = originalRight - minW;
                            } else {
                                newX = originalLeft;
                            }
                        }

                        // Set height to exactly what's required for the text at this width
                        newHeight = requiredHeight;
                        // Adjust Y position if dragging from top edge
                        if (
                            resizeHandle.includes("n") &&
                            !resizeHandle.includes("s")
                        ) {
                            newY = originalBottom - requiredHeight;
                        }

                        const normalizedX = Math.min(newX, newX + newWidth);
                        const normalizedY = Math.min(newY, newY + newHeight);
                        const normalizedWidth = Math.abs(newWidth);
                        const normalizedHeight = Math.abs(newHeight);
                        onUpdateElement(selectedIds[0], {
                            x: normalizedX,
                            y: normalizedY,
                            width: normalizedWidth,
                            height: normalizedHeight,
                        });
                        return;
                    }
                }

                // Single element resize keeps the existing behavior (including mirroring for point-based shapes).
                if (selectedIds.length === 1 && originalElements.length === 1) {
                    const originalElement = originalElements[0];

                    const fontSizeForMin =
                        originalElement.type === "text"
                            ? (originalElement.fontSize ??
                              originalElement.strokeWidth * 4 + 12)
                            : null;
                    const fontFamilyForMin =
                        originalElement.type === "text"
                            ? originalElement.fontFamily || "var(--font-inter)"
                            : null;

                    // Calculate minimum width based on the widest character in the actual text
                    let minAbsWidth = 0;
                    let minAbsHeight = 0;

                    if (originalElement.type === "text") {
                        minAbsWidth = getMinSingleCharWidth(
                            originalElement.text || "",
                            fontSizeForMin!,
                            fontFamilyForMin!,
                            originalElement.letterSpacing ?? 0,
                        );
                        minAbsHeight = Math.max(
                            2,
                            fontSizeForMin! *
                                (originalElement.lineHeight ?? 1.4),
                        );
                    } else if (
                        originalElement.type === "tile" &&
                        originalElement.tileType
                    ) {
                        const minTileSize = getMinTileSize(
                            originalElement.tileType,
                        );
                        minAbsWidth = minTileSize.width;
                        minAbsHeight = minTileSize.height;
                    } else if (
                        originalElement.type === "rectangle" ||
                        originalElement.type === "diamond" ||
                        originalElement.type === "ellipse" ||
                        originalElement.type === "frame" ||
                        originalElement.type === "web-embed"
                    ) {
                        minAbsWidth = 2;
                        minAbsHeight = 2;
                    }

                    // Avoid snapping/flipping when elements get very small (especially lines/pen),
                    // while still keeping box-like elements at a small minimum size.
                    const clampSignedWidth = (size: number) => {
                        if (Number.isNaN(size)) return minAbsWidth;
                        if (minAbsWidth <= 0) return size;
                        if (size === 0) return 0;
                        if (Math.abs(size) < minAbsWidth)
                            return Math.sign(size) * minAbsWidth;
                        return size;
                    };
                    const clampSignedHeight = (size: number) => {
                        if (Number.isNaN(size)) return minAbsHeight;
                        if (minAbsHeight <= 0) return size;
                        if (size === 0) return 0;
                        if (Math.abs(size) < minAbsHeight)
                            return Math.sign(size) * minAbsHeight;
                        return size;
                    };

                    const nextWidth = clampSignedWidth(newWidth);
                    if (nextWidth !== newWidth) {
                        if (
                            resizeHandle.includes("w") &&
                            !resizeHandle.includes("e")
                        ) {
                            newX = originalRight - nextWidth;
                        } else if (
                            resizeHandle.includes("e") &&
                            !resizeHandle.includes("w")
                        ) {
                            newX = originalLeft;
                        } else {
                            const centerX = newX + newWidth / 2;
                            newX = centerX - nextWidth / 2;
                        }
                        newWidth = nextWidth;
                    }

                    const nextHeight = clampSignedHeight(newHeight);
                    if (nextHeight !== newHeight) {
                        if (
                            resizeHandle.includes("n") &&
                            !resizeHandle.includes("s")
                        ) {
                            newY = originalBottom - nextHeight;
                        } else if (
                            resizeHandle.includes("s") &&
                            !resizeHandle.includes("n")
                        ) {
                            newY = originalTop;
                        } else {
                            const centerY = newY + newHeight / 2;
                            newY = centerY - nextHeight / 2;
                        }
                        newHeight = nextHeight;
                    }

                    if (
                        originalElement.type === "rectangle" ||
                        originalElement.type === "diamond" ||
                        originalElement.type === "ellipse" ||
                        originalElement.type === "frame" ||
                        originalElement.type === "web-embed" ||
                        originalElement.type === "tile"
                    ) {
                        const normalizedX = Math.min(newX, newX + newWidth);
                        const normalizedY = Math.min(newY, newY + newHeight);
                        const normalizedWidth = Math.abs(newWidth);
                        const normalizedHeight = Math.abs(newHeight);
                        onUpdateElement(selectedIds[0], {
                            x: normalizedX,
                            y: normalizedY,
                            width: normalizedWidth,
                            height: normalizedHeight,
                        });
                    } else if (
                        originalElement.type === "pen" ||
                        originalElement.type === "line" ||
                        originalElement.type === "arrow" ||
                        originalElement.type === "laser"
                    ) {
                        // `newWidth/newHeight` can be negative here, which intentionally mirrors the element.
                        const scaleX = newWidth / (originalBounds.width || 1);
                        const scaleY = newHeight / (originalBounds.height || 1);
                        const newPoints = originalElement.points.map((p) => ({
                            x: newX + (p.x - originalBounds.x) * scaleX,
                            y: newY + (p.y - originalBounds.y) * scaleY,
                        }));
                        onUpdateElement(selectedIds[0], { points: newPoints });
                    } else if (originalElement.type === "text") {
                        onUpdateElement(selectedIds[0], {
                            x: Math.min(newX, newX + newWidth),
                            y: Math.min(newY, newY + newHeight),
                            width: Math.abs(newWidth),
                            height: Math.abs(newHeight),
                        });
                    }
                    return;
                }

                // Multi-selection: scale all elements relative to the original selection bounds.
                const normalizedX = Math.min(newX, newX + newWidth);
                const normalizedY = Math.min(newY, newY + newHeight);
                const normalizedWidth = Math.max(1, Math.abs(newWidth));
                const normalizedHeight = Math.max(1, Math.abs(newHeight));

                const scaleX = normalizedWidth / (originalBounds.width || 1);
                const scaleY = normalizedHeight / (originalBounds.height || 1);

                originalElements.forEach((origEl) => {
                    if (
                        origEl.type === "pen" ||
                        origEl.type === "line" ||
                        origEl.type === "arrow" ||
                        origEl.type === "laser"
                    ) {
                        const newPoints = origEl.points.map((p) => ({
                            x: normalizedX + (p.x - originalBounds.x) * scaleX,
                            y: normalizedY + (p.y - originalBounds.y) * scaleY,
                        }));
                        onUpdateElement(origEl.id, { points: newPoints });
                        return;
                    }

                    const ox = origEl.x ?? 0;
                    const oy = origEl.y ?? 0;
                    const ow = origEl.width ?? 0;
                    const oh = origEl.height ?? 0;

                    const left = ox;
                    const top = oy;
                    const right = ox + ow;
                    const bottom = oy + oh;

                    const nextLeft =
                        normalizedX + (left - originalBounds.x) * scaleX;
                    const nextTop =
                        normalizedY + (top - originalBounds.y) * scaleY;
                    const nextRight =
                        normalizedX + (right - originalBounds.x) * scaleX;
                    const nextBottom =
                        normalizedY + (bottom - originalBounds.y) * scaleY;

                    const nextX = Math.min(nextLeft, nextRight);
                    const nextY = Math.min(nextTop, nextBottom);
                    const nextW = Math.abs(nextRight - nextLeft);
                    const nextH = Math.abs(nextBottom - nextTop);

                    if (origEl.type === "text") {
                        onUpdateElement(origEl.id, {
                            x: nextX,
                            y: nextY,
                            width: nextW,
                            height: nextH,
                        });
                        return;
                    }

                    onUpdateElement(origEl.id, {
                        x: nextX,
                        y: nextY,
                        width: nextW,
                        height: nextH,
                    });
                });
                return;
            }

            // Handle eraser tool - mark elements for deletion preview
            if (tool === "eraser" && isDrawing) {
                // Add point to eraser trail animation
                if (eraserTrailRef.current) {
                    eraserTrailRef.current.addPoint(point.x, point.y);
                }
                const elementsToMark = getElementsToErase(point);
                if (elementsToMark.length > 0) {
                    setEraserMarkedIds((prev) => {
                        const newSet = new Set(prev);
                        elementsToMark.forEach((id) => newSet.add(id));
                        return newSet;
                    });
                }
                return;
            }

            if (!isDrawing || !currentElement || !startPoint) return;

            switch (tool) {
                case "pen":
                case "highlighter": {
                    setCurrentElement({
                        ...currentElement,
                        points: [...currentElement.points, point],
                    });
                    break;
                }
                case "line":
                case "arrow": {
                    const endPoint = point;
                    const activeConnectorStyle =
                        currentElement.connectorStyle ?? connectorStyle;

                    // Check for snap target during arrow creation
                    const snapDistance = 20 / zoom;
                    const snapResult = throttledFindSnapTarget(
                        endPoint,
                        currentElements,
                        currentElement.id,
                        snapDistance,
                        activeConnectorStyle,
                        startPoint,
                    );

                    if (snapResult) {
                        const snappedEndPoint = snapResult.snapPoint.point;
                        setSnapTarget({
                            elementId: snapResult.elementId,
                            point: snappedEndPoint,
                            position: snapResult.snapPoint.position,
                            outOfLineOfSight: snapResult.outOfLineOfSight,
                        });

                        if (
                            activeConnectorStyle === "sharp" &&
                            startSnapTarget
                        ) {
                            // Dual-connection in sharp mode: enforce orthogonal exit to avoid edge riding.
                            const routedPoints =
                                generateElbowRouteAroundObstacles(
                                    startPoint,
                                    snappedEndPoint,
                                    currentElements,
                                    currentElement.id,
                                    snapResult.elementId,
                                    startSnapTarget.elementId,
                                );
                            setCurrentElement({
                                ...currentElement,
                                points: routedPoints,
                                connectorStyle: "elbow",
                                elbowRoute: undefined,
                            });
                        } else if (activeConnectorStyle === "elbow") {
                            // Generate elbow route around obstacles for preview
                            const routedPoints =
                                generateElbowRouteAroundObstacles(
                                    startPoint,
                                    snappedEndPoint,
                                    currentElements,
                                    currentElement.id,
                                    snapResult.elementId,
                                );
                            setCurrentElement({
                                ...currentElement,
                                points: routedPoints,
                                connectorStyle: "elbow",
                                elbowRoute: undefined,
                            });
                        } else if (activeConnectorStyle === "curved") {
                            // Generate curved route around obstacles for preview
                            const routedPoints =
                                generateCurvedRouteAroundObstacles(
                                    startPoint,
                                    snappedEndPoint,
                                    currentElements,
                                    currentElement.id,
                                    snapResult.elementId,
                                );
                            setCurrentElement({
                                ...currentElement,
                                points: routedPoints,
                                connectorStyle: "curved",
                            });
                        } else if (
                            activeConnectorStyle === "sharp" &&
                            snapResult.outOfLineOfSight
                        ) {
                            // Sharp mode but snap target is out of line of sight
                            // Switch to elbow mode for this connection
                            const routedPoints =
                                generateElbowRouteAroundObstacles(
                                    startPoint,
                                    snappedEndPoint,
                                    currentElements,
                                    currentElement.id,
                                    snapResult.elementId,
                                );
                            setCurrentElement({
                                ...currentElement,
                                points: routedPoints,
                                connectorStyle: "elbow",
                                elbowRoute: undefined,
                            });
                        } else {
                            setCurrentElement({
                                ...currentElement,
                                points: [startPoint, snappedEndPoint],
                            });
                        }
                    } else {
                        setSnapTarget(null);

                        // Use the original connector style from props (not currentElement)
                        // to ensure we switch back to sharp when moving away from an
                        // out-of-sight snap point that temporarily used elbow
                        if (connectorStyle === "elbow") {
                            const dx = endPoint.x - startPoint.x;
                            const dy = endPoint.y - startPoint.y;
                            const elbowRoute =
                                Math.abs(dx) >= Math.abs(dy)
                                    ? "vertical"
                                    : "horizontal";
                            setCurrentElement({
                                ...currentElement,
                                points: [
                                    startPoint,
                                    {
                                        x: (startPoint.x + endPoint.x) / 2,
                                        y: (startPoint.y + endPoint.y) / 2,
                                    },
                                    endPoint,
                                ],
                                connectorStyle: "elbow",
                                elbowRoute,
                            });
                        } else {
                            // Sharp or curved mode - use simple 2-point line
                            setCurrentElement({
                                ...currentElement,
                                points: [startPoint, endPoint],
                                connectorStyle: connectorStyle,
                            });
                        }
                    }
                    break;
                }
                case "rectangle":
                case "diamond":
                case "frame": {
                    const width = point.x - startPoint.x;
                    const height = point.y - startPoint.y;
                    let finalWidth = Math.abs(width);
                    let finalHeight = Math.abs(height);

                    if (shiftPressed) {
                        const size = Math.max(finalWidth, finalHeight);
                        finalWidth = size;
                        finalHeight = size;
                    }

                    setCurrentElement({
                        ...currentElement,
                        x: width < 0 ? startPoint.x - finalWidth : startPoint.x,
                        y:
                            height < 0
                                ? startPoint.y - finalHeight
                                : startPoint.y,
                        width: finalWidth,
                        height: finalHeight,
                    });
                    break;
                }
                case "ellipse": {
                    const width = point.x - startPoint.x;
                    const height = point.y - startPoint.y;
                    let finalWidth = Math.abs(width);
                    let finalHeight = Math.abs(height);

                    if (shiftPressed) {
                        const size = Math.max(finalWidth, finalHeight);
                        finalWidth = size;
                        finalHeight = size;
                    }

                    setCurrentElement({
                        ...currentElement,
                        x: width < 0 ? startPoint.x - finalWidth : startPoint.x,
                        y:
                            height < 0
                                ? startPoint.y - finalHeight
                                : startPoint.y,
                        width: finalWidth,
                        height: finalHeight,
                    });
                    break;
                }
                case "laser": {
                    setCurrentElement({
                        ...currentElement,
                        points: [...currentElement.points, point],
                    });
                    break;
                }
            }
        },
        [
            isDrawing,
            currentElement,
            startPoint,
            tool,
            isReadOnly,
            collaboration,
            getMousePosition,
            isPanning,
            panStart,
            onDeleteElement,
            strokeWidth,
            isDragging,
            isResizing,
            isRotating,
            rotateStart,
            selectedIds,
            dragStart,
            originalElements,
            originalBounds,
            resizeHandle,
            onUpdateElement,
            shiftPressed,
            isBoxSelecting,
            isLassoSelecting,
            lassoPoints,
            lastMousePos,
            setLastMousePos,
            setSelectedIds,
            setLassoPoints,
            draggingConnectorPoint,
            connectorStyle,
            getElementsToErase,
            startSnapTarget,
            throttledArrowUpdates,
            throttledFindSnapTarget,
            elementsRef,
            remotelySelectedIds,
        ],
    );

    const handleMouseDown = useCallback(
        (e: ReactMouseEvent) => {
            // Middle mouse button for panning OR hand tool with left click
            const shouldPan =
                e.button === 1 || (e.button === 0 && tool === "hand");
            if (shouldPan) {
                setIsPanning(true);
                setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
                // User manually panning - stop following
                onManualViewportChange?.();
                return;
            }

            if (isReadOnly) return;

            if (e.button !== 0) return;

            const point = getMousePosition(e);
            setStartPoint(point);
            const currentElements = elementsRef.current;

            // Get the element ID from the event target (works for SVG + HTML overlay).
            const {
                elementId: clickedElementId,
                isInteractive,
                frameLabel,
                frameHandle,
            } = getEventTargetInfo(e);

            const clickedElement = clickedElementId
                ? currentElements.find((el) => el.id === clickedElementId)
                : null;
            // Don't allow selecting elements that are selected by remote users or locked/hidden
            const isRemotelySelected = clickedElement
                ? remotelySelectedIds.has(clickedElement.id)
                : false;
            const isLockedOrHidden = clickedElement
                ? clickedElement.locked || clickedElement.hidden
                : false;
            const selectableClickedElement =
                clickedElement?.type === "laser" ||
                isRemotelySelected ||
                isLockedOrHidden
                    ? null
                    : clickedElement;

            const frameLabelTarget = frameLabel as HTMLElement | null;
            if (frameLabelTarget) {
                e.preventDefault();
                const frameId =
                    frameLabelTarget.getAttribute("data-element-id");
                const frameElement = frameId
                    ? currentElements.find(
                          (el) => el.id === frameId && el.type === "frame",
                      )
                    : null;
                if (frameElement) {
                    setSelectedIds([frameElement.id]);
                    setEditingFrameLabelId(frameElement.id);
                    setFrameLabelValue(frameElement.label ?? "Frame");
                }
                return;
            }

            const frameHandleTarget = frameHandle as HTMLElement | null;
            if (frameHandleTarget && selectableClickedElement?.type === "frame") {
                e.preventDefault();
                const frameId = selectableClickedElement.id;
                const containedElements = currentElements.filter(
                    (el) =>
                        el.frameId === frameId &&
                        el.type !== "laser" &&
                        !el.hidden &&
                        !el.locked &&
                        !remotelySelectedIds.has(el.id),
                );
                const dragElements = [
                    selectableClickedElement,
                    ...containedElements,
                ];
                onStartTransform?.();
                setSelectedIds([selectableClickedElement.id]);
                setIsDragging(true);
                setDragStart(point);
                setOriginalElements(dragElements.map((el) => ({ ...el })));
                return;
            }

            if (isInteractive) {
                // Allow editing/selection inside DOM editors without triggering canvas drags/box-select.
                if (selectableClickedElement) {
                    setSelectedIds(
                        getGroupSelectionIds(
                            selectableClickedElement,
                            currentElements,
                        ),
                    );
                }
                return;
            }

            if (tool === "lasso") {
                setSelectedIds([]);
                setIsBoxSelecting(false);
                setSelectionBox(null);
                setIsLassoSelecting(true);
                setLassoPoints([point]);
                return;
            }

            if (tool === "select") {
                const selectionHasFrame = selectedElements.some(
                    (el) => el.type === "frame",
                );
                const dragSelectionElements = selectionHasFrame
                    ? selectedElements.filter((el) => el.type !== "frame")
                    : selectedElements;

                // Double-click text to edit (Excalidraw-style).
                if (
                    e.detail === 2 &&
                    selectableClickedElement &&
                    selectableClickedElement.type === "text" &&
                    !isRemotelySelected
                ) {
                    const editFontSize =
                        selectableClickedElement.fontSize ??
                        selectableClickedElement.strokeWidth * 4 + 12;
                    const editLineHeight =
                        selectableClickedElement.lineHeight ?? 1.4;
                    setTextInput({
                        x: selectableClickedElement.x ?? 0,
                        y: selectableClickedElement.y ?? 0,
                        width: selectableClickedElement.width,
                        height:
                            selectableClickedElement.height ??
                            editFontSize * editLineHeight,
                        isTextBox: true,
                    });
                    setTextValue(selectableClickedElement.text ?? "");
                    setEditingTextElementId(selectableClickedElement.id);
                    setEditingTextStyle({
                        strokeColor: selectableClickedElement.strokeColor,
                        strokeWidth: selectableClickedElement.strokeWidth,
                        opacity: selectableClickedElement.opacity ?? 100,
                        fontFamily:
                            selectableClickedElement.fontFamily ||
                            "var(--font-inter)",
                        textAlign: selectableClickedElement.textAlign || "left",
                        fontSize:
                            selectableClickedElement.fontSize ?? editFontSize,
                        letterSpacing:
                            selectableClickedElement.letterSpacing ?? 0,
                        lineHeight:
                            selectableClickedElement.lineHeight ??
                            editLineHeight,
                    });
                    setSelectedIds([selectableClickedElement.id]);
                    setTimeout(() => {
                        const editor = textInputRef.current;
                        editor?.focus();
                        if (editor) {
                            editor.setSelectionRange(0, editor.value.length);
                        }
                    }, 10);
                    return;
                }

                // Check if clicking on a resize handle first (supports multi-selection)
                if (selectedBounds && selectedIds.length >= 1) {
                    const handleSize = 10 / zoom;
                    const selectionPadding = 6 / zoom;
                    const visualBounds = expandBounds(
                        selectedBounds,
                        selectionPadding,
                    );

                    // Rotate handle (single selection)
                    if (selectedIds.length === 1) {
                        const selectedElement = currentElements.find(
                            (el) => el.id === selectedIds[0],
                        );
                        if (
                            selectedElement &&
                            selectedElement.type !== "laser" &&
                            (selectedElement.type !== "line" &&
                            selectedElement.type !== "arrow"
                                ? true
                                : selectedElement.points.length >= 3)
                        ) {
                            const rotationDeg = selectedElement.rotation ?? 0;
                            const center = getBoundsCenter(visualBounds);
                            const rotateHandleDistance = 28 / zoom;
                            const rotateHandleRadius = 4 / zoom;

                            const localAnchor: Point =
                                rotateHandleSide === "n"
                                    ? {
                                          x:
                                              visualBounds.x +
                                              visualBounds.width / 2,
                                          y: visualBounds.y,
                                      }
                                    : rotateHandleSide === "e"
                                      ? {
                                            x:
                                                visualBounds.x +
                                                visualBounds.width,
                                            y:
                                                visualBounds.y +
                                                visualBounds.height / 2,
                                        }
                                      : rotateHandleSide === "s"
                                        ? {
                                              x:
                                                  visualBounds.x +
                                                  visualBounds.width / 2,
                                              y:
                                                  visualBounds.y +
                                                  visualBounds.height,
                                          }
                                        : {
                                              x: visualBounds.x,
                                              y:
                                                  visualBounds.y +
                                                  visualBounds.height / 2,
                                          };

                            const outward: Point =
                                rotateHandleSide === "n"
                                    ? { x: 0, y: -1 }
                                    : rotateHandleSide === "e"
                                      ? { x: 1, y: 0 }
                                      : rotateHandleSide === "s"
                                        ? { x: 0, y: 1 }
                                        : { x: -1, y: 0 };

                            const localHandle: Point = {
                                x:
                                    localAnchor.x +
                                    outward.x * rotateHandleDistance,
                                y:
                                    localAnchor.y +
                                    outward.y * rotateHandleDistance,
                            };

                            const handlePos = rotationDeg
                                ? rotatePoint(localHandle, center, rotationDeg)
                                : localHandle;

                            if (
                                Math.hypot(
                                    point.x - handlePos.x,
                                    point.y - handlePos.y,
                                ) <=
                                rotateHandleRadius * 2.25
                            ) {
                                onStartTransform?.();
                                setIsRotating(true);
                                setRotateStart({
                                    elementId: selectedElement.id,
                                    center,
                                    startPointerAngleRad: Math.atan2(
                                        point.y - center.y,
                                        point.x - center.x,
                                    ),
                                    startRotationDeg: rotationDeg,
                                });
                                return;
                            }
                        }
                    }

                    const rotationDegForHandles =
                        selectedIds.length === 1
                            ? (currentElements.find(
                                  (el) => el.id === selectedIds[0],
                              )?.rotation ?? 0)
                            : 0;
                    const centerForHandles = getBoundsCenter(visualBounds);

                    // Only show corner handles for single selection.
                    const baseHandlePoints: Array<{
                        h: Exclude<ResizeHandle, null>;
                        x: number;
                        y: number;
                    }> =
                        selectedIds.length === 1
                            ? [
                                  {
                                      h: "nw",
                                      x: visualBounds.x,
                                      y: visualBounds.y,
                                  },
                                  {
                                      h: "ne",
                                      x: visualBounds.x + visualBounds.width,
                                      y: visualBounds.y,
                                  },
                                  {
                                      h: "se",
                                      x: visualBounds.x + visualBounds.width,
                                      y: visualBounds.y + visualBounds.height,
                                  },
                                  {
                                      h: "sw",
                                      x: visualBounds.x,
                                      y: visualBounds.y + visualBounds.height,
                                  },
                              ]
                            : [
                                  {
                                      h: "nw",
                                      x: visualBounds.x,
                                      y: visualBounds.y,
                                  },
                                  {
                                      h: "n",
                                      x:
                                          visualBounds.x +
                                          visualBounds.width / 2,
                                      y: visualBounds.y,
                                  },
                                  {
                                      h: "ne",
                                      x: visualBounds.x + visualBounds.width,
                                      y: visualBounds.y,
                                  },
                                  {
                                      h: "e",
                                      x: visualBounds.x + visualBounds.width,
                                      y:
                                          visualBounds.y +
                                          visualBounds.height / 2,
                                  },
                                  {
                                      h: "se",
                                      x: visualBounds.x + visualBounds.width,
                                      y: visualBounds.y + visualBounds.height,
                                  },
                                  {
                                      h: "s",
                                      x:
                                          visualBounds.x +
                                          visualBounds.width / 2,
                                      y: visualBounds.y + visualBounds.height,
                                  },
                                  {
                                      h: "sw",
                                      x: visualBounds.x,
                                      y: visualBounds.y + visualBounds.height,
                                  },
                                  {
                                      h: "w",
                                      x: visualBounds.x,
                                      y:
                                          visualBounds.y +
                                          visualBounds.height / 2,
                                  },
                              ];

                    // Hit-testing uses the *local* handle id (so resize math stays stable), but positions are rotated.
                    const handles: Array<{
                        handle: Exclude<ResizeHandle, null>;
                        x: number;
                        y: number;
                    }> = baseHandlePoints.map((h) => {
                        const p = rotationDegForHandles
                            ? rotatePoint(
                                  { x: h.x, y: h.y },
                                  centerForHandles,
                                  rotationDegForHandles,
                              )
                            : { x: h.x, y: h.y };
                        return { handle: h.h, x: p.x, y: p.y };
                    });

                    for (const h of handles) {
                        if (
                            Math.abs(point.x - h.x) <= handleSize &&
                            Math.abs(point.y - h.y) <= handleSize
                        ) {
                            onStartTransform?.();
                            setIsResizing(true);
                            setResizeHandle(h.handle);
                            setDragStart(point);
                            setOriginalElements(
                                selectedElements.map((el) => ({ ...el })),
                            );
                            setOriginalBounds({ ...selectedBounds });
                            return;
                        }
                    }

                    // Dragging directly on the selection edge should resize too (single selection only).
                    if (selectedIds.length === 1) {
                        const edgeThreshold = 10 / zoom;
                        const edgeHandle = getResizeHandleFromSelectionEdge(
                            point,
                            visualBounds,
                            rotationDegForHandles,
                            edgeThreshold,
                        );
                        if (edgeHandle) {
                            onStartTransform?.();
                            setIsResizing(true);
                            setResizeHandle(edgeHandle);
                            setDragStart(point);
                            setOriginalElements(
                                selectedElements.map((el) => ({ ...el })),
                            );
                            setOriginalBounds({ ...selectedBounds });
                            return;
                        }
                    }

                    // Allow dragging the current selection by grabbing anywhere inside its visual frame.
                    // Clicking inside the frame should not clear the selection.
                    const clickedIsInSelection = selectableClickedElement
                        ? selectedIds.includes(selectableClickedElement.id)
                        : true;
                    const pointInSelectionFrame =
                        point.x >= visualBounds.x &&
                        point.x <= visualBounds.x + visualBounds.width &&
                        point.y >= visualBounds.y &&
                        point.y <= visualBounds.y + visualBounds.height;

                    if (
                        pointInSelectionFrame &&
                        clickedIsInSelection &&
                        dragSelectionElements.length > 0 &&
                        selectableClickedElement?.type !== "frame"
                    ) {
                        onStartTransform?.();
                        setIsDragging(true);
                        setDragStart(point);
                        setOriginalElements(
                            dragSelectionElements.map((el) => ({ ...el })),
                        );
                        return;
                    }
                }

                // Use clicked element from event target
                if (selectableClickedElement) {
                    const clickedIds = getGroupSelectionIds(
                        selectableClickedElement,
                        currentElements,
                    );
                    const clickedAllSelected = clickedIds.every((id) =>
                        selectedIds.includes(id),
                    );
                    const dragClickedElements = currentElements.filter(
                        (el) =>
                            clickedIds.includes(el.id) && el.type !== "frame",
                    );

                    // Shift-click to add to selection
                    if (shiftPressed) {
                        if (clickedAllSelected) {
                            setSelectedIds(
                                selectedIds.filter(
                                    (id) => !clickedIds.includes(id),
                                ),
                            );
                        } else {
                            setSelectedIds([
                                ...selectedIds,
                                ...clickedIds.filter(
                                    (id) => !selectedIds.includes(id),
                                ),
                            ]);
                        }
                    } else {
                        if (selectableClickedElement.type === "frame") {
                            setSelectedIds(clickedIds);
                            return;
                        }
                        // If clicked element is already in selection, drag all selected elements
                        if (clickedAllSelected) {
                            if (dragSelectionElements.length === 0) {
                                return;
                            }
                            onStartTransform?.();
                            setIsDragging(true);
                            setDragStart(point);
                            setOriginalElements(
                                dragSelectionElements.map((el) => ({ ...el })),
                            );
                        } else {
                            // Otherwise, select only the clicked element and start dragging it
                            setSelectedIds(clickedIds);
                            if (dragClickedElements.length === 0) {
                                return;
                            }
                            onStartTransform?.();
                            setIsDragging(true);
                            setDragStart(point);
                            setOriginalElements(
                                dragClickedElements.map((el) => ({ ...el })),
                            );
                        }
                    }
                } else {
                    // Start box selection
                    setSelectedIds([]);
                    setIsBoxSelecting(true);
                    setSelectionBox({
                        x: point.x,
                        y: point.y,
                        width: 0,
                        height: 0,
                    });
                }
                return;
            }

            if (tool === "text") {
                // Check if we clicked on an existing text element to edit it
                // Don't allow editing text elements that are selected by remote users
                if (
                    clickedElement &&
                    clickedElement.type === "text" &&
                    !isRemotelySelected
                ) {
                    const editFontSize =
                        clickedElement.fontSize ??
                        clickedElement.strokeWidth * 4 + 12;
                    const editLineHeight = clickedElement.lineHeight ?? 1.4;
                    const padding = 8;
                    const minHeight =
                        editFontSize * editLineHeight + padding * 2 + 4 / zoom;

                    // Enter edit mode for the existing text element
                    setTextInput({
                        x: clickedElement.x ?? 0,
                        y: clickedElement.isTextBox
                            ? (clickedElement.y ?? 0)
                            : (clickedElement.y ?? 0) + editFontSize * 0.82,
                        width: clickedElement.width,
                        height: Math.max(clickedElement.height ?? 0, minHeight),
                        isTextBox: true,
                    });
                    setTextValue(clickedElement.text ?? "");
                    setEditingTextElementId(clickedElement.id);
                    setEditingTextStyle({
                        strokeColor: clickedElement.strokeColor,
                        strokeWidth: clickedElement.strokeWidth,
                        opacity: clickedElement.opacity ?? 100,
                        fontFamily:
                            clickedElement.fontFamily || "var(--font-inter)",
                        textAlign: clickedElement.textAlign || "left",
                        fontSize: clickedElement.fontSize ?? editFontSize,
                        letterSpacing: clickedElement.letterSpacing ?? 0,
                        lineHeight: clickedElement.lineHeight ?? editLineHeight,
                    });
                    setSelectedIds([clickedElement.id]);
                    setTimeout(() => textInputRef.current?.focus(), 10);
                    return;
                }

                // Start tracking if user drags to create a text box (click does nothing)
                setEditingTextElementId(null);
                setEditingTextStyle(null);
                setStartPoint(point);
                setIsDrawing(true);
                return;
            }

            if (tool === "eraser") {
                setIsDrawing(true);
                // Start eraser trail animation
                if (eraserTrailRef.current) {
                    eraserTrailRef.current.startPath(point.x, point.y);
                }
                // Mark elements at initial point for deletion preview
                const elementsToMark = getElementsToErase(point);
                if (elementsToMark.length > 0) {
                    setEraserMarkedIds(new Set(elementsToMark));
                }
                return;
            }

            if (tool === "laser") {
                const newElement: BoardElement = {
                    id: uuid(),
                    type: "laser",
                    points: [point],
                    strokeColor: "#ef4444", // Force red color for laser
                    strokeWidth,
                    timestamp: Date.now(),
                    opacity,
                    strokeStyle,
                    lineCap,
                };
                setCurrentElement(newElement);
                setIsDrawing(true);
                return;
            }

            if (tool === "tile") {
                // Place a tile at the click position
                const tileType = selectedTileType || "tile-text";
                const { width: tileWidth, height: tileHeight } =
                    getDefaultTileSize(tileType);

                // Set initial tile content based on tile type
                const initialTileContent: BoardElement["tileContent"] = {};
                if (tileType === "tile-note") {
                    initialTileContent.noteStyle = selectedNoteStyle;
                    // Set default color based on style - natural-tan for torn, butter for classic
                    initialTileContent.noteColor = selectedNoteStyle === "torn" ? "natural-tan" : "butter";
                }

                const newTile: BoardElement = {
                    id: uuid(),
                    type: "tile",
                    points: [], // Tiles don't use points
                    strokeColor: "#000000", // Default, not really used for tiles
                    strokeWidth: 2,
                    x: point.x - tileWidth / 2, // Center on click
                    y: point.y - tileHeight / 2,
                    width: tileWidth,
                    height: tileHeight,
                    tileType: tileType,
                    tileTitle: "Untitled",
                    tileContent: initialTileContent,
                    opacity: 100,
                };

                // Add the tile immediately (no drawing motion needed)
                onAddElement(newTile);
                setSelectedIds([newTile.id]);

                // Switch to select tool after placing tile (unless tool is locked)
                if (!isToolLocked && onToolChange) {
                    onToolChange("select");
                }

                // Don't set isDrawing - tiles are placed with a single click
                return;
            }

            const elementType: BoardElement["type"] =
                tool === "arrow"
                    ? "arrow"
                    : tool === "highlighter"
                      ? "pen"
                      : tool === "frame"
                        ? "frame"
                        : (tool as
                              | "pen"
                              | "line"
                              | "rectangle"
                              | "diamond"
                              | "ellipse"
                              | "text");

            // For line/arrow, check if start point snaps to a shape
            let startSnapResult = null;
            if (elementType === "line" || elementType === "arrow") {
                const snapDistance = 20 / zoom;
                startSnapResult = findNearestSnapTarget(
                    point,
                    currentElements,
                    null, // no element to exclude yet
                    snapDistance,
                    connectorStyle,
                    undefined, // no other endpoint yet
                );
                if (startSnapResult) {
                    setStartSnapTarget({
                        elementId: startSnapResult.elementId,
                        point: startSnapResult.snapPoint.point,
                        position: startSnapResult.snapPoint.position,
                    });
                } else {
                    setStartSnapTarget(null);
                }
            }

            const isHighlighter = tool === "highlighter";
            const newElement: BoardElement = {
                id: uuid(),
                type: elementType,
                points: [
                    startSnapResult ? startSnapResult.snapPoint.point : point,
                ],
                strokeColor,
                strokeWidth: tool === "frame" ? 2 : strokeWidth,
                opacity,
                strokeStyle:
                    tool === "frame"
                        ? "solid"
                        : isHighlighter
                          ? "solid"
                          : strokeStyle,
                lineCap,
                cornerRadius,
                ...(elementType === "line" || elementType === "arrow"
                    ? { connectorStyle }
                    : {}),
                ...(elementType === "arrow" ? { arrowStart, arrowEnd } : {}),
            };
            if (tool === "frame") {
                newElement.strokeColor = "#94a3b8";
                newElement.fillColor = "transparent";
                newElement.label = "Frame";
                newElement.frameStyle = frameStyle ?? "minimal";
            }

            if (tool === "pen") {
                newElement.fillPattern = fillPattern;
                if (fillPattern === "solid") {
                    // Default fill color to stroke color if not set or transparent
                    newElement.fillColor =
                        fillColor && fillColor !== "transparent"
                            ? fillColor
                            : strokeColor;
                }
            } else if (isHighlighter) {
                newElement.penMode = "highlighter";
                newElement.fillPattern = fillPattern;
                if (fillPattern === "solid") {
                    // Default fill color to stroke color if not set or transparent
                    newElement.fillColor =
                        fillColor && fillColor !== "transparent"
                            ? fillColor
                            : strokeColor;
                }
            }

            if (
                tool === "rectangle" ||
                tool === "diamond" ||
                tool === "ellipse" ||
                tool === "frame"
            ) {
                newElement.x = point.x;
                newElement.y = point.y;
                newElement.width = 0;
                newElement.height = 0;
                newElement.fillColor = fillColor;
            }

            setCurrentElement(newElement);
            setIsDrawing(true);
        },
        [
            tool,
            isReadOnly,
            strokeColor,
            strokeWidth,
            fillColor,
            opacity,
            strokeStyle,
            lineCap,
            connectorStyle,
            arrowStart,
            arrowEnd,
            cornerRadius,
            fillPattern,
            frameStyle,
            getMousePosition,
            elementsRef,
            pan,
            zoom,
            selectedBounds,
            selectedElements,
            selectedIds,
            shiftPressed,
            rotateHandleSide,
            onStartTransform,
            getElementsToErase,
            onDeleteElement,
            remotelySelectedIds,
            setIsLassoSelecting,
            setLassoPoints,
            setEditingFrameLabelId,
            setFrameLabelValue,
        ],
    );

    const handleMouseUp = useCallback(() => {
        if (isReadOnly && !isPanning) return;
        if (isPanning) {
            setIsPanning(false);
            return;
        }
        const currentElements = elementsRef.current;

        // Handle eraser - delete marked elements on mouse release
        if (tool === "eraser" && isDrawing) {
            // End eraser trail animation
            if (eraserTrailRef.current) {
                eraserTrailRef.current.endPath();
            }
            if (eraserMarkedIds.size > 0) {
                const idsToDelete = Array.from(eraserMarkedIds);
                if (onDeleteMultiple) {
                    onDeleteMultiple(idsToDelete);
                } else {
                    idsToDelete.forEach((id) => onDeleteElement(id));
                }
            }
            setEraserMarkedIds(new Set());
            setIsDrawing(false);
            return;
        }

        if (isLassoSelecting) {
            if (lassoPoints.length >= 3) {
                const lassoSelected = getLassoSelectedIds(
                    currentElements,
                    lassoPoints,
                ).filter((id) => !remotelySelectedIds.has(id));
                setSelectedIds(lassoSelected);
            }
            setIsLassoSelecting(false);
            setLassoPoints([]);
            onToolChange?.("select");
            return;
        }

        // Finish box selection
        if (isBoxSelecting && selectionBox) {
            // Only perform box selection if the box has a minimum size (5px)
            // This prevents accidental selections from single clicks
            const minBoxSize = 5;
            if (
                selectionBox.width >= minBoxSize ||
                selectionBox.height >= minBoxSize
            ) {
                // Filter out remotely selected elements from box selection
                const boxSelected = getBoxSelectedIds(
                    currentElements,
                    selectionBox,
                ).filter((id) => !remotelySelectedIds.has(id));
                setSelectedIds(boxSelected);
            }
            setIsBoxSelecting(false);
            setSelectionBox(null);
            return;
        }

        if (draggingConnectorPoint) {
            // Handle sharp mode with out-of-sight snap - finalize to elbow mode
            // This matches the behavior during arrow creation where the elbow is only
            // applied on mouse up, not during the drag preview
            if (
                originalElements.length === 1 &&
                snapTarget?.outOfLineOfSight &&
                connectorStyle === "sharp"
            ) {
                const orig = originalElements[0];
                if (orig.type === "line" || orig.type === "arrow") {
                    const index = draggingConnectorPoint.index;
                    const isEndpoint =
                        index === 0 || index === orig.points.length - 1;

                    if (isEndpoint) {
                        const otherEndpointIndex =
                            index === 0 ? orig.points.length - 1 : 0;
                        const otherEndpoint = orig.points[otherEndpointIndex];

                        // Get existing connection on the other end
                        const otherConnection =
                            index === 0
                                ? orig.endConnection?.elementId
                                : orig.startConnection?.elementId;

                        const routedPoints = generateElbowRouteAroundObstacles(
                            otherEndpoint,
                            snapTarget.point,
                            currentElements,
                            orig.id,
                            snapTarget.elementId,
                            otherConnection ?? null,
                        );

                        // Reverse if dragging start point
                        const finalPoints =
                            index === 0 ? routedPoints.reverse() : routedPoints;

                        // Build connection update
                        const connectionUpdate: Partial<BoardElement> = {
                            points: finalPoints,
                            connectorStyle: "elbow",
                            elbowRoute: undefined,
                        };

                        // Update connection info based on which endpoint was dragged
                        if (index === 0) {
                            connectionUpdate.startConnection = {
                                elementId: snapTarget.elementId,
                                position: snapTarget.position,
                            };
                        } else {
                            connectionUpdate.endConnection = {
                                elementId: snapTarget.elementId,
                                position: snapTarget.position,
                            };
                        }

                        onUpdateElement(orig.id, connectionUpdate);

                        setDraggingConnectorPoint(null);
                        setOriginalElements([]);
                        setSnapTarget(null);
                        return;
                    }
                }
            }

            // Update connection info when dropping on a snap target (for non-out-of-sight snaps)
            // or clear connection when not snapped
            if (originalElements.length === 1) {
                const orig = originalElements[0];
                if (orig.type === "line" || orig.type === "arrow") {
                    const index = draggingConnectorPoint.index;
                    const isEndpoint =
                        index === 0 || index === orig.points.length - 1;

                    if (isEndpoint) {
                        // Update connection info based on which endpoint was dragged
                        const connectionUpdate: Partial<BoardElement> = {};
                        if (index === 0) {
                            if (snapTarget) {
                                connectionUpdate.startConnection = {
                                    elementId: snapTarget.elementId,
                                    position: snapTarget.position,
                                };
                            } else {
                                // Clear connection when not snapped
                                connectionUpdate.startConnection = undefined;
                            }
                        } else {
                            if (snapTarget) {
                                connectionUpdate.endConnection = {
                                    elementId: snapTarget.elementId,
                                    position: snapTarget.position,
                                };
                            } else {
                                // Clear connection when not snapped
                                connectionUpdate.endConnection = undefined;
                            }
                        }
                        onUpdateElement(orig.id, connectionUpdate);
                    }
                }
            }

            // Cleanup elbow polylines after edge drags so temporary points don't "stick" until the next drag.
            if (originalElements.length === 1) {
                const orig = originalElements[0];
                if (
                    (orig.type === "line" || orig.type === "arrow") &&
                    (orig.connectorStyle ?? connectorStyle) === "elbow"
                ) {
                    const current = currentElements.find(
                        (el) => el.id === orig.id,
                    );
                    if (current?.points && current.points.length >= 2) {
                        const eps = 0.5 / zoom;
                        const hasDiagonal = current.points.some((p, i) => {
                            const prev = current.points[i - 1];
                            if (!prev) return false;
                            return (
                                Math.abs(p.x - prev.x) > eps &&
                                Math.abs(p.y - prev.y) > eps
                            );
                        });
                        if (!hasDiagonal) {
                            const simplified = simplifyElbowPolyline(
                                current.points,
                                eps,
                            );
                            if (simplified.length !== current.points.length) {
                                onUpdateElement(current.id, {
                                    points: simplified,
                                    elbowRoute: undefined,
                                    connectorStyle: "elbow",
                                });
                            }
                        }
                    }
                }
            }
            setDraggingConnectorPoint(null);
            setOriginalElements([]);
            setSnapTarget(null);
            return;
        }

        if (isRotating) {
            setIsRotating(false);
            setRotateStart(null);
            return;
        }

        if (isDragging) {
            setIsDragging(false);
            setHasDragMoved(false);
            setDragStart(null);
            setOriginalElements([]);
            return;
        }

        if (isResizing) {
            setIsResizing(false);
            setResizeHandle(null);
            setDragStart(null);
            setOriginalElements([]);
            setOriginalBounds(null);
            return;
        }

        // Handle text tool - determine if it was a click or drag
        if (tool === "text" && isDrawing && startPoint) {
            const currentPoint = lastMousePos;
            const dragDistance = Math.hypot(
                currentPoint.x - startPoint.x,
                currentPoint.y - startPoint.y,
            );

            // Only create text on a drag; a click does nothing.
            if (dragDistance >= 5) {
                const width = Math.abs(currentPoint.x - startPoint.x);
                const x = Math.min(startPoint.x, currentPoint.x);
                const y = Math.min(startPoint.y, currentPoint.y);

                const minHeight = fontSize * lineHeight;

                setTextInput({
                    x,
                    y,
                    width,
                    height: minHeight,
                    isTextBox: true,
                });
                setTextValue("");
                setTimeout(() => textInputRef.current?.focus(), 10);
            }
            setIsDrawing(false);
            setStartPoint(null);
            return;
        }

        if (currentElement && isDrawing) {
            let elementAdded = false;

            if (
                currentElement.type === "pen" &&
                currentElement.points.length >= 1
            ) {
                // Check if shape is closed
                const isClosed = isClosedShape(currentElement.points);
                const endpointsInArea = areEndpointsNear(currentElement.points);
                const isHighlighter = currentElement.penMode === "highlighter";

                // Only fill if closed AND fill is enabled (same for pen and highlighter)
                const shouldFill =
                    isClosed &&
                    endpointsInArea &&
                    currentElement.fillPattern === "solid";
                const finalElement: BoardElement = {
                    ...currentElement,
                    isClosed,
                    fillPattern: shouldFill ? "solid" : "none",
                    // Use existing fillColor (which defaults to strokeColor) or fallback to strokeColor
                    fillColor: shouldFill
                        ? currentElement.fillColor || currentElement.strokeColor
                        : undefined,
                };

                onAddElement(finalElement);
                // Clear selection for pen/highlighter - don't select after creation
                setSelectedIds([]);
                elementAdded = true;
            } else if (
                (currentElement.type === "line" ||
                    currentElement.type === "arrow") &&
                currentElement.points.length >= 2
            ) {
                // Build connection info from snap targets
                const finalArrowElement: BoardElement = { ...currentElement };

                // Add start connection if we snapped to a shape at the start
                if (startSnapTarget) {
                    finalArrowElement.startConnection = {
                        elementId: startSnapTarget.elementId,
                        position: startSnapTarget.position,
                    };
                }

                // Add end connection if we're currently snapped to a shape
                if (snapTarget) {
                    finalArrowElement.endConnection = {
                        elementId: snapTarget.elementId,
                        position: snapTarget.position,
                    };
                }

                onAddElement(finalArrowElement);
                elementAdded = true;

                // Clear the start snap target
                setStartSnapTarget(null);
            } else if (
                currentElement.type === "laser" &&
                currentElement.points.length > 1
            ) {
                // Add laser element; fade-out is computed client-side based on timestamp.
                onAddElement({ ...currentElement, timestamp: Date.now() });
                // Don't switch tool for laser
            } else if (
                (currentElement.type === "rectangle" ||
                    currentElement.type === "diamond" ||
                    currentElement.type === "ellipse" ||
                    currentElement.type === "frame") &&
                currentElement.width &&
                currentElement.height &&
                currentElement.width > 2 &&
                currentElement.height > 2
            ) {
                onAddElement(currentElement);
                elementAdded = true;
            }

            if (elementAdded) {
                // Don't select pen/highlighter elements after creation - keep tool ready for next stroke
                if (currentElement.type !== "pen") {
                    setSelectedIds([currentElement.id]);
                }
            }

            // Switch back to select tool (except for pen/highlighter)
            // Only auto-switch if tool is not locked
            if (
                elementAdded &&
                currentElement.type !== "pen" &&
                !isToolLocked
            ) {
                if (onToolChange) {
                    onToolChange("select");
                }
            }
        }

        setIsDrawing(false);
        setCurrentElement(null);
        setStartPoint(null);
        setSnapTarget(null);
    }, [
        currentElement,
        isDrawing,
        onAddElement,
        isReadOnly,
        isPanning,
        isDragging,
        isResizing,
        isRotating,
        isBoxSelecting,
        selectionBox,
        elementsRef,
        tool,
        onDeleteElement,
        onDeleteMultiple,
        onUpdateElement,
        onToolChange,
        lastMousePos,
        startPoint,
        textInputRef,
        setTextInput,
        setTextValue,
        setIsDrawing,
        setStartPoint,
        setSelectedIds,
        setSnapTarget,
        setStartSnapTarget,
        startSnapTarget,
        snapTarget,
        isLassoSelecting,
        lassoPoints,
        setIsLassoSelecting,
        setLassoPoints,
        draggingConnectorPoint,
        eraserMarkedIds,
        zoom,
        connectorStyle,
        originalElements,
        remotelySelectedIds,
        fontSize,
        lineHeight,
        isToolLocked,
    ]);

    const handleMouseLeave = useCallback(() => {
        // Clear eraser cursor when mouse leaves canvas
        setEraserCursorPos(null);
        // Clear laser cursor when mouse leaves canvas
        setLaserCursorPos(null);
        setHoverCursor(null);
        // Note: We intentionally do NOT clear the cursor position broadcast here
        // so that other users can still see where our cursor was last positioned
        // Also handle mouse up logic
        handleMouseUp();
    }, [handleMouseUp, setEraserCursorPos, setLaserCursorPos, setHoverCursor]);

    const handleTextSubmit = useCallback(() => {
        if (textInput && textValue.trim()) {
            // Always create a text box (single-line by default, expands on Enter).
            const activeStrokeColor =
                editingTextStyle?.strokeColor ?? strokeColor;
            const activeStrokeWidth =
                editingTextStyle?.strokeWidth ?? strokeWidth;
            const activeOpacity = editingTextStyle?.opacity ?? opacity;
            const activeFontFamily = editingTextStyle?.fontFamily ?? fontFamily;
            const activeTextAlign = editingTextStyle?.textAlign ?? textAlign;
            const activeFontSize = editingTextStyle?.fontSize ?? fontSize;
            const activeLetterSpacing =
                editingTextStyle?.letterSpacing ?? letterSpacing;
            const activeLineHeight = editingTextStyle?.lineHeight ?? lineHeight;

            const nextElementId = editingTextElementId ?? uuid();
            const measuredWidth = textInputRef.current
                ? textInputRef.current.offsetWidth
                : undefined;
            const measuredHeight = textInputRef.current
                ? measureWrappedTextHeightPx({
                      text: textValue,
                      width: measuredWidth ?? textInput.width ?? 200,
                      fontSize: activeFontSize,
                      lineHeight: activeLineHeight,
                      fontFamily: activeFontFamily,
                      letterSpacing: activeLetterSpacing,
                      textAlign: activeTextAlign,
                  })
                : undefined;
            const nextElement: BoardElement = {
                id: nextElementId,
                type: "text",
                points: [],
                strokeColor: activeStrokeColor,
                strokeWidth: activeStrokeWidth,
                text: textValue,
                x: textInput.x,
                y: textInput.y,
                width: measuredWidth ?? textInput.width ?? 200,
                height:
                    measuredHeight ??
                    textInput.height ??
                    activeFontSize * activeLineHeight,
                isTextBox: true,
                scaleX: 1,
                scaleY: 1,
                opacity: activeOpacity,
                fontFamily: activeFontFamily,
                textAlign: activeTextAlign,
                fontSize: activeFontSize,
                letterSpacing: activeLetterSpacing,
                lineHeight: activeLineHeight,
            };

            if (editingTextElementId) {
                const { id: _ignoredId, ...updates } = nextElement;
                onUpdateElement(editingTextElementId, updates);
            } else {
                onAddElement(nextElement);
            }

            setSelectedIds([nextElementId]);
            if (onToolChange && !isToolLocked) {
                onToolChange("select");
            }
        }
        setTextInput(null);
        setTextValue("");
        setEditingTextElementId(null);
        setEditingTextStyle(null);
    }, [
        editingTextElementId,
        editingTextStyle,
        textInput,
        textValue,
        strokeColor,
        strokeWidth,
        opacity,
        fontFamily,
        textAlign,
        fontSize,
        letterSpacing,
        lineHeight,
        onAddElement,
        onUpdateElement,
        onToolChange,
        setSelectedIds,
        textInputRef,
        zoom,
        isToolLocked,
    ]);

    const handleTextChange = useCallback(
        (value: string) => {
            setTextValue(value);

            // Clear existing timeout
            if (textSaveTimeoutRef.current) {
                clearTimeout(textSaveTimeoutRef.current);
            }

            // Auto-save after 2 seconds of no typing (optional, can be removed if unwanted)
            // textSaveTimeoutRef.current = setTimeout(() => {
            //   if (textInput && value.trim()) {
            //     handleTextSubmit();
            //   }
            // }, 2000);
        },
        [setTextValue, textSaveTimeoutRef],
    );

    // Global mouse event listeners for drag operations
    // This ensures dragging continues even when the mouse leaves the canvas
    useEffect(() => {
        const isAnyDragActive =
            isDragging ||
            isResizing ||
            isRotating ||
            draggingConnectorPoint !== null ||
            isPanning ||
            isDrawing ||
            isBoxSelecting;

        if (!isAnyDragActive) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            // Prevent default to avoid any unwanted browser behavior
            e.preventDefault();

            const svg = svgRef.current;
            if (!svg) return;

            const rect = svg.getBoundingClientRect();
            const point: Point = {
                x: (e.clientX - rect.left - pan.x) / zoom,
                y: (e.clientY - rect.top - pan.y) / zoom,
            };

            // Create a synthetic React mouse event-like object
            const syntheticEvent = {
                clientX: e.clientX,
                clientY: e.clientY,
                shiftKey: e.shiftKey,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                altKey: e.altKey,
                button: e.button,
                buttons: e.buttons,
                preventDefault: () => {},
                stopPropagation: () => {},
            } as ReactMouseEvent;

            handleMouseMove(syntheticEvent);
        };

        const handleGlobalMouseUp = (e: MouseEvent) => {
            e.preventDefault();
            handleMouseUp();
        };

        // Use window instead of document to capture events even outside the window
        // when the mouse re-enters
        window.addEventListener("mousemove", handleGlobalMouseMove, {
            capture: true,
        });
        window.addEventListener("mouseup", handleGlobalMouseUp, {
            capture: true,
        });

        // Also handle mouseenter to resume tracking when mouse re-enters window
        window.addEventListener("mouseenter", handleGlobalMouseMove, {
            capture: true,
        });

        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove, {
                capture: true,
            });
            window.removeEventListener("mouseup", handleGlobalMouseUp, {
                capture: true,
            });
            window.removeEventListener("mouseenter", handleGlobalMouseMove, {
                capture: true,
            });
        };
    }, [
        isDragging,
        isResizing,
        isRotating,
        draggingConnectorPoint,
        isPanning,
        isDrawing,
        isBoxSelecting,
        handleMouseMove,
        handleMouseUp,
        svgRef,
        pan,
        zoom,
    ]);

    return {
        getMousePosition,
        handleMouseMove,
        handleMouseDown,
        handleMouseUp,
        handleMouseLeave,
        handleTextSubmit,
        handleTextChange,
    };
}
