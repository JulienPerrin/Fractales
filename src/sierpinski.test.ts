import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  equilateralHeight,
  calculeNbIteration,
  sleep,
  draw,
  drawtorefactor,
  ajoutLegende,
  initSierpinski,
} from "./sierpinski";

function setupSierpinskiDom(): {
  canvas: HTMLCanvasElement;
  ctx: Record<string, unknown>;
} {
  document.body.innerHTML = `
    <canvas id="fractale" width="10" height="8"></canvas>
    <input type="checkbox" id="asynchrone" />
    <input type="number" id="intervalleTemps" value="0" />
    <input type="number" id="width" value="5" />
    <input type="checkbox" id="legende" checked />
    <input type="button" id="btnPrecise" value="Augmenter précision" />
  `;

  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  const ctx = {
    clearRect: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    moveTo: vi.fn(),
    putImageData: vi.fn(),
    fillText: vi.fn(),
    font: "",
    textAlign: "left",
    fillStyle: "",
  };
  vi.spyOn(canvas, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  );

  return { canvas, ctx };
}

describe("sierpinski", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("equilateralHeight and calculeNbIteration compute expected values", () => {
    expect(equilateralHeight(600)).toBe(519);
    expect(calculeNbIteration(5)).toBe(
      Math.round(5 * 3 ** Math.log(5))
    );
  });

  it("sleep resolves after the given delay", async () => {
    vi.useFakeTimers();
    const p = sleep(10);
    vi.advanceTimersByTime(10);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("draw renders synchronously and covers all 3 random vertices plus legend", async () => {
    const { ctx } = setupSierpinskiDom();
    const values = [0.1, 0.5, 0.9];
    let idx = 0;
    vi.spyOn(Math, "random").mockImplementation(() => values[idx++ % values.length]!);

    await draw();
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalledTimes(calculeNbIteration(5));
    expect(ctx.fillText).toHaveBeenCalledTimes(3);

    // Without legend
    (ctx.fillText as ReturnType<typeof vi.fn>).mockClear();
    (document.getElementById("legende") as HTMLInputElement).checked = false;
    await draw();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("draw cancels an in-progress async draw when a new draw starts", async () => {
    const { ctx } = setupSierpinskiDom();
    (document.getElementById("asynchrone") as HTMLInputElement).checked = true;
    (document.getElementById("intervalleTemps") as HTMLInputElement).value = "1";

    const first = draw();
    // Immediately start a second synchronous draw so the first cancels
    (document.getElementById("asynchrone") as HTMLInputElement).checked = false;
    const second = draw();

    await Promise.all([first, second]);
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("handles missing 2d context gracefully", async () => {
    const { canvas } = setupSierpinskiDom();
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    await draw();
    await drawtorefactor();
  });

  it("ajoutLegende draws 3 lines of text", () => {
    const { ctx } = setupSierpinskiDom();
    ajoutLegende(ctx as unknown as CanvasRenderingContext2D, 100, 86);
    expect(ctx.fillText).toHaveBeenCalledTimes(3);
  });

  it("initSierpinski triggers draw on load and on control clicks", async () => {
    const { ctx } = setupSierpinskiDom();
    initSierpinski();
    await vi.waitFor(() => {
      expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    });

    document.getElementById("asynchrone")?.click();
    document.getElementById("legende")?.click();
    document.getElementById("btnPrecise")?.click();
    await vi.waitFor(() => {
      expect(ctx.clearRect).toHaveBeenCalledTimes(4);
    });
  });
});
