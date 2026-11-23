import { initViewport } from "./utils.js";
export function drawSimple() {
    draw(0, 0, 2);
}
export function draw(x_mean, y_mean, scale) {
    const canvas = document.getElementById("fractale");
    if (canvas.getContext("2d")) {
        canvas.width = 100;
        canvas.height = 100;
        drawPoint(x_mean, y_mean, scale, 1000);
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
    let h_min = 1;
    let h_max = 0;
    let b_min = 1;
    let b_max = 0;
    let iteration_min = max;
    let iteration_max = 0;
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
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const iteration = itereZ(col, row, scale, x_mean, y_mean, width, height, max);
            if (iteration < max) {
                const h0 = iteration / max;
                const h = (h0 - (h_max + h_min) / 2) / (h_max - h_min) + 1 / 2;
                const s = 1;
                const b0 = iteration / (iteration + 8);
                const b = ((b0 - (b_max + b_min) / 2) * 0.8) / (b_max - b_min) + 1.2 / 2;
                const hsbToRgb = HSVtoRGB(h, s, b);
                d[0] = hsbToRgb.r;
                d[1] = hsbToRgb.g;
                d[2] = hsbToRgb.b;
            }
            else {
                d[0] = 0;
                d[1] = 0;
                d[2] = 0;
            }
            ctx.putImageData(id, col, row);
        }
    }
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
export function HSVtoRGB(hOrObj, s = 0, v = 0) {
    let h;
    if (typeof hOrObj === "object") {
        h = hOrObj.h;
        s = hOrObj.s;
        v = hOrObj.v;
    }
    else {
        h = hOrObj;
    }
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r;
    let g;
    let b;
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
export function initMandelbrot() {
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
document.addEventListener("DOMContentLoaded", initMandelbrot);
