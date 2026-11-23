import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  drawSimple,
  draw,
  drawPrecise,
  drawPoint,
  itereZ,
  ajoutLegende,
  HSVtoRGB,
  initMandelbrot,
} from "./mandelbrot";

function setupMandelbrotDom(): {
  canvas: HTMLCanvasElement;
  ctx: Record<string, unknown>;
} {
  document.body.innerHTML = `
    <canvas id="fractale" width="100" height="100"></canvas>
    <figcaption id="positionAffichee"></figcaption>
    <input type="number" id="width" value="20" />
    <input type="number" id="height" value="20" />
    <input type="number" id="max" value="10" />
    <input type="button" id="btnPrecise" value="Augmenter la précision" />
    <input type="checkbox" id="ajouterLegende" checked />
  `;

  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  const ctx = {
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    fillText: vi.fn(),
    font: "",
    textAlign: "left",
    fillStyle: "",
  };
  vi.spyOn(canvas, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    getPropertyValue: (prop: string) => (prop === "width" ? "100px" : ""),
  } as CSSStyleDeclaration);

  return { canvas, ctx };
}

describe("mandelbrot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("itereZ returns max for points inside the Mandelbrot set and < max for points outside", () => {
    // Center (0, 0) is inside the Mandelbrot set
    const inside = itereZ(50, 50, 2, 0, 0, 100, 100, 50);
    expect(inside).toBe(50);

    // Far outside point escapes immediately
    const outside = itereZ(0, 0, 2, 10, 10, 100, 100, 50);
    expect(outside).toBeLessThan(50);
  });

  it("HSVtoRGB converts all 6 hue sectors and supports object argument", () => {
    expect(HSVtoRGB(0 / 6, 1, 1)).toEqual({ r: 255, g: 0, b: 0 });
    expect(HSVtoRGB(1 / 6, 1, 1)).toEqual({ r: 255, g: 255, b: 0 });
    expect(HSVtoRGB(2 / 6, 1, 1)).toEqual({ r: 0, g: 255, b: 0 });
    expect(HSVtoRGB(3 / 6, 1, 1)).toEqual({ r: 0, g: 255, b: 255 });
    expect(HSVtoRGB(4 / 6, 1, 1)).toEqual({ r: 0, g: 0, b: 255 });
    expect(HSVtoRGB(5 / 6, 1, 1)).toEqual({ r: 255, g: 0, b: 255 });
    expect(HSVtoRGB({ h: 0, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("ajoutLegende draws legend on canvas when checked and skips canvas text when unchecked", () => {
    const { ctx } = setupMandelbrotDom();
    const checkbox = document.getElementById("ajouterLegende") as HTMLInputElement;
    const pos = document.getElementById("positionAffichee") as HTMLElement;

    checkbox.checked = true;
    ajoutLegende(ctx as unknown as CanvasRenderingContext2D, 100, 100, 0, 0, 2, 100);
    expect(ctx.fillText).toHaveBeenCalledTimes(4);
    expect(pos.innerHTML).toContain("max_iterations: 100");

    (ctx.fillText as ReturnType<typeof vi.fn>).mockClear();
    checkbox.checked = false;
    ajoutLegende(ctx as unknown as CanvasRenderingContext2D, 100, 100, 0, 0, 2, 50);
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(pos.innerHTML).toContain("max_iterations: 50");
  });

  it("draw, drawSimple, drawPrecise, and drawPoint render pixels and legend", () => {
    const { canvas, ctx } = setupMandelbrotDom();
    vi.spyOn(console, "log").mockImplementation(() => {});

    drawSimple();
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
    expect(ctx.putImageData).toHaveBeenCalledTimes(100 * 100);

    (ctx.putImageData as ReturnType<typeof vi.fn>).mockClear();
    draw(0, 0, 2);
    expect(ctx.putImageData).toHaveBeenCalledTimes(100 * 100);

    (ctx.putImageData as ReturnType<typeof vi.fn>).mockClear();
    drawPrecise(0, 0, 2);
    expect(canvas.width).toBe(20);
    expect(canvas.height).toBe(20);
    expect(ctx.putImageData).toHaveBeenCalledTimes(20 * 20);

    // When getContext returns null, draw/drawPrecise/drawPoint exit gracefully
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    draw(0, 0, 2);
    drawPrecise(0, 0, 2);
    drawPoint(0, 0, 2, 10);
  });

  it("initMandelbrot binds viewport, precision button, and legend checkbox", () => {
    const { ctx } = setupMandelbrotDom();
    vi.spyOn(console, "log").mockImplementation(() => {});

    initMandelbrot();
    expect(ctx.putImageData).toHaveBeenCalled();

    (ctx.putImageData as ReturnType<typeof vi.fn>).mockClear();
    document.getElementById("btnPrecise")?.click();
    expect(ctx.putImageData).toHaveBeenCalledTimes(20 * 20);

    (ctx.putImageData as ReturnType<typeof vi.fn>).mockClear();
    document.getElementById("ajouterLegende")?.click();
    expect(ctx.putImageData).toHaveBeenCalledTimes(100 * 100);
  });
});
