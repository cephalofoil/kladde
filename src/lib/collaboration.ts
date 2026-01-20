"use client";

import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import type { BoardElement, Cursor } from "./board-types";
import type { CollabPermission } from "./history-types";
import { generateFunnyName } from "./funny-names";
import {
    encrypt,
    decrypt,
    isEncryptedElement,
    type EncryptedElement,
} from "./encryption";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
const LOCAL_ORIGIN = "local";

export interface BoardMetadata {
    name?: string;
}

// Type for encrypted drawing element in awareness
export interface EncryptedDrawingElement {
    encrypted: true;
    ciphertext: string;
    iv: string;
}

// Drawing element can be plaintext or encrypted
export type AwarenessDrawingElement =
    | BoardElement
    | EncryptedDrawingElement
    | null;

export interface UserState {
    id: string;
    name: string;
    color: string;
    isOwner: boolean;
    permission: CollabPermission;
    lastActiveAt?: number;
    cursor?: { x: number; y: number } | null;
    viewport?: { pan: { x: number; y: number }; zoom: number };
    followingUserId?: string | null;
    drawingElement?: AwarenessDrawingElement;
    selectedElementIds?: string[];
}

// PartyKit host - set NEXT_PUBLIC_PARTYKIT_HOST in .env.local
const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST!;

// Type for elements stored in Y.Array (can be encrypted or plain)
type StoredElement = BoardElement | EncryptedElement;

export interface CollaborationOptions {
    readOnly?: boolean;
    isOwner?: boolean;
    permission?: CollabPermission;
}

export class CollaborationManager {
    private doc: Y.Doc;
    private provider: YPartyKitProvider | null = null;
    private elements: Y.Array<StoredElement>;
    private metadata: Y.Map<string>;
    private awareness: Map<number, Cursor> | null = null;
    private userId: string;
    private userName: string;
    private userColor: string;
    private connectionStatus: ConnectionStatus = "connecting";
    private encryptionKey: CryptoKey | null = null;
    private decryptedElementsCache: Map<string, BoardElement> = new Map();
    private isReadOnly: boolean;
    private isOwner: boolean;
    private permission: CollabPermission;
    private activityInterval: number | null = null;
    private handleBeforeUnload = () => {
        try {
            this.provider?.awareness.setLocalState(null);
        } catch (error) {
            console.warn(
                "[Collaboration] Failed to clear local awareness:",
                error,
            );
        }
        this.provider?.disconnect?.();
    };

