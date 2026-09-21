import { isAttachment, type Attachment } from "@type/octarine";

export type IndexedAttachment = Attachment & {
  searchText: string;
};

export function isIndexedAttachment(value: unknown): value is IndexedAttachment {
  return isAttachment(value) && typeof (value as IndexedAttachment).searchText === "string";
}
