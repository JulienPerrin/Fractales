export interface Point {
  x: number;
  y: number;
}

export interface BigFixed {
  readonly raw: bigint;
  readonly fracBits: number;
}

export interface ReferenceOrbit {
  readonly refRe: Float32Array;
  readonly refIm: Float32Array;
  readonly refExp: Float32Array;
  readonly refEscapeIter: number;
}

export interface ViewportState {
  xMean: number;
  yMean: number;
  scale: number;
  xCenter?: BigFixed;
  yCenter?: BigFixed;
}

export type DrawCallback = (
  xMean: number,
  yMean: number,
  scale: number,
  xCenter?: BigFixed,
  yCenter?: BigFixed
) => void;

export interface ColorRange {
  hMin: number;
  hMax: number;
  bMin: number;
  bMax: number;
  iterationMin: number;
  iterationMax: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}
