import { describe, it, expect, vi, beforeEach } from "vitest";

const gpuConstructorMock = vi.fn();

vi.mock("gpu.js", () => ({
  GPU: function (...args: unknown[]) {
    return gpuConstructorMock(...args);
  },
}));

import {
  initGPU,
  resetGPUCache,
  draw,
  drawPrecise,
  drawPoint,
  itereZ,
  ajoutLegende,
  initMandelbrotGpu,
} from "../src/mandelbrot_with_gpu";

function setupGpuDom(): {
  canvas: HTMLCanvasElement;
  replacementCanvas: HTMLCanvasElement;
  ctxMock: {
    fillText: ReturnType<typeof vi.fn>;
    drawImage: ReturnType<typeof vi.fn>;
    font: string;
    textAlign: string;
    fillStyle: string;
  };
  kernelMock: ReturnType<typeof vi.fn>;
  gpuInstanceMock: { createKernel: ReturnType<typeof vi.fn> };
} {
  document.body.innerHTML = `
    <canvas id="fractale" width="100" height="100"></canvas>
    <figcaption id="positionAffichee"></figcaption>
    <form name="precision">
      <input type="number" id="width" name="width" value="30" />
      <input type="number" id="height" name="height" value="30" />
      <input type="number" id="max" name="max" value="10" />
      <input type="checkbox" id="ajouterLegende" name="ajouterLegende" checked />
      <button type="submit" id="btnPrecise">Augmenter la précision</button>
    </form>
  `;

  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  const replacementCanvas = document.createElement("canvas");
  const ctxMock = {
    fillText: vi.fn(),
    drawImage: vi.fn(),
    font: "",
    textAlign: "left",
    fillStyle: "",
  };
  vi.spyOn(canvas, "getContext").mockReturnValue(
    ctxMock as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(replacementCanvas, "getContext").mockReturnValue(
    ctxMock as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    getPropertyValue: (prop: string) => (prop === "width" ? "100px" : ""),
  } as CSSStyleDeclaration);

  const kernelMock = vi.fn(() => "rendered");
  Object.assign(kernelMock, {
    setOutput: vi.fn(() => kernelMock),
    setDynamicOutput: vi.fn(() => kernelMock),
    setDynamicArguments: vi.fn(() => kernelMock),
    setLoopMaxIterations: vi.fn(() => kernelMock),
    setTactic: vi.fn(() => kernelMock),
    setGraphical: vi.fn(() => kernelMock),
    canvas: replacementCanvas,
  });

  const dummyRef = new Float32Array([0, 0]);
  const gpuInstanceMock = {
    createKernel: vi.fn((fn: unknown) => {
      // Also exercise the kernel function in JS for coverage (both shallow and deep FloatExp perturbation modes)
      if (typeof fn === "function") {
        const ctxThis = {
          thread: { x: 0, y: 0, z: 0 },
          output: { x: 10, y: 10, z: 1 },
          color: vi.fn(),
        };
        // Shallow mode (usePerturb = 0): outside, cardioid (0,0), period-2 bulb (-1,0), bounded loop
        fn.call(ctxThis, 2, 0, 0, 10, 0.1, 1, 0.1, 0.9, 0, dummyRef, dummyRef, dummyRef, 1, 1, 1);
        fn.call({ ...ctxThis, thread: { x: 5, y: 5, z: 0 } }, 2, 0, 0, 10, 0.1, 1, 0.1, 0.9, 0, dummyRef, dummyRef, dummyRef, 1, 1, 1);
        fn.call({ ...ctxThis, thread: { x: 5, y: 5, z: 0 } }, 2, -1, 0, 10, 0.1, 1, 0.1, 0.9, 0, dummyRef, dummyRef, dummyRef, 1, 1, 1);
        fn.call({ ...ctxThis, thread: { x: 5, y: 5, z: 0 } }, 1, 0, 0.75, 2, 0.1, 1, 0.1, 0.9, 0, dummyRef, dummyRef, dummyRef, 1, 1, 0);
        // Deep FloatExp perturbation mode (usePerturb = 1) at ultra-deep exp = -170 (~1e-51)!
        const tipOrbitRe = new Float32Array(100);
        const tipOrbitIm = new Float32Array(100);
        const tipOrbitExp = new Float32Array(100);
        tipOrbitRe[1] = -1;
        tipOrbitExp[1] = 1;
        for (let k = 2; k < 100; k++) {
          tipOrbitRe[k] = 1;
          tipOrbitExp[k] = 1;
        }
        // thread.x = 0 -> negative dc (-2 - 1e-51) grows by 4^k and escapes around iter 85!
        fn.call({ ...ctxThis, thread: { x: 0, y: 5, z: 0 } }, 0, -2, 0, 95, 0.1, 1, 0.1, 0.9, 1, tipOrbitRe, tipOrbitIm, tipOrbitExp, 95, 1, -170);
        // Center pixel (dc = 0) stays bounded
        fn.call({ ...ctxThis, thread: { x: 5, y: 5, z: 0 } }, 0, -2, 0, 10, 0.1, 1, 0.1, 0.9, 1, tipOrbitRe, tipOrbitIm, tipOrbitExp, 10, 1, -170);
        // Rebasing branches (diffZ < -15, within [-15, 15], and m >= refEscapeIter)
        const refRe = new Float32Array([0, -1, 0.5, -1, 0]);
        const refIm = new Float32Array([0, 0, 0, 0, 0]);
        const refExp = new Float32Array([0, 0, -200, 0, 0]);
        fn.call(ctxThis, 0, -1, 0, 6, 0.1, 1, 0.1, 0.9, 1, refRe, refIm, refExp, 2, 1, -5);
        fn.call({ ...ctxThis, thread: { x: 8, y: 5, z: 0 } }, 0, -1, 0, 5, 0.1, 1, 0.1, 0.9, 1, refRe, refIm, new Float32Array([0, 0, 0, 0, 0]), 4, 1, 0);
        const escRefRe = new Float32Array([0, 0.75]);
        const escRefIm = new Float32Array([0, 0]);
        const escRefExp = new Float32Array([0, 3]);
        fn.call(ctxThis, 0, 6, 0, 10, 0.1, 1, 0.1, 0.9, 1, escRefRe, escRefIm, escRefExp, 1, 1, -2);
        // Hit all cas 0..5 including negative h wrapping
        for (let s = -2; s < 6; s++) {
          const h0 = 0.1; // iteration 1 / 10
          const hTarget = (s + 0.1) / 6;
          const hMin = h0 - hTarget;
          fn.call(ctxThis, 2, 0, 0, 10, hMin, hMin + 1, 0.1, 0.9, 0, dummyRef, dummyRef, dummyRef, 1, 1, 1);
        }
      }
      return kernelMock;
    }),
  };

  gpuConstructorMock.mockImplementation(() => gpuInstanceMock);

  return { canvas, replacementCanvas, ctxMock, kernelMock, gpuInstanceMock };
}

