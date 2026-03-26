import { vi } from "vitest";

type PreferenceValues = Record<string, unknown>;

const localStorageState = new Map<string, unknown>();

let preferenceValues: PreferenceValues = {};

export const Toast = {
  Style: {
    Animated: "animated",
    Failure: "failure",
    Success: "success",
  },
} as const;

export const open = vi.fn(async (_target: string) => undefined);
export const showToast = vi.fn(async (_options: unknown) => undefined);
export const popToRoot = vi.fn(async (_options?: unknown) => undefined);
export const closeMainWindow = vi.fn(async (_options?: unknown) => undefined);

export const LocalStorage = {
  async getItem<T>(key: string): Promise<T | undefined> {
    return localStorageState.get(key) as T | undefined;
  },
  async setItem(key: string, value: unknown): Promise<void> {
    localStorageState.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    localStorageState.delete(key);
  },
  async clear(): Promise<void> {
    localStorageState.clear();
  },
};

export function getPreferenceValues<T>(): T {
  return preferenceValues as T;
}

export function setMockPreferences(values: PreferenceValues): void {
  preferenceValues = { ...values };
}

export function resetRaycastApiMock(): void {
  preferenceValues = {};
  localStorageState.clear();

  open.mockReset();
  open.mockResolvedValue(undefined);

  showToast.mockReset();
  showToast.mockResolvedValue(undefined);

  popToRoot.mockReset();
  popToRoot.mockResolvedValue(undefined);

  closeMainWindow.mockReset();
  closeMainWindow.mockResolvedValue(undefined);
}
