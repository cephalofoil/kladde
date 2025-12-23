"use client";

/**
 * End-to-End Encryption for Kladde Collaboration
 *
 * Uses AES-GCM 128-bit encryption via the Web Cryptography API.
 * The encryption key is shared via the URL fragment (hash), which
 * browsers never send to the server.
 *
 * URL format: /board/{roomId}#{encryptionKey}
 */

// Length of the base64-encoded key (22 characters for 128-bit key)
const KEY_LENGTH = 22;

/**
 * Generate a new AES-GCM encryption key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 128,
    },
    true, // extractable - needed to export as JWK
    ["encrypt", "decrypt"],
  );
}

/**
 * Export a CryptoKey to a URL-safe base64 string
 */
export async function exportKeyToString(key: CryptoKey): Promise<string> {
  const jwk = await window.crypto.subtle.exportKey("jwk", key);
  // The 'k' field contains the base64url-encoded key material
  return jwk.k!;
}

/**
 * Import a key from a URL-safe base64 string
 */
export async function importKeyFromString(
  keyString: string,
): Promise<CryptoKey> {
  const jwk: JsonWebKey = {
    kty: "oct",
    k: keyString,
    alg: "A128GCM",
    ext: true,
    key_ops: ["encrypt", "decrypt"],
  };

  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "AES-GCM" },
    false, // not extractable after import
    ["encrypt", "decrypt"],
  );
}

/**
 * Generate a random 12-byte IV (Initialization Vector)
 * Each encryption operation must use a unique IV
 */
function generateIV(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt data using AES-GCM
 * Returns an object with the ciphertext and IV (both base64 encoded)
 */
export async function encrypt(
  key: CryptoKey,
  data: unknown,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = generateIV();
  const plaintext = new TextEncoder().encode(JSON.stringify(data));

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as ArrayBufferView<ArrayBuffer>,
    },
    key,
    plaintext,
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt<T>(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
): Promise<T> {
  const ciphertextBytes = base64ToUint8Array(ciphertext);
  const ivBytes = base64ToUint8Array(iv);

  const plaintext = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes as ArrayBufferView<ArrayBuffer>,
    },
    key,
    ciphertextBytes as ArrayBufferView<ArrayBuffer>,
  );

  const decoded = new TextDecoder().decode(plaintext);
  return JSON.parse(decoded) as T;
}

/**
 * Check if Web Crypto API is available
 * Requires HTTPS in production
 */
export function isEncryptionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.subtle &&
    typeof window.crypto.subtle.generateKey === "function"
  );
}

/**
 * Extract encryption key from URL hash
 * Returns null if no key is present
 */
export function getKeyFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return null;

  // Remove the leading '#'
  const keyString = hash.slice(1);

  // Validate key length (base64url encoding of 128-bit key is 22 chars)
  if (keyString.length !== KEY_LENGTH) return null;

  return keyString;
}

/**
 * Set encryption key in URL hash without triggering navigation
 */
export function setKeyInUrl(keyString: string): void {
  if (typeof window === "undefined") return;

  // Use replaceState to avoid adding to browser history
  const newUrl = `${window.location.pathname}${window.location.search}#${keyString}`;
  window.history.replaceState(null, "", newUrl);
}

/**
 * Get the full shareable URL including the encryption key
 */
export function getShareableUrl(roomId: string, keyString: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/board/${roomId}#${keyString}`;
}

/**
 * Encrypted element wrapper type
 */
export interface EncryptedElement {
  id: string;
  encrypted: true;
  ciphertext: string;
  iv: string;
}

/**
 * Check if an element is encrypted
 */
export function isEncryptedElement(
  element: unknown,
): element is EncryptedElement {
  return (
    typeof element === "object" &&
    element !== null &&
    "encrypted" in element &&
    (element as EncryptedElement).encrypted === true &&
    "ciphertext" in element &&
    "iv" in element
  );
}
