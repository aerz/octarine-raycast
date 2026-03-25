import type { ReactNode } from "react";

export function match<T extends string>(value: T, cases: Record<T, () => ReactNode>): ReactNode {
  return cases[value]();
}
