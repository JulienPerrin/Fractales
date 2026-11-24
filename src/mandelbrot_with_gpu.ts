import { GPU } from "gpu.js";
import type { BigFixed, ReferenceOrbit } from "./types/fractale.js";
import type { GPUInstance, GPUKernel } from "./types/gpu.js";
import { itereZ } from "./mandelbrot.js";
import {
  ajoutLegende,
  initMovableFractal,
  resolveColorAndMax,
} from "./fractale_map.js";
import {
  bigFixedFromNumber,
  computeReferenceOrbit,
  decomposeScale,
  perturbItereZ,
  precisionBitsForScale,
} from "./utils.js";

export { ajoutLegende, itereZ };

const DEEP_ZOOM_THRESHOLD = 1e-5;
const EMPTY_REF = new Float32Array([0, 0]);

type MandelbrotKernelArgs = [
  scaleArg: number,
  xMeanArg: number,
  yMeanArg: number,
  maxArg: number,
  hMinArg: number,
  hMaxArg: number,
  bMinArg: number,
  bMaxArg: number,
  usePerturb: number,
  refRe: Float32Array,
  refIm: Float32Array,
  refExp: Float32Array,
  refEscapeIter: number,
  scaleMantissa: number,
  scaleExp: number,
];

let cachedGpu: GPUInstance | null = null;
let cachedKernel: GPUKernel<MandelbrotKernelArgs> | null = null;

export function resetGPUCache(): void {
  cachedGpu = null;
  cachedKernel = null;
}

export function initGPU(): GPUInstance {
  if (!cachedGpu) {
    cachedGpu = new GPU();
  }
  return cachedGpu;
}

