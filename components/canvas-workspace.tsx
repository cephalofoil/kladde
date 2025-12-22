"use client";

import React from "react";
import { useRef, useEffect, useCallback, useState } from "react";
import { useBoardStore } from "@/stores/board-management-store";
import { useEventListener } from "@/hooks/useEventListener";
import { UI_DELAYS } from "@/lib/constants";
import { CanvasToolbar } from "./canvas-toolbar";
import { ZoomControls } from "./zoom-controls";
import { LogoBar } from "./logo-bar";
import { CanvasTile } from "./canvas-tile";
import { PropertiesPanel } from "./properties-panel";
import { LayersPanel } from "./layers-panel";
import { AlignmentToolbar } from "./alignment-toolbar";
import { AdminDevPanel } from "./admin-dev-panel";
import { DocumentEditorPanel } from "./document-editor-panel";
import type {
  TileData,
  Connection,
  BoardData,
  DocumentLayout,
} from "@/types/canvas";
import { generateId } from "@/lib/id";
import { UndoRedoHandler } from "./undo-redo-handler";
import { useCanvasHistory } from "@/hooks/useCanvasHistory";
import {
  createHandDrawnOrthogonalPath,
  createSmoothCurve,
  createStraightLine,
  createOrthogonalPath,
} from "@/lib/rough-path";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CanvasWorkspaceProps {
  boardId?: string;
  initialBoardData?: BoardData;
  onDataChange?: (hasChanges: boolean) => void;
}

/**
 * CanvasWorkspace that works directly with board management store
 */