describe("mandelbrot_with_gpu", () => {
  beforeEach(() => {
    resetGPUCache();
    vi.restoreAllMocks();
  });

  it("initGPU instantiates and caches GPU from gpu.js", () => {
    const { gpuInstanceMock } = setupGpuDom();
    const instance = initGPU();
    expect(instance).toBe(gpuInstanceMock);
    expect(initGPU()).toBe(instance);
  });

  it("itereZ computes Mandelbrot iterations", () => {
    expect(itereZ(50, 50, 2, 0, 0, 100, 100, 20)).toBe(20);
    expect(itereZ(0, 0, 2, 10, 10, 100, 100, 20)).toBeLessThan(20);
  });

  it("ajoutLegende renders legend text and updates positionAffichee", () => {
    const { canvas } = setupGpuDom();
    const ctx = canvas.getContext("2d")!;
    const checkbox = document.getElementById("ajouterLegende") as HTMLInputElement;
    const pos = document.getElementById("positionAffichee") as HTMLElement;

    checkbox.checked = true;
    ajoutLegende(ctx, 100, 100, 0, 0, 2, 10);
    expect(ctx.fillText).toHaveBeenCalledTimes(4);
    expect(pos.innerHTML).toContain("max_iterations: 10");

    (ctx.fillText as ReturnType<typeof vi.fn>).mockClear();
    checkbox.checked = false;
    ajoutLegende(ctx, 100, 100, 0, 0, 2, 15);
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(pos.innerHTML).toContain("max_iterations: 15");
  });

  it("drawPoint computes dynamic h_min/h_max/b_min/b_max from sampling instead of fixed values", () => {
    const { kernelMock } = setupGpuDom();
    vi.spyOn(console, "log").mockImplementation(() => {});

    drawPoint(0, 0, 2, 10);
    const args = kernelMock.mock.calls[0] as number[];
    // args: [scale, x_mean, y_mean, max, h_min, h_max, b_min, b_max]
    expect(args[0]).toBe(2);
    expect(args[3]).toBe(10);
    // At (0,0), scale=2, max=10, escaped samples have iteration >= 1 -> h_min=0.1, h_max < 1, b_max < 0.9
    expect(args[4]).toBeCloseTo(0.1);
    expect(args[5]).toBeLessThan(1);
    expect(args[5]).toBeGreaterThan(args[4]!);
    expect(args[7]).toBeLessThan(0.9);
    expect(args[7]).toBeGreaterThan(args[6]!);
  });

  it("drawPoint falls back safely when all sampled points are inside the set (no escaped samples)", () => {
    const { kernelMock } = setupGpuDom();
    vi.spyOn(console, "log").mockImplementation(() => {});

    // Deep inside the main cardioid (0, 0) with tiny scale: every sample hits max iterations
    drawPoint(0, 0, 0.01, 10);
    const args = kernelMock.mock.calls[0] as number[];
    expect(args[4]).toBe(1 / 10);
    expect(args[5]).toBe(1);
    expect(args[6]).toBe(1 / 10);
    expect(args[7]).toBe(9 / 10);
  });

  it("GPU kernel maps bottom thread.y=0 to negative c_im and top thread.y=output.y to positive c_im", () => {
    const { gpuInstanceMock } = setupGpuDom();
    vi.spyOn(console, "log").mockImplementation(() => {});

    let capturedKernel:
      | ((
          this: { thread: { x: number; y: number; z: number }; output: { x: number; y: number; z: number }; color: ReturnType<typeof vi.fn> },
          ...args: number[]
        ) => void)
      | undefined;
    gpuInstanceMock.createKernel.mockImplementation((fn: unknown) => {
      capturedKernel = fn as typeof capturedKernel;
      const k = vi.fn(() => "rendered");
      return Object.assign(k, {
        setOutput: vi.fn(() => k),
        setDynamicOutput: vi.fn(() => k),
        setDynamicArguments: vi.fn(() => k),
        setLoopMaxIterations: vi.fn(() => k),
        setTactic: vi.fn(() => k),
        setGraphical: vi.fn(() => k),
        canvas: document.createElement("canvas"),
      });
    });

    drawPoint(0, 0, 2, 10);
    expect(capturedKernel).toBeDefined();

    const emptyRef = new Float32Array([0, 0]);
    const colorTop = vi.fn();
    capturedKernel!.call(
      { thread: { x: 5, y: 10, z: 0 }, output: { x: 10, y: 10, z: 1 }, color: colorTop },
      1, 0, 1.5, 2, 0.1, 1, 0.1, 0.9, 0, emptyRef, emptyRef, emptyRef, 1, 1, 0
    );
    const colorBottom = vi.fn();
    capturedKernel!.call(
      { thread: { x: 5, y: 0, z: 0 }, output: { x: 10, y: 10, z: 1 }, color: colorBottom },
      1, 0, 1.5, 2, 0.1, 1, 0.1, 0.9, 0, emptyRef, emptyRef, emptyRef, 1, 1, 0
    );
    expect(colorTop.mock.calls[0]!.slice(0, 3)).not.toEqual([0, 0, 0]);
    expect(colorBottom).toHaveBeenCalledWith(0, 0, 0, 1);
  });

  it("switches to FloatExp perturbation mode past 1e-18 (e.g. 1e-50) with highp precision", () => {
    const { kernelMock } = setupGpuDom();
    drawPoint(-2, 0, 1e-50, 200);
    expect((kernelMock as unknown as { setTactic: ReturnType<typeof vi.fn> }).setTactic).toHaveBeenCalledWith("precision");
    const callArgs = kernelMock.mock.calls[0] as unknown[];
    // args: [scale, x_mean, y_mean, max, h_min, h_max, b_min, b_max, usePerturb, refRe, refIm, refExp, refEscapeIter, scaleMantissa, scaleExp]
    expect(callArgs[8]).toBe(1);
    expect(callArgs[9]).toBeInstanceOf(Float32Array);
    expect(callArgs[14]).toBeLessThan(-160);
  });

  it("reuses a single GPU instance and compiled kernel across frames and preserves width/height on draw", () => {
    const { canvas, replacementCanvas, ctxMock, kernelMock, gpuInstanceMock } =
      setupGpuDom();

    draw(0, 0, 2);
    draw(0.1, 0.1, 1.8);
    expect(gpuInstanceMock.createKernel).toHaveBeenCalledTimes(1);
    expect(kernelMock).toHaveBeenCalledTimes(2);
    expect(canvas.width).toBe(30);
    expect(canvas.height).toBe(30);
    expect(document.getElementById("fractale")).toBe(canvas);
    expect(ctxMock.drawImage).toHaveBeenCalledWith(replacementCanvas, 0, 0);

    drawPrecise(0, 0, 2);
    expect(gpuInstanceMock.createKernel).toHaveBeenCalledTimes(1);

    // When getContext returns null
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    draw(0, 0, 2);
    drawPrecise(0, 0, 2);
    drawPoint(0, 0, 2, 10);
  });

  it("initMandelbrotGpu wires viewport and form controls and keeps #fractale interactive", () => {
    const { canvas, kernelMock } = setupGpuDom();
    vi.spyOn(console, "log").mockImplementation(() => {});

    initMandelbrotGpu();
    expect(kernelMock).toHaveBeenCalledTimes(1);

    // Wheel zoom on the same #fractale canvas still works after rendering
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true }));
    const callsAfterZoom = kernelMock.mock.calls.length;
    expect(callsAfterZoom).toBeGreaterThan(1);

    const form = document.querySelector("form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(kernelMock).toHaveBeenCalledTimes(callsAfterZoom + 1);
    expect(canvas.width).toBe(30);
    expect(canvas.height).toBe(30);
  });
});
