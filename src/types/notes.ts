import { isNote, type Workspace } from "./octarine";

export type ScannedNote = {
  id: string;
  title: string;
  path: string;
  workspace: Workspace;
};

export type IndexedNote = ScannedNote & {
  normalizedTitle: string;
  normalizedPath: string;
  normalizedWorkspace: string;
  normalizedDirectory: string;
  directorySegments: string[];
  searchText: string;
};

export type IndexedNoteFolder = {
  id: string;
  name: string;
  path: string;
  workspace: Workspace;
  searchText: string;
};

export function isIndexedNote(value: unknown): value is IndexedNote {
  return (
    isNote(value) &&
    typeof (value as IndexedNote).id === "string" &&
    typeof (value as IndexedNote).normalizedTitle === "string" &&
    typeof (value as IndexedNote).normalizedPath === "string" &&
    typeof (value as IndexedNote).normalizedWorkspace === "string" &&
    typeof (value as IndexedNote).normalizedDirectory === "string" &&
    Array.isArray((value as IndexedNote).directorySegments) &&
    (value as IndexedNote).directorySegments.every((s) => typeof s === "string") &&
    typeof (value as IndexedNote).searchText === "string"
  );
}
