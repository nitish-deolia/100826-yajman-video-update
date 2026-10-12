import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { BatchItem } from './batchRunner';
import { buildReportCsv, buildZip } from './zipPackager';

describe('buildZip', () => {
  it('stores every entry under its name', async () => {
    const blob = buildZip([
      { name: 'a.mp4', data: new Uint8Array([1, 2, 3]) },
      { name: 'आशा.mp4', data: new Uint8Array([4, 5]) },
    ]);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));

    expect(Object.keys(files).sort()).toEqual(['a.mp4', 'आशा.mp4']);
    expect([...files['a.mp4']]).toEqual([1, 2, 3]);
  });
});

describe('buildReportCsv', () => {
  it('escapes commas, quotes and line breaks', () => {
    const items: BatchItem[] = [
      { index: 0, caption: 'Hi, "friend"', fileName: 'one.mp4', status: 'failed', error: 'bad\nthing' },
    ];
    const csv = buildReportCsv(items);

    expect(csv).toContain('"Hi, ""friend"""');
    expect(csv).toContain('"bad\nthing"');
  });
});
