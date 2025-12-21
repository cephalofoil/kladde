/**
 * Standardized timing constants for consistent UX across the application
 */

// Debounce delays for different types of inputs
export const DEBOUNCE_DELAYS = {
  /** Input field debounce for text changes (300ms) */
  INPUT: 300,
  /** Editor content changes (300ms) */
  EDITOR: 300,
  /** Board data persistence (500ms for less frequent saves) */
  BOARD_SAVE: 500,
  /** Auto-focus delay for editors (100ms) */
  AUTO_FOCUS: 100,
  /** Immediate flush for pointer events */
  IMMEDIATE: 0,
} as const;

// Toast duration constants
export const TOAST_DURATION = {
  SHORT: 3000,
  LONG: 5000,
  PERMANENT: Infinity,
} as const;

// Animation durations
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

// UI interaction delays
export const UI_DELAYS = {
  /** Small delay for focus management after state updates (10ms) */
  FOCUS_AFTER_UPDATE: 10,
  /** Delay before closing dialogs to allow animations (100ms) */
  DIALOG_CLOSE: 100,
  /** Animation start delay (50ms) */
  ANIMATION_START: 50,
  /** Auto-save delay for board data (2000ms) */
  AUTO_SAVE: 2000,
  /** Hydration fallback timeout (2000ms) */
  HYDRATION_TIMEOUT: 2000,
  /** Mock operation delay for prototyping (1000ms) */
  MOCK_DELAY: 1000,
} as const;

export const EXPORT_SCHEMA_VERSION = "1.0.0";
