export type ItemStatus = 'pending' | 'rendering' | 'done' | 'failed';

export interface BatchItem {
  index: number;
  caption: string;
  fileName: string;
  status: ItemStatus;
  error?: string;
}

export interface BatchHandlers {
  renderItem: (item: BatchItem) => Promise<Uint8Array>;
  onResult: (item: BatchItem, bytes: Uint8Array) => void;
  onChange: (items: BatchItem[]) => void;
  shouldCancel: () => boolean;
}

// Items are processed one at a time; a failed item never stops the rest of the batch.
export async function runBatch(
  initial: BatchItem[],
  indices: number[],
  handlers: BatchHandlers,
): Promise<BatchItem[]> {
  let items = initial;
  const update = (index: number, patch: Partial<BatchItem>) => {
    items = items.map((item) => (item.index === index ? { ...item, ...patch } : item));
    handlers.onChange(items);
  };

  for (const index of indices) {
    if (handlers.shouldCancel()) break;
    const current = items.find((item) => item.index === index);
    if (!current || current.status === 'done') continue;

    update(index, { status: 'rendering', error: undefined });
    try {
      const bytes = await handlers.renderItem(current);
      handlers.onResult(current, bytes);
      update(index, { status: 'done' });
    } catch (error) {
      update(index, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Rendering failed.',
      });
    }
  }
  return items;
}
