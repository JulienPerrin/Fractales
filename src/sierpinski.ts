import {
  batch,
  computed,
  effect,
  signal,
  type ReadonlySignal,
  type Signal,
} from "@preact/signals-core";

export interface SierpinskiState {
  readonly width: Signal<number>;
  readonly height: ReadonlySignal<number>;
  readonly iterations: ReadonlySignal<number>;
  readonly isAsync: Signal<boolean>;
  readonly intervalMs: Signal<number>;
  readonly showLegend: Signal<boolean>;
  readonly drawTrigger: Signal<number>;
}

export interface RenderOptions {
  readonly width: number;
  readonly height: number;
  readonly iterations: number;
  readonly isAsync: boolean;
  readonly showLegend: boolean;
  readonly getIntervalMs: () => number;
  readonly isCancelled: () => boolean;
}

export function equilateralHeight(width: number): number {
  return Math.floor(Math.sqrt(width * width - (width / 2) * (width / 2)));
}

export function calculeNbIteration(width: number): number {
  return Math.round(width * 3 ** Math.log(width));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createSierpinskiState(): SierpinskiState {
  const width = signal(600);
  const height = computed(() => equilateralHeight(width.value));
  const iterations = computed(() => calculeNbIteration(width.value));
  const isAsync = signal(true);
  const intervalMs = signal(1);
  const showLegend = signal(true);
  const drawTrigger = signal(0);

  return {
    width,
    height,
    iterations,
    isAsync,
    intervalMs,
    showLegend,
    drawTrigger,
  };
}

export async function renderSierpinski(
  canvas: HTMLCanvasElement,
  options: RenderOptions
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const { width, height, iterations, isAsync, showLegend } = options;
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);

  const pixel = ctx.createImageData(1, 1);
  pixel.data[0] = 192;
  pixel.data[1] = 192;
  pixel.data[2] = 192;
  pixel.data[3] = 255;

  const vertices: readonly (readonly [number, number])[] = [
    [width, height],
    [0, height],
    [width / 2, 0],
  ];

  let x = 0;
  let y = 0;

  for (let i = 0; i < iterations; i++) {
    ctx.moveTo(x, y);
    const vertex = vertices[Math.floor(Math.random() * 3)]!;
    x = 0.5 * (x + vertex[0]);
    y = 0.5 * (y + vertex[1]);
    ctx.putImageData(pixel, x, y);

    const interval = options.getIntervalMs();
    if (isAsync && interval > 0) {
      await sleep(interval);
    }
    if (options.isCancelled()) {
      return;
    }
  }

  if (showLegend) {
    ajoutLegende(ctx, width, height, iterations);
  }
}

export function ajoutLegende(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  iterations: number
): void {
  ctx.font = Math.floor(width / 30) + "px Georgia";
  ctx.textAlign = "right";
  ctx.fillStyle = "black";
  ctx.fillText(
    "nombre d'itérations : " + iterations,
    (width * 29) / 30,
    (height * 25) / 28
  );
  ctx.fillText(
    "largeur du canvas (px) : " + width,
    (width * 29) / 30,
    (height * 26) / 28
  );
  ctx.fillText(
    "nombre de px : " + width * height,
    (width * 29) / 30,
    (height * 27) / 28
  );
}

export function initSierpinski(): {
  state: SierpinskiState;
  dispose: () => void;
} {
  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  const asynchroneInput = document.getElementById(
    "asynchrone"
  ) as HTMLInputElement;
  const intervalleInput = document.getElementById(
    "intervalleTemps"
  ) as HTMLInputElement;
  const widthInput = document.getElementById("width") as HTMLInputElement;
  const legendeInput = document.getElementById("legende") as HTMLInputElement;

  const state = createSierpinskiState();

  const syncFromForm = (): void => {
    batch(() => {
      state.width.value = parseInt(widthInput.value, 10);
      state.isAsync.value = asynchroneInput.checked;
      state.intervalMs.value = parseInt(intervalleInput.value, 10);
      state.showLegend.value = legendeInput.checked;
      state.drawTrigger.value++;
    });
  };

  syncFromForm();

  document.querySelector("form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    syncFromForm();
  });

  const dispose = effect(() => {
    const width = state.width.value;
    const height = state.height.value;
    const iterations = state.iterations.value;
    const isAsync = state.isAsync.value;
    const showLegend = state.showLegend.value;
    void state.drawTrigger.value;

    let cancelled = false;
    void renderSierpinski(canvas, {
      width,
      height,
      iterations,
      isAsync,
      showLegend,
      getIntervalMs: () => state.intervalMs.peek(),
      isCancelled: () => cancelled,
    });

    return () => {
      cancelled = true;
    };
  });

  return { state, dispose };
}

document.addEventListener("DOMContentLoaded", initSierpinski);
