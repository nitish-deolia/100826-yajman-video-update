import { describe, expect, it } from 'vitest';
import { normalizeTimeframe, parseSeconds } from './timeframe';

describe('normalizeTimeframe', () => {
  it('accepts a valid range', () => {
    expect(normalizeTimeframe(2, 8, 20)).toEqual({ start: 2, end: 8 });
  });

  it('clamps the end to the video duration', () => {
    expect(normalizeTimeframe(0, 99, 20)).toEqual({ start: 0, end: 20 });
  });

  it('rejects invalid ranges', () => {
    expect(() => normalizeTimeframe(-1, 5, 20)).toThrow();
    expect(() => normalizeTimeframe(5, 5, 20)).toThrow();
    expect(() => normalizeTimeframe(20, 25, 20)).toThrow();
    expect(() => normalizeTimeframe(NaN, 5, 20)).toThrow();
  });
});

describe('parseSeconds', () => {
  it('returns NaN for blank input', () => {
    expect(parseSeconds('  ')).toBeNaN();
    expect(parseSeconds('2.5')).toBe(2.5);
  });
});
