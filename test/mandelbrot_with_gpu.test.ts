import { describe, it, expect, vi, beforeEach } from "vitest";

const gpuConstructorMock = vi.fn();

vi.mock("gpu.js", () => ({
  GPU: function (...args: unknown[]) {
    return gpuConstructorMock(...args);
  },
}));

import {
  initGPU,
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
    setGraphical: vi.fn(() => kernelMock),
    canvas: replacementCanvas,
  });

  const gpuInstanceMock = {
    createKernel: vi.fn((fn: unknown) => {
      // Also exercise the kernel function in JS for coverage
      if (typeof fn === "function") {
        const ctxThis = {
          thread: { x: 0, y: 0, z: 0 },
          output: { x: 10, y: 10, z: 1 },
          color: vi.fn(),
        };
        // Exercise outside (escapes) and inside (max iterations) + all 6 HSV sectors
        fn.call(ctxThis, 2, 0, 0, 10, 0.1, 1, 0.1, 0.9);
        fn.call({ ...ctxThis, thread: { x: 5, y: 5, z: 0 } }, 2, 0, 0, 10, 0.1, 1, 0.1, 0.9);
        // Hit all cas 0..5 by varying h_min/h_max so h = hTarget
        for (let s = 0; s < 6; s++) {
          const h0 = 0.1; // iteration 1 / 10
          const hTarget = (s + 0.1) / 6;
          const hMin = h0 - hTarget;
          fn.call(ctxThis, 2, 0, 0, 10, hMin, hMin + 1, 0.1, 0.9);
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
    vi.restoreAllMocks();
  });

  it("initGPU instantiates GPU from gpu.js", () => {
    const { gpuInstanceMock } = setupGpuDom();
    const instance = initGPU();
    expect(instance).toBe(gpuInstanceMock);
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
        setGraphical: vi.fn(() => k),
        canvas: document.createElement("canvas"),
      });
    });

    drawPoint(0, 0, 2, 10);
    expect(capturedKernel).toBeDefined();

    // At xMean=0, yMean=1.5, scale=1, max=2:
    // top (thread.y=10) -> c_im = +2.5 (escapes immediately at iter 1 -> colored)
    // bottom (thread.y=0) -> c_im = +0.5 (stays bounded at iter 2 -> black [0,0,0])
    const colorTop = vi.fn();
    capturedKernel!.call(
      { thread: { x: 5, y: 10, z: 0 }, output: { x: 10, y: 10, z: 1 }, color: colorTop },
      1, 0, 1.5, 2, 0.1, 1, 0.1, 0.9
    );
    const colorBottom = vi.fn();
    capturedKernel!.call(
      { thread: { x: 5, y: 0, z: 0 }, output: { x: 10, y: 10, z: 1 }, color: colorBottom },
      1, 0, 1.5, 2, 0.1, 1, 0.1, 0.9
    );
    expect(colorTop.mock.calls[0]!.slice(0, 3)).not.toEqual([0, 0, 0]);
    expect(colorBottom).toHaveBeenCalledWith(0, 0, 0, 255);
  });

  it("draw, drawPrecise, and drawPoint render onto #fractale without removing it", () => {
    const { canvas, replacementCanvas, ctxMock, kernelMock } = setupGpuDom();
    vi.spyOn(console, "log").mockImplementation(() => {});

    draw(0, 0, 2);
    expect(kernelMock).toHaveBeenCalled();
    expect(document.getElementById("fractale")).toBe(canvas);
    expect(ctxMock.drawImage).toHaveBeenCalledWith(replacementCanvas, 0, 0);

    drawPrecise(0, 0, 2);
    expect(canvas.width).toBe(30);
    expect(canvas.height).toBe(30);

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
