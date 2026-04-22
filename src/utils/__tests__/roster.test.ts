import { describe, it, expect } from 'vitest';
import { getDisplayName, getDisplayFirst } from '../getDisplayName';
import { expandAbbreviations } from '../expandAbbreviations';
import { cn } from '../cn';
import type { Student } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: '1',
    name: 'Jane Smith',
    class_id: null,
    user_id: 'u1',
    created_at: '2024-01-01',
    ...overrides,
  };
}

// ─── getDisplayName ───────────────────────────────────────────────────────────

describe('getDisplayName', () => {
  it('returns full name when alias mode is off', () => {
    const s = makeStudent({ name: 'Jane Smith' });
    expect(getDisplayName(s, false)).toBe('Jane Smith');
  });

  it('returns alias when alias mode is on and alias exists', () => {
    const s = makeStudent({ name: 'Jane Smith', alias: 'Sparky' });
    expect(getDisplayName(s, true)).toBe('Sparky');
  });

  it('returns initials when alias mode is on and no alias', () => {
    const s = makeStudent({ name: 'Jane Smith' });
    expect(getDisplayName(s, true)).toBe('J.S.');
  });

  it('returns single initial for one-word name', () => {
    const s = makeStudent({ name: 'Madonna' });
    expect(getDisplayName(s, true)).toBe('M');
  });

  it('handles extra whitespace in name', () => {
    const s = makeStudent({ name: '  Jane   Smith  ' });
    expect(getDisplayName(s, true)).toBe('J.S.');
  });

  it('ignores empty alias and falls back to initials', () => {
    const s = makeStudent({ name: 'Jane Smith', alias: '' });
    expect(getDisplayName(s, true)).toBe('J.S.');
  });

  it('returns full name unchanged when alias mode is off even with alias set', () => {
    const s = makeStudent({ name: 'Jane Smith', alias: 'Sparky' });
    expect(getDisplayName(s, false)).toBe('Jane Smith');
  });
});

// ─── getDisplayFirst ──────────────────────────────────────────────────────────

describe('getDisplayFirst', () => {
  it('returns first name when alias mode is off', () => {
    const s = makeStudent({ name: 'Jane Smith' });
    expect(getDisplayFirst(s, false)).toBe('Jane');
  });

  it('returns alias as first token when alias mode is on', () => {
    const s = makeStudent({ name: 'Jane Smith', alias: 'Sparky Jones' });
    expect(getDisplayFirst(s, true)).toBe('Sparky');
  });

  it('returns initials first token when alias mode is on and no alias', () => {
    const s = makeStudent({ name: 'Jane Smith' });
    expect(getDisplayFirst(s, true)).toBe('J.S.');
  });

  it('returns single-word alias as-is', () => {
    const s = makeStudent({ name: 'Jane Smith', alias: 'Sparky' });
    expect(getDisplayFirst(s, true)).toBe('Sparky');
  });
});

// ─── expandAbbreviations ──────────────────────────────────────────────────────

describe('expandAbbreviations', () => {
  it('expands a simple abbreviation', () => {
    const abbrs = [{ id: '1', abbreviation: 'OT', expansion: 'off task', caseSensitive: false }];
    expect(expandAbbreviations('Student was OT today', abbrs)).toBe('Student was off task today');
  });

  it('is case-insensitive when caseSensitive is false', () => {
    const abbrs = [{ id: '1', abbreviation: 'ot', expansion: 'off task', caseSensitive: false }];
    expect(expandAbbreviations('Student was OT today', abbrs)).toBe('Student was off task today');
  });

  it('is case-sensitive when caseSensitive is true', () => {
    const abbrs = [{ id: '1', abbreviation: 'OT', expansion: 'off task', caseSensitive: true }];
    expect(expandAbbreviations('Student was ot today', abbrs)).toBe('Student was ot today');
  });

  it('does not expand partial word matches', () => {
    const abbrs = [{ id: '1', abbreviation: 'OT', expansion: 'off task', caseSensitive: false }];
    expect(expandAbbreviations('OTIS was here', abbrs)).toBe('OTIS was here');
  });

  it('returns original string when no abbreviations provided', () => {
    expect(expandAbbreviations('hello world', [])).toBe('hello world');
  });

  it('expands multiple abbreviations', () => {
    const abbrs = [
      { id: '1', abbreviation: 'OT', expansion: 'off task', caseSensitive: false },
      { id: '2', abbreviation: 'GB', expansion: 'great behavior', caseSensitive: false },
    ];
    expect(expandAbbreviations('OT then GB', abbrs)).toBe('off task then great behavior');
  });

  it('expands abbreviation at start of string', () => {
    const abbrs = [{ id: '1', abbreviation: 'OT', expansion: 'off task', caseSensitive: false }];
    expect(expandAbbreviations('OT today', abbrs)).toBe('off task today');
  });

  it('expands abbreviation at end of string', () => {
    const abbrs = [{ id: '1', abbreviation: 'OT', expansion: 'off task', caseSensitive: false }];
    expect(expandAbbreviations('was OT', abbrs)).toBe('was off task');
  });

  it('skips abbreviation entries with empty abbreviation field', () => {
    const abbrs = [{ id: '1', abbreviation: '', expansion: 'off task', caseSensitive: false }];
    expect(expandAbbreviations('hello', abbrs)).toBe('hello');
  });

  it('escapes regex special chars in abbreviation (no partial match explosion)', () => {
    // 'C.D' contains a dot which is a regex wildcard — escaping prevents it matching 'CAD'
    const abbrs = [{ id: '1', abbreviation: 'C.D', expansion: 'conduct disorder', caseSensitive: false }];
    expect(expandAbbreviations('CAD was discussed', abbrs)).toBe('CAD was discussed');
  });
});

// ─── cn (class name utility) ──────────────────────────────────────────────────

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'active')).toBe('base active');
  });

  it('handles undefined and null inputs gracefully', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('handles array of class names', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('returns empty string when no args', () => {
    expect(cn()).toBe('');
  });

  it('deduplicates text-color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});
