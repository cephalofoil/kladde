/**
 * Storage utility functions for calculating and displaying storage usage
 */

export interface StorageEstimate {
  used: number;
  quota: number;
}

export interface StorageBreakdown {
  boards: number;
  boardData: number;
  workstreams: number;
  total: number;
}

/**
 * Get the actual size of Kladde's data stored in IndexedDB
 * by reading the stored value directly
 */
export async function getKladdeStorageSize(): Promise<number> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return 0;
  }

  try {
    const { get } = await import("idb-keyval");
    const storedData = await get<string>("kladde-boards");
    if (storedData) {
      // Return the actual byte size of the stored string
      return new Blob([storedData]).size;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Calculate total browser storage quota using the Storage API
 * Note: This returns the quota for the entire origin, not just Kladde
 */
export async function getBrowserStorageQuota(): Promise<number> {
  if (typeof navigator !== "undefined" && "storage" in navigator && "estimate" in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return estimate.quota ?? 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * Format bytes to a human-readable string
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Calculate storage breakdown by serializing data and measuring size
 * Note: This is an estimate based on JSON serialization of in-memory state
 */
export function calculateStorageBreakdown(
  boards: Map<string, unknown>,
  boardData: Map<string, unknown>,
  workstreams: Map<string, unknown>
): StorageBreakdown {
  const encoder = new TextEncoder();

  const boardsSize = encoder.encode(
    JSON.stringify(Array.from(boards.entries()))
  ).length;

  const boardDataSize = encoder.encode(
    JSON.stringify(Array.from(boardData.entries()))
  ).length;

  const workstreamsSize = encoder.encode(
    JSON.stringify(Array.from(workstreams.entries()))
  ).length;

  return {
    boards: boardsSize,
    boardData: boardDataSize,
    workstreams: workstreamsSize,
    total: boardsSize + boardDataSize + workstreamsSize,
  };
}

/**
 * Get percentage of storage used
 */
export function getStoragePercentage(used: number, quota: number): number {
  if (quota === 0) return 0;
  return Math.min(100, (used / quota) * 100);
}
