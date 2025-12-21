import type { BoardData } from "@/types/canvas";
import type { PatchOp } from "./board-management-store";

export function applyPatchLocally(board: BoardData, op: PatchOp) {
  const decode = (seg: string) => seg.replace(/~1/g, "/").replace(/~0/g, "~");
  const path =
    op.path === "/" ? [] : op.path.replace(/^\//, "").split("/").map(decode);
  if (path.length === 0) return; // do not operate on root

  let target: unknown = board;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (typeof target !== "object" || target === null) return;
    target = (target as Record<string, unknown>)[key];
    if (target == null) return;
  }

  const key = path[path.length - 1];
  if (typeof target !== "object" || target === null) return;

  if (op.op === "remove") {
    if (Array.isArray(target)) {
      const idx = Number(key);
      if (
        !Number.isInteger(idx) ||
        idx < 0 ||
        idx >= (target as unknown[]).length
      )
        return;
      (target as unknown[]).splice(idx, 1);
    } else {
      const obj = target as Record<string, unknown>;
      if (!(key in obj)) return;
      delete obj[key];
    }
  } else if (op.op === "replace") {
    if (Array.isArray(target)) {
      const idx = Number(key);
      if (
        !Number.isInteger(idx) ||
        idx < 0 ||
        idx >= (target as unknown[]).length
      )
        return;
      (target as unknown[])[idx] = op.value as unknown;
    } else {
      const obj = target as Record<string, unknown>;
      if (!(key in obj)) return;
      obj[key] = op.value;
    }
  } else if (op.op === "add") {
    if (Array.isArray(target)) {
      const arr = target as unknown[];
      const idx = key === "-" ? arr.length : Number(key);
      if (!Number.isInteger(idx) || idx < 0 || idx > arr.length) return;
      arr.splice(idx, 0, op.value);
    } else {
      (target as Record<string, unknown>)[key] = op.value;
    }
  }
}

export function applyShallowPatch(
  board: BoardData,
  patch: Partial<BoardData>,
  dirtyPaths: Set<string>,
  queue: PatchOp[],
) {
  Object.entries(patch).forEach(([k, v]) => {
    (board as unknown as Record<string, unknown>)[k] = v as unknown;
    dirtyPaths.add("/" + k);
    queue.push({ op: "replace", path: "/" + k, value: v });
  });
}
