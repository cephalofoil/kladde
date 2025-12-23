"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { v4 as uuid } from "uuid";
import getStroke from "perfect-freehand";
import type { Tool, BoardElement, Point } from "@/lib/board-types";
import { isClosedShape } from "@/lib/board-types";
import { CollaborationManager } from "@/lib/collaboration";
import { CollaboratorCursors } from "./collaborator-cursor";
import { EraserTrail } from "@/lib/eraser-trail";
import type {
    ResizeHandle,
    RotateHandleSide,
    ConnectorDragKind,
    BoundingBox,
} from "./canvas/types";
import {
    degToRad,
    radToDeg,
    normalizeAngleDeg,
    rotatePoint,
    rotateVector,
    getBoundsCenter,
    expandBounds,
    isBoundsFullyInsideBox,
    getHandlePointFromBounds,
    getHandleLocalOffset,
    getOppositeResizeHandle,
    getWorldResizeHandle,
    getResizeCursor,
    getHandleDirection,
    getRotatedResizeCursor,
    getResizeHandleFromSelectionEdge,
    chooseRotateHandleSide,
    getContrastingTextColor,
} from "./canvas/geometry";
import {
    measureTextWidthPx,
    getTextFontString,
    getMinSingleCharWidth,
    measureWrappedTextHeightPx,
    wrapText,
    wrapTextBreakWord,
    wrapTextBreakWordMeasured,
} from "./canvas/text-utils";
import {
    getSvgPathFromStroke,
    getArrowHeadPoints,
    getMarkerBasis,
} from "./canvas/drawing";
import {
    getQuadraticBezierBounds,
    getCubicBezierPoint,
    getCatmullRomControlPoints,
    getCatmullRomPath,
    getCatmullRomBounds,
    getElbowPolylineForVertices,
    simplifyElbowPolyline,
} from "./canvas/curves";
import {
    getBoundingBox,
    getCombinedBounds,
    getGroupSelectionIds,
    getBoxSelectedIds,
} from "./canvas/shapes";

interface RemoteSelection {
    userId: string;
    userName: string;
    userColor: string;
    elementIds: string[];
}

interface RemoteCursor {
    id: string;
    name: string;
    color: string;
    x: number;
    y: number;
    lastActivity: number;
}

interface CanvasProps {
    tool: Tool;
    strokeColor: string;
    strokeWidth: number;
    fillColor?: string;
    opacity?: number;
    strokeStyle?: "solid" | "dashed" | "dotted";
    lineCap?: "butt" | "round";
    connectorStyle?: "sharp" | "curved" | "elbow";
    arrowStart?: NonNullable<BoardElement["arrowStart"]>;
    arrowEnd?: NonNullable<BoardElement["arrowEnd"]>;
    cornerRadius?: number;
    fontFamily?: string;
    textAlign?: "left" | "center" | "right";
    fontSize?: number;
    letterSpacing?: number;
    lineHeight?: number;
    fillPattern?: "none" | "solid" | "criss-cross";
    collaboration: CollaborationManager | null;
    elements: BoardElement[];
    onAddElement: (element: BoardElement) => void;
    onUpdateElement: (id: string, updates: Partial<BoardElement>) => void;
    onDeleteElement: (id: string) => void;
    onStartTransform?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onToolChange?: (tool: Tool) => void;
    onSetViewport?: (
        setter: (pan: { x: number; y: number }, zoom: number) => void,
    ) => void;
    onManualViewportChange?: () => void;
    onSelectionChange?: (elements: BoardElement[]) => void;
    onStrokeColorChange?: (color: string) => void;
    onFillColorChange?: (color: string) => void;
    canvasBackground?: "none" | "dots" | "lines" | "grid";
    highlightedElementIds?: string[];
    isToolLocked?: boolean;
    isEditArrowMode?: boolean;
    remoteSelections?: RemoteSelection[];
    isReadOnly?: boolean;
    showRemoteCursors?: boolean;
    showUndoRedo?: boolean;
}

