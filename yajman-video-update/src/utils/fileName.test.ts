import { describe, expect, it } from 'vitest';
import { sanitizeFileName, uniqueFileName } from './fileName';

describe('sanitizeFileName', () => {
  it('removes illegal characters and collapses spaces', () => {
    expect(sanitizeFileName('  Ram / Sita: "Sharma"  ')).toBe('Ram Sita Sharma');
  });

  it('falls back when nothing usable remains', () => {
    expect(sanitizeFileName('???')).toBe('video');
  });

  it('strips leading dots', () => {
    expect(sanitizeFileName('..hidden')).toBe('hidden');
  });
});

describe('uniqueFileName', () => {
  it('adds a numeric suffix on duplicates, ignoring case', () => {
    const used = new Set<string>();
    expect(uniqueFileName('Asha', used)).toBe('Asha.mp4');
    expect(uniqueFileName('asha', used)).toBe('asha_2.mp4');
    expect(uniqueFileName('ASHA', used)).toBe('ASHA_3.mp4');
  });
});
