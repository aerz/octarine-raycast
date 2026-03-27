import { LocalStorage } from "@raycast/api";
import { describe, expect, it } from "vitest";
import { loadStoredJson, saveStoredJson } from "../../src/lib/cache";

describe("cache", () => {
  it("returns undefined when the key is missing", async () => {
    const result = await loadStoredJson("missing", isTestCache);

    expect(result).toBeUndefined();
  });

  it("returns parsed data when the JSON is valid and passes validation", async () => {
    await LocalStorage.setItem("test", JSON.stringify({ value: "cached" }));

    const result = await loadStoredJson("test", isTestCache);

    expect(result).toEqual({ value: "cached" });
  });

  it("returns undefined when the JSON is malformed", async () => {
    await LocalStorage.setItem("test", "{");

    const result = await loadStoredJson("test", isTestCache);

    expect(result).toBeUndefined();
  });

  it("returns undefined when validation fails", async () => {
    await LocalStorage.setItem("test", JSON.stringify({ value: 1 }));

    const result = await loadStoredJson("test", isTestCache);

    expect(result).toBeUndefined();
  });

  it("stores JSON strings via saveStoredJson", async () => {
    await saveStoredJson("test", { value: "saved" });

    expect(await LocalStorage.getItem("test")).toBe(JSON.stringify({ value: "saved" }));
  });
});

type TestCache = {
  value: string;
};

function isTestCache(value: unknown): value is TestCache {
  return (
    !!value &&
    typeof value === "object" &&
    "value" in value &&
    typeof (value as Record<string, unknown>).value === "string"
  );
}