export function Canvas({
    tool,
    strokeColor,
    strokeWidth,
    fillColor = "transparent",
    opacity = 100,
    strokeStyle = "solid",
    lineCap = "round",
    connectorStyle = "sharp",
    arrowStart = "arrow",
    arrowEnd = "arrow",
    cornerRadius = 0,
    fontFamily = "var(--font-inter)",
    textAlign = "left",
    fontSize = 24,
    letterSpacing = 0,
    lineHeight = 1.5,
    fillPattern = "none",
    collaboration,
    elements,
    onAddElement,
    onUpdateElement,
    onDeleteElement,
    onStartTransform,
    onUndo,
    onRedo,
    onToolChange,
    onSetViewport,
    onManualViewportChange,
    onSelectionChange,
    onStrokeColorChange,
    onFillColorChange,
    canvasBackground = "none",
    highlightedElementIds = [],
    isToolLocked = false,
    isEditArrowMode = false,
    remoteSelections = [],
    isReadOnly = false,
    showRemoteCursors = true,
    showUndoRedo = true,
}: CanvasProps) {
    const TEXT_CLIP_BUFFER_PX = 2;
    const LASER_HOLD_DURATION_MS = 3000;
    const LASER_FADE_DURATION_MS = 800;
    const LASER_TTL_MS = LASER_HOLD_DURATION_MS + LASER_FADE_DURATION_MS + 250;

    // Compute a set of element IDs that are selected by remote users (locked for editing)
    const remotelySelectedIds = useMemo(() => {
        const ids = new Set<string>();
        remoteSelections.forEach((sel) => {
            sel.elementIds.forEach((id) => ids.add(id));
        });
        return ids;
    }, [remoteSelections]);

    // Create a map from element ID to the remote user who selected it
    const remoteSelectionByElementId = useMemo(() => {
        const map = new Map<string, { userName: string; userColor: string }>();
        remoteSelections.forEach((sel) => {
            sel.elementIds.forEach((id) => {
                // First user to select wins (shouldn't happen in practice)
                if (!map.has(id)) {
                    map.set(id, {
                        userName: sel.userName,
                        userColor: sel.userColor,
                    });
                }
            });
        });
        return map;
    }, [remoteSelections]);

    const nameTagWidthCacheRef = useRef<Map<string, number>>(new Map());
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const eraserTrailPathRef = useRef<SVGPathElement>(null);
    const eraserTrailRef = useRef<EraserTrail | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentElement, setCurrentElement] = useState<BoardElement | null>(
        null,
    );
    const [startPoint, setStartPoint] = useState<Point | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
    const [remoteDrawingElements, setRemoteDrawingElements] = useState<
        Array<{ id: string; color: string; element: BoardElement }>
    >([]);
    const remotelyEditingTextIds = useMemo(() => {
        const ids = new Set<string>();
        remoteDrawingElements.forEach(({ element }) => {
            if (element.type === "text") ids.add(element.id);
        });
        return ids;
    }, [remoteDrawingElements]);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [textInput, setTextInput] = useState<{
        x: number;
        y: number;
        width?: number;
        height?: number;
        isTextBox?: boolean;
    } | null>(null);
    const [textValue, setTextValue] = useState("");
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const textEditorWrapperRef = useRef<HTMLDivElement>(null);
    const textEditorMirrorRef = useRef<HTMLDivElement>(null);
    const textEditorCaretRef = useRef<HTMLDivElement>(null);
    const caretUpdateRafRef = useRef<number | null>(null);
    const [editingTextElementId, setEditingTextElementId] = useState<
        string | null
    >(null);
    const [editingTextStyle, setEditingTextStyle] = useState<{
        strokeColor: string;
        strokeWidth: number;
        opacity: number;
        fontFamily: string;
        textAlign: "left" | "center" | "right";
        fontSize: number;
        letterSpacing: number;
        lineHeight: number;
    } | null>(null);
    const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 });

    // Eraser preview state
    const [eraserMarkedIds, setEraserMarkedIds] = useState<Set<string>>(
        new Set(),
    );
    const [eraserCursorPos, setEraserCursorPos] = useState<Point | null>(null);

    // Laser pointer cursor state
    const [laserCursorPos, setLaserCursorPos] = useState<Point | null>(null);
    const expiredLaserIdsRef = useRef<Set<string>>(new Set());
    const elementsRef = useRef(elements);
    const pendingCursorPosRef = useRef<Point | null>(null);
    const cursorBroadcastRafRef = useRef<number | null>(null);
    const pendingDrawingElementRef = useRef<BoardElement | null>(null);
    const drawingElementBroadcastRafRef = useRef<number | null>(null);

    // Move and resize state
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
    const [dragStart, setDragStart] = useState<Point | null>(null);
    const [originalElements, setOriginalElements] = useState<BoardElement[]>(
        [],
    );
    const [originalBounds, setOriginalBounds] = useState<BoundingBox | null>(
        null,
    );

    // Rotate state (single selection only)
    const [isRotating, setIsRotating] = useState(false);
    const [rotateStart, setRotateStart] = useState<{
        elementId: string;
        center: Point;
        startPointerAngleRad: number;
        startRotationDeg: number;
    } | null>(null);
    const [rotateHandleSide, setRotateHandleSide] =
        useState<RotateHandleSide>("n");
    const lastSingleSelectedIdRef = useRef<string | null>(null);
    const [hoverCursor, setHoverCursor] = useState<string | null>(null);
    const lastEnforcedTextHeightsRef = useRef<Map<string, number>>(new Map());

    const [draggingConnectorPoint, setDraggingConnectorPoint] = useState<{
        index: number;
        kind: ConnectorDragKind;
        axis?: "x" | "y";
        indices?: [number, number];
        range?: [number, number];
        edgeKey?: string;
        anchor?: Point;
    } | null>(null);

    // Box selection state
    const [isBoxSelecting, setIsBoxSelecting] = useState(false);
    const [selectionBox, setSelectionBox] = useState<BoundingBox | null>(null);
    const [inputHint, setInputHint] = useState<"mouse" | "trackpad">("mouse");

    // Shift key tracking
    const [shiftPressed, setShiftPressed] = useState(false);

    // Track shift key and other shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isReadOnly) return;
            if (e.key === "Shift") setShiftPressed(true);
            if (e.key === "Delete" && selectedIds.length > 0) {
                selectedIds.forEach((id) => onDeleteElement(id));
                setSelectedIds([]);
            }
            if (e.key === "Escape") {
                setSelectedIds([]);
                setTextInput(null);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Shift") setShiftPressed(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [selectedIds, onDeleteElement, isReadOnly]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const platform = navigator.platform || "";
        const userAgent = navigator.userAgent || "";
        const isMacLike =
            /Mac|iPhone|iPad|iPod/.test(platform) ||
            /Mac|iPhone|iPad|iPod/.test(userAgent);
        const hasTouch = navigator.maxTouchPoints > 0;
        setInputHint(isMacLike || hasTouch ? "trackpad" : "mouse");
    }, []);

    // Wheel zoom handler with native event listener to prevent browser zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            // Prevent browser back/forward navigation on horizontal scroll
            if (Math.abs(e.deltaX) > 0) {
                e.preventDefault();
            }

            if (e.ctrlKey || e.metaKey) {
                // Zoom with Ctrl/Cmd + Scroll
                e.preventDefault();

                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const delta = e.deltaY > 0 ? 0.9 : 1.1;

                setZoom((prevZoom) => {
                    const newZoom = Math.max(
                        0.1,
                        Math.min(5, prevZoom * delta),
                    );

                    // Calculate world position under cursor before zoom
                    const worldX = (mouseX - pan.x) / prevZoom;
                    const worldY = (mouseY - pan.y) / prevZoom;

                    // Adjust pan so the same world position stays under cursor
                    setPan({
                        x: mouseX - worldX * newZoom,
                        y: mouseY - worldY * newZoom,
                    });

                    return newZoom;
                });
                // User manually zoomed - stop following
                onManualViewportChange?.();
            } else if (
                !e.ctrlKey &&
                !e.metaKey &&
                (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0)
            ) {
                // Two-finger trackpad pan (no modifier keys)
                e.preventDefault();
                setPan((prev) => ({
                    x: prev.x - e.deltaX,
                    y: prev.y - e.deltaY,
                }));
                // User manually panned - stop following
                onManualViewportChange?.();
            }
        };

        container.addEventListener("wheel", handleWheel, { passive: false });
        return () => container.removeEventListener("wheel", handleWheel);
    }, [pan]);

    // Initialize eraser trail
    useEffect(() => {
        if (eraserTrailPathRef.current && !eraserTrailRef.current) {
            // Detect theme - check if dark mode is active
            const isDark = document.documentElement.classList.contains("dark");
            eraserTrailRef.current = new EraserTrail(
                eraserTrailPathRef.current,
                isDark ? "dark" : "light",
            );
        }

        // Update theme when it changes
        const observer = new MutationObserver(() => {
            if (eraserTrailRef.current) {
                const isDark =
                    document.documentElement.classList.contains("dark");
                eraserTrailRef.current.setTheme(isDark ? "dark" : "light");
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => {
            observer.disconnect();
            if (eraserTrailRef.current) {
                eraserTrailRef.current.clear();
            }
        };
    }, []);

    // Track remote cursors and drawing elements
    useEffect(() => {
        if (!collaboration) return;

        const unsubscribe = collaboration.onAwarenessChange((states) => {
            const myId = collaboration.getUserInfo().id;
            const now = Date.now();

            setRemoteCursors((prevCursors) => {
                const cursors: RemoteCursor[] = [];

                states.forEach((state) => {
                    if (
                        state.user &&
                        state.user.id !== myId &&
                        state.user.cursor
                    ) {
                        // Check if cursor position changed
                        const prevCursor = prevCursors.find(
                            (c) => c.id === state.user.id,
                        );
                        const positionChanged =
                            !prevCursor ||
                            prevCursor.x !== state.user.cursor.x ||
                            prevCursor.y !== state.user.cursor.y;

                        cursors.push({
                            id: state.user.id,
                            name: state.user.name,
                            color: state.user.color,
                            x: state.user.cursor.x,
                            y: state.user.cursor.y,
                            lastActivity: positionChanged
                                ? now
                                : (prevCursor?.lastActivity ?? now),
                        });
                    }
                });

                return cursors;
            });

            // Track remote drawing elements (in-progress drawings from other users)
            const drawingElements: Array<{
                id: string;
                color: string;
                element: BoardElement;
            }> = [];
            states.forEach((state) => {
                if (
                    state.user &&
                    state.user.id !== myId &&
                    state.user.drawingElement
                ) {
                    drawingElements.push({
                        id: state.user.id,
                        color: state.user.color,
                        element: state.user.drawingElement,
                    });
                }
            });
            setRemoteDrawingElements(drawingElements);
        });

        return unsubscribe;
    }, [collaboration]);

    // Broadcast current drawing element to other users
    useEffect(() => {
        if (!collaboration) return;

        // Prefer sending a live text draft while editing; otherwise send in-progress drawings.
        if (textInput) {
            const activeFontSize = editingTextStyle?.fontSize ?? fontSize;
            const activeLineHeight = editingTextStyle?.lineHeight ?? lineHeight;
            const draft: BoardElement = {
                id:
                    editingTextElementId ??
                    `text-draft-${collaboration.getUserInfo().id}`,
                type: "text",
                points: [],
                text: textValue,
                x: textInput.x,
                y: textInput.y,
                width: textInput.width ?? 200,
                height: textInput.height ?? activeFontSize * activeLineHeight,
                isTextBox: true,
                strokeColor: editingTextStyle?.strokeColor ?? strokeColor,
                strokeWidth: editingTextStyle?.strokeWidth ?? strokeWidth,
                opacity: editingTextStyle?.opacity ?? opacity,
                fontFamily: editingTextStyle?.fontFamily ?? fontFamily,
                textAlign: editingTextStyle?.textAlign ?? textAlign,
                fontSize: editingTextStyle?.fontSize ?? fontSize,
                letterSpacing: editingTextStyle?.letterSpacing ?? letterSpacing,
                lineHeight: editingTextStyle?.lineHeight ?? lineHeight,
                scaleX: 1,
                scaleY: 1,
            };
            pendingDrawingElementRef.current = draft;
            if (drawingElementBroadcastRafRef.current === null) {
                drawingElementBroadcastRafRef.current = requestAnimationFrame(
                    () => {
                        drawingElementBroadcastRafRef.current = null;
                        collaboration.updateDrawingElement(
                            pendingDrawingElementRef.current,
                        );
                    },
                );
            }
            return;
        }

        collaboration.updateDrawingElement(currentElement);
    }, [
        collaboration,
        currentElement,
        editingTextElementId,
        editingTextStyle,
        fontFamily,
        fontSize,
        letterSpacing,
        lineHeight,
        opacity,
        strokeColor,
        strokeWidth,
        textAlign,
        textInput,
        textValue,
    ]);

    // Broadcast viewport changes to other users
    useEffect(() => {
        if (!collaboration) return;
        collaboration.updateViewport(pan, zoom);
    }, [collaboration, pan, zoom]);

    // Periodically delete expired laser elements so they don't stick around if the creator disconnects mid-fade.
    useEffect(() => {
        const interval = window.setInterval(() => {
            const now = Date.now();
            elementsRef.current.forEach((el) => {
                if (el.type !== "laser") return;
                if (!el.timestamp) return;
                if (expiredLaserIdsRef.current.has(el.id)) return;
                if (now - el.timestamp < LASER_TTL_MS) return;

                expiredLaserIdsRef.current.add(el.id);
                onDeleteElement(el.id);
            });
        }, 2000);

        return () => window.clearInterval(interval);
    }, [LASER_TTL_MS, onDeleteElement]);

    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    useEffect(() => {
        return () => {
            if (cursorBroadcastRafRef.current !== null) {
                cancelAnimationFrame(cursorBroadcastRafRef.current);
            }
            if (drawingElementBroadcastRafRef.current !== null) {
                cancelAnimationFrame(drawingElementBroadcastRafRef.current);
            }
        };
    }, []);

    // Clear eraser marked IDs when tool changes
    useEffect(() => {
        if (tool !== "eraser") {
            setEraserMarkedIds(new Set());
            setEraserCursorPos(null);
            // Clear eraser trail when switching away from eraser
            if (eraserTrailRef.current) {
                eraserTrailRef.current.clear();
            }
        }
        if (tool !== "laser") {
            setLaserCursorPos(null);
        }
    }, [tool]);

    // Expose viewport setter to parent component
    useEffect(() => {
        if (onSetViewport) {
            onSetViewport((newPan, newZoom) => {
                setPan(newPan);
                setZoom(newZoom);
            });
        }
    }, [onSetViewport]);

    const getMousePosition = useCallback(
        (e: React.MouseEvent): Point => {
            const svg = svgRef.current;
            if (!svg) return { x: 0, y: 0 };

            const rect = svg.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left - pan.x) / zoom,
                y: (e.clientY - rect.top - pan.y) / zoom,
            };
        },
        [pan, zoom],
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

            elements.forEach((el) => {
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
        [elements, strokeWidth, remotelySelectedIds, zoom],
    );

    // Get selected elements and their combined bounds
    const selectedElements = selectedIds
        .map((id) => elements.find((el) => el.id === id))
        .filter(Boolean) as BoardElement[];
    const selectedBounds = getCombinedBounds(selectedIds, elements);

    // Decide which side gets the rotate handle at selection time (keeps stable while rotating).
    useEffect(() => {
        if (selectedIds.length === 1) {
            const id = selectedIds[0];
            if (lastSingleSelectedIdRef.current !== id) {
                lastSingleSelectedIdRef.current = id;
                const el = elements.find((e) => e.id === id);
                const rotationDeg = el?.rotation ?? 0;
                setRotateHandleSide(chooseRotateHandleSide(rotationDeg));
            }
            return;
        }

        lastSingleSelectedIdRef.current = null;
        setRotateHandleSide("n");
    }, [elements, selectedIds]);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (isReadOnly && !isPanning) return;

            const point = getMousePosition(e);
            setLastMousePos(point);

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
                        elements,
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

                onUpdateElement(rotateStart.elementId, {
                    rotation: nextRotationDeg,
                });
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
                const selectedElement = elements.find(
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
                            newPoints = [
                                pStart,
                                {
                                    x:
                                        2 * localPoint.x -
                                        (pStart.x + pEnd.x) / 2,
                                    y:
                                        2 * localPoint.y -
                                        (pStart.y + pEnd.y) / 2,
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
                        const pStart = newPoints[0];
                        const pEnd = newPoints[newPoints.length - 1];
                        newPoints[1] = {
                            x: 2 * localPoint.x - (pStart.x + pEnd.x) / 2,
                            y: 2 * localPoint.y - (pStart.y + pEnd.y) / 2,
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

                            newPoints[0] = localPoint;

                            if (edge12Vertical) {
                                // Edge 1→2 is vertical (same X), so point 1 keeps X from point 2
                                // but takes Y from new point 0 to connect the first edge
                                newPoints[1] = { x: p2.x, y: localPoint.y };
                            } else if (edge12Horizontal) {
                                // Edge 1→2 is horizontal (same Y), so point 1 keeps Y from point 2
                                // but takes X from new point 0 to connect the first edge
                                newPoints[1] = { x: localPoint.x, y: p2.y };
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

                            newPoints[lastIdx] = localPoint;

                            if (edgeVertical) {
                                // Edge p2→p1 is vertical (same X), so p1 keeps X from p2
                                // but takes Y from new endpoint to connect the last edge
                                newPoints[lastIdx - 1] = {
                                    x: p2.x,
                                    y: localPoint.y,
                                };
                            } else if (edgeHorizontal) {
                                // Edge p2→p1 is horizontal (same Y), so p1 keeps Y from p2
                                // but takes X from new endpoint to connect the last edge
                                newPoints[lastIdx - 1] = {
                                    x: localPoint.x,
                                    y: p2.y,
                                };
                            } else {
                                // Not axis-aligned, keep p1 fixed
                            }
                        }
                    } else if (index >= 0 && index < newPoints.length) {
                        newPoints[index] = localPoint;
                    }

                    onUpdateElement(originalElement.id, { points: newPoints });
                }
                return;
            }

            // Handle dragging (moving elements)
            if (isDragging && dragStart && originalElements.length > 0) {
                const dx = point.x - dragStart.x;
                const dy = point.y - dragStart.y;

                originalElements.forEach((origEl) => {
                    if (
                        origEl.type === "pen" ||
                        origEl.type === "line" ||
                        origEl.type === "arrow"
                    ) {
                        const newPoints = origEl.points.map((p) => ({
                            x: p.x + dx,
                            y: p.y + dy,
                        }));
                        onUpdateElement(origEl.id, { points: newPoints });
                    } else {
                        onUpdateElement(origEl.id, {
                            x: (origEl.x ?? 0) + dx,
                            y: (origEl.y ?? 0) + dy,
                        });
                    }
                });
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
                        originalElement.type === "web-embed");

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
                    const minAbsWidth =
                        originalElement.type === "text"
                            ? getMinSingleCharWidth(
                                  originalElement.text || "",
                                  fontSizeForMin!,
                                  fontFamilyForMin!,
                                  originalElement.letterSpacing ?? 0,
                              )
                            : originalElement.type === "rectangle" ||
                                originalElement.type === "diamond" ||
                                originalElement.type === "ellipse" ||
                                originalElement.type === "frame" ||
                                originalElement.type === "web-embed"
                              ? 2
                              : 0;

                    const minAbsHeight =
                        originalElement.type === "text"
                            ? Math.max(
                                  2,
                                  fontSizeForMin! *
                                      (originalElement.lineHeight ?? 1.4),
                              )
                            : originalElement.type === "rectangle" ||
                                originalElement.type === "diamond" ||
                                originalElement.type === "ellipse" ||
                                originalElement.type === "frame" ||
                                originalElement.type === "web-embed"
                              ? 2
                              : 0;

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
                        originalElement.type === "web-embed"
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
                case "pen": {
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
                    if (activeConnectorStyle === "elbow") {
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
                        setCurrentElement({
                            ...currentElement,
                            points: [startPoint, endPoint],
                        });
                    }
                    break;
                }
                case "rectangle":
                case "diamond": {
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
            elements,
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
            lastMousePos,
            setLastMousePos,
            setSelectedIds,
            draggingConnectorPoint,
            connectorStyle,
            getElementsToErase,
            remotelySelectedIds,
        ],
    );

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
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

            // Get the element ID from the clicked SVG element (check parent if needed)
            let target = e.target as SVGElement;
            let clickedElementId = target.getAttribute("data-element-id");

            // If not found on target, check parent elements up to the SVG root
            if (!clickedElementId && target.parentElement) {
                let parent: Element | null = target.parentElement;
                while (
                    parent &&
                    parent.tagName !== "svg" &&
                    !clickedElementId
                ) {
                    clickedElementId = parent.getAttribute("data-element-id");
                    if (!clickedElementId && parent.parentElement) {
                        parent = parent.parentElement;
                    } else {
                        break;
                    }
                }
            }

            const clickedElement = clickedElementId
                ? elements.find((el) => el.id === clickedElementId)
                : null;
            // Don't allow selecting elements that are selected by remote users
            const isRemotelySelected = clickedElement
                ? remotelySelectedIds.has(clickedElement.id)
                : false;
            const selectableClickedElement =
                clickedElement?.type === "laser" || isRemotelySelected
                    ? null
                    : clickedElement;

            if (tool === "select") {
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
                        const selectedElement = elements.find(
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
                            ? (elements.find((el) => el.id === selectedIds[0])
                                  ?.rotation ?? 0)
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

                    if (pointInSelectionFrame && clickedIsInSelection) {
                        onStartTransform?.();
                        setIsDragging(true);
                        setDragStart(point);
                        setOriginalElements(
                            selectedElements.map((el) => ({ ...el })),
                        );
                        return;
                    }
                }

                // Use clicked element from event target
                if (selectableClickedElement) {
                    const clickedIds = getGroupSelectionIds(
                        selectableClickedElement,
                        elements,
                    );
                    const clickedAllSelected = clickedIds.every((id) =>
                        selectedIds.includes(id),
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
                        setSelectedIds(clickedIds);
                        onStartTransform?.();
                        setIsDragging(true);
                        setDragStart(point);
                        setOriginalElements(
                            elements
                                .filter((el) => clickedIds.includes(el.id))
                                .map((el) => ({ ...el })),
                        );
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

            // For drawing tools, if we clicked on an element, select it instead
            if (
                tool !== "eraser" &&
                tool !== "text" &&
                selectableClickedElement
            ) {
                setSelectedIds(
                    getGroupSelectionIds(selectableClickedElement, elements),
                );
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

            const elementType: BoardElement["type"] =
                tool === "arrow"
                    ? "arrow"
                    : (tool as
                          | "pen"
                          | "line"
                          | "rectangle"
                          | "diamond"
                          | "ellipse"
                          | "text");

            const newElement: BoardElement = {
                id: uuid(),
                type: elementType,
                points: [point],
                strokeColor,
                strokeWidth,
                opacity,
                strokeStyle,
                lineCap,
                cornerRadius,
                ...(elementType === "line" || elementType === "arrow"
                    ? { connectorStyle }
                    : {}),
                ...(elementType === "arrow" ? { arrowStart, arrowEnd } : {}),
            };

            if (tool === "pen") {
                newElement.fillPattern = fillPattern;
            }

            if (
                tool === "rectangle" ||
                tool === "diamond" ||
                tool === "ellipse"
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
            getMousePosition,
            elements,
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
        ],
    );

    const handleMouseUp = useCallback(() => {
        if (isReadOnly && !isPanning) return;
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        // Handle eraser - delete marked elements on mouse release
        if (tool === "eraser" && isDrawing) {
            // End eraser trail animation
            if (eraserTrailRef.current) {
                eraserTrailRef.current.endPath();
            }
            if (eraserMarkedIds.size > 0) {
                eraserMarkedIds.forEach((id) => onDeleteElement(id));
            }
            setEraserMarkedIds(new Set());
            setIsDrawing(false);
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
                    elements,
                    selectionBox,
                ).filter((id) => !remotelySelectedIds.has(id));
                setSelectedIds(boxSelected);
            }
            setIsBoxSelecting(false);
            setSelectionBox(null);
            return;
        }

        if (draggingConnectorPoint) {
            // Cleanup elbow polylines after edge drags so temporary points don't "stick" until the next drag.
            if (originalElements.length === 1) {
                const orig = originalElements[0];
                if (
                    (orig.type === "line" || orig.type === "arrow") &&
                    (orig.connectorStyle ?? connectorStyle) === "elbow"
                ) {
                    const current = elements.find((el) => el.id === orig.id);
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
            return;
        }

        if (isRotating) {
            setIsRotating(false);
            setRotateStart(null);
            return;
        }

        if (isDragging) {
            setIsDragging(false);
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

                // Add closed flag and apply fill pattern only if shape is closed
                const finalElement: BoardElement = {
                    ...currentElement,
                    isClosed,
                    fillPattern: (isClosed &&
                    currentElement.fillPattern !== "none"
                        ? currentElement.fillPattern
                        : "none") as "none" | "solid" | "criss-cross",
                };

                onAddElement(finalElement);
                elementAdded = true;
            } else if (
                (currentElement.type === "line" ||
                    currentElement.type === "arrow") &&
                currentElement.points.length >= 2
            ) {
                onAddElement(currentElement);
                elementAdded = true;
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
                    currentElement.type === "ellipse") &&
                currentElement.width &&
                currentElement.height &&
                currentElement.width > 2 &&
                currentElement.height > 2
            ) {
                onAddElement(currentElement);
                elementAdded = true;
            }

            // Switch back to select tool and select the new element (except for pen tool)
            // Only auto-switch if tool is not locked
            if (
                elementAdded &&
                currentElement.type !== "pen" &&
                !isToolLocked
            ) {
                setSelectedIds([currentElement.id]);
                if (onToolChange) {
                    onToolChange("select");
                }
            }
        }

        setIsDrawing(false);
        setCurrentElement(null);
        setStartPoint(null);
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
        elements,
        tool,
        onDeleteElement,
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
        draggingConnectorPoint,
        eraserMarkedIds,
        zoom,
        connectorStyle,
        originalElements,
        remotelySelectedIds,
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
    }, [handleMouseUp]);

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

    // Auto-save text on blur or after typing stops
    const textSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleTextChange = useCallback((value: string) => {
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
    }, []);

    // While editing an existing text element, allow style changes (letter spacing, font, etc)
    // to apply immediately and persist on submit.
    useEffect(() => {
        if (!textInput) return;
        setEditingTextStyle((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                strokeColor,
                strokeWidth,
                opacity,
                fontFamily,
                textAlign,
                fontSize,
                letterSpacing,
                lineHeight,
            };
        });
    }, [
        fontFamily,
        fontSize,
        letterSpacing,
        lineHeight,
        opacity,
        strokeColor,
        strokeWidth,
        textAlign,
        textInput,
    ]);

    // Auto-resize textarea to fit content
    useEffect(() => {
        if (textInputRef.current && textInput) {
            const textarea = textInputRef.current;
            const activeFontSize = editingTextStyle?.fontSize ?? fontSize;
            const activeLineHeight = editingTextStyle?.lineHeight ?? lineHeight;
            const minHeightPx = activeFontSize * activeLineHeight;
            const measuredContentHeight = measureWrappedTextHeightPx({
                text: textValue, // Use textValue state instead of textarea.value for immediate updates
                width: textInput.width ?? 200,
                fontSize: activeFontSize,
                lineHeight: activeLineHeight,
                fontFamily: editingTextStyle?.fontFamily ?? fontFamily,
                letterSpacing: editingTextStyle?.letterSpacing ?? letterSpacing,
                textAlign: editingTextStyle?.textAlign ?? textAlign,
            });

            // Use exact measured height without buffer to avoid extra space below text
            const newHeight = Math.max(measuredContentHeight, minHeightPx);
            textarea.style.height = `${newHeight}px`;

            // Always update textInput height to match content (both growing and shrinking)
            const currentHeight = textInput.height ?? 0;
            if (Math.abs(currentHeight - newHeight) > 0.5) {
                setTextInput((prev) =>
                    prev
                        ? { ...prev, height: newHeight, isTextBox: true }
                        : prev,
                );
            }
            // Always update the actual element's text and height so the selection box and content stay in sync
            if (editingTextElementId) {
                onUpdateElement(editingTextElementId, {
                    text: textValue,
                    height: newHeight,
                });
            }

            // Update caret position after layout changes.
            if (caretUpdateRafRef.current === null) {
                caretUpdateRafRef.current = requestAnimationFrame(() => {
                    caretUpdateRafRef.current = null;
                    const textarea = textInputRef.current;
                    const mirror = textEditorMirrorRef.current;
                    const caret = textEditorCaretRef.current;
                    if (!textarea || !mirror || !caret) return;
                    if (textarea.selectionStart !== textarea.selectionEnd) {
                        caret.style.display = "none";
                        return;
                    }
                    const pos =
                        textarea.selectionStart ?? textarea.value.length;
                    mirror.textContent = "";
                    mirror.append(
                        document.createTextNode(textarea.value.slice(0, pos)),
                    );
                    const marker = document.createElement("span");
                    marker.textContent = "\u200b";
                    mirror.append(marker);
                    const mirrorRect = mirror.getBoundingClientRect();
                    const markerRect = marker.getBoundingClientRect();
                    caret.style.display = "block";
                    caret.style.left = `${markerRect.left - mirrorRect.left}px`;
                    caret.style.top = `${markerRect.top - mirrorRect.top}px`;
                    caret.style.height = `${markerRect.height || activeFontSize}px`;
                });
            }
        }
    }, [
        editingTextStyle,
        fontSize,
        lineHeight,
        textValue,
        textInput,
        editingTextElementId,
        onUpdateElement,
    ]);

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
                const pStart = originalPoints[0];
                const pEnd = originalPoints[originalPoints.length - 1];
                const nextPoints = originalPoints.map((p) => ({ ...p }));
                nextPoints[1] = {
                    x: 2 * localPoint.x - (pStart.x + pEnd.x) / 2,
                    y: 2 * localPoint.y - (pStart.y + pEnd.y) / 2,
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
                    const nextPoints = [
                        pStart,
                        {
                            x: 2 * localPoint.x - (pStart.x + pEnd.x) / 2,
                            y: 2 * localPoint.y - (pStart.y + pEnd.y) / 2,
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
            lastMousePos,
            originalElements,
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
                        if (effectiveElement.points.length === 3) {
                            pathD = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
                        } else {
                            pathD = getCatmullRomPath(effectiveElement.points);
                        }
                    } else if (style === "elbow") {
                        const elbowEps = 0.5 / zoom;
                        polyPoints =
                            effectiveElement.points.length === 3
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
                                strokeLinecap={elLineCap}
                                opacity={markerOpacity}
                            />
                        );
                    };

                    if (marker === "arrow") {
                        const [pA, pB] = getArrowHeadPoints(
                            offsetTip,
                            from,
                            size,
                        );
                        return (
                            <g pointerEvents="none">
                                {line(pA.x, pA.y)}
                                {line(pB.x, pB.y)}
                            </g>
                        );
                    }

                    if (
                        marker === "triangle" ||
                        marker === "triangle-outline"
                    ) {
                        const back = size * 1.1;
                        const spread = size * 0.85;
                        const baseX = offsetTip.x + bx * back;
                        const baseY = offsetTip.y + by * back;
                        const p1 = {
                            x: baseX + px * spread,
                            y: baseY + py * spread,
                        };
                        const p2 = {
                            x: baseX - px * spread,
                            y: baseY - py * spread,
                        };
                        return (
                            <polygon
                                pointerEvents="none"
                                points={`${offsetTip.x},${offsetTip.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
                                fill={marker === "triangle" ? stroke : "none"}
                                stroke={
                                    marker === "triangle-outline"
                                        ? stroke
                                        : "none"
                                }
                                strokeWidth={
                                    marker === "triangle-outline"
                                        ? outlineStrokeWidth
                                        : undefined
                                }
                                strokeLinejoin="round"
                                opacity={markerOpacity}
                            />
                        );
                    }

                    if (marker === "diamond" || marker === "diamond-outline") {
                        const back1 = size * 0.9;
                        const back2 = size * 1.8;
                        const spread = size * 0.75;
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
                    }

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

                    return null;
                };

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
                            strokeLinejoin="round"
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
                const cx = (element.x || 0) + (element.width || 0) / 2;
                const cy = (element.y || 0) + (element.height || 0) / 2;
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
                            fill={elFillColor}
                            rx={elCornerRadius}
                            opacity={
                                isMarkedForDeletion
                                    ? elOpacity * 0.3
                                    : elOpacity
                            }
                            strokeDasharray={strokeDasharray}
                            pointerEvents="auto"
                        />
                        {element.url && (
                            <text
                                x={(element.x ?? 0) + (element.width ?? 0) / 2}
                                y={(element.y ?? 0) + (element.height ?? 0) / 2}
                                fill={element.strokeColor}
                                fontSize={12}
                                fontFamily="inherit"
                                textAnchor="middle"
                                opacity={
                                    isMarkedForDeletion
                                        ? elOpacity * 0.3 * 0.7
                                        : elOpacity * 0.7
                                }
                                pointerEvents="none"
                            >
                                {element.url}
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
            case "laser": {
                if (element.points.length < 2) return null;
                const baseOpacity = (element.opacity ?? 100) / 100;
                let fadeMultiplier = 1;
                if (element.timestamp) {
                    const elapsed = Date.now() - element.timestamp;
                    if (elapsed >= LASER_HOLD_DURATION_MS) {
                        const fadeElapsed = elapsed - LASER_HOLD_DURATION_MS;
                        const progress = Math.min(
                            1,
                            fadeElapsed / LASER_FADE_DURATION_MS,
                        );
                        const easeOutProgress = 1 - Math.pow(1 - progress, 3);
                        fadeMultiplier = Math.max(0, 1 - easeOutProgress);
                    }
                }
                const elOpacity = baseOpacity * fadeMultiplier;
                const stroke = getStroke(
                    element.points.map((p) => [p.x, p.y]),
                    {
                        size: 8,
                        thinning: 0.3,
                        smoothing: 0.5,
                        streamline: 0.5,
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
            const existingRadius = isEditArrowMode
                ? baseRadius * 1.6
                : baseRadius;

            const handlePosCurved = {
                x: (start.x + 2 * control.x + end.x) / 4,
                y: (start.y + 2 * control.y + end.y) / 4,
            };
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

                const elbowPolylineRaw =
                    el.points.length === 2
                        ? [start, end]
                        : el.points.length === 3
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
                    e: React.MouseEvent,
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
                    e: React.MouseEvent,
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
                        <circle
                            cx={elbowPolyline[0].x}
                            cy={elbowPolyline[0].y}
                            r={bigRadius}
                            fill="var(--background)"
                            stroke="var(--accent)"
                            strokeWidth={dotStrokeWidth}
                            style={{ cursor: "move" }}
                            onMouseDown={(e) =>
                                startDragWithExplicit(e, {
                                    kind: "elbowEndpoint",
                                    index: 0,
                                })
                            }
                        />
                        <circle
                            cx={elbowPolyline[elbowPolyline.length - 1].x}
                            cy={elbowPolyline[elbowPolyline.length - 1].y}
                            r={bigRadius}
                            fill="var(--background)"
                            stroke="var(--accent)"
                            strokeWidth={dotStrokeWidth}
                            style={{ cursor: "move" }}
                            onMouseDown={(e) =>
                                startDragWithExplicit(e, {
                                    kind: "elbowEndpoint",
                                    index: elbowPolyline.length - 1,
                                })
                            }
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
                          { pos: end, index: 2, kind: "normal" },
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
                e: React.MouseEvent,
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
                e: React.MouseEvent,
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
                    {handles.map((h) => (
                        <circle
                            key={`${element.id}-pt-${h.index}`}
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

    // Render remote selection overlays (elements selected by other users)
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
                                strokeWidth={2}
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
                        strokeWidth={2}
                        strokeDasharray="5,5"
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
                            rx={2}
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
                    strokeWidth={2}
                    strokeDasharray={
                        selectedIds.length === 1 ? undefined : "5,5"
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
                        rx={2}
                        style={{ cursor: handle.cursor }}
                    />
                ))}
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

                    // Add padding around the element
                    const padding = 8;
                    return (
                        <rect
                            key={`highlight-${id}`}
                            x={bounds.x - padding}
                            y={bounds.y - padding}
                            width={bounds.width + padding * 2}
                            height={bounds.height + padding * 2}
                            fill="none"
                            stroke="hsl(var(--chart-2))"
                            strokeWidth={2}
                            strokeDasharray="4,4"
                            pointerEvents="none"
                            opacity={0.8}
                            rx={4}
                        />
                    );
                })}
            </g>
        );
    };

    const getCursorStyle = () => {
        if (isDragging) return "grabbing";
        if (isPanning) return "grabbing";
        if (isRotating) return "grabbing";
        if (isResizing) {
            if (resizeHandle && selectedIds.length === 1) {
                const selectedElement = elements.find(
                    (el) => el.id === selectedIds[0],
                );
                const rotationDeg = selectedElement?.rotation ?? 0;
                return getRotatedResizeCursor(resizeHandle, rotationDeg);
            }

            switch (resizeHandle) {
                case "nw":
                case "se":
                    return "nwse-resize";
                case "ne":
                case "sw":
                    return "nesw-resize";
                case "n":
                case "s":
                    return "ns-resize";
                case "e":
                case "w":
                    return "ew-resize";
            }
        }

        switch (tool) {
            case "hand":
                return "grab";
            case "pen":
            case "line":
            case "arrow":
            case "rectangle":
            case "diamond":
            case "ellipse":
                return "crosshair";
            case "eraser":
                return "none";
            case "select":
                return (
                    hoverCursor ??
                    (selectedIds.length > 0 ? "grab" : "crosshair")
                );
            case "text":
                return "text";
            case "laser":
                return "none";
            default:
                return "crosshair";
        }
    };

    // Update parent component when selection changes
    useEffect(() => {
        if (onSelectionChange) {
            const selected = elements.filter((el) =>
                selectedIds.includes(el.id),
            );
            onSelectionChange(selected);
        }
    }, [selectedIds, elements, onSelectionChange]);

    // Ensure selected text boxes never clip their content (e.g. after style changes like letterSpacing).
    useEffect(() => {
        selectedIds.forEach((id) => {
            const el = elements.find((e) => e.id === id);
            if (!el || el.type !== "text" || !el.isTextBox) return;
            if (textInput && editingTextElementId === id) return;
            if (el.width == null || el.height == null) return;

            const fs = el.fontSize ?? el.strokeWidth * 4 + 12;
            const lh = el.lineHeight ?? 1.4;
            const ff = el.fontFamily || "var(--font-inter)";

            const required = Math.max(
                fs * lh,
                measureWrappedTextHeightPx({
                    text: el.text || "",
                    width: el.width,
                    fontSize: fs,
                    lineHeight: lh,
                    fontFamily: ff,
                    letterSpacing: el.letterSpacing ?? 0,
                    textAlign: el.textAlign ?? "left",
                }),
            );

            if (required <= el.height + 0.5) return;

            const last = lastEnforcedTextHeightsRef.current.get(id);
            if (last && Math.abs(last - required) <= 0.5) return;
            lastEnforcedTextHeightsRef.current.set(id, required);
            onUpdateElement(id, { height: required });
        });
    }, [
        editingTextElementId,
        elements,
        onUpdateElement,
        selectedIds,
        textInput,
    ]);

    // Helper function to get background style
    const getBackgroundStyle = () => {
        const spacing = 40 * zoom;
        const position = `${pan.x}px ${pan.y}px`;
        const gridColor = "currentColor"; // Will inherit from parent's text color

        switch (canvasBackground) {
            case "grid":
                return {
                    backgroundImage: `
            linear-gradient(to right, ${gridColor} 1px, transparent 1px),
            linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
          `,
                    backgroundSize: `${spacing}px ${spacing}px`,
                    backgroundPosition: position,
                };
            case "dots":
                return {
                    backgroundImage: `radial-gradient(circle, ${gridColor} 1.5px, transparent 1.5px)`,
                    backgroundSize: `${spacing}px ${spacing}px`,
                    backgroundPosition: position,
                };
            case "lines":
                return {
                    backgroundImage: `linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
                    backgroundSize: `${spacing}px ${spacing}px`,
                    backgroundPosition: position,
                };
            case "none":
            default:
                return {
                    backgroundImage: "none",
                };
        }
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden bg-background"
        >
            {/* Canvas Background */}
            {canvasBackground !== "none" && (
                <div
                    className="absolute inset-0 pointer-events-none text-foreground opacity-[0.08] dark:opacity-[0.05]"
                    style={getBackgroundStyle()}
                />
            )}

            {/* Main SVG Canvas */}
            <svg
                ref={svgRef}
                className="w-full h-full"
                style={{ cursor: getCursorStyle() }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            >
                <defs>
                    <filter
                        id="laser-glow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                    >
                        {/* Create multiple blur layers for stronger glow */}
                        <feGaussianBlur stdDeviation="3" result="blur1" />
                        <feGaussianBlur stdDeviation="6" result="blur2" />
                        <feGaussianBlur stdDeviation="9" result="blur3" />

                        {/* Brighten the glow */}
                        <feColorMatrix
                            in="blur1"
                            result="brightBlur1"
                            type="matrix"
                            values="1.5 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
                        />
                        <feColorMatrix
                            in="blur2"
                            result="brightBlur2"
                            type="matrix"
                            values="1.3 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0.8 0"
                        />
                        <feColorMatrix
                            in="blur3"
                            result="brightBlur3"
                            type="matrix"
                            values="1.2 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0.6 0"
                        />

                        {/* Merge all layers */}
                        <feMerge>
                            <feMergeNode in="brightBlur3" />
                            <feMergeNode in="brightBlur2" />
                            <feMergeNode in="brightBlur1" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {/* Pattern definitions for pen fill */}
                    {/* Criss-cross pattern - diagonal lines both ways with organic spacing */}
                    <pattern
                        id="fill-pattern-criss-cross"
                        width="24"
                        height="24"
                        patternUnits="userSpaceOnUse"
                    >
                        {/* Diagonal lines going one way */}
                        <line
                            x1="0"
                            y1="0"
                            x2="24"
                            y2="24"
                            stroke="currentColor"
                            strokeWidth="1"
                            opacity="0.6"
                            strokeLinecap="round"
                        />
                        <line
                            x1="-6"
                            y1="0"
                            x2="18"
                            y2="24"
                            stroke="currentColor"
                            strokeWidth="0.8"
                            opacity="0.5"
                            strokeLinecap="round"
                        />
                        <line
                            x1="6"
                            y1="0"
                            x2="30"
                            y2="24"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            opacity="0.5"
                            strokeLinecap="round"
                        />
                        <line
                            x1="-12"
                            y1="0"
                            x2="12"
                            y2="24"
                            stroke="currentColor"
                            strokeWidth="0.9"
                            opacity="0.4"
                            strokeLinecap="round"
                        />
                        <line
                            x1="12"
                            y1="0"
                            x2="36"
                            y2="24"
                            stroke="currentColor"
                            strokeWidth="0.9"
                            opacity="0.4"
                            strokeLinecap="round"
                        />
                        {/* Diagonal lines going the other way */}
                        <line
                            x1="0"
                            y1="24"
                            x2="24"
                            y2="0"
                            stroke="currentColor"
                            strokeWidth="1"
                            opacity="0.6"
                            strokeLinecap="round"
                        />
                        <line
                            x1="-6"
                            y1="24"
                            x2="18"
                            y2="0"
                            stroke="currentColor"
                            strokeWidth="0.9"
                            opacity="0.5"
                            strokeLinecap="round"
                        />
                        <line
                            x1="6"
                            y1="24"
                            x2="30"
                            y2="0"
                            stroke="currentColor"
                            strokeWidth="1.1"
                            opacity="0.5"
                            strokeLinecap="round"
                        />
                        <line
                            x1="-12"
                            y1="24"
                            x2="12"
                            y2="0"
                            stroke="currentColor"
                            strokeWidth="0.8"
                            opacity="0.4"
                            strokeLinecap="round"
                        />
                        <line
                            x1="12"
                            y1="24"
                            x2="36"
                            y2="0"
                            stroke="currentColor"
                            strokeWidth="1"
                            opacity="0.4"
                            strokeLinecap="round"
                        />
                    </pattern>
                </defs>
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Render all elements sorted by zIndex */}
                    {[...elements]
                        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                        .map((el) => renderElement(el))}

                    {/* Render remote users' in-progress drawings */}
                    {remoteDrawingElements.map(({ id, color, element }) => (
                        <g key={`remote-drawing-${id}`} opacity={0.7}>
                            {renderElement(
                                element.type === "text"
                                    ? element
                                    : {
                                          ...element,
                                          strokeColor: color,
                                      },
                                true,
                            )}
                        </g>
                    ))}

                    {/* Render current element being drawn */}
                    {currentElement && renderElement(currentElement, true)}

                    {/* Render remote user selections (colored frames with name tags) */}
                    {renderRemoteSelections()}

                    {/* Render selection box */}
                    {tool === "select" && renderSelectionBox()}

                    {/* Render search result highlights */}
                    {renderHighlights()}

                    {/* Render box selection rectangle */}
                    {isBoxSelecting && selectionBox && (
                        <rect
                            x={selectionBox.x}
                            y={selectionBox.y}
                            width={selectionBox.width}
                            height={selectionBox.height}
                            fill="rgba(98, 114, 164, 0.2)"
                            stroke="var(--accent)"
                            strokeWidth={1}
                            strokeDasharray="4,4"
                        />
                    )}

                    {/* Render text box preview while dragging */}
                    {tool === "text" && isDrawing && startPoint && (
                        <rect
                            x={Math.min(startPoint.x, lastMousePos.x)}
                            y={Math.min(startPoint.y, lastMousePos.y)}
                            width={Math.abs(lastMousePos.x - startPoint.x)}
                            height={fontSize * lineHeight}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={strokeWidth * 0.5}
                            strokeDasharray="4,4"
                            opacity={0.5}
                            rx={4}
                        />
                    )}

                    {/* Eraser trail animation */}
                    <path ref={eraserTrailPathRef} />

                    {/* Eraser cursor circle */}
                    {tool === "eraser" && eraserCursorPos && (
                        <circle
                            cx={eraserCursorPos.x}
                            cy={eraserCursorPos.y}
                            r={strokeWidth * 2}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1 / zoom}
                            opacity={0.5}
                            pointerEvents="none"
                        />
                    )}

                    {/* Laser pointer cursor - glowing red dot with white center */}
                    {tool === "laser" && laserCursorPos && (
                        <g pointerEvents="none">
                            {/* Outer glow - large red blur */}
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={8 / zoom}
                                fill="#ff0000"
                                opacity={0.3}
                                filter="blur(4px)"
                            />
                            {/* Middle glow - medium red blur */}
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={5 / zoom}
                                fill="#ff0000"
                                opacity={0.5}
                                filter="blur(2px)"
                            />
                            {/* Main red dot */}
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={3 / zoom}
                                fill="#ff0000"
                                opacity={0.9}
                            />
                            {/* White center dot */}
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={1 / zoom}
                                fill="#ffffff"
                            />
                        </g>
                    )}
                </g>
            </svg>

            {/* Remote Cursors - Animated (not scaled with zoom) */}
            {showRemoteCursors && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <CollaboratorCursors
                        cursors={remoteCursors}
                        pan={pan}
                        zoom={zoom}
                    />
                </div>
            )}

            {/* Text Input */}
            {textInput && (
                <div
                    ref={textEditorWrapperRef}
                    className="absolute pointer-events-auto"
                    style={{
                        left: textInput.x * zoom + pan.x,
                        top: textInput.y * zoom + pan.y,
                        width: textInput.width ?? 200,
                        height:
                            textInput.height ??
                            (editingTextStyle?.fontSize ?? fontSize) *
                                (editingTextStyle?.lineHeight ?? lineHeight),
                        transform: `scale(${zoom})`,
                        transformOrigin: "top left",
                        overflow: "visible",
                    }}
                >
                    <textarea
                        ref={textInputRef}
                        value={textValue}
                        wrap="soft"
                        rows={1}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        autoComplete="off"
                        onChange={(e) => handleTextChange(e.target.value)}
                        onSelect={() => {
                            if (caretUpdateRafRef.current !== null) return;
                            caretUpdateRafRef.current = requestAnimationFrame(
                                () => {
                                    caretUpdateRafRef.current = null;
                                    const textarea = textInputRef.current;
                                    const mirror = textEditorMirrorRef.current;
                                    const caret = textEditorCaretRef.current;
                                    if (!textarea || !mirror || !caret) return;
                                    if (
                                        textarea.selectionStart !==
                                        textarea.selectionEnd
                                    ) {
                                        caret.style.display = "none";
                                        return;
                                    }
                                    const pos =
                                        textarea.selectionStart ??
                                        textarea.value.length;
                                    mirror.textContent = "";
                                    mirror.append(
                                        document.createTextNode(
                                            textarea.value.slice(0, pos),
                                        ),
                                    );
                                    const marker =
                                        document.createElement("span");
                                    marker.textContent = "\u200b";
                                    mirror.append(marker);
                                    const mirrorRect =
                                        mirror.getBoundingClientRect();
                                    const markerRect =
                                        marker.getBoundingClientRect();
                                    caret.style.display = "block";
                                    caret.style.left = `${markerRect.left - mirrorRect.left}px`;
                                    caret.style.top = `${markerRect.top - mirrorRect.top}px`;
                                    caret.style.height = `${markerRect.height || (editingTextStyle?.fontSize ?? fontSize)}px`;
                                },
                            );
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setTextInput(null);
                                setTextValue("");
                                setEditingTextElementId(null);
                                setEditingTextStyle(null);
                            }
                        }}
                        onBlur={(e) => {
                            // Don't close if clicking on sidebar or other UI elements
                            const relatedTarget =
                                e.relatedTarget as HTMLElement;
                            if (
                                relatedTarget &&
                                (relatedTarget.closest(".fixed.right-4") || // Sidebar
                                    relatedTarget.tagName === "BUTTON" ||
                                    relatedTarget.tagName === "SELECT" ||
                                    relatedTarget.tagName === "INPUT")
                            ) {
                                return;
                            }
                            // Save text on blur if there's content
                            if (textValue.trim()) {
                                handleTextSubmit();
                            } else {
                                setTextInput(null);
                                setTextValue("");
                                setEditingTextElementId(null);
                                setEditingTextStyle(null);
                            }
                        }}
                        className="absolute inset-0 bg-transparent outline-none text-foreground resize-none"
                        style={{
                            width: "100%",
                            height: "100%",
                            fontSize: editingTextStyle?.fontSize ?? fontSize,
                            fontFamily:
                                editingTextStyle?.fontFamily ?? fontFamily,
                            letterSpacing: `${editingTextStyle?.letterSpacing ?? letterSpacing}px`,
                            color: editingTextStyle?.strokeColor ?? strokeColor,
                            lineHeight: (
                                editingTextStyle?.lineHeight ?? lineHeight
                            ).toString(),
                            textAlign: editingTextStyle?.textAlign ?? textAlign,
                            padding: 0,
                            margin: 0,
                            border: 0,
                            outline:
                                "2px dashed color-mix(in oklab, var(--accent) 60%, transparent)",
                            outlineOffset: "0px",
                            boxSizing: "content-box",
                            overflow: "visible",
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                            whiteSpace: "pre-wrap",
                            caretColor: "transparent",
                        }}
                    />
                    <div
                        ref={textEditorCaretRef}
                        className="shadeworks-text-caret"
                        style={{
                            position: "absolute",
                            width: "2px",
                            backgroundColor: "var(--accent)",
                            borderRadius: "1px",
                            top: 0,
                            left: 0,
                            display: "none",
                        }}
                    />
                    <div
                        ref={textEditorMirrorRef}
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            inset: 0,
                            visibility: "hidden",
                            pointerEvents: "none",
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                            fontSize: `${editingTextStyle?.fontSize ?? fontSize}px`,
                            fontFamily:
                                editingTextStyle?.fontFamily ?? fontFamily,
                            letterSpacing: `${editingTextStyle?.letterSpacing ?? letterSpacing}px`,
                            lineHeight: (
                                editingTextStyle?.lineHeight ?? lineHeight
                            ).toString(),
                            textAlign: editingTextStyle?.textAlign ?? textAlign,
                            padding: 0,
                            margin: 0,
                            boxSizing: "content-box",
                        }}
                    />
                </div>
            )}

            {/* Zoom and Undo/Redo Controls */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 select-none">
                <div className="flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border rounded-md p-1.5 shadow-xl">
                    <button
                        onClick={() => {
                            setZoom((prev) => Math.max(0.1, prev - 0.1));
                            onManualViewportChange?.();
                        }}
                        className="p-1.5 rounded-sm hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
                        title="Zoom Out"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 12H4"
                            />
                        </svg>
                    </button>
                    <span className="text-xs font-medium text-foreground min-w-[3rem] text-center">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        onClick={() => {
                            setZoom((prev) => Math.min(5, prev + 0.1));
                            onManualViewportChange?.();
                        }}
                        className="p-1.5 rounded-sm hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
                        title="Zoom In"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                    </button>
                    <div className="w-px h-4 bg-border" />
                    <button
                        onClick={() => {
                            setZoom(1);
                            onManualViewportChange?.();
                        }}
                        className="p-1.5 rounded-sm hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all text-xs"
                        title="Reset Zoom"
                    >
                        Reset
                    </button>
                </div>
                {showUndoRedo && (
                    <div className="flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border rounded-md p-1.5 shadow-xl">
                        <button
                            onClick={onUndo}
                            className="p-1.5 rounded-sm hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
                            title="Undo (Ctrl+Z)"
                        >
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={onRedo}
                            className="p-1.5 rounded-sm hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
                            title="Redo (Ctrl+Y)"
                        >
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
                                />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Tooltip */}
            {!isReadOnly && (
                <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-border">
                    {inputHint === "trackpad"
                        ? "Pinch to zoom  Two-finger to pan"
                        : "Ctrl+Scroll to zoom  Middle-click to pan"}
                </div>
            )}
        </div>
    );
}
