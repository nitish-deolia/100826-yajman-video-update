import { describe, expect, it } from 'vitest';
import { computeOverlayPosition } from './placement';

const video = { width: 1000, height: 2000 };

describe('computeOverlayPosition', () => {
  it('centres the box on the anchor', () => {
    expect(computeOverlayPosition({ width: 400, height: 200 }, video, { x: 0.5, y: 0.5 })).toEqual({
      x: 300,
      y: 900,
    });
  });

  it('keeps the box inside the video', () => {
    expect(computeOverlayPosition({ width: 400, height: 200 }, video, { x: 0, y: 1 })).toEqual({
      x: 0,
      y: 1800,
    });
  });

  it('pins to the origin when the box is larger than the video', () => {
    expect(computeOverlayPosition({ width: 1200, height: 200 }, video, { x: 0.5, y: 0.5 }).x).toBe(0);
  });
});
