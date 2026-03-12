import { isAttachment, type Attachment } from "./octarine";

export type IndexedAttachment = Attachment & {
  // Lowercased searchable text built during scan.
  searchText: string;
};

export function isIndexedAttachment(value: unknown): value is IndexedAttachment {
  return isAttachment(value) && typeof (value as IndexedAttachment).searchText === "string";
}
