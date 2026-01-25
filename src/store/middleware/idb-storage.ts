import { get, set, del } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

// Check if we're in a browser environment
const isBrowser =
  typeof window !== "undefined" && typeof indexedDB !== "undefined";

export const idbStorage: StateStorage = {
  async getItem(name: string) {
    // Server-side: return null to indicate no stored data
    if (!isBrowser) {
      return null;
    }

    try {
      const value = await get<string>(name);
      return value ?? null;
    } catch {
      return null;
    }
  },
  async setItem(name: string, value: string) {
    // Server-side: silently skip (can't persist on server)
    if (!isBrowser) {
      return;
    }

    try {
      await set(name, value);
    } catch (error) {
      throw error; // Re-throw to let Zustand handle the error
    }
  },
  async removeItem(name: string) {
    // Server-side: silently skip (nothing to remove on server)
    if (!isBrowser) {
      return;
    }

    try {
      await del(name);
    } catch (error) {
      throw error;
    }
  },
};

export default idbStorage;
