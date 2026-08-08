/** datavis-ace ships untyped JS; the grid adapters define the shapes, so borrow them. */
declare module "datavis-ace" {
  import type { SourceInstance, ViewInstance } from "@mieweb/datavis";

  export const Source: new (
    spec: { type: string; [key: string]: unknown },
    params?: unknown,
    userTypeInfo?: unknown,
    opts?: unknown,
  ) => SourceInstance;

  export const ComputedView: new (source: SourceInstance, opts?: unknown) => ViewInstance;
}
