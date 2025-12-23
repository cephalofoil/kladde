"use client";

import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import type { BoardElement, Cursor } from "./board-types";
import { generateFunnyName } from "./funny-names";
import {
    encrypt,
    decrypt,
    isEncryptedElement,
    type EncryptedElement,
} from "./encryption";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface UserState {
    id: string;
    name: string;
    color: string;
    cursor?: { x: number; y: number } | null;
    viewport?: { pan: { x: number; y: number }; zoom: number };
    followingUserId?: string | null;
    drawingElement?: BoardElement | null;
    selectedElementIds?: string[];
}

// PartyKit host - set NEXT_PUBLIC_PARTYKIT_HOST in .env.local
const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST!;

// Type for elements stored in Y.Array (can be encrypted or plain)
type StoredElement = BoardElement | EncryptedElement;

export class CollaborationManager {
    private doc: Y.Doc;
    private provider: YPartyKitProvider | null = null;
    private elements: Y.Array<StoredElement>;
    private awareness: Map<number, Cursor> | null = null;
    private userId: string;
    private userName: string;
    private userColor: string;
    private connectionStatus: ConnectionStatus = "connecting";
    private encryptionKey: CryptoKey | null = null;
    private decryptedElementsCache: Map<string, BoardElement> = new Map();
    private isReadOnly: boolean;

    constructor(
        roomId: string,
        userName?: string,
        encryptionKey?: CryptoKey,
        options: { readOnly?: boolean } = {},
    ) {
        this.doc = new Y.Doc();
        this.elements = this.doc.getArray<StoredElement>("elements");
        this.userId = Math.random().toString(36).substring(2, 9);
        // Use provided name or generate a funny random name
        this.userName = userName || generateFunnyName();
        this.userColor = this.getRandomColor();
        this.encryptionKey = encryptionKey || null;
        this.isReadOnly = options.readOnly ?? false;

        // Connect to PartyKit
        this.provider = new YPartyKitProvider(
            PARTYKIT_HOST,
            `board-${roomId}`,
            this.doc,
            {
                connect: true,
            },
        );

        // Track connection status
        this.provider.on("sync", (isSynced: boolean) => {
            console.log("[Collaboration] Synced:", isSynced);
            this.connectionStatus = isSynced ? "connected" : "connecting";
        });

        this.provider.on("status", ({ status }: { status: string }) => {
            console.log("[Collaboration] Status:", status);
            if (status === "connected") {
                this.connectionStatus = "connected";
            } else if (status === "disconnected") {
                this.connectionStatus = "disconnected";
            }
        });

        // Set user awareness (skip in read-only mode)
        if (!this.isReadOnly) {
            this.provider.awareness.setLocalStateField("user", {
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                cursor: null,
            });
        } else {
            this.provider.awareness.setLocalState(null);
        }

        console.log(
            "[Collaboration] Initialized for room:",
            roomId,
            "as:",
            this.userName,
        );
    }

