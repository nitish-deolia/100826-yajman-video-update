const PLACEHOLDER = /\{([^{}]+)\}/g;

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function findUnknownPlaceholders(template: string, headers: string[]): string[] {
  const known = new Set(headers.map(normalize));
  const unknown = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER)) {
    if (!known.has(normalize(match[1]))) unknown.add(match[1].trim());
  }
  return [...unknown];
}

export function applyTemplate(template: string, row: Record<string, string>): string {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalize(key), value]));
  return template
    .replace(PLACEHOLDER, (placeholder, name: string) => values.get(normalize(name)) ?? placeholder)
    .replace(/\s+/g, ' ')
    .trim();
}
