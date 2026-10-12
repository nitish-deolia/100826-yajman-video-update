import { toMarkdown } from '@mdgate/numbers';
import readXlsxFile from 'read-excel-file';

export interface ExcelData {
  headers: string[];
  rows: Record<string, string>[];
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

function parseMarkdownTable(markdown: string): unknown[][] {
  const lines = markdown.split(/\r?\n/);
  const tables: unknown[][][] = [];
  let current: unknown[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      if (current.length > 0) tables.push(current);
      current = [];
      continue;
    }

    const cells: string[] = [''];
    for (let index = 0; index < trimmed.length; index += 1) {
      const character = trimmed[index];
      if (character === '\\' && trimmed[index + 1] === '|') {
        cells[cells.length - 1] += '|';
        index += 1;
      } else if (character === '|') {
        cells.push('');
      } else {
        cells[cells.length - 1] += character;
      }
    }
    if (cells[0].trim() === '') cells.shift();
    if (cells[cells.length - 1]?.trim() === '') cells.pop();
    const row = cells.map((cell) => cell.trim().replace(/<br\s*\/?\s*>/gi, ' '));
    if (row.length > 0 && row.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    current.push(row);
  }
  if (current.length > 0) tables.push(current);
  return tables.find((table) => table.length >= 2) ?? [];
}

export async function parseExcel(file: File): Promise<ExcelData> {
  const extension = file.name.toLowerCase().split('.').pop();
  let sheet: unknown[][];
  if (extension === 'numbers') {
    const markdown = await toMarkdown(new Uint8Array(await file.arrayBuffer()));
    sheet = parseMarkdownTable(markdown);
  } else if (extension === 'xlsx') {
    sheet = await readXlsxFile(file);
  } else {
    throw new Error('Choose an .xlsx or Apple Numbers (.numbers) spreadsheet.');
  }
  if (sheet.length < 2) {
    throw new Error('The spreadsheet needs a header row and at least one row of data.');
  }

  const columns = sheet[0]
    .map((cell, index) => ({ name: cellToString(cell), index }))
    .filter((column) => column.name !== '');
  if (columns.length === 0) throw new Error('The first row must contain column names.');

  const seen = new Set<string>();
  for (const { name } of columns) {
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`The column name "${name}" appears more than once.`);
    seen.add(key);
  }

  const rows = sheet
    .slice(1)
    .map((cells) =>
      Object.fromEntries(columns.map(({ name, index }) => [name, cellToString(cells[index])])),
    )
    .filter((row) => Object.values(row).some((value) => value !== ''));
  if (rows.length === 0) throw new Error('No rows with data were found.');

  return { headers: columns.map((column) => column.name), rows };
}