    constructor(
        roomId: string,
        userName?: string,
        encryptionKey?: CryptoKey,
        options: CollaborationOptions = {},
    ) {
        this.doc = new Y.Doc();
        this.elements = this.doc.getArray<StoredElement>("elements");
        this.metadata = this.doc.getMap<string>("metadata");
        this.userId = Math.random().toString(36).substring(2, 9);
        // Use provided name or generate a funny random name
        this.userName = userName || generateFunnyName();
        this.userColor = this.getRandomColor();
        this.encryptionKey = encryptionKey || null;
        this.isOwner = options.isOwner ?? false;
        this.permission = options.permission ?? "edit";
        // Read-only if permission is view, or explicitly set
        this.isReadOnly = options.readOnly ?? this.permission === "view";

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
                isOwner: this.isOwner,
                permission: this.permission,
                lastActiveAt: Date.now(),
                cursor: null,
            });
        } else {
            // In view mode, still set awareness but mark as viewer
            this.provider.awareness.setLocalStateField("user", {
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                isOwner: this.isOwner,
                permission: "view",
                lastActiveAt: Date.now(),
                cursor: null,
            });
        }

        console.log(
            "[Collaboration] Initialized for room:",
            roomId,
            "as:",
            this.userName,
            "isOwner:",
            this.isOwner,
            "permission:",
            this.permission,
        );

        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", this.handleBeforeUnload);
            this.activityInterval = window.setInterval(() => {
                this.touchLocalActivity();
            }, 10_000);
        }
    }

    private touchLocalActivity(): void {
        if (!this.provider) return;
        const currentState = this.provider.awareness.getLocalState() as {
            user?: UserState;
        } | null;
        if (!currentState?.user) return;
        this.provider.awareness.setLocalStateField("user", {
            ...currentState.user,
            lastActiveAt: Date.now(),
        });
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
     * Check if this user is the owner of the board
     */
    getIsOwner(): boolean {
        return this.isOwner;
    }

    /**
     * Get the user's permission level
     */
    getPermission(): CollabPermission {
        return this.permission;
    }

    /**
     * Check if user can edit
     */
    canEdit(): boolean {
        return this.permission === "edit" && !this.isReadOnly;
    }

    /**
     * Check if encryption is enabled
     */
    isEncrypted(): boolean {
        return this.encryptionKey !== null;
    }

    /**
     * Set or update the encryption key and re-encrypt existing elements
     * Used when owner generates key after CollaborationManager is created
     */
    async setEncryptionKey(key: CryptoKey): Promise<void> {
        this.encryptionKey = key;
        console.log("[Collaboration] Encryption key set");

        // Re-encrypt any existing unencrypted elements
        const stored = this.elements.toArray();
        const hasUnencryptedElements = stored.some(
            (el) => !isEncryptedElement(el),
        );

        if (hasUnencryptedElements && this.canEdit()) {
            console.log(
                "[Collaboration] Re-encrypting existing elements with new key",
            );
            // Get all elements as BoardElement (decrypting if needed)
            const elements: BoardElement[] = [];
            for (const el of stored) {
                if (isEncryptedElement(el)) {
                    // Already encrypted - try to decrypt (might fail if different key)
                    const decrypted = await this.decryptElement(el);
                    if (decrypted) elements.push(decrypted);
                } else {
                    // Unencrypted - use as-is
                    elements.push(el as BoardElement);
                }
            }
            // Re-encrypt all with new key
            if (elements.length > 0) {
                await this.setElements(elements);
            }
        }
    }

    /**
     * Get the current encryption key (for passing to invite dialog)
     */
    getEncryptionKey(): CryptoKey | null {
        return this.encryptionKey;
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
        } catch {
            // Decryption can fail if data was encrypted with a different key
            // or is corrupted - this is expected during key transitions
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
        if (this.isReadOnly || !this.canEdit()) return;

        this.decryptedElementsCache.clear();

        let storedElements: StoredElement[] = [];
        const key = this.encryptionKey;
        if (key) {
            try {
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
            } catch (error) {
                console.error(
                    "[Collaboration] Failed to encrypt elements:",
                    error,
                );
                // Fall back to storing unencrypted if encryption fails
                storedElements = nextElements;
            }
        } else {
            storedElements = nextElements;
        }

        this.doc.transact(() => {
            this.elements.delete(0, this.elements.length);
            if (storedElements.length > 0) {
                this.elements.insert(0, storedElements);
            }
        }, LOCAL_ORIGIN);
    }

    /**
     * Add a new element (encrypts if encryption is enabled)
     */
    async addElement(element: BoardElement): Promise<void> {
        if (this.isReadOnly || !this.canEdit()) return;
        if (this.encryptionKey) {
            try {
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
                this.doc.transact(() => {
                    this.elements.push([encrypted]);
                }, LOCAL_ORIGIN);
                // Pre-cache the decrypted element
                this.decryptedElementsCache.set(element.id, element);
            } catch (error) {
                console.error(
                    "[Collaboration] Failed to encrypt element:",
                    error,
                );
                // Fall back to storing unencrypted
                this.doc.transact(() => {
                    this.elements.push([element]);
                }, LOCAL_ORIGIN);
            }
        } else {
            this.doc.transact(() => {
                this.elements.push([element]);
            }, LOCAL_ORIGIN);
        }
    }

    /**
     * Update an existing element (re-encrypts if encryption is enabled)
     */
    async updateElement(
        id: string,
        updates: Partial<BoardElement>,
    ): Promise<void> {
        if (this.isReadOnly || !this.canEdit()) return;
        const storedArray = this.elements.toArray();
        const matchingIndexes: number[] = [];
        storedArray.forEach((el, idx) => {
            if (el.id === id) matchingIndexes.push(idx);
        });
        const index =
            matchingIndexes.length > 0
                ? matchingIndexes[matchingIndexes.length - 1]
                : -1;

        if (index !== -1) {
            const stored = storedArray[index];
            let currentElement: BoardElement;

            try {
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
                    }, LOCAL_ORIGIN);
                    // Update cache
                    this.decryptedElementsCache.set(id, updated);
                } else {
                    // Replace atomically to avoid transient delete/insert flicker in observers.
                    this.doc.transact(() => {
                        this.elements.delete(index, 1);
                        this.elements.insert(index, [updated]);
                    }, LOCAL_ORIGIN);
                }
            } catch (error) {
                console.error(
                    "[Collaboration] Failed to update element:",
                    error,
                );
            }
        }
    }

    /**
     * Delete an element
     */
    deleteElement(id: string): void {
        if (this.isReadOnly || !this.canEdit()) return;
        const storedArray = this.elements.toArray();
        const matchingIndexes: number[] = [];
        storedArray.forEach((el, idx) => {
            if (el.id === id) matchingIndexes.push(idx);
        });
        if (matchingIndexes.length === 0) return;

        // Delete from the end to avoid index shifts.
        this.doc.transact(() => {
            for (let i = matchingIndexes.length - 1; i >= 0; i -= 1) {
                this.elements.delete(matchingIndexes[i], 1);
            }
        }, LOCAL_ORIGIN);
        // Remove from cache
        this.decryptedElementsCache.delete(id);
    }

    /**
     * Clear all elements
     */
    clearAll(): void {
        if (this.isReadOnly || !this.canEdit()) return;
        this.doc.transact(() => {
            this.elements.delete(0, this.elements.length);
        }, LOCAL_ORIGIN);
        this.decryptedElementsCache.clear();
    }

    /**
     * Subscribe to element changes
     * Callback receives decrypted elements
     */
    onElementsChange(
        callback: (
            elements: BoardElement[],
            info?: { isRemote: boolean },
        ) => void,
    ): () => void {
        const handler = async (event: Y.YArrayEvent<StoredElement>) => {
            const isRemote = event.transaction.origin !== LOCAL_ORIGIN;
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
                callback(decrypted, { isRemote });
            } else {
                callback(this.elements.toArray() as BoardElement[], {
                    isRemote,
                });
            }
        };
        this.elements.observe(handler);
        return () => this.elements.unobserve(handler);
    }

    updateCursor(x: number, y: number): void {
        if (this.isReadOnly) return;
        if (this.provider) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: UserState;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                isOwner: this.isOwner,
                permission: this.permission,
                lastActiveAt: Date.now(),
                cursor: { x, y },
            });
        }
    }

    updateViewport(pan: { x: number; y: number }, zoom: number): void {
        if (this.isReadOnly) return;
        if (this.provider) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: UserState;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                isOwner: this.isOwner,
                permission: this.permission,
                lastActiveAt: Date.now(),
                viewport: { pan, zoom },
            });
        }
    }

    async updateDrawingElement(element: BoardElement | null): Promise<void> {
        if (this.isReadOnly || !this.canEdit()) return;
        if (!this.provider) return;

        const currentState = this.provider.awareness.getLocalState() as {
            user?: UserState;
        } | null;

        // If no encryption key or clearing the element, send as-is
        if (!this.encryptionKey || element === null) {
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                isOwner: this.isOwner,
                permission: this.permission,
                lastActiveAt: Date.now(),
                drawingElement: element,
            });
            return;
        }

        // Encrypt the drawing element before sending
        try {
            const { ciphertext, iv } = await encrypt(
                this.encryptionKey,
                element,
            );
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                isOwner: this.isOwner,
                permission: this.permission,
                lastActiveAt: Date.now(),
                drawingElement: {
                    encrypted: true,
                    ciphertext,
                    iv,
                } as EncryptedDrawingElement,
            });
        } catch (error) {
            console.error(
                "[Collaboration] Failed to encrypt drawing element:",
                error,
            );
            // Don't broadcast if encryption fails (security over convenience)
        }
    }

    /**
     * Decrypt an awareness drawing element if encrypted
     */
    async decryptDrawingElement(
        data: AwarenessDrawingElement,
    ): Promise<BoardElement | null> {
        if (data === null || data === undefined) return null;

        // Check if it's encrypted
        if (
            typeof data === "object" &&
            "encrypted" in data &&
            data.encrypted === true &&
            "ciphertext" in data &&
            "iv" in data
        ) {
            if (!this.encryptionKey) {
                console.warn(
                    "[Collaboration] Cannot decrypt drawing element: no encryption key",
                );
                return null;
            }
            try {
                return await decrypt<BoardElement>(
                    this.encryptionKey,
                    data.ciphertext,
                    data.iv,
                );
            } catch {
                // Decryption can fail if data was encrypted with a different key
                // or is corrupted - this is expected during key transitions
                return null;
            }
        }

        // Not encrypted, return as-is (backward compatibility)
        return data as BoardElement;
    }

    updateFollowingUser(userId: string | null): void {
        if (this.isReadOnly) return;
        if (this.provider) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: UserState;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                isOwner: this.isOwner,
                permission: this.permission,
                lastActiveAt: Date.now(),
                followingUserId: userId,
            });
        }
    }

    updateSelectedElements(elementIds: string[]): void {
        if (this.isReadOnly) return;
        if (this.provider) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: UserState;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                isOwner: this.isOwner,
                permission: this.permission,
                lastActiveAt: Date.now(),
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
            isOwner: this.isOwner,
            permission: this.permission,
        };
    }

    /**
     * Update the user's display name and broadcast it to other users
     */
    updateUserName(newName: string): void {
        if (!newName.trim()) return;
        this.userName = newName.trim();

        if (this.provider) {
            const currentState = this.provider.awareness.getLocalState() as {
                user?: UserState;
            } | null;
            this.provider.awareness.setLocalStateField("user", {
                ...(currentState?.user || {}),
                id: this.userId,
                name: this.userName,
                color: this.userColor,
                isOwner: this.isOwner,
                permission: this.permission,
                lastActiveAt: Date.now(),
            });
        }
    }

    getConnectionStatus(): ConnectionStatus {
        return this.connectionStatus;
    }

    getMetadata(): BoardMetadata {
        const name = this.metadata.get("name");
        return { name: name ? String(name) : undefined };
    }

    setMetadata(next: BoardMetadata): void {
        if (this.isReadOnly || !this.canEdit()) return;

        this.doc.transact(() => {
            if (next.name !== undefined) {
                this.metadata.set("name", next.name);
            }
        }, LOCAL_ORIGIN);
    }

    onMetadataChange(
        callback: (
            metadata: BoardMetadata,
            info?: { isRemote: boolean },
        ) => void,
    ): () => void {
        const handler = (event: Y.YMapEvent<string>) => {
            const isRemote = event.transaction.origin !== LOCAL_ORIGIN;
            callback(this.getMetadata(), { isRemote });
        };
        this.metadata.observe(handler);
        return () => this.metadata.unobserve(handler);
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
        if (typeof window !== "undefined") {
            window.removeEventListener("beforeunload", this.handleBeforeUnload);
            if (this.activityInterval !== null) {
                window.clearInterval(this.activityInterval);
                this.activityInterval = null;
            }
        }
        try {
            this.provider?.awareness.setLocalState(null);
        } catch (error) {
            console.warn(
                "[Collaboration] Failed to clear local awareness:",
                error,
            );
        }
        this.provider?.disconnect?.();
        this.provider?.destroy();
        this.doc.destroy();
    }
}