    private getRandomColor(): string {
        const colors = [
            "#f87171",
            "#fb923c",
            "#fbbf24",
            "#a3e635",
            "#4ade80",
            "#34d399",
            "#22d3d8",
            "#38bdf8",
            "#60a5fa",
            "#818cf8",
            "#a78bfa",
            "#c084fc",
            "#e879f9",
            "#f472b6",
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Check if encryption is enabled
     */
    isEncrypted(): boolean {
        return this.encryptionKey !== null;
    }

    /**
     * Decrypt a single stored element
     */
    private async decryptElement(
        stored: StoredElement,
    ): Promise<BoardElement | null> {
        if (!isEncryptedElement(stored)) {
            // Element is not encrypted, return as-is
            return stored as BoardElement;
        }

        if (!this.encryptionKey) {
            console.warn(
                "[Collaboration] Cannot decrypt element: no encryption key",
            );
            return null;
        }

        // Check cache first
        const cached = this.decryptedElementsCache.get(stored.id);
        if (cached) {
            return cached;
        }

        try {
            const decrypted = await decrypt<BoardElement>(
                this.encryptionKey,
                stored.ciphertext,
                stored.iv,
            );
            // Cache the decrypted element
            this.decryptedElementsCache.set(stored.id, decrypted);
            return decrypted;
        } catch (error) {
            console.error("[Collaboration] Failed to decrypt element:", error);
            return null;
        }
    }

    /**
     * Get all elements (decrypted if encryption is enabled)
     * Note: Returns cached elements for sync access
     */
    getElements(): BoardElement[] {
        const stored = this.elements.toArray();
        const result: BoardElement[] = [];

        for (const el of stored) {
            if (isEncryptedElement(el)) {
                // Try to get from cache
                const cached = this.decryptedElementsCache.get(el.id);
                if (cached) {
                    result.push(cached);
                }
                // If not cached, it will be decrypted asynchronously
            } else {
                result.push(el as BoardElement);
            }
        }

        return result;
    }

    /**
     * Get all elements asynchronously (ensures all are decrypted)
     */
    async getElementsAsync(): Promise<BoardElement[]> {
        const stored = this.elements.toArray();
        const decrypted = await Promise.all(
            stored.map((el) => this.decryptElement(el)),
        );
        return decrypted.filter((el): el is BoardElement => el !== null);
    }

    /**
     * Replace all elements at once (encrypts if encryption is enabled)
     */
    async setElements(nextElements: BoardElement[]): Promise<void> {
        if (this.isReadOnly) return;

        this.decryptedElementsCache.clear();

        let storedElements: StoredElement[] = [];
        const key = this.encryptionKey;
        if (key) {
            storedElements = await Promise.all(
                nextElements.map(async (element) => {
                    const { ciphertext, iv } = await encrypt(key, element);
                    this.decryptedElementsCache.set(element.id, element);
                    return {
                        id: element.id,
                        encrypted: true,
                        ciphertext,
                        iv,
                    } satisfies EncryptedElement;
                }),
            );
        } else {
            storedElements = nextElements;
        }

        this.doc.transact(() => {
            this.elements.delete(0, this.elements.length);
            if (storedElements.length > 0) {
                this.elements.insert(0, storedElements);
            }
        });
    }

    /**
     * Add a new element (encrypts if encryption is enabled)
     */
    async addElement(element: BoardElement): Promise<void> {
        if (this.isReadOnly) return;
        if (this.encryptionKey) {
            const { ciphertext, iv } = await encrypt(
                this.encryptionKey,
                element,
            );
            const encrypted: EncryptedElement = {
                id: element.id,
                encrypted: true,
                ciphertext,
                iv,
            };
            this.elements.push([encrypted]);
            // Pre-cache the decrypted element
            this.decryptedElementsCache.set(element.id, element);
        } else {
            this.elements.push([element]);
        }
    }

    /**
     * Update an existing element (re-encrypts if encryption is enabled)
     */
    async updateElement(
        id: string,
        updates: Partial<BoardElement>,
    ): Promise<void> {
        if (this.isReadOnly) return;
        const storedArray = this.elements.toArray();
        const index = storedArray.findIndex((el) => el.id === id);

        if (index !== -1) {
            const stored = storedArray[index];
            let currentElement: BoardElement;

            if (isEncryptedElement(stored)) {
                // Get from cache or decrypt
                const cached = this.decryptedElementsCache.get(id);
                if (cached) {
                    currentElement = cached;
                } else if (this.encryptionKey) {
                    const decrypted = await decrypt<BoardElement>(
                        this.encryptionKey,
                        stored.ciphertext,
                        stored.iv,
                    );
                    currentElement = decrypted;
                } else {
                    console.error(
                        "[Collaboration] Cannot update encrypted element without key",
                    );
                    return;
                }
            } else {
                currentElement = stored as BoardElement;
            }

            const updated = { ...currentElement, ...updates };

            if (this.encryptionKey) {
                const { ciphertext, iv } = await encrypt(
                    this.encryptionKey,
                    updated,
                );
                const encrypted: EncryptedElement = {
                    id: updated.id,
                    encrypted: true,
                    ciphertext,
                    iv,
                };
                // Replace atomically to avoid transient delete/insert flicker in observers.
                this.doc.transact(() => {
                    this.elements.delete(index, 1);
                    this.elements.insert(index, [encrypted]);
                });
                // Update cache
                this.decryptedElementsCache.set(id, updated);
            } else {
                // Replace atomically to avoid transient delete/insert flicker in observers.
                this.doc.transact(() => {
                    this.elements.delete(index, 1);
                    this.elements.insert(index, [updated]);
                });
            }
        }
    }

    /**
     * Delete an element
     */
    deleteElement(id: string): void {
        if (this.isReadOnly) return;
        const index = this.elements.toArray().findIndex((el) => el.id === id);
        if (index !== -1) {
            this.elements.delete(index, 1);
            // Remove from cache
            this.decryptedElementsCache.delete(id);
        }
    }

    /**
     * Clear all elements
     */
    clearAll(): void {
        if (this.isReadOnly) return;
        this.elements.delete(0, this.elements.length);
        this.decryptedElementsCache.clear();
    }

    /**
     * Subscribe to element changes
     * Callback receives decrypted elements
     */
    onElementsChange(callback: (elements: BoardElement[]) => void): () => void {
        const handler = async (event: Y.YArrayEvent<StoredElement>) => {
            if (this.encryptionKey) {
                // Invalidate cache for changed elements
                // When elements change from remote, we need to re-decrypt them
                const currentStored = this.elements.toArray();
                const currentIds = new Set(currentStored.map((el) => el.id));

                // Remove deleted elements from cache
                for (const cachedId of this.decryptedElementsCache.keys()) {
                    if (!currentIds.has(cachedId)) {
                        this.decryptedElementsCache.delete(cachedId);
                    }
                }

                // Invalidate cache for elements that were modified
                // We detect this by comparing ciphertext - if it changed, invalidate
                for (const stored of currentStored) {
                    if (isEncryptedElement(stored)) {
                        const cached = this.decryptedElementsCache.get(
                            stored.id,
                        );
                        if (cached) {
                            // Check if this element was in the delta (changed)
                            // Simple approach: always re-decrypt on remote changes
                            // by checking if the event came from a remote source
                            if (event.transaction.origin !== null) {
                                // Remote change - invalidate cache for this element
                                this.decryptedElementsCache.delete(stored.id);
                            }
                        }
                    }
                }

                // Decrypt all elements asynchronously
                const decrypted = await this.getElementsAsync();
                callback(decrypted);
            } else {
                callback(this.elements.toArray() as BoardElement[]);
            }
        };
        this.elements.observe(handler);
        return () => this.elements.unobserve(handler);
    }

    updateCursor(x: number, y: number): void {
        if (this.isReadOnly) return;
        if (this.provider) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: any;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                cursor: { x, y },
            });
        }
    }

    updateViewport(pan: { x: number; y: number }, zoom: number): void {
        if (this.isReadOnly) return;
        if (this.provider) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: any;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                viewport: { pan, zoom },
            });
        }
    }

    updateDrawingElement(element: BoardElement | null): void {
        if (this.isReadOnly) return;
        if (this.provider) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: any;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                drawingElement: element,
            });
        }
    }

    updateFollowingUser(userId: string | null): void {
        if (this.isReadOnly) return;
        if (this.provider) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: any;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                followingUserId: userId,
            });
        }
    }

    updateSelectedElements(elementIds: string[]): void {
        if (this.isReadOnly) return;
        if (this.provider) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: any;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                selectedElementIds: elementIds,
            });
        }
    }

    onAwarenessChange(
        callback: (users: Map<number, { user: UserState }>) => void,
    ): () => void {
        if (!this.provider) return () => {};

        const handler = () => {
            const states = this.provider!.awareness.getStates() as Map<
                number,
                { user: UserState }
            >;
            callback(states);
        };

        this.provider.awareness.on("change", handler);
        handler(); // Initial call

        return () => {
            this.provider?.awareness.off("change", handler);
        };
    }

    getConnectedUsers(): number {
        if (!this.provider) return 1;
        return this.provider.awareness.getStates().size;
    }

    getUserInfo() {
        return {
            id: this.userId,
            name: this.userName,
            color: this.userColor,
        };
    }

    /**
     * Update the user's display name and broadcast it to other users
     */
    updateUserName(newName: string): void {
        if (!newName.trim()) return;
        this.userName = newName.trim();

        if (this.provider && !this.isReadOnly) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: any;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
            });
        }
    }

    getConnectionStatus(): ConnectionStatus {
        return this.connectionStatus;
    }

    onConnectionChange(
        callback: (status: ConnectionStatus, peers: number) => void,
    ): () => void {
        if (!this.provider) return () => {};

        const syncHandler = (isSynced: boolean) => {
            this.connectionStatus = isSynced ? "connected" : "connecting";
            callback(this.connectionStatus, this.getConnectedUsers() - 1);
        };

        const statusHandler = ({ status }: { status: string }) => {
            if (status === "connected") {
                this.connectionStatus = "connected";
            } else if (status === "disconnected") {
                this.connectionStatus = "disconnected";
            }
            callback(this.connectionStatus, this.getConnectedUsers() - 1);
        };

        const awarenessHandler = () => {
            callback(this.connectionStatus, this.getConnectedUsers() - 1);
        };

        this.provider.on("sync", syncHandler);
        this.provider.on("status", statusHandler);
        this.provider.awareness.on("change", awarenessHandler);

        return () => {
            this.provider?.off("sync", syncHandler);
            this.provider?.off("status", statusHandler);
            this.provider?.awareness.off("change", awarenessHandler);
        };
    }

    destroy(): void {
        this.provider?.destroy();
        this.doc.destroy();
    }
}
