import { isFolder, isNote, type Folder, type Note } from "./octarine";

export type IndexedNote = Note & {
  id: string;
  pinned: boolean;
  searchText: string;
};

export type IndexedFolder = Folder & {
  id: string;
  searchText: string;
};

export function isIndexedNote(value: unknown): value is IndexedNote {
  return (
    isNote(value) &&
    typeof (value as IndexedNote).id === "string" &&
    typeof (value as IndexedNote).pinned === "boolean" &&
    typeof (value as IndexedNote).searchText === "string"
  );
}

export function isIndexedFolder(value: unknown): value is IndexedFolder {
  return (
    isFolder(value) &&
    typeof (value as IndexedFolder).id === "string" &&
    typeof (value as IndexedFolder).searchText === "string"
  );
}
