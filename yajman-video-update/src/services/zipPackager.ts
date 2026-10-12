import { Zip, ZipPassThrough } from 'fflate';
import type { BatchItem } from './batchRunner';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// MP4 is already compressed, so entries are stored without extra compression.
export function buildZip(entries: ZipEntry[]): Blob {
  const chunks: Uint8Array[] = [];
  const state: { error: Error | null } = { error: null };

  const zip = new Zip((error, chunk) => {
    if (error) state.error = error;
    else chunks.push(chunk);
  });
  for (const entry of entries) {
    const file = new ZipPassThrough(entry.name);
    zip.add(file);
    file.push(entry.data, true);
  }
  zip.end();

  if (state.error) throw state.error;
  return new Blob(chunks, { type: 'application/zip' });
}

function escapeCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildReportCsv(items: BatchItem[]): string {
  const rows = items.map((item) =>
    [String(item.index + 1), item.fileName, item.status, item.caption, item.error ?? '']
      .map(escapeCsv)
      .join(','),
  );
  // The BOM lets Excel read UTF-8 captions correctly.
  return `\uFEFF${['row,file,status,caption,error', ...rows].join('\r\n')}`;
}
