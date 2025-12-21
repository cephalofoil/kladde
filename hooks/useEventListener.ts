import { useEffect, useRef, type RefObject } from "react";

type EventTarget =
  | Window
  | Document
  | HTMLElement
  | MediaQueryList
  | AbortSignal;

export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element?: RefObject<EventTarget> | EventTarget | null,
  options?: boolean | AddEventListenerOptions,
): void;

export function useEventListener<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: (event: DocumentEventMap[K]) => void,
  element: RefObject<Document> | Document,
  options?: boolean | AddEventListenerOptions,
): void;

export function useEventListener<K extends keyof HTMLElementEventMap>(
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  element: RefObject<HTMLElement> | HTMLElement,
  options?: boolean | AddEventListenerOptions,
): void;

export function useEventListener<K extends keyof MediaQueryListEventMap>(
  eventName: K,
  handler: (event: MediaQueryListEventMap[K]) => void,
  element: RefObject<MediaQueryList> | MediaQueryList,
  options?: boolean | AddEventListenerOptions,
): void;

export function useEventListener(
  eventName: string,
  handler: (event: Event) => void,
  element?: RefObject<EventTarget> | EventTarget | null,
  options?: boolean | AddEventListenerOptions,
): void;

export function useEventListener<T extends Event = Event>(
  eventName: string,
  handler: (event: T) => void,
  element?: RefObject<EventTarget> | EventTarget | null,
  options?: boolean | AddEventListenerOptions,
): void {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const targetElement = element?.hasOwnProperty?.("current")
      ? (element as RefObject<EventTarget>).current
      : (element as EventTarget);

    const eventListener = (event: Event) => savedHandler.current(event as T);

    if (targetElement?.addEventListener) {
      targetElement.addEventListener(eventName, eventListener, options);

      return () => {
        targetElement.removeEventListener(eventName, eventListener, options);
      };
    }
  }, [eventName, element, options]);
}
