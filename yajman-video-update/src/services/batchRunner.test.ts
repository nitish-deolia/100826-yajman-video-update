import { describe, expect, it } from 'vitest';
import { runBatch, type BatchItem } from './batchRunner';

const makeItems = (count: number): BatchItem[] =>
  Array.from({ length: count }, (_, index) => ({
    index,
    caption: `caption ${index}`,
    fileName: `video_${index}.mp4`,
    status: 'pending',
  }));

const noop = () => undefined;

describe('runBatch', () => {
  it('continues after a failed item and records the error', async () => {
    const results: number[] = [];
    const final = await runBatch(makeItems(3), [0, 1, 2], {
      renderItem: async (item) => {
        if (item.index === 1) throw new Error('boom');
        return new Uint8Array([item.index]);
      },
      onResult: (item) => results.push(item.index),
      onChange: noop,
      shouldCancel: () => false,
    });

    expect(results).toEqual([0, 2]);
    expect(final.map((item) => item.status)).toEqual(['done', 'failed', 'done']);
    expect(final[1].error).toBe('boom');
  });

  it('stops starting new items once cancelled', async () => {
    let cancelled = false;
    const final = await runBatch(makeItems(3), [0, 1, 2], {
      renderItem: async () => {
        cancelled = true;
        return new Uint8Array();
      },
      onResult: noop,
      onChange: noop,
      shouldCancel: () => cancelled,
    });

    expect(final.map((item) => item.status)).toEqual(['done', 'pending', 'pending']);
  });

  it('skips items that are already done when retrying', async () => {
    const items = makeItems(2);
    items[0].status = 'done';
    const rendered: number[] = [];
    await runBatch(items, [0, 1], {
      renderItem: async (item) => {
        rendered.push(item.index);
        return new Uint8Array();
      },
      onResult: noop,
      onChange: noop,
      shouldCancel: () => false,
    });

    expect(rendered).toEqual([1]);
  });
});