function getOrCreateKernel(
  width: number,
  height: number
): GPUKernel<MandelbrotKernelArgs> {
  if (!cachedKernel) {
    const gpu = initGPU();
    cachedKernel = gpu
      .createKernel(function (
        scaleArg: number,
        xMeanArg: number,
        yMeanArg: number,
        maxArg: number,
        hMinArg: number,
        hMaxArg: number,
        bMinArg: number,
        bMaxArg: number,
        usePerturb: number,
        refRe: Float32Array,
        refIm: Float32Array,
        refExp: Float32Array,
        refEscapeIter: number,
        scaleMantissa: number,
        scaleExp: number
      ) {
        const dcRe =
          ((scaleMantissa / 2.0) *
            (this.thread.x - this.output.x / 2.0) *
            4.0) /
          this.output.x;
        const dcIm =
          ((scaleMantissa / 2.0) *
            (this.thread.y - this.output.y / 2.0) *
            4.0) /
          this.output.x;

        let iteration = 0;
        if (usePerturb == 1) {
          let t3Exp = scaleExp;
          if (dcRe == 0.0 && dcIm == 0.0) {
            t3Exp = -10000.0;
          }
          let dRe = 0.0;
          let dIm = 0.0;
          let dExp = -10000.0;
          let m = 0;

          while (iteration < maxArg) {
            const rRe = refRe[m]!;
            const rIm = refIm[m]!;
            const rExp = refExp[m]!;

            let zRe = rRe;
            let zIm = rIm;
            let zExp = rExp;
            if (rRe == 0.0 && rIm == 0.0) {
              zRe = dRe;
              zIm = dIm;
              zExp = dExp;
            } else if (dRe != 0.0 || dIm != 0.0) {
              zExp = Math.max(rExp, dExp);
              let rScale = 0.0;
              if (rExp - zExp >= -30.0) {
                rScale = Math.pow(2.0, rExp - zExp);
              }
              let dScale = 0.0;
              if (dExp - zExp >= -30.0) {
                dScale = Math.pow(2.0, dExp - zExp);
              }
              zRe = rRe * rScale + dRe * dScale;
              zIm = rIm * rScale + dIm * dScale;
            }

            const zMagSq = zRe * zRe + zIm * zIm;
            if (zMagSq > 0.0 && zExp >= -10.0) {
              if (zExp > 4.0 || zMagSq * Math.pow(2.0, 2.0 * zExp) > 4.0) {
                break;
              }
            }

            const dMagSq = dRe * dRe + dIm * dIm;
            let shouldRebase = 0;
            if (m >= refEscapeIter) {
              shouldRebase = 1;
            } else if (dMagSq > 0.0) {
              const diffZ = zExp - dExp;
              if (
                diffZ <= 15.0 &&
                zMagSq * Math.pow(2.0, 2.0 * diffZ) < dMagSq
              ) {
                shouldRebase = 1;
              }
            }
            if (shouldRebase == 1) {
              dRe = zRe;
              dIm = zIm;
              dExp = zExp;
              m = 0;
            }

            const cRRe = refRe[m]!;
            const cRIm = refIm[m]!;
            const cRExp = refExp[m]!;
            const t1Re = 2.0 * (cRRe * dRe - cRIm * dIm);
            const t1Im = 2.0 * (cRRe * dIm + cRIm * dRe);
            let t1Exp = cRExp + dExp;
            if ((cRRe == 0.0 && cRIm == 0.0) || (dRe == 0.0 && dIm == 0.0)) {
              t1Exp = -10000.0;
            }

            const t2Re = dRe * dRe - dIm * dIm;
            const t2Im = 2.0 * dRe * dIm;
            let t2Exp = 2.0 * dExp;
            if (dRe == 0.0 && dIm == 0.0) {
              t2Exp = -10000.0;
            }

            const topExp = Math.max(t1Exp, Math.max(t2Exp, t3Exp));
            let s1 = 0.0;
            if (t1Exp - topExp >= -30.0) {
              s1 = Math.pow(2.0, t1Exp - topExp);
            }
            let s2 = 0.0;
            if (t2Exp - topExp >= -30.0) {
              s2 = Math.pow(2.0, t2Exp - topExp);
            }
            let s3 = 0.0;
            if (t3Exp - topExp >= -30.0) {
              s3 = Math.pow(2.0, t3Exp - topExp);
            }

            dRe = t1Re * s1 + t2Re * s2 + dcRe * s3;
            dIm = t1Im * s1 + t2Im * s2 + dcIm * s3;
            dExp = topExp;

            const normSq = dRe * dRe + dIm * dIm;
            if (normSq == 0.0) {
              dExp = -10000.0;
            } else {
              const shiftExp = Math.floor(Math.log(normSq) * 0.72134752);
              if (shiftExp != 0.0) {
                const inv = Math.pow(2.0, -shiftExp);
                dRe = dRe * inv;
                dIm = dIm * inv;
                dExp = dExp + shiftExp;
              }
            }

            m = m + 1;
            iteration = iteration + 1;
          }
        } else {
          const c_re =
            ((scaleArg / 2.0) * (this.thread.x - this.output.x / 2.0) * 4.0) /
              this.output.x +
            xMeanArg;
          const c_im =
            ((scaleArg / 2.0) * (this.thread.y - this.output.y / 2.0) * 4.0) /
              this.output.x +
            yMeanArg;
          const q = (c_re - 0.25) * (c_re - 0.25) + c_im * c_im;
          if (
            q * (q + (c_re - 0.25)) <= 0.25 * c_im * c_im ||
            (c_re + 1.0) * (c_re + 1.0) + c_im * c_im <= 0.0625
          ) {
            iteration = maxArg;
          } else {
            let zx = 0.0;
            let zy = 0.0;
            while (zx * zx + zy * zy <= 4.0 && iteration < maxArg) {
              const zxNext = zx * zx - zy * zy + c_re;
              zy = 2.0 * zx * zy + c_im;
              zx = zxNext;
              iteration = iteration + 1;
            }
          }
        }

        let r = 0.0;
        let g = 0.0;
        let b = 0.0;
        if (iteration < maxArg) {
          const h0 = iteration / maxArg;
          const h =
            (h0 - (hMaxArg + hMinArg) / 2.0) / (hMaxArg - hMinArg) + 0.5;
          const b0 = h0 / (h0 + 0.8);
          const rawV =
            ((b0 - (bMaxArg + bMinArg) / 2.0) * 0.8) / (bMaxArg - bMinArg) +
            0.6;
          const v = Math.max(0.2, Math.min(1.0, rawV));

          const i = Math.floor(h * 6.0);
          const f = h * 6.0 - i;
          const p = 0.0;
          const qCol = v * (1.0 - f);
          const tCol = v * f;
          const cas = i - Math.floor(i / 6.0) * 6.0;
          if (cas == 0) {
            r = v;
            g = tCol;
            b = p;
          }
          if (cas == 1) {
            r = qCol;
            g = v;
            b = p;
          }
          if (cas == 2) {
            r = p;
            g = v;
            b = tCol;
          }
          if (cas == 3) {
            r = p;
            g = qCol;
            b = v;
          }
          if (cas == 4) {
            r = tCol;
            g = p;
            b = v;
          }
          if (cas == 5) {
            r = v;
            g = p;
            b = qCol;
          }
        }

        this.color(r, g, b, 1);
      })
      .setTactic("precision")
      .setDynamicOutput(true)
      .setDynamicArguments(true)
      .setLoopMaxIterations(100000)
      .setGraphical(true);
  }

  return cachedKernel.setOutput([width, height]);
}