export function CanvasWorkspace({
  boardId,
  initialBoardData,
  onDataChange,
}: CanvasWorkspaceProps = {}) {
  // Subscribe to only the specific store properties we need
  const storeCurrentBoardId = useBoardStore((state) => state.currentBoardId);
  const currentBoardId = boardId || storeCurrentBoardId;

  // Subscribe directly to tiles and connections with stable selectors
  const storeTiles = useBoardStore(
    useCallback(
      (state) => {
        const boardData = currentBoardId
          ? state.boardData[currentBoardId]
          : null;
        return boardData?.tiles ?? [];
      },
      [currentBoardId],
    ),
  );

  const storeConnections = useBoardStore(
    useCallback(
      (state) => {
        const boardData = currentBoardId
          ? state.boardData[currentBoardId]
          : null;
        return boardData?.connections ?? [];
      },
      [currentBoardId],
    ),
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use boardId prop or fall back to store current board
  const effectiveBoardId = currentBoardId;

  // Only initialize history if we have a valid board ID
  const historyHook = useCanvasHistory(effectiveBoardId || "temp-board");
  const { pushToHistory } = historyHook;

  // UI State
  const [activeTool, setActiveTool] = useState<TileData["type"] | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Selection state
  const [selectedTileIds, setSelectedTileIds] = useState<string[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{
    tileId: string;
    side: "top" | "right" | "bottom" | "left";
  } | null>(null);
  const [connectionTarget, setConnectionTarget] = useState<{
    tileId: string;
    side?: "top" | "right" | "bottom" | "left";
  } | null>(null);
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);
  const [connectionDragStart, setConnectionDragStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isDraggingControlPoint, setIsDraggingControlPoint] = useState(false);
  const [controlPointDragStart, setControlPointDragStart] = useState<{
    x: number;
    y: number;
    initialOffset: { x: number; y: number };
  } | null>(null);

  // Admin panel state
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<
    (() => void) | null
  >(null);

  // Document editor panel state
  const [documentEditorState, setDocumentEditorState] = useState<{
    isOpen: boolean;
    tileId: string;
  } | null>(null);

  // Tile counters for generating unique names
  const [tileCounters, setTileCounters] = useState<Record<string, number>>({
    text: 0,
    code: 0,
    note: 0,
    image: 0,
    shape: 0,
    mermaid: 0,
    document: 0,
  });

  // Use provided initial data or fetch from store
  const tiles = initialBoardData?.tiles ?? storeTiles;
  const connections = initialBoardData?.connections ?? storeConnections;

  // Calculate canvas bounds
  const canvasBounds = React.useMemo(() => {
    if (tiles.length === 0) {
      return { width: 2000, height: 2000, minX: -500, minY: -500 };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    tiles.forEach((tile: TileData) => {
      minX = Math.min(minX, tile.x);
      minY = Math.min(minY, tile.y);
      maxX = Math.max(maxX, tile.x + tile.width);
      maxY = Math.max(maxY, tile.y + tile.height);
    });

    const buffer = 500;
    minX -= buffer;
    minY -= buffer;
    maxX += buffer;
    maxY += buffer;

    const minCanvasSize = 2000;
    const width = Math.max(maxX - minX, minCanvasSize);
    const height = Math.max(maxY - minY, minCanvasSize);

    return { width, height, minX, minY };
  }, [tiles]);

  // Selected tiles
  const selectedTiles = tiles.filter((tile: TileData) =>
    selectedTileIds.includes(tile.id),
  );

  const selectedBounds = React.useMemo(() => {
    if (selectedTiles.length === 0) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    selectedTiles.forEach((tile) => {
      minX = Math.min(minX, tile.x);
      minY = Math.min(minY, tile.y);
      maxX = Math.max(maxX, tile.x + tile.width);
      maxY = Math.max(maxY, tile.y + tile.height);
    });

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [selectedTiles]);

  // Auto-save functionality
  const [isDirty, setIsDirty] = useState(false);
  // const [lastSaved, setLastSaved] = useState(Date.now()); // Unused for now
  // const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null); // Unused for now

  // Mark data as dirty and notify parent
  const markDirty = useCallback(() => {
    pushToHistory();
    setIsDirty(true);
    onDataChange?.(true);
  }, [onDataChange, pushToHistory]);

  // Document editor panel functions
  const openDocumentSideView = useCallback((tileId: string) => {
    setDocumentEditorState({
      isOpen: true,
      tileId,
    });
  }, []);

  const closeDocumentEditor = useCallback(() => {
    setDocumentEditorState(null);
  }, []);

  const updateDocumentContent = useCallback(
    (
      tileId: string,
      updates: {
        title?: string;
        description?: string;
        layout?: DocumentLayout;
        linkedTileIds?: string[];
      },
    ) => {
      if (!currentBoardId) return;

      const updatedTiles = tiles.map((tile: TileData) =>
        tile.id === tileId
          ? {
              ...tile,
              title: updates.title !== undefined ? updates.title : tile.title,
              content: {
                ...tile.content,
                ...(updates.description !== undefined && {
                  description: updates.description,
                }),
                ...(updates.layout !== undefined && { layout: updates.layout }),
                ...(updates.linkedTileIds !== undefined && {
                  linkedTileIds: updates.linkedTileIds,
                }),
              },
            }
          : tile,
      );

      useBoardStore.getState().update({ tiles: updatedTiles });
      markDirty();
    },
    [currentBoardId, tiles, markDirty],
  );

  // Save current state to board management store
  // const saveToStore = useCallback(() => {
  //   useBoardStore.getState().flushNow();
  // }, []);

  // Tile operations
  const updateTile = useCallback(
    (id: string, updates: Partial<TileData>) => {
      if (!currentBoardId) return;

      const updatedTiles = tiles.map((tile: TileData) =>
        tile.id === id ? { ...tile, ...updates } : tile,
      );

      useBoardStore.getState().update({ tiles: updatedTiles });
      markDirty();
    },
    [currentBoardId, tiles, markDirty],
  );

  const deleteTile = useCallback(
    (id: string) => {
      if (!currentBoardId) return;

      const updatedTiles = tiles.filter((tile: TileData) => tile.id !== id);
      const updatedConnections = connections.filter(
        (conn: Connection) => conn.fromTileId !== id && conn.toTileId !== id,
      );

      useBoardStore
        .getState()
        .update({ tiles: updatedTiles, connections: updatedConnections });

      // Remove from selections
      setSelectedTileIds((prev) => prev.filter((tileId) => tileId !== id));

      markDirty();
    },
    [currentBoardId, tiles, connections, markDirty],
  );

  // Batch delete multiple tiles efficiently
  const deleteMultipleTiles = useCallback(
    (ids: string[]) => {
      if (!currentBoardId || ids.length === 0) return;

      // Get current state from store to ensure we're working with fresh data
      const currentState = useBoardStore.getState();
      const currentTiles = currentState.tiles;
      const currentConnections = currentState.connections;

      const updatedTiles = currentTiles.filter(
        (tile: TileData) => !ids.includes(tile.id),
      );
      const updatedConnections = currentConnections.filter(
        (conn: Connection) =>
          !ids.includes(conn.fromTileId) && !ids.includes(conn.toTileId),
      );

      useBoardStore
        .getState()
        .update({ tiles: updatedTiles, connections: updatedConnections });

      // Remove from selections
      setSelectedTileIds((prev) =>
        prev.filter((tileId) => !ids.includes(tileId)),
      );

      markDirty();
    },
    [currentBoardId, markDirty],
  );

  const addTile = useCallback(
    (tile: TileData) => {
      if (!currentBoardId) return;
      const updatedTiles = [...tiles, tile];
      useBoardStore.getState().update({ tiles: updatedTiles });
      markDirty();
    },
    [currentBoardId, tiles, markDirty],
  );

  // Connection operations
  const deleteConnection = useCallback(
    (id: string) => {
      if (!currentBoardId) return;

      const updatedConnections = connections.filter(
        (conn: Connection) => conn.id !== id,
      );
      useBoardStore.getState().update({ connections: updatedConnections });

      if (selectedConnectionId === id) {
        setSelectedConnectionId(null);
      }

      markDirty();
    },
    [currentBoardId, connections, selectedConnectionId, markDirty],
  );

  const addConnection = useCallback(
    (connection: Connection) => {
      if (!currentBoardId) return;
      const updatedConnections = [...connections, connection];
      useBoardStore.getState().update({ connections: updatedConnections });
      markDirty();
    },
    [currentBoardId, connections, markDirty],
  );

  // Utility functions
  const incrementTileCounter = useCallback(
    (type: string) => {
      const newCounter = (tileCounters[type] || 0) + 1;
      setTileCounters((prev) => ({ ...prev, [type]: newCounter }));
      return newCounter;
    },
    [tileCounters],
  );

  const getDefaultContent = useCallback((type: string) => {
    switch (type) {
      case "text":
        return { text: "" };
      case "code":
        return {
          code: '// Your code here\nconsole.log("Hello World");',
          language: "javascript",
        };
      case "note":
        return { text: "Add your notes here..." };
      case "image":
        return { src: "", alt: "Image placeholder" };
      case "mermaid":
        return {
          chart: "",
        };
      case "shape":
        return { shape: "rectangle", fill: "#3b82f6" };
      case "document":
        return {
          title: "New Document",
          description: "Click to add description",
          layout: {
            pageFormat: "A4" as const,
            orientation: "portrait" as const,
            margins: { top: 25, right: 25, bottom: 25, left: 25 },
            sections: [],
            createdDate: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          },
          linkedTileIds: [],
        };
      default:
        return {};
    }
  }, []);

  const createTileAtPosition = useCallback(
    (type: string, x: number, y: number, width: number, height: number) => {
      const newCounter = incrementTileCounter(type);
      const tileName = `${type.charAt(0).toUpperCase() + type.slice(1)} ${newCounter}`;

      // Set standard sizes for different tile types
      let finalWidth = width;
      let finalHeight = height;

      if (width === 0 || height === 0) {
        if (type === "document") {
          finalWidth = 200;
          finalHeight = 280;
        } else if (type === "code") {
          finalWidth = 500;
          finalHeight = 400;
        } else if (type === "mermaid") {
          finalWidth = 250;
          finalHeight = 250;
        } else if (type === "image") {
          finalWidth = 400;
          finalHeight = 225;
        } else if (type === "text") {
          finalWidth = 600;
          finalHeight = 550;
        } else {
          finalWidth = 325;
          finalHeight = 250;
        }
      } else {
        if (type === "text") {
          finalWidth = Math.max(Math.abs(width), 600);
          finalHeight = Math.max(Math.abs(height), 550);
        } else if (type === "document") {
          finalWidth = Math.max(Math.abs(width), 200);
          finalHeight = Math.max(Math.abs(height), 280);
        } else {
          finalWidth = Math.max(Math.abs(width), 200);
          finalHeight = Math.max(Math.abs(height), 150);
        }
      }

      // Center the tile on the click position when using minimum sizes
      let tileX, tileY;
      if (width === 0 || height === 0) {
        tileX = x - finalWidth / 2;
        tileY = y - finalHeight / 2;
      } else {
        tileX = Math.min(x, x + width);
        tileY = Math.min(y, y + height);
      }

      const newTile: TileData = {
        id: generateId("tile"),
        type: type as TileData["type"],
        x: tileX,
        y: tileY,
        width: finalWidth,
        height: finalHeight,
        rotation: 0,
        title: tileName,
        content: getDefaultContent(type),
      };

      addTile(newTile);
      return newTile;
    },
    [addTile, incrementTileCounter, getDefaultContent],
  );

  // Connection utilities
  const determineOptimalAnchorPoints = useCallback(
    (fromTileId: string, toTileId: string) => {
      const fromTile = tiles.find((t: TileData) => t.id === fromTileId);
      const toTile = tiles.find((t: TileData) => t.id === toTileId);

      if (!fromTile || !toTile) return { fromSide: "right", toSide: "left" };

      const fromCenter = {
        x: fromTile.x + fromTile.width / 2,
        y: fromTile.y + fromTile.height / 2,
      };
      const toCenter = {
        x: toTile.x + toTile.width / 2,
        y: toTile.y + toTile.height / 2,
      };

      const dx = toCenter.x - fromCenter.x;
      const dy = toCenter.y - fromCenter.y;

      let fromSide: "top" | "right" | "bottom" | "left";
      let toSide: "top" | "right" | "bottom" | "left";

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          fromSide = "right";
          toSide = "left";
        } else {
          fromSide = "left";
          toSide = "right";
        }
      } else {
        if (dy > 0) {
          fromSide = "bottom";
          toSide = "top";
        } else {
          fromSide = "top";
          toSide = "bottom";
        }
      }

      return { fromSide, toSide };
    },
    [tiles],
  );

  const getConnectionPoint = (
    tileId: string,
    side: "top" | "right" | "bottom" | "left",
  ) => {
    const tile = tiles.find((t: TileData) => t.id === tileId);
    if (!tile) return { x: 0, y: 0 };

    switch (side) {
      case "top":
        return { x: tile.x + tile.width / 2, y: tile.y };
      case "right":
        return { x: tile.x + tile.width, y: tile.y + tile.height / 2 };
      case "bottom":
        return { x: tile.x + tile.width / 2, y: tile.y + tile.height };
      case "left":
        return { x: tile.x, y: tile.y + tile.height / 2 };
    }
  };

  const createConnection = useCallback(
    (
      fromTileId: string,
      toTileId: string,
      label?: string,
      explicitFromSide?: "top" | "right" | "bottom" | "left",
      explicitToSide?: "top" | "right" | "bottom" | "left",
    ) => {
      // Use explicit sides if provided, otherwise determine optimal ones
      let fromSide: "top" | "right" | "bottom" | "left";
      let toSide: "top" | "right" | "bottom" | "left";

      if (explicitFromSide && explicitToSide) {
        fromSide = explicitFromSide;
        toSide = explicitToSide;
      } else {
        const optimal = determineOptimalAnchorPoints(fromTileId, toTileId);
        fromSide = (explicitFromSide || optimal.fromSide) as
          | "top"
          | "right"
          | "bottom"
          | "left";
        toSide = (explicitToSide || optimal.toSide) as
          | "top"
          | "right"
          | "bottom"
          | "left";
      }

      const newConnection: Connection = {
        id: generateId("connection"),
        fromTileId,
        toTileId,
        fromSide,
        toSide,
        label,
      };

      addConnection(newConnection);
      return newConnection;
    },
    [addConnection, determineOptimalAnchorPoints],
  );

  // Selection functions
  const selectTile = useCallback((id: string, multiSelect = false) => {
    if (multiSelect) {
      setSelectedTileIds((prev) =>
        prev.includes(id)
          ? prev.filter((tileId) => tileId !== id)
          : [...prev, id],
      );
    } else {
      setSelectedTileIds([id]);
    }
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedTileIds([]);
    setSelectedConnectionId(null);
  }, []);

  // Clear selections when board changes
  useEffect(() => {
    deselectAll();
  }, [currentBoardId, deselectAll]);

  // Generate test data functionality
  const generateTestData = useCallback(() => {
    if (!currentBoardId) return;

    // Create sample tiles
    const sampleTiles = [
      {
        id: `tile-${Date.now()}-1`,
        type: "text" as const,
        x: 100,
        y: 100,
        width: 600,
        height: 550,
        rotation: 0,
        title: "Sample Text Tile",
        content: {
          text: "This is a sample text tile for testing purposes. You can edit this content to test the text rendering functionality.",
        },
      },
      {
        id: `tile-${Date.now()}-2`,
        type: "code" as const,
        x: 800,
        y: 100,
        width: 500,
        height: 400,
        rotation: 0,
        title: "Sample Code Tile",
        content: {
          code: "function helloWorld() {\n  console.log('Hello, World!');\n  return 'Sample code for testing';\n}",
          language: "javascript",
        },
      },
      {
        id: `tile-${Date.now()}-3`,
        type: "mermaid" as const,
        x: 100,
        y: 700,
        width: 250,
        height: 250,
        rotation: 0,
        title: "Sample Mermaid Tile",
        content: {
          chart: "",
        },
      },
      {
        id: `tile-${Date.now()}-4`,
        type: "note" as const,
        x: 400,
        y: 700,
        width: 325,
        height: 250,
        rotation: 0,
        title: "Sample Note Tile",
        content: {
          text: "This is a sample note tile. Notes are great for quick thoughts and reminders.",
        },
      },
      {
        id: `tile-${Date.now()}-5`,
        type: "document" as const,
        x: 800,
        y: 700,
        width: 200,
        height: 280,
        rotation: 0,
        title: "Sample Document",
        content: {
          title: "Sample Document",
          description:
            "This is a sample document tile with standard proportions.",
          status: "draft",
          dueDate: "",
          assignees: [],
          tags: [],
          attachments: [],
          subtasks: [{ id: "1", text: "Review sample", completed: false }],
          comments: [],
        },
      },
    ];

    // Create sample connections between tiles
    const sampleConnections = [
      {
        id: `connection-${Date.now()}-1`,
        fromTileId: sampleTiles[0].id, // Text tile
        toTileId: sampleTiles[1].id, // Code tile
        fromSide: "right" as const,
        toSide: "left" as const,
        label: "",
      },
      {
        id: `connection-${Date.now()}-2`,
        fromTileId: sampleTiles[1].id, // Code tile
        toTileId: sampleTiles[2].id, // Mermaid tile
        fromSide: "bottom" as const,
        toSide: "top" as const,
        label: "",
      },
      {
        id: `connection-${Date.now()}-3`,
        fromTileId: sampleTiles[2].id, // Mermaid tile
        toTileId: sampleTiles[3].id, // Note tile
        fromSide: "right" as const,
        toSide: "left" as const,
        label: "",
      },
    ];

    // Clear existing data and add sample tiles and connections
    useBoardStore.getState().update({
      tiles: sampleTiles,
      connections: sampleConnections,
    });

    // Clear selections
    deselectAll();

    markDirty();
    console.log("✓ Generated test data with", sampleTiles.length, "tiles");
  }, [currentBoardId, markDirty, deselectAll]);

  // Rest of the component implementation...
  // (Keyboard shortcuts, canvas drawing, event handlers, etc.)
  // For brevity, I'll include just the essential parts for now

  // Load initial board data
  useEffect(() => {
    if (initialBoardData && currentBoardId) {
      // Seed store to initialize the board data
      useBoardStore.getState().update(initialBoardData);
      pushToHistory();
    }
  }, [initialBoardData, currentBoardId, pushToHistory]);

  // Auto-save effect
  useEffect(() => {
    if (!isDirty) return;

    const autoSaveTimer = setTimeout(() => {
      useBoardStore.getState().flushNow();
      setIsDirty(false);
    }, UI_DELAYS.AUTO_SAVE); // Auto-save after inactivity

    return () => clearTimeout(autoSaveTimer);
  }, [isDirty]);

  const handleManualSave = useCallback(
    (e: CustomEvent) => {
      if (e.detail.boardId === currentBoardId) {
        useBoardStore.getState().flushNow();
      }
    },
    [currentBoardId],
  );

  useEventListener(
    "manual-save-requested",
    handleManualSave as (e: Event) => void,
    window,
  );

  const handleGenerateTestData = useCallback(() => {
    generateTestData();
  }, [generateTestData]);

  const handleClearAllData = useCallback(() => {
    if (currentBoardId) {
      useBoardStore.getState().update({ tiles: [], connections: [] });
      deselectAll();
      markDirty();
      console.log("✓ Cleared all canvas data");
    }
  }, [currentBoardId, deselectAll, markDirty]);

  useEventListener(
    "generate-test-data-requested",
    handleGenerateTestData,
    window,
  );
  useEventListener("clear-all-data-requested", handleClearAllData, window);

  // Export images handler
  const handleExportImages = useCallback(() => {
    if (selectedTileIds.length === 0) {
      alert("Please select some tiles first");
      return;
    }

    const selectedTiles = tiles.filter((tile) =>
      selectedTileIds.includes(tile.id),
    );
    const imageTiles = selectedTiles.filter((tile) => tile.type === "image");

    if (imageTiles.length === 0) {
      alert("No image tiles selected");
      return;
    }

    // Export each image tile as a text file
    imageTiles.forEach((tile, index) => {
      const imageData = tile.content as { src?: string; alt?: string };
      const imageInfo = {
        tileId: tile.id,
        tileType: tile.type,
        position: { x: tile.x, y: tile.y },
        size: { width: tile.width, height: tile.height },
        imageSrc: imageData.src || "No image source",
        imageAlt: imageData.alt || "No alt text",
        exportedAt: new Date().toISOString(),
      };

      const textContent = `Image Tile Export
==================

Tile ID: ${imageInfo.tileId}
Type: ${imageInfo.tileType}
Position: (${imageInfo.position.x}, ${imageInfo.position.y})
Size: ${imageInfo.size.width} x ${imageInfo.size.height}
Image Source: ${imageInfo.imageSrc}
Alt Text: ${imageInfo.imageAlt}
Exported: ${imageInfo.exportedAt}

--- End of Image Tile ---`;

      const blob = new Blob([textContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image-tile-${tile.id}-${index + 1}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    console.log(`✓ Exported ${imageTiles.length} image tiles as text files`);
  }, [selectedTileIds, tiles]);

  useEventListener("export-images-requested", handleExportImages, window);

  // Import handler
  useEffect(() => {
    const handleImport = (e: Event) => {
      try {
        const ce = e as CustomEvent<{
          data?: BoardData;
          tiles?: TileData[];
          connections?: Connection[];
          assets?: Record<string, unknown>;
          version?: string;
        }>;
        const incoming = ce.detail;
        // Support both { tiles, connections, assets?, version? } and { data: BoardData, board?: any }
        const data = (incoming?.data ?? incoming) as {
          tiles?: TileData[];
          connections?: Connection[];
          assets?: Record<string, unknown>;
          version?: string;
        };
        if (
          !data ||
          !Array.isArray(data.tiles) ||
          !Array.isArray(data.connections)
        ) {
          alert("Invalid board data format.");
          return;
        }
        useBoardStore.getState().update({
          tiles: data.tiles,
          connections: data.connections,
        });
        deselectAll();
        markDirty();
        console.log("✓ Imported board data");
      } catch (err) {
        console.error("Import failed:", err);
        alert("Import failed. See console for details.");
      }
    };

    window.addEventListener(
      "import-board-data-requested",
      handleImport as EventListener,
    );
    return () =>
      window.removeEventListener(
        "import-board-data-requested",
        handleImport as EventListener,
      );
  }, [markDirty, deselectAll]);

  // Delete confirmation helpers
  const confirmDelete = useCallback((deleteAction: () => void) => {
    setPendingDeleteAction(() => deleteAction);
    setShowDeleteDialog(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (pendingDeleteAction) {
      pendingDeleteAction();
    }
    setShowDeleteDialog(false);
    setPendingDeleteAction(null);
  }, [pendingDeleteAction]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteDialog(false);
    setPendingDeleteAction(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
        e.preventDefault();
        setIsAdminPanelOpen(true);
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const activeElement = document.activeElement;

        // Enhanced text editing detection
        const isInputFocused =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            (activeElement as HTMLElement).contentEditable === "true" ||
            activeElement.getAttribute("contenteditable") === "true" ||
            activeElement.getAttribute("contenteditable") === "" ||
            activeElement.closest('[contenteditable="true"]') ||
            activeElement.closest('[contenteditable=""]') ||
            activeElement.closest("input") ||
            activeElement.closest("textarea") ||
            activeElement.closest('[role="textbox"]') ||
            activeElement.closest(".ProseMirror") ||
            activeElement.closest(".CodeMirror") ||
            activeElement.closest("[data-slate-editor]"));

        // Additional checks for editing contexts
        const isInsideTile = activeElement?.closest("[data-tile-id]");
        const isInsidePromptWriter =
          activeElement?.closest("[data-prompt-writer-container]") ||
          activeElement?.closest("[data-template-container]");

        if (!isInputFocused && !isInsideTile && !isInsidePromptWriter) {
          e.preventDefault();

          // Check if there's anything to delete
          const hasSelection =
            selectedConnectionId || selectedTileIds.length > 0;

          if (hasSelection) {
            confirmDelete(() => {
              // Delete selected connection
              if (selectedConnectionId) {
                deleteConnection(selectedConnectionId);
              }

              // Delete selected tiles
              if (selectedTileIds.length > 0) {
                deleteMultipleTiles(selectedTileIds);
              }
            });
          }
        }
      }
    },
    [
      selectedTileIds,
      deleteConnection,
      selectedConnectionId,
      confirmDelete,
      setIsAdminPanelOpen,
      deleteMultipleTiles,
    ],
  );

  useEventListener("keydown", handleKeyDown, window);

  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setStageSize({
        width: rect.width,
        height: rect.height,
      });
    }
  }, []);

  useEffect(() => {
    updateSize();
  }, [updateSize]);

  useEventListener("resize", updateSize, window);

  // Grid drawing
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showGrid || zoom < 0.5) return;

    // const gridSize = 20 * zoom; // Unused for now
    const visibleLeft = -pan.x / zoom;
    const visibleTop = -pan.y / zoom;
    const visibleRight = (canvas.width - pan.x) / zoom;
    const visibleBottom = (canvas.height - pan.y) / zoom;

    ctx.strokeStyle = "hsl(var(--border))";
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    // Draw vertical lines
    const startX = Math.floor(visibleLeft / 20) * 20;
    for (let worldX = startX; worldX <= visibleRight; worldX += 20) {
      const screenX = worldX * zoom + pan.x;
      if (screenX >= -1 && screenX <= canvas.width + 1) {
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, canvas.height);
      }
    }

    // Draw horizontal lines
    const startY = Math.floor(visibleTop / 20) * 20;
    for (let worldY = startY; worldY <= visibleBottom; worldY += 20) {
      const screenY = worldY * zoom + pan.y;
      if (screenY >= -1 && screenY <= canvas.height + 1) {
        ctx.moveTo(0, screenY);
        ctx.lineTo(canvas.width, screenY);
      }
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [showGrid, zoom, pan.x, pan.y]);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = stageSize.width;
      canvasRef.current.height = stageSize.height;
      drawGrid();
    }
  }, [stageSize.width, stageSize.height, drawGrid]);

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scaleBy = 1.05;
      const direction = e.deltaY > 0 ? 1 : -1;
      const newZoom = direction > 0 ? zoom / scaleBy : zoom * scaleBy;
      const clampedZoom = Math.max(0.1, Math.min(5, newZoom));

      const mousePointTo = {
        x: (mouseX - pan.x) / zoom,
        y: (mouseY - pan.y) / zoom,
      };

      setZoom(clampedZoom);
      setPan({
        x: mouseX - mousePointTo.x * clampedZoom,
        y: mouseY - mousePointTo.y * clampedZoom,
      });
    },
    [zoom, pan, setZoom, setPan],
  );

  // Attach wheel event listener with passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // Canvas event handlers
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        deselectAll();
      }
    },
    [deselectAll],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool && e.target === e.currentTarget) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;

        // Start dragging for potential tile creation
        setIsDragging(true);
        setDragStart({ x, y });
        setDragEnd({ x, y });
        e.preventDefault();
      } else if (e.target === e.currentTarget) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        setIsPanning(true);
        setPanStart({
          x: e.clientX - pan.x,
          y: e.clientY - pan.y,
        });
        deselectAll();
        e.preventDefault();
      }
    },
    [activeTool, pan.x, pan.y, zoom, deselectAll],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && activeTool) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;

        setDragEnd({ x, y });
      } else if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else if (isConnecting) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;

        const targetTile = tiles.find(
          (tile: TileData) =>
            x >= tile.x &&
            x <= tile.x + tile.width &&
            y >= tile.y &&
            y <= tile.y + tile.height &&
            tile.id !== connectionStart?.tileId,
        );

        setConnectionTarget(targetTile ? { tileId: targetTile.id } : null);
      } else if (isDraggingConnection) {
        // Call handleConnectionDrag directly to avoid dependency issues
        if (
          !isDraggingConnection ||
          !selectedConnectionId ||
          !connectionDragStart
        )
          return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const currentX = (e.clientX - rect.left - pan.x) / zoom;
        const currentY = (e.clientY - rect.top - pan.y) / zoom;

        // Find target tile under cursor
        const targetTile = tiles.find(
          (tile: TileData) =>
            currentX >= tile.x &&
            currentX <= tile.x + tile.width &&
            currentY >= tile.y &&
            currentY <= tile.y + tile.height,
        );

        setConnectionTarget(targetTile ? { tileId: targetTile.id } : null);
      } else if (isDraggingControlPoint) {
        // Handle control point dragging
        if (
          !isDraggingControlPoint ||
          !selectedConnectionId ||
          !controlPointDragStart
        )
          return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const currentX = (e.clientX - rect.left - pan.x) / zoom;
        const currentY = (e.clientY - rect.top - pan.y) / zoom;

        // Calculate new offset based on drag
        const deltaX = currentX - controlPointDragStart.x;
        const deltaY = currentY - controlPointDragStart.y;

        const newOffset = {
          x: controlPointDragStart.initialOffset.x + deltaX,
          y: controlPointDragStart.initialOffset.y + deltaY,
        };

        // Update the connection with new offset
        const updatedConnections = connections.map((conn: Connection) =>
          conn.id === selectedConnectionId
            ? { ...conn, controlPointOffset: newOffset }
            : conn,
        );
        useBoardStore.getState().update({ connections: updatedConnections });
      }
    },
    [
      isDragging,
      activeTool,
      pan.x,
      pan.y,
      zoom,
      isPanning,
      panStart.x,
      panStart.y,
      isConnecting,
      tiles,
      connectionStart,
      isDraggingConnection,
      selectedConnectionId,
      connectionDragStart,
      isDraggingControlPoint,
      controlPointDragStart,
      connections,
      selectedConnectionId,
    ],
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (isDragging && activeTool) {
      const width = dragEnd.x - dragStart.x;
      const height = dragEnd.y - dragStart.y;

      // If drag area is too small, create tile with minimum size
      if (Math.abs(width) < 20 || Math.abs(height) < 20) {
        const newTile = createTileAtPosition(
          activeTool,
          dragStart.x,
          dragStart.y,
          0, // Will use minimum size from createTileAtPosition
          0,
        );
        selectTile(newTile.id);
      } else {
        // Use actual drag dimensions
        const newTile = createTileAtPosition(
          activeTool,
          dragStart.x,
          dragStart.y,
          width,
          height,
        );
        selectTile(newTile.id);
      }

      setIsDragging(false);
      setActiveTool(null);
    } else if (isPanning) {
      setIsPanning(false);
    } else if (isDraggingConnection) {
      // Inline handleConnectionDragEnd logic to avoid dependency issues
      if (!isDraggingConnection || !selectedConnectionId) return;

      const connection = connections.find(
        (conn: Connection) => conn.id === selectedConnectionId,
      );
      if (!connection) return;

      if (
        connectionTarget &&
        connectionTarget.tileId !== connection.fromTileId
      ) {
        // Delete old connection and create new one
        deleteConnection(selectedConnectionId);
        createConnection(connection.fromTileId, connectionTarget.tileId);
      }

      setIsDraggingConnection(false);
      setConnectionDragStart(null);
      setIsConnecting(false);
      setConnectionStart(null);
      setConnectionTarget(null);
      setSelectedConnectionId(null);
    } else if (isDraggingControlPoint) {
      // Stop dragging control point
      setIsDraggingControlPoint(false);
      setControlPointDragStart(null);
    }
  }, [
    isDragging,
    activeTool,
    dragEnd.x,
    dragEnd.y,
    dragStart.x,
    dragStart.y,
    createTileAtPosition,
    selectTile,
    isPanning,
    isDraggingConnection,
    selectedConnectionId,
    connections,
    connectionTarget,
    deleteConnection,
    createConnection,
    isDraggingControlPoint,
  ]);

  const selectTool = useCallback((type: TileData["type"]) => {
    setActiveTool(type);
  }, []);

  // Connection functions
  const handleStartConnection = useCallback(
    (tileId: string, side?: "top" | "right" | "bottom" | "left") => {
      setIsConnecting(true);
      setConnectionStart({
        tileId,
        side: side || "right", // Default to right if not specified
      });
    },
    [],
  );

  const handleEndConnection = useCallback(
    (tileId: string, side?: "top" | "right" | "bottom" | "left") => {
      if (
        isConnecting &&
        connectionStart &&
        connectionStart.tileId !== tileId
      ) {
        // Use the explicit sides from the connection start and end
        createConnection(
          connectionStart.tileId,
          tileId,
          undefined, // label
          connectionStart.side,
          side, // If side not provided, createConnection will determine it
        );
      }
      setIsConnecting(false);
      setConnectionStart(null);
      setConnectionTarget(null);
    },
    [isConnecting, connectionStart, createConnection],
  );

  const handleCancelConnection = useCallback(() => {
    setIsConnecting(false);
    setConnectionStart(null);
    setConnectionTarget(null);
  }, []);

  const handleConnectionMouseDown = (
    e: React.MouseEvent,
    connectionId: string,
  ) => {
    e.stopPropagation();
    setSelectedConnectionId(connectionId);
    // Just select the connection, don't start dragging
    // Users can drag the control point to adjust the path instead
  };

  const handleControlPointMouseDown = (
    e: React.MouseEvent,
    connectionId: string,
    currentOffset: { x: number; y: number },
  ) => {
    e.stopPropagation();
    setSelectedConnectionId(connectionId);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDraggingControlPoint(true);
    setControlPointDragStart({
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
      initialOffset: currentOffset,
    });
  };

  const expandBounds = (
    bounds: { x: number; y: number; width: number; height: number },
    padding: number,
  ) => ({
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  });

  // Connection rendering
  const renderConnections = () => {
    return connections.map((connection: Connection) => {
      const fromTile = tiles.find(
        (t: TileData) => t.id === connection.fromTileId,
      );
      const toTile = tiles.find((t: TileData) => t.id === connection.toTileId);

      if (!fromTile || !toTile) return null;

      const fromPoint = getConnectionPoint(
        connection.fromTileId,
        connection.fromSide,
      );
      const toPoint = getConnectionPoint(
        connection.toTileId,
        connection.toSide,
      );

      const adjustedFromPoint = {
        x: fromPoint.x - canvasBounds.minX,
        y: fromPoint.y - canvasBounds.minY,
      };
      const adjustedToPoint = {
        x: toPoint.x - canvasBounds.minX,
        y: toPoint.y - canvasBounds.minY,
      };

      // Get connection style (default to hand-drawn)
      const style = connection.style || "hand-drawn";
      const roughness = connection.roughness ?? 1;
      const strokeWidth = connection.strokeWidth ?? 2;
      const color = connection.color;

      // Generate path based on style
      let pathData: string;
      let controlPoint: { x: number; y: number } | null = null;

      if (style === "straight") {
        // Clean orthogonal routing with 90-degree angles (like draw.io)
        const result = createOrthogonalPath(
          adjustedFromPoint,
          adjustedToPoint,
          connection.fromSide as "top" | "right" | "bottom" | "left",
          connection.toSide as "top" | "right" | "bottom" | "left",
          { controlPointOffset: connection.controlPointOffset },
        );
        pathData = result.pathData;
        controlPoint = result.controlPoint;
      } else if (style === "smooth") {
        pathData = createSmoothCurve(adjustedFromPoint, adjustedToPoint);
        controlPoint = {
          x: (adjustedFromPoint.x + adjustedToPoint.x) / 2,
          y: (adjustedFromPoint.y + adjustedToPoint.y) / 2,
        };
      } else {
        // hand-drawn style (default)
        // Use connection ID as seed for consistent randomness
        const seed =
          parseInt(connection.id.replace(/\D/g, "").slice(0, 8)) ||
          Math.random() * 10000;
        const result = createHandDrawnOrthogonalPath(
          adjustedFromPoint,
          adjustedToPoint,
          connection.fromSide as "top" | "right" | "bottom" | "left",
          connection.toSide as "top" | "right" | "bottom" | "left",
          {
            roughness,
            seed,
            bowing: 1,
            controlPointOffset: connection.controlPointOffset,
          },
        );
        pathData = result.pathData;
        controlPoint = result.controlPoint;
      }
      const isSelected = selectedConnectionId === connection.id;

      return (
        <g key={connection.id}>
          {/* Invisible wider path for easier clicking */}
          <path
            d={pathData}
            stroke="transparent"
            strokeWidth="12"
            fill="none"
            className="cursor-pointer pointer-events-auto"
            onMouseDown={(e) => handleConnectionMouseDown(e, connection.id)}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Visible connection path */}
          <path
            d={pathData}
            stroke={isSelected ? "#f59e0b" : color || "#0ea5e9"}
            strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
            fill="none"
            markerEnd={
              isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"
            }
            className="pointer-events-none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Selection indicator - draggable control point */}
          {isSelected && controlPoint && (
            <>
              <circle
                cx={controlPoint.x}
                cy={controlPoint.y}
                r="8"
                fill="#f59e0b"
                stroke="#fff"
                strokeWidth="2"
                className="cursor-move"
                style={{ cursor: "move", pointerEvents: "auto" }}
                onMouseDown={(e) => {
                  handleControlPointMouseDown(
                    e,
                    connection.id,
                    connection.controlPointOffset || { x: 0, y: 0 },
                  );
                }}
                onClick={(e) => e.stopPropagation()}
              />
              {/* Delete button near arrow start */}
              <g>
                <circle
                  cx={
                    adjustedFromPoint.x +
                    (connection.fromSide === "right"
                      ? 20
                      : connection.fromSide === "left"
                        ? -20
                        : 0)
                  }
                  cy={
                    adjustedFromPoint.y +
                    (connection.fromSide === "bottom"
                      ? 20
                      : connection.fromSide === "top"
                        ? -20
                        : 0)
                  }
                  r="10"
                  fill="#ef4444"
                  stroke="#fff"
                  strokeWidth="2"
                  className="cursor-pointer"
                  style={{ pointerEvents: "auto" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    deleteConnection(connection.id);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                />
                <text
                  x={
                    adjustedFromPoint.x +
                    (connection.fromSide === "right"
                      ? 20
                      : connection.fromSide === "left"
                        ? -20
                        : 0)
                  }
                  y={
                    adjustedFromPoint.y +
                    (connection.fromSide === "bottom"
                      ? 20
                      : connection.fromSide === "top"
                        ? -20
                        : 0)
                  }
                  fill="#fff"
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  ×
                </text>
              </g>
            </>
          )}
        </g>
      );
    });
  };

  const renderMultiSelectionFrame = () => {
    if (!selectedBounds || selectedTileIds.length < 2) return null;

    const selectionPadding = 6 / zoom;
    const handleSize = 8 / zoom;
    const handleRadius = 2 / zoom;
    const handleStrokeWidth = 2 / zoom;
    const visualBounds = expandBounds(selectedBounds, selectionPadding);

    const combinedBounds = {
      x: visualBounds.x - canvasBounds.minX,
      y: visualBounds.y - canvasBounds.minY,
      width: visualBounds.width,
      height: visualBounds.height,
    };

    const handlePoints = [
      {
        x: combinedBounds.x,
        y: combinedBounds.y,
        cursor: "nwse-resize",
      },
      {
        x: combinedBounds.x + combinedBounds.width / 2,
        y: combinedBounds.y,
        cursor: "ns-resize",
      },
      {
        x: combinedBounds.x + combinedBounds.width,
        y: combinedBounds.y,
        cursor: "nesw-resize",
      },
      {
        x: combinedBounds.x + combinedBounds.width,
        y: combinedBounds.y + combinedBounds.height / 2,
        cursor: "ew-resize",
      },
      {
        x: combinedBounds.x + combinedBounds.width,
        y: combinedBounds.y + combinedBounds.height,
        cursor: "nwse-resize",
      },
      {
        x: combinedBounds.x + combinedBounds.width / 2,
        y: combinedBounds.y + combinedBounds.height,
        cursor: "ns-resize",
      },
      {
        x: combinedBounds.x,
        y: combinedBounds.y + combinedBounds.height,
        cursor: "nesw-resize",
      },
      {
        x: combinedBounds.x,
        y: combinedBounds.y + combinedBounds.height / 2,
        cursor: "ew-resize",
      },
    ];

    return (
      <svg
        className="absolute pointer-events-none"
        style={{
          left: canvasBounds.minX,
          top: canvasBounds.minY,
          width: canvasBounds.width,
          height: canvasBounds.height,
          overflow: "visible",
        }}
      >
        <g>
          <rect
            x={combinedBounds.x}
            y={combinedBounds.y}
            width={combinedBounds.width}
            height={combinedBounds.height}
            fill="none"
            stroke="var(--selection-accent)"
            strokeWidth={2}
            strokeDasharray="5,5"
          />
          {handlePoints.map((h, index) => (
            <rect
              key={`${h.x}-${h.y}-${index}`}
              x={h.x - handleSize / 2}
              y={h.y - handleSize / 2}
              width={handleSize}
              height={handleSize}
              fill="var(--background)"
              stroke="var(--selection-accent)"
              strokeWidth={handleStrokeWidth}
              rx={handleRadius}
              style={{ cursor: h.cursor }}
            />
          ))}
        </g>
      </svg>
    );
  };

  const handleDeleteTileWithConfirmation = useCallback(
    (id: string) => {
      confirmDelete(() => {
        deleteTile(id);
      });
    },
    [deleteTile, confirmDelete],
  );

  return (
    <div className="relative h-screen w-full flex  overflow-hidden">
      <UndoRedoHandler boardId={effectiveBoardId || "temp-board"} />
      <div className="flex-1 relative">
        <LogoBar />
        <CanvasToolbar
          onSelectTool={selectTool}
          activeTool={activeTool}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(!showGrid)}
          onResetZoom={() => setZoom(1)}
          onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
          isAdminPanelOpen={isAdminPanelOpen}
        />

        <ZoomControls
          zoom={zoom}
          onZoomIn={() => setZoom(Math.min(5, zoom * 1.2))}
          onZoomOut={() => setZoom(Math.max(0.1, zoom / 1.2))}
          onResetZoom={() => setZoom(1)}
        />

        {selectedTileIds.length >= 2 && (
          <div className="absolute top-20 left-4 z-20">
            <AlignmentToolbar
              selectedTiles={selectedTiles}
              onUpdateTile={updateTile}
            />
          </div>
        )}

        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onClick={(e) => {
            if (isConnecting && e.target === e.currentTarget) {
              handleCancelConnection();
            }
            handleCanvasClick(e);
          }}
          style={
            {
              cursor: activeTool
                ? "crosshair"
                : isPanning
                  ? "grabbing"
                  : isConnecting
                    ? "crosshair"
                    : isDraggingConnection
                      ? "grabbing"
                      : "grab",
              "--selection-accent": "#3b82f6",
            } as React.CSSProperties
          }
        >
          <canvas
            ref={canvasRef}
            width={stageSize.width}
            height={stageSize.height}
            className="absolute inset-0 pointer-events-none"
          />

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <svg
              className="absolute"
              style={{
                left: canvasBounds.minX,
                top: canvasBounds.minY,
                width: canvasBounds.width,
                height: canvasBounds.height,
                pointerEvents: isDraggingConnection ? "auto" : "none",
                overflow: "visible",
              }}
            >
              <defs>
                {/* Hand-drawn style arrowhead */}
                <marker
                  id="arrowhead"
                  markerWidth="12"
                  markerHeight="10"
                  refX="11"
                  refY="5"
                  orient="auto"
                >
                  <path
                    d="M 0,0 L 12,5 L 0,10 L 3,5 Z"
                    fill="#0ea5e9"
                    stroke="#0ea5e9"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                  />
                </marker>
                {/* Selected arrowhead */}
                <marker
                  id="arrowhead-selected"
                  markerWidth="12"
                  markerHeight="10"
                  refX="11"
                  refY="5"
                  orient="auto"
                >
                  <path
                    d="M 0,0 L 12,5 L 0,10 L 3,5 Z"
                    fill="#f59e0b"
                    stroke="#f59e0b"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                  />
                </marker>
              </defs>
              {renderConnections()}
            </svg>
            {isDragging && activeTool && (
              <div
                className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
                style={{
                  left: Math.min(dragStart.x, dragEnd.x),
                  top: Math.min(dragStart.y, dragEnd.y),
                  width: Math.abs(dragEnd.x - dragStart.x),
                  height: Math.abs(dragEnd.y - dragStart.y),
                }}
              />
            )}

            <div className="pointer-events-auto">
              {tiles.map((tile: TileData) => (
                <CanvasTile
                  key={tile.id}
                  tile={tile}
                  isSelected={selectedTileIds.includes(tile.id)}
                  zoom={zoom}
                  onSelect={(multiSelect) => selectTile(tile.id, multiSelect)}
                  onUpdate={(updates) => updateTile(tile.id, updates)}
                  onDelete={() => handleDeleteTileWithConfirmation(tile.id)}
                  onStartConnection={handleStartConnection}
                  onEndConnection={handleEndConnection}
                  isConnectionTarget={connectionTarget?.tileId === tile.id}
                  isConnectionMode={isConnecting}
                  allTiles={tiles}
                  connections={connections}
                  onOpenDocumentSideView={openDocumentSideView}
                />
              ))}
            </div>
            {renderMultiSelectionFrame()}
          </div>
        </div>
      </div>

      <div className="w-80 bg-card border-l flex-shrink-0 flex flex-col h-full overflow-y-scroll">
        <div className="border-b">
          <LayersPanel
            tiles={tiles}
            selectedTileIds={selectedTileIds}
            onSelectTile={selectTile}
            onDeleteTile={handleDeleteTileWithConfirmation}
            compact={true}
          />
        </div>

        <div className="">
          <PropertiesPanel
            selectedTiles={selectedTiles}
            onUpdateTile={updateTile}
            allTiles={tiles}
          />
        </div>
      </div>

      {/* Admin Development Panel */}
      <AdminDevPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelDelete();
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTileIds.length > 1
                ? `Are you sure you want to delete ${selectedTileIds.length} selected tiles?`
                : selectedTileIds.length === 1
                  ? "Are you sure you want to delete the selected tile?"
                  : selectedConnectionId
                    ? "Are you sure you want to delete the selected connection?"
                    : "Are you sure you want to delete the selected items?"}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              onClick={handleCancelDelete}
              className="hover:bg-muted/50"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Editor Panel */}
      {documentEditorState && (
        <DocumentEditorPanel
          isOpen={documentEditorState.isOpen}
          tileId={documentEditorState.tileId}
          title={
            tiles.find((t) => t.id === documentEditorState.tileId)?.title ||
            "Untitled Document"
          }
          description={
            tiles.find((t) => t.id === documentEditorState.tileId)?.content
              ?.description
          }
          layout={
            tiles.find((t) => t.id === documentEditorState.tileId)?.content
              ?.layout
          }
          linkedTileIds={
            tiles.find((t) => t.id === documentEditorState.tileId)?.content
              ?.linkedTileIds
          }
          allTiles={tiles}
          connections={connections}
          onClose={closeDocumentEditor}
          onUpdate={(updates) =>
            updateDocumentContent(documentEditorState.tileId, updates)
          }
        />
      )}
    </div>
  );
}
