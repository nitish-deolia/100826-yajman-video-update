import type { YajmanDetails, YajmanVideoEntry } from '../services/yajmanOverlay';
import type { ExcelData } from './excel';
import { sanitizeFileName, uniqueFileName } from './fileName';

export type FieldKey = keyof YajmanDetails;
export type FieldMap = Record<FieldKey, string>;

export const YAJMAN_FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'number', label: 'Number' },
  { key: 'gotra', label: 'Gotra' },
  { key: 'pitraName', label: 'Pitra Name' },
];

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  date: ['date', 'tithi', 'tarikh'],
  fullName: ['full name', 'name', 'yajman'],
  number: ['number', 'mobile', 'phone', 'contact'],
  gotra: ['gotra'],
  pitraName: ['pitra name', 'pitra', 'ancestor names', 'pitraname'],
};

export const EMPTY_FIELD_MAP: FieldMap = { date: '', fullName: '', number: '', gotra: '', pitraName: '' };

export function suggestColumnMapping(headers: string[]): FieldMap {
  return Object.fromEntries(YAJMAN_FIELDS.map(({ key }) => {
    const column = headers.find((header) => FIELD_ALIASES[key].includes(header.trim().toLowerCase()));
    return [key, column ?? ''];
  })) as FieldMap;
}

export function mapExcelRow(row: Record<string, string>, mapping: FieldMap): YajmanDetails {
  return {
    date: mapping.date ? row[mapping.date] ?? '' : '',
    fullName: mapping.fullName ? row[mapping.fullName] ?? '' : '',
    number: mapping.number ? row[mapping.number] ?? '' : '',
    gotra: mapping.gotra ? row[mapping.gotra] ?? '' : '',
    pitraName: mapping.pitraName ? row[mapping.pitraName] ?? '' : '',
  };
}

export function buildYajmanEntries(excel: ExcelData, mapping: FieldMap): YajmanVideoEntry[] {
  const used = new Set<string>();
  const digits = String(excel.rows.length).length;
  return excel.rows.map((row, index) => {
    const details = mapExcelRow(row, mapping);
    const sequence = String(index + 1).padStart(digits, '0');
    const name = sanitizeFileName(details.fullName || `video_${index + 1}`, 48);
    const datePrefix = details.date ? `${sanitizeFileName(details.date, 20)}_` : '';
    return { details, fileName: uniqueFileName(`${sequence}_${datePrefix}${name}.mp4`, used) };
  });
}
