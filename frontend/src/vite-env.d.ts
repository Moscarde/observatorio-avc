/// <reference types="vite/client" />
declare module "echarts" {
  export interface Chart {
    setOption(
      option: Record<string, unknown>,
      options?: { notMerge?: boolean },
    ): void;
    resize(): void;
    dispose(): void;
    on(event: string, callback: (params: { name: string }) => void): void;
    off(event: string): void;
  }
  export function init(
    element: HTMLElement,
    theme?: unknown,
    options?: { renderer: string },
  ): Chart;
  export function registerMap(name: string, geo: unknown): void;
}
