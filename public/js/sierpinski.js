nbSeq = 0;

function equilateralHeight(width) {
  return Math.floor(Math.sqrt(width * width - (width / 2) * (width / 2)));
}
function calculeNbIteration(width) {
  return Math.round(width * 3 ** Math.log(width));
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function draw() {
  const canvas = document.getElementById("fractale");
  if (canvas.getContext) {
    nbSeq++;
    canvas.width = parseInt(document.getElementById("width").value);
    canvas.height = equilateralHeight(canvas.width);
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    drawtorefactor();
  }
}

async function drawtorefactor() {
  const idDraw = nbSeq;
  const canvas = document.getElementById("fractale");
  if (canvas.getContext) {
    const ctx = canvas.getContext("2d");
    const width = parseInt(document.getElementById("width").value);
    const height = equilateralHeight(width);
    canvas.width = width;
    canvas.height = height;

    const id = ctx.createImageData(1, 1); // only do this once per page
    let d = id.data; // only do this once per page
    d[0] = 192; //r
    d[1] = 192; //g
    d[2] = 192; //b
    d[3] = 255; //a: transparency, 0..255

    let x = 0;
    let y = 0;

    let xa = width,
      ya = height,
      xb = 0,
      yb = height;
    let xc = width / 2;
    let yc = height - equilateralHeight(width);
    let aleatoire;

    nbIter = calculeNbIteration(width);

    for (i = 0; i < nbIter; i++) {
      ctx.moveTo(x, y);
      aleatoire = Math.floor(Math.random() * 3);
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
      if (
        document.getElementById("asynchrone").checked &&
        parseInt(document.getElementById("intervalleTemps").value) > 0
      ) {
        await sleep(parseInt(document.getElementById("intervalleTemps").value));
      }
      if (nbSeq != idDraw) return;
    }

    if (document.getElementById("legende").checked)
      ajoutLegende(ctx, width, height);
  }
}

function ajoutLegende(ctx, width, height) {
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
