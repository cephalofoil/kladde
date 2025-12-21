import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/stores/idb-storage";

interface PromptDraft {
  plainText: string;
  editorState?: string; // JSON serialized Lexical editor state
}

interface PromptWriterState {
  drafts: Record<string, PromptDraft>; // key: `${boardId}:${tileId}` or simple key
  templates: Record<string, string>; // key: `${boardId}:${tileId}`, value: templateId
  setDraft: (boardId: string, tileId: string, plainText: string, editorState?: string) => void;
  clearDraft: (boardId: string, tileId: string) => void;
  clearAllForBoard: (boardId: string) => void;
  // Template management
  setTemplate: (boardId: string, tileId: string, templateId: string) => void;
  clearTemplate: (boardId: string, tileId: string) => void;
  getTemplate: (boardId: string, tileId: string) => string | undefined;
  // Legacy API for compatibility with existing components
  setDraftByKey: (key: string, value: string) => void;
  clearDraftByKey: (key: string) => void;
}

export const usePromptWriterStore = create<PromptWriterState>()(
  persist(
    (set, get) => ({
      drafts: {},
      templates: {},
      setDraft: (boardId, tileId, plainText, editorState) =>
        set((state) => {
          const key = `${boardId}:${tileId}`;
          return { 
            drafts: { 
              ...state.drafts, 
              [key]: { plainText, editorState } 
            } 
          };
        }),
      clearDraft: (boardId, tileId) =>
        set((state) => {
          const key = `${boardId}:${tileId}`;
          const drafts = { ...state.drafts };
          delete drafts[key];
          return { drafts };
        }),
      clearAllForBoard: (boardId) =>
        set((state) => {
          const drafts = Object.fromEntries(
            Object.entries(state.drafts).filter(
              ([k]) => !k.startsWith(`${boardId}:`),
            ),
          );
          const templates = Object.fromEntries(
            Object.entries(state.templates).filter(
              ([k]) => !k.startsWith(`${boardId}:`),
            ),
          );
          return { drafts, templates };
        }),
      // Template management
      setTemplate: (boardId, tileId, templateId) =>
        set((state) => {
          const key = `${boardId}:${tileId}`;
          return { templates: { ...state.templates, [key]: templateId } };
        }),
      clearTemplate: (boardId, tileId) =>
        set((state) => {
          const key = `${boardId}:${tileId}`;
          const templates = { ...state.templates };
          delete templates[key];
          return { templates };
        }),
      getTemplate: (boardId, tileId) => {
        const key = `${boardId}:${tileId}`;
        return get().templates[key];
      },
      // Legacy API for compatibility
      setDraftByKey: (key, value) =>
        set((state) => ({
          drafts: { ...state.drafts, [key]: { plainText: value } },
        })),
      clearDraftByKey: (key) =>
        set((state) => {
          const drafts = { ...state.drafts };
          delete drafts[key];
          return { drafts };
        }),
    }),
    {
      name: "prompt-writer-drafts",
      version: 4,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ drafts: state.drafts, templates: state.templates }),
        migrate: (persistedState, version) => {
        if (version < 4) {
          // Migrate from v3 to v4 (convert string drafts to PromptDraft objects)
          const ps = persistedState as any;
          const oldDrafts = ps?.drafts || {};
          const newDrafts: Record<string, PromptDraft> = {};
          
          // Convert old string drafts to new PromptDraft format
          for (const [key, value] of Object.entries(oldDrafts)) {
            if (typeof value === 'string') {
              newDrafts[key] = { plainText: value };
            } else if (value && typeof value === 'object' && 'plainText' in value) {
              newDrafts[key] = value as PromptDraft;
            }
          }
          
          return {
            drafts: newDrafts,
            templates: ps?.templates || {},
          };
        }
        const ps = persistedState as
          | Partial<PromptWriterState>
          | null
          | undefined;
        return {
          drafts:
            ps &&
            typeof ps === "object" &&
            ps.drafts &&
            typeof ps.drafts === "object"
              ? ps.drafts
              : {},
          templates:
            ps &&
            typeof ps === "object" &&
            ps.templates &&
            typeof ps.templates === "object"
              ? ps.templates
              : {},
        };
      },
    },
  ),
);
