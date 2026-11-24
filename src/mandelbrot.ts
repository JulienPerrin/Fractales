import type { HsvColor, RgbColor } from "./types/fractale.js";
import { ajoutLegende, initMovableFractal, resolveColorAndMax } from "./fractale_map.js";

export { ajoutLegende };

export function draw(x_mean: number, y_mean: number, scale: number): void {
  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  if (canvas.getContext("2d")) {
    canvas.width = 100;
    canvas.height = 100;
    drawPoint(x_mean, y_mean, scale, 1000);
  }
}

export function drawPrecise(x_mean: number, y_mean: number, scale: number): void {
  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  if (canvas.getContext("2d")) {
    canvas.width = parseInt(
      (document.getElementById("width") as HTMLInputElement).value,
      10
    );
    canvas.height = parseInt(
      (document.getElementById("height") as HTMLInputElement).value,
      10
    );
    const nbMaxIter = parseInt(
      (document.getElementById("max") as HTMLInputElement).value,
      10
    );
    drawPoint(x_mean, y_mean, scale, nbMaxIter);
  }
}

export function drawPoint(
  x_mean: number,
  y_mean: number,
  scale: number,
  max: number
): void {
  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;

  const id = ctx.createImageData(1, 1);
  const d = id.data;
  d[0] = 0;
  d[1] = 0;
  d[2] = 0;
  d[3] = 255;

  const { max: effectiveMax, colorRange } = resolveColorAndMax(
    width,
    height,
    max,
    scale,
    (col, row, iterMax) =>
      itereZ(col, row, scale, x_mean, y_mean, width, height, iterMax)
  );
  const {
    hMin: h_min,
    hMax: h_max,
    bMin: b_min,
    bMax: b_max,
    iterationMin: iteration_min,
    iterationMax: iteration_max,
  } = colorRange;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const iteration = itereZ(
        col,
        row,
        scale,
        x_mean,
        y_mean,
        width,
        height,
        effectiveMax
      );
      if (iteration < effectiveMax) {
        const h0 = iteration / effectiveMax;
        const h = (h0 - (h_max + h_min) / 2) / (h_max - h_min) + 1 / 2;
        const s = 1;
        const b0 = h0 / (h0 + 0.8);
        const rawB = ((b0 - (b_max + b_min) / 2) * 0.8) / (b_max - b_min) + 1.2 / 2;
        const b = Math.max(0.2, Math.min(1, rawB));
        const hsbToRgb = HSVtoRGB(h, s, b);
        d[0] = hsbToRgb.r;
        d[1] = hsbToRgb.g;
        d[2] = hsbToRgb.b;
      } else {
        d[0] = 0;
        d[1] = 0;
        d[2] = 0;
      }

      ctx.putImageData(id, col, row);
    }
  }

  ajoutLegende(ctx, width, height, x_mean, y_mean, scale, effectiveMax);

  console.log("[h_min, h_max, b_min, b_max, iteration_min, iteration_max]", [
    h_min,
    h_max,
    b_min,
    b_max,
    iteration_min,
    iteration_max,
  ]);
}

export function itereZ(
  col: number,
  row: number,
  scale: number,
  x_mean: number,
  y_mean: number,
  width: number,
  height: number,
  max: number,
): number {
  const c_re = ((scale / 2.0) * (col - width / 2.0) * 4.0) / width + x_mean;
  const c_im = ((scale / 2.0) * (height / 2.0 - row) * 4.0) / width + y_mean;
  const q = (c_re - 0.25) * (c_re - 0.25) + c_im * c_im;
  if (
    q * (q + (c_re - 0.25)) <= 0.25 * c_im * c_im ||
    (c_re + 1) * (c_re + 1) + c_im * c_im <= 0.0625
  ) {
    return max;
  }
  let x = 0;
  let y = 0;
  let iteration = 0;
  while (x * x + y * y <= 4 && iteration < max) {
    const x_new = x * x - y * y + c_re;
    y = 2 * x * y + c_im;
    x = x_new;
    iteration++;
  }
  return iteration;
}

export function HSVtoRGB(hOrObj: number | HsvColor, s = 0, v = 0): RgbColor {
  let h: number;
  if (typeof hOrObj === "object") {
    h = hOrObj.h;
    s = hOrObj.s;
    v = hOrObj.v;
  } else {
    h = hOrObj;
  }

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r: number;
  let g: number;
  let b: number;

  switch (((i % 6) + 6) % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    default:
      r = v;
      g = p;
      b = q;
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function initMandelbrot(): void {
  initMovableFractal(draw, drawPrecise);
}

document.addEventListener("DOMContentLoaded", initMandelbrot);
