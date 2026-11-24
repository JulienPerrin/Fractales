import type {
  BigFixed,
  DrawCallback,
  Point,
  ReferenceOrbit,
  ViewportState,
} from "./types/fractale.js";

export type { BigFixed, DrawCallback, Point, ReferenceOrbit, ViewportState };

export function precisionBitsForScale(scale: number): number {
  return Math.max(128, Math.ceil(-Math.log2(Math.max(scale, 1e-300))) + 64);
}

export function decomposeScale(scale: number): {
  mantissa: number;
  exp: number;
} {
  const clamped = Math.max(scale, 1e-300);
  const exp = Math.floor(Math.log2(clamped));
  const mantissa = clamped * Math.pow(2, -exp);
  return { mantissa, exp };
}

export function bigFixedFromNumber(value: number, fracBits: number): BigFixed {
  if (value === 0) {
    return { raw: 0n, fracBits };
  }
  const exp = Math.floor(Math.log2(Math.abs(value))) - 52;
  const mantissa = BigInt(Math.round(value * Math.pow(2, -exp)));
  const shift = fracBits + exp;
  const raw =
    shift >= 0 ? mantissa << BigInt(shift) : mantissa >> BigInt(-shift);
  return { raw, fracBits };
}

export function bigFixedAdd(a: BigFixed, b: BigFixed): BigFixed {
  const fracBits = Math.max(a.fracBits, b.fracBits);
  const aScaled = a.raw << BigInt(fracBits - a.fracBits);
  const bScaled = b.raw << BigInt(fracBits - b.fracBits);
  return { raw: aScaled + bScaled, fracBits };
}

function fixedRawToNumber(raw: bigint, fracBits: number): number {
  if (fracBits > 53) {
    return Number(raw >> BigInt(fracBits - 53)) / 9007199254740992;
  }
  return Number(raw) / Math.pow(2, fracBits);
}

export function bigFixedToNumber(a: BigFixed): number {
  return fixedRawToNumber(a.raw, a.fracBits);
}

function fixedPairToFloatExp(
  zRe: bigint,
  zIm: bigint,
  fracBits: number
): { re: number; im: number; exp: number } {
  const absRe = zRe < 0n ? -zRe : zRe;
  const absIm = zIm < 0n ? -zIm : zIm;
  const absMax = absRe > absIm ? absRe : absIm;
  if (absMax === 0n) {
    return { re: 0, im: 0, exp: 0 };
  }
  const bitLen = absMax.toString(2).length;
  const exp = bitLen - 1 - fracBits;
  const shift = bitLen - 53;
  const scaleInv = 1 / 4503599627370496; // 2^-52
  if (shift > 0) {
    const s = BigInt(shift);
    return {
      re: Number(zRe >> s) * scaleInv,
      im: Number(zIm >> s) * scaleInv,
      exp,
    };
  }
  const s = BigInt(-shift);
  return {
    re: Number(zRe << s) * scaleInv,
    im: Number(zIm << s) * scaleInv,
    exp,
  };
}

export function computeReferenceOrbit(
  xCenter: BigFixed,
  yCenter: BigFixed,
  maxIter: number
): ReferenceOrbit {
  const fracBits = Math.max(xCenter.fracBits, yCenter.fracBits);
  const shift = BigInt(fracBits);
  const cRe = xCenter.raw << BigInt(fracBits - xCenter.fracBits);
  const cIm = yCenter.raw << BigInt(fracBits - yCenter.fracBits);
  const escapeLimit = 16n << BigInt(2 * fracBits);

  const refRe = new Float32Array(maxIter + 1);
  const refIm = new Float32Array(maxIter + 1);
  const refExp = new Float32Array(maxIter + 1);
  let zRe = 0n;
  let zIm = 0n;
  let refEscapeIter = maxIter;

  for (let n = 0; n <= maxIter; n++) {
    const fe = fixedPairToFloatExp(zRe, zIm, fracBits);
    refRe[n] = fe.re;
    refIm[n] = fe.im;
    refExp[n] = fe.exp;
    if (zRe * zRe + zIm * zIm > escapeLimit) {
      refEscapeIter = n;
      break;
    }
    const nextRe = ((zRe * zRe - zIm * zIm) >> shift) + cRe;
    zIm = ((2n * zRe * zIm) >> shift) + cIm;
    zRe = nextRe;
  }

  return { refRe, refIm, refExp, refEscapeIter };
}

