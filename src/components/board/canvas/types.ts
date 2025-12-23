import type { BoardElement } from "@/lib/board-types";

export interface RemoteSelection {
    userId: string;
    userName: string;
    userColor: string;
    elementIds: string[];
}

export interface RemoteCursor {
    id: string;
    name: string;
    color: string;
    x: number;
    y: number;
    lastActivity: number;
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;
export type RotateHandleSide = "n" | "e" | "s" | "w";
export type ConnectorDragKind =
    | "normal"
    | "createCorner"
    | "curvedMid"
    | "elbowHandle"
    | "elbowOrtho"
    | "elbowEdge"
    | "elbowEndpoint";

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
