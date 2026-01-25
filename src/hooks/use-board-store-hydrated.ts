import { useSyncExternalStore } from "react";
import { useBoardStore } from "@/store/board-store";

let hydratedOnce = useBoardStore.persist.hasHydrated();

const subscribe = (onStoreChange: () => void) => {
  if (useBoardStore.persist.hasHydrated()) {
    hydratedOnce = true;
    return () => undefined;
  }

  return useBoardStore.persist.onFinishHydration(() => {
    hydratedOnce = true;
    onStoreChange();
  });
};

const getSnapshot = () =>
  hydratedOnce || useBoardStore.persist.hasHydrated();
const getServerSnapshot = () => false;

export function useBoardStoreHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
