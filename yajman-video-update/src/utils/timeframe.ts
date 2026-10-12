export interface Timeframe {
  start: number;
  end: number;
}

export function parseSeconds(text: string): number {
  return text.trim() === '' ? NaN : Number(text);
}

export function normalizeTimeframe(start: number, end: number, duration: number): Timeframe {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('Enter the start and end times in seconds.');
  }
  if (start < 0) throw new Error('Start time cannot be negative.');
  if (start >= duration) throw new Error('Start time must be before the end of the video.');

  const clampedEnd = Math.min(end, duration);
  if (clampedEnd <= start) throw new Error('End time must be after the start time.');
  return { start, end: clampedEnd };
}