export function draw(
  x_mean: number,
  y_mean: number,
  scale: number,
  xCenter?: BigFixed,
  yCenter?: BigFixed
): void {
  drawPrecise(x_mean, y_mean, scale, xCenter, yCenter);
}

export function drawPrecise(
  x_mean: number,
  y_mean: number,
  scale: number,
  xCenter?: BigFixed,
  yCenter?: BigFixed
): void {
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
    drawPoint(x_mean, y_mean, scale, nbMaxIter, xCenter, yCenter);
  }
}

export function drawPoint(
  x_mean: number,
  y_mean: number,
  scale: number,
  max: number,
  xCenter?: BigFixed,
  yCenter?: BigFixed
): void {
  const canvas = document.getElementById("fractale") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const bits = precisionBitsForScale(scale);
  const cx = xCenter ?? bigFixedFromNumber(x_mean, bits);
  const cy = yCenter ?? bigFixedFromNumber(y_mean, bits);
  const { mantissa: scaleMantissa, exp: scaleExp } = decomposeScale(scale);
  const useDeepZoom = scale < DEEP_ZOOM_THRESHOLD;

  let activeOrbit: ReferenceOrbit | null = null;
  let activeOrbitMax = -1;
  const getOrbit = (iterMax: number): ReferenceOrbit => {
    if (!activeOrbit || activeOrbitMax !== iterMax) {
      activeOrbit = computeReferenceOrbit(cx, cy, iterMax);
      activeOrbitMax = iterMax;
    }
    return activeOrbit;
  };

  const { max: effectiveMax, colorRange } = resolveColorAndMax(
    width,
    height,
    max,
    scale,
    (col, row, iterMax) => {
      if (!useDeepZoom) {
        return itereZ(col, row, scale, x_mean, y_mean, width, height, iterMax);
      }
      const dcRe = ((scaleMantissa / 2) * (col - width / 2) * 4) / width;
      const dcIm = ((scaleMantissa / 2) * (height / 2 - row) * 4) / width;
      return perturbItereZ(dcRe, dcIm, scaleExp, getOrbit(iterMax), iterMax);
    }
  );

  const { hMin: h_min, hMax: h_max, bMin: b_min, bMax: b_max } = colorRange;
  const render = getOrCreateKernel(width, height);

  if (useDeepZoom) {
    const orbit = getOrbit(effectiveMax);
    render(
      scale,
      x_mean,
      y_mean,
      effectiveMax,
      h_min,
      h_max,
      b_min,
      b_max,
      1,
      orbit.refRe,
      orbit.refIm,
      orbit.refExp,
      orbit.refEscapeIter,
      scaleMantissa,
      scaleExp
    );
  } else {
    render(
      scale,
      x_mean,
      y_mean,
      effectiveMax,
      h_min,
      h_max,
      b_min,
      b_max,
      0,
      EMPTY_REF,
      EMPTY_REF,
      EMPTY_REF,
      1,
      scaleMantissa,
      scaleExp
    );
  }

  ctx.drawImage(render.canvas, 0, 0);
  ajoutLegende(ctx, width, height, x_mean, y_mean, scale, effectiveMax);
}

export function initMandelbrotGpu(): void {
  initMovableFractal(draw, drawPrecise);
}

document.addEventListener("DOMContentLoaded", initMandelbrotGpu);
