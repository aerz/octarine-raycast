import { Toast, showToast } from "@raycast/api";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Workspace } from "../../src/types/octarine";

class HookRuntime {
  private stateSlots: unknown[] = [];
  private refSlots: unknown[] = [];
  private effectSlots: Array<readonly unknown[] | undefined> = [];
  private queuedEffects: Array<() => void> = [];
  private hookIndex = 0;
  private effectIndex = 0;
  private stateUpdated = false;

  beginRender(): void {
    this.hookIndex = 0;
    this.effectIndex = 0;
    this.queuedEffects = [];
    this.stateUpdated = false;
  }

  didStateUpdate(): boolean {
    return this.stateUpdated;
  }

  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void {
    const index = this.effectIndex++;
    const previousDeps = this.effectSlots[index];

    if (!haveDepsChanged(previousDeps, deps)) {
      return;
    }

    this.effectSlots[index] = deps;
    this.queuedEffects.push(() => {
      effect();
    });
  }

  useMemo<T>(factory: () => T): T {
    return factory();
  }

  useRef<T>(initialValue: T): { current: T } {
    const index = this.hookIndex++;

    if (this.refSlots[index] === undefined) {
      this.refSlots[index] = { current: initialValue };
    }

    return this.refSlots[index] as { current: T };
  }

  useState<T>(initialValue: T | (() => T)): [T, (value: T | ((previousValue: T) => T)) => void] {
    const index = this.hookIndex++;

    if (this.stateSlots[index] === undefined) {
      this.stateSlots[index] = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
    }

    const setState = (value: T | ((previousValue: T) => T)) => {
      const previousValue = this.stateSlots[index] as T;
      const nextValue = typeof value === "function" ? (value as (previousValue: T) => T)(previousValue) : value;

      if (Object.is(previousValue, nextValue)) {
        return;
      }

      this.stateSlots[index] = nextValue;
      this.stateUpdated = true;
    };

    return [this.stateSlots[index] as T, setState];
  }

  flushEffects(): void {
    const effects = [...this.queuedEffects];
    this.queuedEffects = [];

    for (const effect of effects) {
      effect();
    }
  }
}

function haveDepsChanged(
  previousDeps: readonly unknown[] | undefined,
  nextDeps: readonly unknown[] | undefined,
): boolean {
  if (previousDeps === undefined || nextDeps === undefined) {
    return true;
  }

  if (previousDeps.length !== nextDeps.length) {
    return true;
  }

  return nextDeps.some((dependency, index) => !Object.is(dependency, previousDeps[index]));
}

let activeRuntime = new HookRuntime();

vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => activeRuntime.useEffect(effect, deps),
  useMemo: <T>(factory: () => T) => activeRuntime.useMemo(factory),
  useRef: <T>(initialValue: T) => activeRuntime.useRef(initialValue),
  useState: <T>(initialValue: T | (() => T)) => activeRuntime.useState(initialValue),
}));

type UseOpenTarget = (typeof import("../../src/hooks/useOpenTarget"))["useOpenTarget"];

let useOpenTarget: UseOpenTarget;

beforeAll(async () => {
  ({ useOpenTarget } = await import("../../src/hooks/useOpenTarget"));
});

beforeEach(() => {
  activeRuntime = new HookRuntime();
});

const workspaces: Workspace[] = [
  { name: "Alpha", path: "/tmp/alpha" },
  { name: "Beta", path: "/tmp/beta" },
];

async function renderHook(options: Parameters<UseOpenTarget>[0]): Promise<ReturnType<UseOpenTarget>> {
  let result: ReturnType<UseOpenTarget> | undefined;

  for (let renderCount = 0; renderCount < 10; renderCount++) {
    activeRuntime.beginRender();
    result = useOpenTarget(options);
    activeRuntime.flushEffects();
    await Promise.resolve();

    if (!activeRuntime.didStateUpdate()) {
      break;
    }
  }

  if (result === undefined) {
    throw new Error("Hook did not return a result");
  }

  return result;
}

describe("useOpenTarget", () => {
  it("keeps the menu visible when no workspace was requested", async () => {
    const open = vi.fn(async () => true);

    const result = await renderHook({
      requestedWorkspace: "",
      workspaces,
      status: { isLoading: false, failed: false },
      open,
    });

    expect(result.shouldClose).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("opens a matched workspace once and hides the menu", async () => {
    const open = vi.fn(async () => true);

    const result = await renderHook({
      requestedWorkspace: "Alpha",
      workspaces,
      status: { isLoading: false, failed: false },
      open,
    });

    expect(result.shouldClose).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith("Alpha");

    await renderHook({
      requestedWorkspace: "Alpha",
      workspaces,
      status: { isLoading: false, failed: false },
      open,
    });

    expect(open).toHaveBeenCalledTimes(1);
  });

  it("keeps the menu visible when the direct open fails", async () => {
    const open = vi.fn(async () => false);

    const result = await renderHook({
      requestedWorkspace: "Alpha",
      workspaces,
      status: { isLoading: false, failed: false },
      open,
    });

    expect(result.shouldClose).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("shows the workspace-not-found toast once per missing workspace", async () => {
    const open = vi.fn(async () => true);

    const result = await renderHook({
      requestedWorkspace: "Missing",
      workspaces,
      status: { isLoading: false, failed: false },
      open,
    });

    expect(result.shouldClose).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      style: Toast.Style.Failure,
      title: "Workspace “Missing” not found",
    });

    await renderHook({
      requestedWorkspace: "Missing",
      workspaces,
      status: { isLoading: false, failed: false },
      open,
    });

    expect(showToast).toHaveBeenCalledTimes(1);

    await renderHook({
      requestedWorkspace: "Still Missing",
      workspaces,
      status: { isLoading: false, failed: false },
      open,
    });

    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it("suppresses not-found toasts while loading or after load failure", async () => {
    const open = vi.fn(async () => true);

    await renderHook({
      requestedWorkspace: "Missing",
      workspaces,
      status: { isLoading: true, failed: false },
      open,
    });
    await renderHook({
      requestedWorkspace: "Missing",
      workspaces,
      status: { isLoading: false, failed: true },
      open,
    });

    expect(showToast).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
