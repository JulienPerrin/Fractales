import { GPU } from "gpu.js";
import type { GPUInstance } from "./types/gpu.js";
import { itereZ } from "./mandelbrot.js";
import {
  ajoutLegende,
  initMovableFractal,
  sampleColorRange,
} from "./fractale_map.js";

export { ajoutLegende, itereZ };

export function initGPU(): GPUInstance {
  return new GPU();
}

export function draw(x_mean: number, y_mean: number, scale: number): void {
  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  if (canvas.getContext("2d")) {
    canvas.width = 100;
    canvas.height = 100;
    const nbMaxIter = parseInt(
      (document.getElementById("max") as HTMLInputElement).value,
      10
    );
    drawPoint(x_mean, y_mean, scale, nbMaxIter);
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

  const gpu = initGPU();
  const width = canvas.width;
  const height = canvas.height;

  const {
    hMin: h_min,
    hMax: h_max,
    bMin: b_min,
    bMax: b_max,
    iterationMin: iteration_min,
    iterationMax: iteration_max,
  } = sampleColorRange(width, height, max, (col, row) =>
    itereZ(col, row, scale, x_mean, y_mean, width, height, max)
  );

  const render = gpu
    .createKernel(function (
      scaleArg: number,
      xMeanArg: number,
      yMeanArg: number,
      maxArg: number,
      hMinArg: number,
      hMaxArg: number,
      bMinArg: number,
      bMaxArg: number
    ) {
      let iteration = 0;
      const c_re =
        ((scaleArg / 2.0) * (this.thread.x - this.output.x / 2.0) * 4.0) /
          this.output.x +
        xMeanArg;
      const c_im =
        ((scaleArg / 2.0) * (this.thread.y - this.output.y / 2.0) * 4.0) /
          this.output.x +
        yMeanArg;
      let z = [0, 0];
      do {
        z = [
          z[0]! * z[0]! - z[1]! * z[1]! + c_re,
          2 * z[0]! * z[1]! + c_im,
        ];
        iteration = iteration + 1;
      } while (z[0]! * z[0]! + z[1]! * z[1]! <= 4 && iteration < maxArg);

      let r = 0;
      let g = 0;
      let b = 0;
      if (iteration < maxArg) {
        const h0 = iteration / maxArg;
        const h = (h0 - (hMaxArg + hMinArg) / 2) / (hMaxArg - hMinArg) + 1 / 2;
        const s = 1;
        const b0 = iteration / (iteration + 8);
        const v =
          ((b0 - (bMaxArg + bMinArg) / 2) * 0.8) / (bMaxArg - bMinArg) +
          1.2 / 2;

        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        const cas = i % 6;
        if (cas == 0) {
          r = v;
          g = t;
          b = p;
        }
        if (cas == 1) {
          r = q;
          g = v;
          b = p;
        }
        if (cas == 2) {
          r = p;
          g = v;
          b = t;
        }
        if (cas == 3) {
          r = p;
          g = q;
          b = v;
        }
        if (cas == 4) {
          r = t;
          g = p;
          b = v;
        }
        if (cas == 5) {
          r = v;
          g = p;
          b = q;
        }
      } else {
        r = 0;
        g = 0;
        b = 0;
      }

      this.color(r, g, b, 255);
    })
    .setOutput([width, height])
    .setGraphical(true);

  console.log(
    "matriceOut",
    render(scale, x_mean, y_mean, max, h_min, h_max, b_min, b_max)
  );
  ctx.drawImage(render.canvas, 0, 0);
  ajoutLegende(ctx, width, height, x_mean, y_mean, scale, max);

  console.log("[h_min, h_max, b_min, b_max, iteration_min, iteration_max]", [
    h_min,
    h_max,
    b_min,
    b_max,
    iteration_min,
    iteration_max,
  ]);
}

export function initMandelbrotGpu(): void {
  initMovableFractal(draw, drawPrecise);
}

document.addEventListener("DOMContentLoaded", initMandelbrotGpu);
