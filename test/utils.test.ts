import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pt,
  calculerRatio,
  calculeCoordonnees,
  calculePositionPx,
  translate,
  initViewport,
  precisionBitsForScale,
  decomposeScale,
  bigFixedFromNumber,
  bigFixedAdd,
  bigFixedToNumber,
  computeReferenceOrbit,
  perturbItereZ,
} from "../src/utils";

describe("utils", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    document.body.innerHTML = '<canvas id="fractale" width="100" height="100"></canvas>';
    canvas = document.getElementById("fractale") as HTMLCanvasElement;
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (prop: string) => (prop === "width" ? "200px" : ""),
    } as CSSStyleDeclaration);
  });

  it("pt creates a Point object", () => {
    expect(pt(3, -4)).toEqual({ x: 3, y: -4 });
  });

  it("calculerRatio computes CSS width / canvas.width", () => {
    expect(calculerRatio(canvas)).toBe(2);
  });

  it("calculeCoordonnees and calculePositionPx are inverses", () => {
    const ratio = 2;
    const scale = 2;
    const coord = calculeCoordonnees(100, 100, canvas, ratio, scale);
    expect(coord.x).toBeCloseTo(0);
    expect(coord.y).toBeCloseTo(0);

    const px = calculePositionPx(coord.x, coord.y, canvas, ratio, scale);
    expect(px.x).toBeCloseTo(100);
    expect(px.y).toBeCloseTo(100);

    const topLeft = calculeCoordonnees(0, 0, canvas, ratio, scale);
    expect(topLeft.x).toBeCloseTo(-2);
    expect(topLeft.y).toBeCloseTo(2);
    const pxTopLeft = calculePositionPx(topLeft.x, topLeft.y, canvas, ratio, scale);
    expect(pxTopLeft.x).toBeCloseTo(0);
    expect(pxTopLeft.y).toBeCloseTo(0);
  });

  it("translate shifts state and invokes drawFn", () => {
    const state = { xMean: 1, yMean: 2, scale: 0.5 };
    const drawFn = vi.fn();
    translate(state, 0.5, -1, drawFn);
    expect(state).toEqual({ xMean: 1.5, yMean: 1, scale: 0.5 });
    expect(drawFn).toHaveBeenCalledWith(1.5, 1, 0.5);
  });

  it("initViewport draws initially and handles pan, click-zoom, shift-click-zoom, and wheel zoom", () => {
    const drawFn = vi.fn();
    const state = initViewport(canvas, drawFn);
    expect(drawFn).toHaveBeenCalledTimes(1);
    expect(drawFn).toHaveBeenCalledWith(0, 0, 2);

    // Non-left mouse button does not start drag
    canvas.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 50, bubbles: true }));
    expect(drawFn).toHaveBeenCalledTimes(1);

    // Click without drag zooms in
    const downNoDrag = new MouseEvent("mousedown", { button: 0, bubbles: true });
    Object.defineProperty(downNoDrag, "offsetX", { value: 100 });
    Object.defineProperty(downNoDrag, "offsetY", { value: 100 });
    canvas.dispatchEvent(downNoDrag);
    canvas.dispatchEvent(new MouseEvent("mouseup", { shiftKey: false, bubbles: true }));
    expect(state.scale).toBeCloseTo(2 / 1.1);

    // Shift-click without drag zooms out
    const downShift = new MouseEvent("mousedown", { button: 0, bubbles: true });
    Object.defineProperty(downShift, "offsetX", { value: 100 });
    Object.defineProperty(downShift, "offsetY", { value: 100 });
    canvas.dispatchEvent(downShift);
    canvas.dispatchEvent(new MouseEvent("mouseup", { shiftKey: true, bubbles: true }));
    expect(state.scale).toBeCloseTo(2);

    // Drag pans the viewport
    const downDrag = new MouseEvent("mousedown", { button: 0, bubbles: true });
    Object.defineProperty(downDrag, "offsetX", { value: 100 });
    Object.defineProperty(downDrag, "offsetY", { value: 100 });
    canvas.dispatchEvent(downDrag);

    const moveDrag = new MouseEvent("mousemove", { bubbles: true });
    Object.defineProperty(moveDrag, "offsetX", { value: 150 });
    Object.defineProperty(moveDrag, "offsetY", { value: 100 });
    canvas.dispatchEvent(moveDrag);
    expect(state.xMean).toBeLessThan(0);

    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    // Wheel zoom invokes drawFn only once per wheel tick
    const callsBeforeWheel = drawFn.mock.calls.length;
    const scaleBeforeWheel = state.scale;
    const wheelIn = new WheelEvent("wheel", { deltaY: -100, cancelable: true });
    canvas.dispatchEvent(wheelIn);
    expect(state.scale).toBeLessThan(scaleBeforeWheel);
    expect(wheelIn.defaultPrevented).toBe(true);
    expect(drawFn).toHaveBeenCalledTimes(callsBeforeWheel + 1);

    // Wheel with deltaY === 0 does nothing
    const scaleAfterWheel = state.scale;
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 0, cancelable: true }));
    expect(state.scale).toBe(scaleAfterWheel);

    // Fallback to pageX/pageY when offsetX/offsetY are 0
    const downPage = new MouseEvent("mousedown", { button: 0, bubbles: true });
    Object.defineProperty(downPage, "offsetX", { value: 0 });
    Object.defineProperty(downPage, "offsetY", { value: 0 });
    Object.defineProperty(downPage, "pageX", { value: 10 });
    Object.defineProperty(downPage, "pageY", { value: 10 });
    canvas.dispatchEvent(downPage);
    canvas.dispatchEvent(new MouseEvent("mouseup", { shiftKey: false, bubbles: true }));

    // Zoom still works when canvas/CSS ratio changes
    const scaleBeforeResizeZoom = state.scale;
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "400px",
    } as CSSStyleDeclaration);
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true }));
    expect(state.scale).toBeLessThan(scaleBeforeResizeZoom);
  });

  it("BigFixed arbitrary-precision arithmetic, reference orbit, and perturbation match exact Mandelbrot", () => {
    expect(precisionBitsForScale(2)).toBe(128);
    expect(precisionBitsForScale(1e-30)).toBeGreaterThan(128);

    const zero = bigFixedFromNumber(0, 128);
    expect(bigFixedToNumber(zero)).toBe(0);

    const a = bigFixedFromNumber(-0.75, 128);
    const tiny = bigFixedFromNumber(1e-25, 192);
    const sum = bigFixedAdd(a, tiny);
    const sumReversed = bigFixedAdd(tiny, a);
    expect(sum.fracBits).toBe(192);
    expect(sumReversed.raw).toBe(sum.raw);
    expect(sum.raw).toBeGreaterThan(a.raw << 64n);
    expect(bigFixedToNumber(a)).toBeCloseTo(-0.75, 12);
    // Also exercise shift < 0 when fracBits is small
    const coarse = bigFixedFromNumber(0.5, 10);
    expect(bigFixedToNumber(coarse)).toBeCloseTo(0.5, 2);

    // Bounded reference orbit inside Mandelbrot set (-1, 0): period-2 cycle 0 -> -1 -> 0
    const orbitInside = computeReferenceOrbit(
      bigFixedFromNumber(-1, 128),
      bigFixedFromNumber(0, 128),
      20
    );
    expect(orbitInside.refEscapeIter).toBe(20);
    // Perturbation with dc = 0 stays bounded for all 20 iterations
    expect(perturbItereZ(0, 0, 0, orbitInside, 20)).toBe(20);
    // Perturbation with dc = +0.5 * 2^0 -> C = -0.5 (stays bounded, exercises |z| < |d| rebasing!)
    expect(perturbItereZ(0.5, 0, 0, orbitInside, 20)).toBe(20);

    // Escaping reference orbit at C0 = (1.5, 0) escapes quickly; nearby pixel C = (-0.5, 0) rebases on m >= refEscapeIter
    const orbitEscaping = computeReferenceOrbit(
      bigFixedFromNumber(1.5, 128),
      bigFixedFromNumber(0, 128),
      20
    );
    expect(orbitEscaping.refEscapeIter).toBeLessThan(20);
    expect(perturbItereZ(-1.0, 0, 1, orbitEscaping, 20)).toBe(20);
    expect(perturbItereZ(0.5, 0, 1, orbitEscaping, 20)).toBeLessThan(20);

    // Ultra-deep scale (1e-50, well past float32 1e-18 and 1e-38 limits!): C0 = (0.25, 0) cusp
    // C = 0.25 + dc escapes for dc > 0 and stays bounded for dc <= 0 even at 1e-50!
    const { mantissa, exp } = decomposeScale(1e-50);
    expect(mantissa).toBeGreaterThanOrEqual(0.5);
    expect(mantissa).toBeLessThan(2);
    expect(exp).toBeLessThan(-160);
    const orbitCusp = computeReferenceOrbit(
      bigFixedFromNumber(0.25, 256),
      bigFixedFromNumber(0, 256),
      40
    );
    expect(perturbItereZ(-mantissa, 0, exp, orbitCusp, 40)).toBe(40);
    // At C0 = (-2, 0) (tip of antenna!):
    // +dc (-2 + 1e-50) is inside [-2, 0.25] (stays bounded = 120), while -dc (-2 - 1e-50) escapes around n ~ 85!
    const orbitTip = computeReferenceOrbit(
      bigFixedFromNumber(-2, 256),
      bigFixedFromNumber(0, 256),
      120
    );
    expect(perturbItereZ(mantissa, 0, exp, orbitTip, 120)).toBe(120);
    const iterAt1e50 = perturbItereZ(-mantissa, 0, exp, orbitTip, 120);
    expect(iterAt1e50).toBeGreaterThanOrEqual(70);
    expect(iterAt1e50).toBeLessThan(100);

    // Near-origin tiny BigFixed (bitLen <= 53 and negative imaginary part)
    const tinyOriginOrbit = computeReferenceOrbit(
      { raw: 1n, fracBits: 128 },
      { raw: -3n, fracBits: 128 },
      5
    );
    expect(tinyOriginOrbit.refExp[1]).toBeLessThan(-120);
    expect(perturbItereZ(1, 0, 0, tinyOriginOrbit, 5)).toBe(3);
  });
});
