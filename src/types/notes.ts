import { isNote, type Note } from "./octarine";

export type IndexedNote = Note & {
  id: string;
  pinned: boolean;
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
