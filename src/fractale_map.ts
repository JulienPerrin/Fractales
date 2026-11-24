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

  const stepX = Math.max(15, Math.ceil(width / 20));
  const stepY = Math.max(15, Math.ceil(height / 20));

  for (let col = 0; col < width; col += stepX) {
    for (let row = 0; row < height; row += stepY) {
      const iteration = iteratePixel(col, row);
      iterationMax = Math.max(iteration, iterationMax);
      if (iteration < max) {
        iterationMin = Math.min(iteration, iterationMin);
        const h = iteration / max;
        hMin = Math.min(h, hMin);
        hMax = Math.max(h, hMax);
        const b = h / (h + 0.8);
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
  } else {
    if (hMax - hMin < 1e-3) {
      const hMid = (hMin + hMax) / 2;
      hMin = hMid - 5e-4;
      hMax = hMid + 5e-4;
    }
    if (bMax - bMin < 1e-3) {
      const bMid = (bMin + bMax) / 2;
      bMin = bMid - 5e-4;
      bMax = bMid + 5e-4;
    }
  }

  return { hMin, hMax, bMin, bMax, iterationMin, iterationMax };
}

export const MAX_AUTO_ITERATIONS = 100000;

export function computeAutoMaxIterations(
  baseMax: number,
  scale: number,
  sampleIterationMax?: number
): number {
  const zoomDepth = Math.max(0, Math.log2(2 / Math.max(scale, 1e-300)));
  let target = Math.round(baseMax + 80 * zoomDepth);

  if (sampleIterationMax !== undefined) {
    if (sampleIterationMax < 0.35 * target) {
      target = Math.max(baseMax, Math.round(sampleIterationMax * 2));
    } else if (sampleIterationMax >= 0.9 * target) {
      target = Math.round(target * 1.25);
    }
  }

  return Math.min(MAX_AUTO_ITERATIONS, Math.max(1, target));
}

export function resolveColorAndMax(
  width: number,
  height: number,
  baseMax: number,
  scale: number,
  iteratePixel: (col: number, row: number, max: number) => number
): { max: number; colorRange: ColorRange } {
  const autoMax =
    (document.getElementById("autoMax") as HTMLInputElement | null)?.checked ??
    false;
  if (!autoMax) {
    return {
      max: baseMax,
      colorRange: sampleColorRange(width, height, baseMax, (col, row) =>
        iteratePixel(col, row, baseMax)
      ),
    };
  }

  const initialMax = computeAutoMaxIterations(baseMax, scale);
  const initialRange = sampleColorRange(width, height, initialMax, (col, row) =>
    iteratePixel(col, row, initialMax)
  );
  const effectiveMax = computeAutoMaxIterations(
    baseMax,
    scale,
    initialRange.iterationMax
  );
  if (effectiveMax === initialMax) {
    return { max: effectiveMax, colorRange: initialRange };
  }

  return {
    max: effectiveMax,
    colorRange: sampleColorRange(width, height, effectiveMax, (col, row) =>
      iteratePixel(col, row, effectiveMax)
    ),
  };
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
  const renderTick = signal(0);

  const syncMaxDisabled = (): void => {
    const maxInput = document.getElementById("max") as HTMLInputElement | null;
    const autoMax = document.getElementById(
      "autoMax"
    ) as HTMLInputElement | null;
    if (maxInput && autoMax) {
      maxInput.disabled = autoMax.checked;
    }
  };
  syncMaxDisabled();

  const viewport = initViewport(canvas, (x, y, s) => {
    batch(() => {
      xMean.value = x;
      yMean.value = y;
      scale.value = s;
      precise.value = false;
      renderTick.value++;
    });
  });

  const form = document.querySelector("form");
  form?.addEventListener("change", syncMaxDisabled);
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    syncMaxDisabled();
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
    void renderTick.value;

    if (isPrecise) {
      drawPreciseFn(x, y, s, viewport.xCenter, viewport.yCenter);
    } else {
      drawFn(x, y, s, viewport.xCenter, viewport.yCenter);
    }
  });
}
