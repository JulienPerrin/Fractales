export interface Point {
  x: number;
  y: number;
}

export interface ViewportState {
  xMean: number;
  yMean: number;
  scale: number;
}

export type DrawCallback = (xMean: number, yMean: number, scale: number) => void;

export interface ColorRange {
  hMin: number;
  hMax: number;
  bMin: number;
  bMax: number;
  iterationMin: number;
  iterationMax: number;
}
