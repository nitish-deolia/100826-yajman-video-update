import { describe, expect, it } from 'vitest';
import { applyTemplate, findUnknownPlaceholders } from './template';

const row = { Name: 'Asha', City: 'Indore' };

describe('applyTemplate', () => {
  it('fills placeholders case-insensitively', () => {
    expect(applyTemplate('Hello {name} from {CITY}', row)).toBe('Hello Asha from Indore');
  });

  it('leaves unknown placeholders untouched and tidies whitespace', () => {
    expect(applyTemplate('  {Name}   {Missing} ', row)).toBe('Asha {Missing}');
  });

  it('returns an empty string when every value is blank', () => {
    expect(applyTemplate('{Name}', { Name: '' })).toBe('');
  });
});

describe('findUnknownPlaceholders', () => {
  it('lists placeholders that match no column', () => {
    expect(findUnknownPlaceholders('{Name} {Age} {age}', ['Name'])).toEqual(['Age', 'age']);
  });
});
