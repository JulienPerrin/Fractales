import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  equilateralHeight,
  calculeNbIteration,
  sleep,
  createSierpinskiState,
  renderSierpinski,
  ajoutLegende,
  initSierpinski,
} from "../src/sierpinski";

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
    expect(calculeNbIteration(5)).toBe(Math.round(5 * 3 ** Math.log(5)));
  });

  it("sleep resolves after the given delay", async () => {
    vi.useFakeTimers();
    const p = sleep(10);
    vi.advanceTimersByTime(10);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("createSierpinskiState derives height and iterations reactively from width", () => {
    const state = createSierpinskiState();
    expect(state.width.value).toBe(600);
    expect(state.height.value).toBe(519);
    expect(state.iterations.value).toBe(calculeNbIteration(600));
    expect(state.isAsync.value).toBe(true);
    expect(state.intervalMs.value).toBe(1);
    expect(state.showLegend.value).toBe(true);

    state.width.value = 5;
    expect(state.height.value).toBe(equilateralHeight(5));
    expect(state.iterations.value).toBe(calculeNbIteration(5));
  });

  it("renderSierpinski renders synchronously and covers all 3 random vertices plus legend", async () => {
    const { canvas, ctx } = setupSierpinskiDom();
    const values = [0.1, 0.5, 0.9];
    let idx = 0;
    vi.spyOn(Math, "random").mockImplementation(
      () => values[idx++ % values.length]!
    );

    const width = 5;
    const height = equilateralHeight(width);
    const iterations = calculeNbIteration(width);

    await renderSierpinski(canvas, {
      width,
      height,
      iterations,
      isAsync: false,
      showLegend: true,
      getIntervalMs: () => 0,
      isCancelled: () => false,
    });

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, width, height);
    expect(ctx.putImageData).toHaveBeenCalledTimes(iterations);
    expect(ctx.fillText).toHaveBeenCalledTimes(3);

    // Without legend
    (ctx.fillText as ReturnType<typeof vi.fn>).mockClear();
    await renderSierpinski(canvas, {
      width,
      height,
      iterations,
      isAsync: false,
      showLegend: false,
      getIntervalMs: () => 0,
      isCancelled: () => false,
    });
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("renderSierpinski stops early when cancelled during async draw", async () => {
    const { canvas, ctx } = setupSierpinskiDom();
    let cancelled = false;
    const drawPromise = renderSierpinski(canvas, {
      width: 5,
      height: equilateralHeight(5),
      iterations: calculeNbIteration(5),
      isAsync: true,
      showLegend: true,
      getIntervalMs: () => 1,
      isCancelled: () => cancelled,
    });

    cancelled = true;
    await drawPromise;
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("renderSierpinski handles missing 2d context gracefully", async () => {
    const { canvas } = setupSierpinskiDom();
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    await renderSierpinski(canvas, {
      width: 5,
      height: equilateralHeight(5),
      iterations: 10,
      isAsync: false,
      showLegend: true,
      getIntervalMs: () => 0,
      isCancelled: () => false,
    });
  });

  it("ajoutLegende draws 3 lines of text with given iterations", () => {
    const { ctx } = setupSierpinskiDom();
    ajoutLegende(ctx as unknown as CanvasRenderingContext2D, 100, 86, 42);
    expect(ctx.fillText).toHaveBeenCalledTimes(3);
    expect(ctx.fillText).toHaveBeenCalledWith(
      "nombre d'itérations : 42",
      (100 * 29) / 30,
      (86 * 25) / 28
    );
  });

  it("initSierpinski binds DOM controls to signals and re-renders reactively", async () => {
    const { ctx } = setupSierpinskiDom();
    const { state, dispose } = initSierpinski();

    await vi.waitFor(() => {
      expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    });
    expect(state.width.value).toBe(5);
    expect(state.isAsync.value).toBe(false);
    expect(state.intervalMs.value).toBe(0);
    expect(state.showLegend.value).toBe(true);

    const asynchrone = document.getElementById("asynchrone") as HTMLInputElement;
    asynchrone.checked = true;
    asynchrone.dispatchEvent(new Event("change"));
    expect(state.isAsync.value).toBe(true);

    const intervalle = document.getElementById(
      "intervalleTemps"
    ) as HTMLInputElement;
    intervalle.value = "2";
    intervalle.dispatchEvent(new Event("input"));
    expect(state.intervalMs.value).toBe(2);

    const widthInput = document.getElementById("width") as HTMLInputElement;
    widthInput.value = "6";
    widthInput.dispatchEvent(new Event("change"));
    expect(state.width.value).toBe(6);

    const legende = document.getElementById("legende") as HTMLInputElement;
    legende.checked = false;
    legende.dispatchEvent(new Event("change"));
    expect(state.showLegend.value).toBe(false);

    document.getElementById("btnPrecise")?.click();

    await vi.waitFor(() => {
      expect(ctx.clearRect).toHaveBeenCalledTimes(5);
    });

    dispose();
  });
});
