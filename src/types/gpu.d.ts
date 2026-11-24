export interface GPUKernelContext {
  thread: { x: number; y: number; z: number };
  output: { x: number; y: number; z: number };
  color(r: number, g: number, b: number, a?: number): void;
}

export interface GPUKernel<TArgs extends unknown[] = unknown[], TReturn = unknown> {
  (...args: TArgs): TReturn;
  setOutput(dimensions: number[]): this;
  setDynamicOutput(flag: boolean): this;
  setDynamicArguments(flag: boolean): this;
  setLoopMaxIterations(max: number): this;
  setTactic(tactic: "speed" | "balanced" | "precision"): this;
  setGraphical(graphical: boolean): this;
  readonly canvas: HTMLCanvasElement;
}

export interface GPUInstance {
  createKernel<TArgs extends unknown[]>(
    kernelFn: (this: GPUKernelContext, ...args: TArgs) => void
  ): GPUKernel<TArgs>;
}

export interface GPUConstructor {
  new (): GPUInstance;
}

declare module "gpu.js" {
  export const GPU: GPUConstructor;
}
