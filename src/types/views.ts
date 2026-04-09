import { isView, type View } from "./octarine";

export type IndexedView = View & {
  searchText: string;
};

export function isIndexedView(value: unknown): value is IndexedView {
  return isView(value) && typeof (value as IndexedView).searchText === "string";
}
