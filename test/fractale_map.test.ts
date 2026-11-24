import { describe, it, expect, beforeEach } from "vitest";
import {
  MAX_AUTO_ITERATIONS,
  computeAutoMaxIterations,
  initMovableFractal,
  resolveColorAndMax,
} from "../src/fractale_map";

describe("fractale_map auto-iterations", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("computeAutoMaxIterations scales with zoom depth and refines using sampled iterationMax", () => {
    // At default scale=2, zoomDepth=0 -> baseMax
    expect(computeAutoMaxIterations(200, 2)).toBe(200);

    // Zoomed in 1024x (scale = 2 / 1024) -> zoomDepth = 10 -> 200 + 800 = 1000
    expect(computeAutoMaxIterations(200, 2 / 1024)).toBe(1000);

    // Exterior region (sampleIterationMax < 35% of target) caps down toward max(baseMax, 2 * sample)
    expect(computeAutoMaxIterations(200, 2 / 1024, 50)).toBe(200);
    expect(computeAutoMaxIterations(50, 2 / 1024, 100)).toBe(200);

    // Mid-range sample keeps target unchanged
    expect(computeAutoMaxIterations(200, 2 / 1024, 500)).toBe(1000);

    // Dense boundary (sampleIterationMax >= 90% of target) boosts by 1.25x
    expect(computeAutoMaxIterations(200, 2 / 1024, 950)).toBe(1250);

    // Clamps to [1, MAX_AUTO_ITERATIONS]
    expect(computeAutoMaxIterations(0, 2)).toBe(1);
    expect(computeAutoMaxIterations(95000, 2 / 1024, 95000)).toBe(
      MAX_AUTO_ITERATIONS
    );

    // Scales continuously past 1e-15 (e.g. 1.92e-20 > 1e-15)
    expect(computeAutoMaxIterations(200, 1.92e-20)).toBeGreaterThan(
      computeAutoMaxIterations(200, 1e-15)
    );
  });

  it("resolveColorAndMax returns baseMax when #autoMax is absent or unchecked", () => {
    const resNoInput = resolveColorAndMax(30, 30, 50, 0.01, () => 10);
    expect(resNoInput.max).toBe(50);

    document.body.innerHTML = `<input type="checkbox" id="autoMax" />`;
    const resUnchecked = resolveColorAndMax(30, 30, 50, 0.01, () => 10);
    expect(resUnchecked.max).toBe(50);
  });

  it("resolveColorAndMax adapts max when #autoMax is checked (unchanged and refined paths)", () => {
    document.body.innerHTML = `<input type="checkbox" id="autoMax" checked />`;

    // Mid-range sample: effectiveMax === initialMax (no second sample pass)
    const mid = resolveColorAndMax(30, 30, 100, 2 / 1024, () => 500);
    expect(mid.max).toBe(900);

    // Dense boundary sample: boosts by 1.25x and re-samples
    const dense = resolveColorAndMax(
      30,
      30,
      100,
      2 / 1024,
      (_c, _r, m) => m - 1
    );
    expect(dense.max).toBe(1125);

    // All samples unescaped (iteration === m) at 1.92e-20: must boost max, NEVER drop back to 200!
    const allUnescaped = resolveColorAndMax(
      30,
      30,
      200,
      1.92e-20,
      (_c, _r, m) => m
    );
    expect(allUnescaped.max).toBeGreaterThan(6000);

    // High-iteration narrow escape spread enforces symmetric span centered on sampled midpoint
    const narrowHighIter = resolveColorAndMax(
      30,
      30,
      5000,
      2,
      (col) => (col === 0 ? 4000 : col === 15 ? 4001 : 5000)
    );
    expect(narrowHighIter.colorRange.hMax - narrowHighIter.colorRange.hMin).toBeCloseTo(1e-3, 6);
    expect(narrowHighIter.colorRange.bMax - narrowHighIter.colorRange.bMin).toBeCloseTo(1e-3, 6);
    // At high max (9000), brightness values stay well below 1.0 (no float32 saturation near 1.0)
    expect(narrowHighIter.colorRange.bMax).toBeLessThan(0.6);
  });

  it("initMovableFractal disables #max when #autoMax is checked and re-enables when unchecked", () => {
    document.body.innerHTML = `
      <canvas id="fractale" width="100" height="100"></canvas>
      <form>
        <input type="number" id="max" value="200" />
        <input type="checkbox" id="autoMax" checked />
        <button type="submit">Appliquer</button>
      </form>
    `;
    const canvas = document.getElementById("fractale") as HTMLCanvasElement;
    canvas.style.width = "100px";

    initMovableFractal(
      () => {},
      () => {}
    );

    const maxInput = document.getElementById("max") as HTMLInputElement;
    const autoMax = document.getElementById("autoMax") as HTMLInputElement;
    expect(maxInput.disabled).toBe(true);

    autoMax.checked = false;
    autoMax.dispatchEvent(new Event("change", { bubbles: true }));
    expect(maxInput.disabled).toBe(false);
  });
});
