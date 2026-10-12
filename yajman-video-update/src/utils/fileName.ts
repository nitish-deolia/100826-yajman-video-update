const ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function sanitizeFileName(raw: string, maxLength = 80): string {
  const cleaned = raw
    .replace(ILLEGAL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return cleaned.slice(0, maxLength).trim() || 'video';
}

export function uniqueFileName(base: string, used: Set<string>, ext = 'mp4'): string {
  let name = `${base}.${ext}`;
  let suffix = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base}_${suffix++}.${ext}`;
  }
  used.add(name.toLowerCase());
  return name;
}
