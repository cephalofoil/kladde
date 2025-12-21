import { useRef, useEffect } from "react";

/**
 * Custom hook for managing debounced timers with automatic cleanup
 * @param delay - Debounce delay in milliseconds
 * @returns Object with schedule and cancel functions
 */
export function useDebouncedTimer(delay: number = 300) {
  const timerRef = useRef<number | null>(null);

  // Clear timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const schedule = (callback: () => void) => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Schedule new timer
    timerRef.current = window.setTimeout(() => {
      callback();
      timerRef.current = null;
    }, delay);
  };

  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return { schedule, cancel };
}
