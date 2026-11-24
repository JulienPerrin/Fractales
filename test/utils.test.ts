import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pt,
  calculerRatio,
  calculeCoordonnees,
  calculePositionPx,
  translate,
  initViewport,
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

    // Wheel zoom
    const scaleBeforeWheel = state.scale;
    const wheelIn = new WheelEvent("wheel", { deltaY: -100, cancelable: true });
    canvas.dispatchEvent(wheelIn);
    expect(state.scale).toBeLessThan(scaleBeforeWheel);
    expect(wheelIn.defaultPrevented).toBe(true);

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

    // Zoom skipped if ratio changed
    const scaleBeforeBlockedZoom = state.scale;
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "400px",
    } as CSSStyleDeclaration);
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true }));
    expect(state.scale).toBe(scaleBeforeBlockedZoom);
  });
});
