export interface Anchor {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const DEFAULT_ANCHOR: Anchor = { x: 0.5, y: 0.88 };

export const QUICK_ANCHORS = {
  top: { x: 0.5, y: 0.12 },
  middle: { x: 0.5, y: 0.5 },
  bottom: DEFAULT_ANCHOR,
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// The anchor is the caption's centre as a fraction of the video; the result is its top-left pixel.
export function computeOverlayPosition(box: Size, video: Size, anchor: Anchor): { x: number; y: number } {
  return {
    x: clamp(Math.round(anchor.x * video.width - box.width / 2), 0, Math.max(0, video.width - box.width)),
    y: clamp(Math.round(anchor.y * video.height - box.height / 2), 0, Math.max(0, video.height - box.height)),
  };
}