export function perturbItereZ(
  dcRe: number,
  dcIm: number,
  dcExp: number,
  orbit: ReferenceOrbit,
  maxIter: number
): number {
  const dcZero = dcRe === 0 && dcIm === 0;
  const t3Exp = dcZero ? -10000 : dcExp;
  let dRe = 0;
  let dIm = 0;
  let dExp = -10000;
  let m = 0;
  let iteration = 0;

  while (iteration < maxIter) {
    const rRe = orbit.refRe[m]!;
    const rIm = orbit.refIm[m]!;
    const rExp = orbit.refExp[m]!;
    const rZero = rRe === 0 && rIm === 0;
    const dZero = dRe === 0 && dIm === 0;

    let zRe = rRe;
    let zIm = rIm;
    let zExp = rExp;
    if (rZero) {
      zRe = dRe;
      zIm = dIm;
      zExp = dExp;
    } else if (!dZero) {
      zExp = Math.max(rExp, dExp);
      const rScale = rExp - zExp < -30 ? 0 : Math.pow(2, rExp - zExp);
      const dScale = dExp - zExp < -30 ? 0 : Math.pow(2, dExp - zExp);
      zRe = rRe * rScale + dRe * dScale;
      zIm = rIm * rScale + dIm * dScale;
    }

    const zMagSq = zRe * zRe + zIm * zIm;
    if (zMagSq > 0 && zExp >= -10) {
      if (zExp > 4 || zMagSq * Math.pow(2, 2 * zExp) > 4) {
        break;
      }
    }

    const dMagSq = dRe * dRe + dIm * dIm;
    let shouldRebase = m >= orbit.refEscapeIter;
    if (!shouldRebase && !dZero) {
      const diffZ = zExp - dExp;
      if (diffZ <= 15 && zMagSq * Math.pow(2, 2 * diffZ) < dMagSq) {
        shouldRebase = true;
      }
    }
    if (shouldRebase) {
      dRe = zRe;
      dIm = zIm;
      dExp = zExp;
      m = 0;
    }

    const cRRe = orbit.refRe[m]!;
    const cRIm = orbit.refIm[m]!;
    const cRExp = orbit.refExp[m]!;
    const curDZero = dRe === 0 && dIm === 0;
    const curRZero = cRRe === 0 && cRIm === 0;

    const t1Re = 2 * (cRRe * dRe - cRIm * dIm);
    const t1Im = 2 * (cRRe * dIm + cRIm * dRe);
    const t1Exp = curRZero || curDZero ? -10000 : cRExp + dExp;

    const t2Re = dRe * dRe - dIm * dIm;
    const t2Im = 2 * dRe * dIm;
    const t2Exp = curDZero ? -10000 : 2 * dExp;

    const topExp = Math.max(t1Exp, Math.max(t2Exp, t3Exp));
    const s1 = t1Exp - topExp < -30 ? 0 : Math.pow(2, t1Exp - topExp);
    const s2 = t2Exp - topExp < -30 ? 0 : Math.pow(2, t2Exp - topExp);
    const s3 = t3Exp - topExp < -30 ? 0 : Math.pow(2, t3Exp - topExp);

    dRe = t1Re * s1 + t2Re * s2 + dcRe * s3;
    dIm = t1Im * s1 + t2Im * s2 + dcIm * s3;
    dExp = topExp;

    const normSq = dRe * dRe + dIm * dIm;
    if (normSq === 0) {
      dExp = -10000;
    } else {
      const shiftExp = Math.floor(Math.log(normSq) * 0.7213475204444817);
      if (shiftExp !== 0) {
        const inv = Math.pow(2, -shiftExp);
        dRe *= inv;
        dIm *= inv;
        dExp += shiftExp;
      }
    }

    m++;
    iteration++;
  }

  return iteration;
}

export function pt(x: number, y: number): Point {
  return { x, y };
}

export function calculerRatio(canvas: HTMLCanvasElement): number {
  const cssWidth = parseInt(
    window.getComputedStyle(canvas, null).getPropertyValue("width"),
    10
  );
  return cssWidth / canvas.width;
}

export function calculeCoordonnees(
  evtx: number,
  evty: number,
  canvas: HTMLCanvasElement,
  ratio: number,
  scale: number
): Point {
  const x = ((2 * evtx) / ratio / canvas.width - 1) * scale;
  const y = ((canvas.height - (2 * evty) / ratio) / canvas.height) * scale;
  return pt(x, y);
}

