import { ReactNode } from "react"

export {}

declare global {
  type ChildrenProps<T extends Record<string, unknown> = Record<string, unknown>> = {
    children: ReactNode;
  } & T;
}
