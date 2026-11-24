import { batch, effect, signal } from "@preact/signals-core";
import type { ColorRange, DrawCallback } from "./types/fractale.js";
import { initViewport } from "./utils.js";

export type { ColorRange };

export function sampleColorRange(
  width: number,
  height: number,
  max: number,
  iteratePixel: (col: number, row: number) => number
): ColorRange {
  let iterationMin = max;
  let iterationMax = 0;
  let hMin = 1;
  let hMax = 0;
  let bMin = 1;
  let bMax = 0;

  for (let col = 0; col < width; col += 15) {
    for (let row = 0; row < height; row += 15) {
      const iteration = iteratePixel(col, row);
      if (iteration < max) {
        iterationMin = Math.min(iteration, iterationMin);
        iterationMax = Math.max(iteration, iterationMax);
        const h = iteration / max;
        hMin = Math.min(h, hMin);
        hMax = Math.max(h, hMax);
        const b = iteration / (iteration + 8);
        bMin = Math.min(b, bMin);
        bMax = Math.max(b, bMax);
      }
    }
  }

  if (hMin >= hMax || bMin >= bMax) {
    hMin = 1 / 10;
    hMax = 1;
    bMin = 1 / 10;
    bMax = 9 / 10;
  }

  return { hMin, hMax, bMin, bMax, iterationMin, iterationMax };
}

export function ajoutLegende(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  x_mean: number,
  y_mean: number,
  scale: number,
  max: number
): void {
  const checkbox = document.getElementById("ajouterLegende") as HTMLInputElement;
  if (checkbox.checked) {
    ctx.font = Math.floor(width / 30) + "px Georgia";
    ctx.textAlign = "right";
    ctx.fillStyle = "white";
    ctx.fillText(
      `max_iterations : ${max}`,
      (width * 29) / 30,
      (height * 24) / 28
    );
    ctx.fillText(
      `scale : ${scale.toPrecision(3)}`,
      (width * 29) / 30,
      (height * 25) / 28
    );
    ctx.fillText(
      `x_mean : ${x_mean.toPrecision(3)}`,
      (width * 29) / 30,
      (height * 26) / 28
    );
    ctx.fillText(
      `y_mean : ${y_mean.toPrecision(3)}`,
      (width * 29) / 30,
      (height * 27) / 28
    );
  }
  const positionAffichee = document.getElementById(
    "positionAffichee"
  ) as HTMLElement;
  positionAffichee.innerHTML = `<p>
		max_iterations: ${max}<br/>
        scale: ${scale.toPrecision(3)}<br/>
        x_mean: ${x_mean.toPrecision(3)}<br/>
        y_mean: ${y_mean.toPrecision(3)}<br/>
	</p>`;
}

export function initMovableFractal(
  drawFn: DrawCallback,
  drawPreciseFn: DrawCallback
): void {
  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  const xMean = signal(0);
  const yMean = signal(0);
  const scale = signal(2);
  const precise = signal(false);
  const submitTick = signal(0);

  initViewport(canvas, (x, y, s) => {
    batch(() => {
      xMean.value = x;
      yMean.value = y;
      scale.value = s;
      precise.value = false;
    });
  });

  document.querySelector("form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    batch(() => {
      precise.value = true;
      submitTick.value++;
    });
  });

  effect(() => {
    const x = xMean.value;
    const y = yMean.value;
    const s = scale.value;
    const isPrecise = precise.value;
    void submitTick.value;

    if (isPrecise) {
      drawPreciseFn(x, y, s);
    } else {
      drawFn(x, y, s);
    }
  });
}
