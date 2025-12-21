import { enableMapSet } from "immer";

// Enable Immer MapSet plugin for proper Map/Set support in stores
// This must be called before any stores that use Map/Set are created
enableMapSet();
