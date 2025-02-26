function initGPU() {
  try {
    return new window.GPU.GPU();
  } catch (e) {
    return new GPU();
  }
}
const gpu = initGPU();

function drawSimple() {
  draw(0, 0, 2);
}

function draw(x_mean, y_mean, scale) {
  const canvas = document.getElementById("fractale");
  if (canvas.getContext) {
    canvas.width = 100;
    canvas.height = 100;
    nbMaxIter = parseInt(document.getElementById("max").value);
    drawPoint(x_mean, y_mean, scale, nbMaxIter);
  }
}

function drawPrecise(x_mean, y_mean, scale) {
  const canvas = document.getElementById("fractale");
  if (canvas.getContext) {
    canvas.width = parseInt(document.getElementById("width").value);
    canvas.height = parseInt(document.getElementById("height").value);
    nbMaxIter = parseInt(document.getElementById("max").value);
    drawPoint(x_mean, y_mean, scale, nbMaxIter);
  }
}

function drawPoint(x_mean, y_mean, scale, max) {
  let getCanvas = () => document.getElementById("fractale");
  const canvas = getCanvas();
  if (canvas.getContext) {
    const width = canvas.width;
    const height = canvas.height;

    // = -0.77568377;
    // = 0.13646737;
    // = 0.01;

    let h_min = 1,
      h_max = 0,
      b_min = 1,
      b_max = 0,
      iteration_min = max,
      iteration_max = 0;

    /*for (let col = 0; col < width; col += 15) {
      for (let row = 0; row < height; row += 15) {
        let iteration = matriceIterationOut[col][row];
        if (iteration < max) {
          iteration_min = Math.min(iteration, iteration_min);
          iteration_max = Math.max(iteration, iteration_max);
          let h = iteration / max;
          h_min = Math.min(h, h_min);
          h_max = Math.max(h, h_max);
          let b = iteration / (iteration + 8);
          b_min = Math.min(b, b_min);
          b_max = Math.max(b, b_max);
        }
        //console.log(iteration);
      }
    }*/

    h_min = 1 / 10;
    h_max = 1;
    b_min = 1 / 10;
    b_max = 9 / 10;

    const render = gpu
      .createKernel(function (scale, x_mean, y_mean, max, h_min, h_max, b_min, b_max) {
        let iteration = 0;
        const c_re = ((scale / 2.0) * (this.thread.x - this.output.x / 2.0) * 4.0) / this.output.x + x_mean;
        const c_im = ((scale / 2.0) * (this.output.y / 2.0 - this.thread.y) * 4.0) / this.output.x + y_mean;
        let z = [0, 0];
        do {
          z = [z[0] * z[0] - z[1] * z[1] + c_re, 2 * z[0] * z[1] + c_im];
          iteration = iteration + 1;
        } while (z[0] * z[0] + z[1] * z[1] <= 4 && iteration < max);

        let r = 0;
        let g = 0;
        let b = 0;
        if (iteration < max) {
          let h0 = iteration / max;
          let h = (h0 - (h_max + h_min) / 2) / (h_max - h_min) + 1 / 2;
          let s = 1;
          let b0 = iteration / (iteration + 8);
          //ici, on cherche à eviter d'avoir une brillance trop faible
          let v = ((b0 - (b_max + b_min) / 2) * 0.8) / (b_max - b_min) + 1.2 / 2;

          //HSR to RGB
          let i = Math.floor(h * 6);
          let f = h * 6 - i;
          let p = v * (1 - s);
          let q = v * (1 - f * s);
          let t = v * (1 - (1 - f) * s);
          let cas = i % 6;
          if (cas == 0) {
            (r = v), (g = t), (b = p);
          }
          if (cas == 1) {
            (r = q), (g = v), (b = p);
          }
          if (cas == 2) {
            (r = p), (g = v), (b = t);
          }
          if (cas == 3) {
            (r = p), (g = q), (b = v);
          }
          if (cas == 4) {
            (r = t), (g = p), (b = v);
          }
          if (cas == 5) {
            (r = v), (g = p), (b = q);
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

    console.log("matriceOut", render(scale, x_mean, y_mean, max, h_min, h_max, b_min, b_max));
    const canvasThatReplace = render.canvas;
    canvas.replaceWith(canvasThatReplace);

    const ctx = canvasThatReplace.getContext("2d");
    //ajoutLegende(ctx, width, height, x_mean, y_mean, scale, max);

    console.log("[h_min, h_max, b_min, b_max, iteration_min, iteration_max]", [h_min, h_max, b_min, b_max, iteration_min, iteration_max]);
  }
}

function generateIterationMatriceOf0(width, height) {
  let matrice = [];
  for (let row = 0; row < width; row++) {
    matrice.push([]);
    for (let col = 0; col < height; col++) {
      matrice[row].push(0);
    }
  }
  return matrice;
}
/*
function myKernel(scale, x_mean, y_mean, width, height, max) {
  const c_re =
    ((scale / 2.0) * (this.thread.y - width / 2.0) * 4.0) / width + x_mean;
  const c_im =
    ((scale / 2.0) * (height / 2.0 - this.thread.x) * 4.0) / width + y_mean;
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
*/

function itereZ(col, row, scale, x_mean, y_mean, width, height, max) {
  const c_re = ((scale / 2.0) * (col - width / 2.0) * 4.0) / width + x_mean;
  const c_im = ((scale / 2.0) * (height / 2.0 - row) * 4.0) / width + y_mean;
  let x = 0,
    y = 0;
  let iteration = 0;
  while (x * x + y * y <= 4 && iteration < max) {
    var x_new = x * x - y * y + c_re;
    y = 2 * x * y + c_im;
    x = x_new;
    iteration++;
  }
  return iteration;
}

function ajoutLegende(ctx, width, height, x_mean, y_mean, scale, max) {
  if (document.getElementById("ajouterLegende").checked) {
    ctx.font = Math.floor(width / 30) + "px Georgia";
    ctx.textAlign = "right";
    ctx.fillStyle = "white";
    ctx.fillText(`max_iterations : ${max}`, (width * 29) / 30, (height * 24) / 28);
    ctx.fillText(`scale : ${scale.toPrecision(3)}`, (width * 29) / 30, (height * 25) / 28);
    ctx.fillText(`x_mean : ${x_mean.toPrecision(3)}`, (width * 29) / 30, (height * 26) / 28);
    ctx.fillText(`y_mean : ${y_mean.toPrecision(3)}`, (width * 29) / 30, (height * 27) / 28);
  }
  const positionAffichee = document.getElementById("positionAffichee");
  positionAffichee.innerHTML = `<p>
		max_iterations: ${max}<br/>
        scale: ${scale.toPrecision(3)}<br/>
        x_mean: ${x_mean.toPrecision(3)}<br/>
        y_mean: ${y_mean.toPrecision(3)}<br/>
	<p>`;
}

function HSVtoRGB(h, s, v) {
  let r = 0;
  let g = 0;
  let b = 0;
  let i = Math.floor(h * 6);
  let f = h * 6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  let cas = i % 6;
  if (cas == 0) {
    (r = v), (g = t), (b = p);
  }
  if (cas == 1) {
    (r = q), (g = v), (b = p);
  }
  if (cas == 2) {
    (r = p), (g = v), (b = t);
  }
  if (cas == 3) {
    (r = p), (g = q), (b = v);
  }
  if (cas == 4) {
    (r = t), (g = p), (b = v);
  }
  if (cas == 5) {
    (r = v), (g = p), (b = q);
  }
  return [r, g, b];
}
