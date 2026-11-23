let nbSeq = 0;
let nbIter = 0;

export function equilateralHeight(width: number): number {
  return Math.floor(Math.sqrt(width * width - (width / 2) * (width / 2)));
}

export function calculeNbIteration(width: number): number {
  return Math.round(width * 3 ** Math.log(width));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function draw(): Promise<void> {
  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    nbSeq++;
    canvas.width = parseInt(
      (document.getElementById("width") as HTMLInputElement).value,
      10
    );
    canvas.height = equilateralHeight(canvas.width);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await drawtorefactor();
  }
}

export async function drawtorefactor(): Promise<void> {
  const idDraw = nbSeq;
  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const width = parseInt(
    (document.getElementById("width") as HTMLInputElement).value,
    10
  );
  const height = equilateralHeight(width);
  canvas.width = width;
  canvas.height = height;

  const id = ctx.createImageData(1, 1);
  const d = id.data;
  d[0] = 192;
  d[1] = 192;
  d[2] = 192;
  d[3] = 255;

  let x = 0;
  let y = 0;

  const xa = width;
  const ya = height;
  const xb = 0;
  const yb = height;
  const xc = width / 2;
  const yc = height - equilateralHeight(width);

  nbIter = calculeNbIteration(width);

  const asynchroneInput = document.getElementById(
    "asynchrone"
  ) as HTMLInputElement;
  const intervalleInput = document.getElementById(
    "intervalleTemps"
  ) as HTMLInputElement;

  for (let i = 0; i < nbIter; i++) {
    ctx.moveTo(x, y);
    const aleatoire = Math.floor(Math.random() * 3);
    switch (aleatoire) {
      case 0:
        x = 0.5 * (x + xa);
        y = 0.5 * (y + ya);
        break;
      case 1:
        x = 0.5 * (x + xb);
        y = 0.5 * (y + yb);
        break;
      case 2:
        x = 0.5 * (x + xc);
        y = 0.5 * (y + yc);
        break;
    }
    ctx.putImageData(id, x, y);
    const intervalle = parseInt(intervalleInput.value, 10);
    if (asynchroneInput.checked && intervalle > 0) {
      await sleep(intervalle);
    }
    if (nbSeq !== idDraw) {
      return;
    }
  }

  if ((document.getElementById("legende") as HTMLInputElement).checked) {
    ajoutLegende(ctx, width, height);
  }
}

export function ajoutLegende(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.font = Math.floor(width / 30) + "px Georgia";
  ctx.textAlign = "right";
  ctx.fillStyle = "black";
  ctx.fillText(
    "nombre d'itérations : " + nbIter,
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

export function initSierpinski(): void {
  void draw();

  document.getElementById("asynchrone")?.addEventListener("click", () => {
    void draw();
  });
  document.getElementById("legende")?.addEventListener("click", () => {
    void draw();
  });
  document.getElementById("btnPrecise")?.addEventListener("click", () => {
    void draw();
  });
}

document.addEventListener("DOMContentLoaded", initSierpinski);
