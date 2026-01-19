"use client";

/**
 * Hash-based routing for E2E encrypted collaboration
 *
 * URL format: /#roomId,encryptionKey or /#roomId,encryptionKey,view
 *
 * Examples:
 * - Edit:  https://kladde.app/#abc123,ZqwWzSYUS_T2n_oOwLosMQ
 * - View:  https://kladde.app/#abc123,ZqwWzSYUS_T2n_oOwLosMQ,view
 */

export interface CollabRoomParams {
  roomId: string;
  encryptionKey: string;
  isViewOnly: boolean;
}

/**
 * Parse the URL hash for collaboration room parameters
 * Returns null if hash is not a valid collab URL
 */
export function parseCollabHash(): CollabRoomParams | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return null;

  // Remove leading #
  const content = hash.slice(1);

  // Split by comma: roomId,key or roomId,key,view
  const parts = content.split(",");

  if (parts.length < 2) return null;

  const roomId = parts[0];
  const encryptionKey = parts[1];

  // Validate we have both required parts
  if (!roomId || !encryptionKey) return null;

  // Check for view-only flag
  const isViewOnly = parts.length >= 3 && parts[2] === "view";

  return {
    roomId,
    encryptionKey,
    isViewOnly,
  };
}

/**
 * Build a collaboration hash URL
 */
export function buildCollabUrl(
  roomId: string,
  encryptionKey: string,
  isViewOnly: boolean = false,
): string {
  if (typeof window === "undefined") return "";

  const base = window.location.origin;
  const hash = isViewOnly
    ? `#${roomId},${encryptionKey},view`
    : `#${roomId},${encryptionKey}`;

  return `${base}/${hash}`;
}

/**
 * Check if the current URL is a collaboration URL
 */
export function isCollabUrl(): boolean {
  return parseCollabHash() !== null;
}