export function calculePositionPx(
  x: number,
  y: number,
  canvas: HTMLCanvasElement,
  ratio: number,
  scale: number
): Point {
  const evtx = ((x / scale + 1) * canvas.width * ratio) / 2;
  const evty = ((1 - y / scale) * canvas.height * ratio) / 2;
  return pt(evtx, evty);
}

export function translate(
  state: ViewportState,
  x: number,
  y: number,
  drawFn: DrawCallback
): void {
  state.xMean += x;
  state.yMean += y;
  drawFn(state.xMean, state.yMean, state.scale);
}

function getEventPosition(evt: MouseEvent, canvas: HTMLCanvasElement): Point {
  const evtx = evt.offsetX || evt.pageX - canvas.offsetLeft;
  const evty = evt.offsetY || evt.pageY - canvas.offsetTop;
  return pt(evtx, evty);
}

export function initViewport(
  canvas: HTMLCanvasElement,
  drawFn: DrawCallback
): ViewportState {
  const state: ViewportState = {
    xMean: 0,
    yMean: 0,
    scale: 2,
    xCenter: bigFixedFromNumber(0, 128),
    yCenter: bigFixedFromNumber(0, 128),
  };

  let last = pt(0, 0);
  let meanStart = pt(0, 0);
  let centerStartX = state.xCenter!;
  let centerStartY = state.yCenter!;
  let draggedStart = pt(0, 0);
  let dragStart = false;
  let dragged = false;

  drawFn(state.xMean, state.yMean, state.scale);

  canvas.addEventListener("mousedown", (evt: MouseEvent) => {
    if (evt.button === 0) {
      document.body.style.userSelect = "none";
      const ratio = calculerRatio(canvas);
      const pos = getEventPosition(evt, canvas);
      last = calculeCoordonnees(pos.x, pos.y, canvas, ratio, state.scale);
      meanStart = pt(state.xMean, state.yMean);
      centerStartX = state.xCenter!;
      centerStartY = state.yCenter!;
      draggedStart = calculeCoordonnees(pos.x, pos.y, canvas, ratio, state.scale);
      dragged = false;
      dragStart = true;
    }
  });

  canvas.addEventListener("mousemove", (evt: MouseEvent) => {
    const ratio = calculerRatio(canvas);
    const pos = getEventPosition(evt, canvas);
    last = calculeCoordonnees(pos.x, pos.y, canvas, ratio, state.scale);
    dragged = true;
    if (dragStart) {
      const dx = draggedStart.x - last.x;
      const dy = draggedStart.y - last.y;
      const bits = precisionBitsForScale(state.scale);
      state.xMean = meanStart.x + dx;
      state.yMean = meanStart.y + dy;
      state.xCenter = bigFixedAdd(centerStartX, bigFixedFromNumber(dx, bits));
      state.yCenter = bigFixedAdd(centerStartY, bigFixedFromNumber(dy, bits));
      drawFn(state.xMean, state.yMean, state.scale);
    }
  });

  canvas.addEventListener("mouseup", (evt: MouseEvent) => {
    dragStart = false;
    if (!dragged) {
      zoom(evt.shiftKey ? -1 : 1);
    }
  });

  const scaleFactor = 1.1;
  function zoom(clicks: number): void {
    const ratio = calculerRatio(canvas);
    const pointZoom = calculePositionPx(last.x, last.y, canvas, ratio, state.scale);
    const prevLastX = last.x;
    const prevLastY = last.y;
    const factor = Math.pow(scaleFactor, clicks);
    state.scale = state.scale / factor;
    last = calculeCoordonnees(pointZoom.x, pointZoom.y, canvas, ratio, state.scale);
    const dx = prevLastX - last.x;
    const dy = prevLastY - last.y;
    const bits = precisionBitsForScale(state.scale);
    state.xMean += dx;
    state.yMean += dy;
    state.xCenter = bigFixedAdd(state.xCenter!, bigFixedFromNumber(dx, bits));
    state.yCenter = bigFixedAdd(state.yCenter!, bigFixedFromNumber(dy, bits));
    drawFn(state.xMean, state.yMean, state.scale);
  }

  canvas.addEventListener("wheel", (evt: WheelEvent) => {
    evt.preventDefault();
    const delta = evt.deltaY ? -evt.deltaY / 100 : 0;
    if (delta) {
      zoom(delta);
    }
  });

  return state;
}
