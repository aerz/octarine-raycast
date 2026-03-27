import { LocalStorage } from "@raycast/api";

export async function loadStoredJson<T>(
  key: string,
  isValid: (value: unknown) => value is T,
): Promise<T | undefined> {
  const cachedValue = await LocalStorage.getItem<string>(key);
  if (!cachedValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(cachedValue) as unknown;
    return isValid(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function saveStoredJson<T>(key: string, value: T): Promise<void> {
  await LocalStorage.setItem(key, JSON.stringify(value));
}
