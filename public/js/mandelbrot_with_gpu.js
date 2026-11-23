import { initViewport } from "./utils.js";
export function initGPU() {
    if (window.GPU?.GPU) {
        return new window.GPU.GPU();
    }
    const GlobalGPU = globalThis.GPU;
    return new GlobalGPU();
}
export function drawSimple() {
    draw(0, 0, 2);
}
export function draw(x_mean, y_mean, scale) {
    const canvas = document.getElementById("fractale");
    if (canvas.getContext("2d")) {
        canvas.width = 100;
        canvas.height = 100;
        const nbMaxIter = parseInt(document.getElementById("max").value, 10);
        drawPoint(x_mean, y_mean, scale, nbMaxIter);
    }
}
export function drawPrecise(x_mean, y_mean, scale) {
    const canvas = document.getElementById("fractale");
    if (canvas.getContext("2d")) {
        canvas.width = parseInt(document.getElementById("width").value, 10);
        canvas.height = parseInt(document.getElementById("height").value, 10);
        const nbMaxIter = parseInt(document.getElementById("max").value, 10);
        drawPoint(x_mean, y_mean, scale, nbMaxIter);
    }
}
export function drawPoint(x_mean, y_mean, scale, max) {
    const canvas = document.getElementById("fractale");
    if (!canvas.getContext("2d")) {
        return;
    }
    const gpu = initGPU();
    const width = canvas.width;
    const height = canvas.height;
    let iteration_min = max;
    let iteration_max = 0;
    let h_min = 1;
    let h_max = 0;
    let b_min = 1;
    let b_max = 0;
    for (let col = 0; col < width; col += 15) {
        for (let row = 0; row < height; row += 15) {
            const iteration = itereZ(col, row, scale, x_mean, y_mean, width, height, max);
            if (iteration < max) {
                iteration_min = Math.min(iteration, iteration_min);
                iteration_max = Math.max(iteration, iteration_max);
                const h = iteration / max;
                h_min = Math.min(h, h_min);
                h_max = Math.max(h, h_max);
                const b = iteration / (iteration + 8);
                b_min = Math.min(b, b_min);
                b_max = Math.max(b, b_max);
            }
        }
    }
    if (h_min >= h_max || b_min >= b_max) {
        h_min = 1 / 10;
        h_max = 1;
        b_min = 1 / 10;
        b_max = 9 / 10;
    }
    const render = gpu
        .createKernel(function (scaleArg, xMeanArg, yMeanArg, maxArg, hMinArg, hMaxArg, bMinArg, bMaxArg) {
        let iteration = 0;
        const c_re = ((scaleArg / 2.0) * (this.thread.x - this.output.x / 2.0) * 4.0) /
            this.output.x +
            xMeanArg;
        const c_im = ((scaleArg / 2.0) * (this.output.y / 2.0 - this.thread.y) * 4.0) /
            this.output.x +
            yMeanArg;
        let z = [0, 0];
        do {
            z = [
                z[0] * z[0] - z[1] * z[1] + c_re,
                2 * z[0] * z[1] + c_im,
            ];
            iteration = iteration + 1;
        } while (z[0] * z[0] + z[1] * z[1] <= 4 && iteration < maxArg);
        let r = 0;
        let g = 0;
        let b = 0;
        if (iteration < maxArg) {
            const h0 = iteration / maxArg;
            const h = (h0 - (hMaxArg + hMinArg) / 2) / (hMaxArg - hMinArg) + 1 / 2;
            const s = 1;
            const b0 = iteration / (iteration + 8);
            const v = ((b0 - (bMaxArg + bMinArg) / 2) * 0.8) / (bMaxArg - bMinArg) +
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
        }
        else {
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
    console.log("[h_min, h_max, b_min, b_max, iteration_min, iteration_max]", [
        h_min,
        h_max,
        b_min,
        b_max,
        iteration_min,
        iteration_max,
    ]);
}
export function generateIterationMatriceOf0(width, height) {
    const matrice = [];
    for (let row = 0; row < width; row++) {
        const rowArr = [];
        for (let col = 0; col < height; col++) {
            rowArr.push(0);
        }
        matrice.push(rowArr);
    }
    return matrice;
}
export function itereZ(col, row, scale, x_mean, y_mean, width, height, max) {
    const c_re = ((scale / 2.0) * (col - width / 2.0) * 4.0) / width + x_mean;
    const c_im = ((scale / 2.0) * (height / 2.0 - row) * 4.0) / width + y_mean;
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
export function ajoutLegende(ctx, width, height, x_mean, y_mean, scale, max) {
    const checkbox = document.getElementById("ajouterLegende");
    if (checkbox.checked) {
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
export function HSVtoRGB(h, s, v) {
    let r = 0;
    let g = 0;
    let b = 0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const cas = ((i % 6) + 6) % 6;
    if (cas === 0) {
        r = v;
        g = t;
        b = p;
    }
    if (cas === 1) {
        r = q;
        g = v;
        b = p;
    }
    if (cas === 2) {
        r = p;
        g = v;
        b = t;
    }
    if (cas === 3) {
        r = p;
        g = q;
        b = v;
    }
    if (cas === 4) {
        r = t;
        g = p;
        b = v;
    }
    if (cas === 5) {
        r = v;
        g = p;
        b = q;
    }
    return [r, g, b];
}
export function initMandelbrotGpu() {
    const canvas = document.getElementById("fractale");
    const state = initViewport(canvas, draw);
    document
        .getElementById("btnPrecise")
        ?.addEventListener("click", () => {
        drawPrecise(state.xMean, state.yMean, state.scale);
    });
    document
        .getElementById("ajouterLegende")
        ?.addEventListener("click", () => {
        draw(state.xMean, state.yMean, state.scale);
    });
}
document.addEventListener("DOMContentLoaded", initMandelbrotGpu);
