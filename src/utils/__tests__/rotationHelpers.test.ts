import { describe, it, expect } from 'vitest';
import { getRotationForDate, getForecast, DEFAULT_SPECIALS_CONFIG, SpecialsConfig } from '../rotationHelpers';

// Build a date from local year/month/day to avoid UTC timezone drift.
function localDate(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d);
}

const BASE_CONFIG: SpecialsConfig = {
  ...DEFAULT_SPECIALS_CONFIG,
  mode: 'letter-day',
  specialsNames: { A: 'Art', B: 'PE', C: 'Music' },
  rotationMapping: {},
  dayOfWeekSpecials: {},
  rollingStartDate: '',
  rollingLetterCount: 5,
  todayOverride: null,
};

// ─── mode: off ────────────────────────────────────────────────────────────────

describe('getRotationForDate — off mode', () => {
  it('returns null when mode is off', () => {
    const config: SpecialsConfig = { ...BASE_CONFIG, mode: 'off' };
    expect(getRotationForDate(localDate(2024, 9, 9), config)).toBeNull(); // Monday
  });
});

// ─── weekends ─────────────────────────────────────────────────────────────────

describe('getRotationForDate — weekends', () => {
  it('returns null on Saturday', () => {
    const config: SpecialsConfig = { ...BASE_CONFIG, mode: 'letter-day', rotationMapping: { '2024-09-07': 'A' } };
    expect(getRotationForDate(localDate(2024, 9, 7), config)).toBeNull(); // Saturday
  });

  it('returns null on Sunday', () => {
    const config: SpecialsConfig = { ...BASE_CONFIG, mode: 'letter-day', rotationMapping: { '2024-09-08': 'A' } };
    expect(getRotationForDate(localDate(2024, 9, 8), config)).toBeNull(); // Sunday
  });
});

// ─── mode: letter-day ─────────────────────────────────────────────────────────

describe('getRotationForDate — letter-day mode', () => {
  it('returns correct letter and special when date is mapped', () => {
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'letter-day',
      rotationMapping: { '2024-09-09': 'B' },
    };
    const result = getRotationForDate(localDate(2024, 9, 9), config);
    expect(result).toEqual({ letter: 'B', special: 'PE' });
  });

  it('returns null when date has no mapping', () => {
    const config: SpecialsConfig = { ...BASE_CONFIG, mode: 'letter-day', rotationMapping: {} };
    expect(getRotationForDate(localDate(2024, 9, 9), config)).toBeNull();
  });

  it('falls back to "No Special" for unmapped letter', () => {
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'letter-day',
      rotationMapping: { '2024-09-09': 'Z' },
    };
    const result = getRotationForDate(localDate(2024, 9, 9), config);
    expect(result?.special).toBe('No Special');
  });
});

// ─── mode: day-of-week ────────────────────────────────────────────────────────

describe('getRotationForDate — day-of-week mode', () => {
  it('maps Monday (1) correctly', () => {
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'day-of-week',
      dayOfWeekSpecials: { '1': 'Art', '2': 'PE', '3': 'Music', '4': 'Library', '5': 'STEM' },
    };
    const result = getRotationForDate(localDate(2024, 9, 9), config); // 2024-09-09 is Monday
    expect(result).toEqual({ letter: 'Mon', special: 'Art' });
  });

  it('maps Friday (5) correctly', () => {
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'day-of-week',
      dayOfWeekSpecials: { '1': 'Art', '2': 'PE', '3': 'Music', '4': 'Library', '5': 'STEM' },
    };
    const result = getRotationForDate(localDate(2024, 9, 13), config); // 2024-09-13 is Friday
    expect(result).toEqual({ letter: 'Fri', special: 'STEM' });
  });

  it('returns null when day has no special', () => {
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'day-of-week',
      dayOfWeekSpecials: {},
    };
    expect(getRotationForDate(localDate(2024, 9, 9), config)).toBeNull();
  });
});

// ─── mode: rolling ────────────────────────────────────────────────────────────

describe('getRotationForDate — rolling mode', () => {
  it('returns null when rollingStartDate is empty', () => {
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'rolling',
      rollingStartDate: '',
    };
    expect(getRotationForDate(localDate(2024, 9, 9), config)).toBeNull();
  });

  it('start date itself is letter A', () => {
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'rolling',
      rollingStartDate: '2024-09-09',
      rollingLetterCount: 5,
    };
    const result = getRotationForDate(localDate(2024, 9, 9), config);
    expect(result?.letter).toBe('A');
    expect(result?.special).toBe('Art');
  });

  it('next weekday is letter B', () => {
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'rolling',
      rollingStartDate: '2024-09-09', // Monday = A
      rollingLetterCount: 5,
    };
    const result = getRotationForDate(localDate(2024, 9, 10), config); // Tuesday = B
    expect(result?.letter).toBe('B');
  });

  it('wraps around after rollingLetterCount days', () => {
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'rolling',
      rollingStartDate: '2024-09-09', // Monday = A (idx 0)
      rollingLetterCount: 5,
    };
    // 5 weekdays later: Mon Sep 16 = idx 5 → 5 % 5 = 0 = A again
    const result = getRotationForDate(localDate(2024, 9, 16), config);
    expect(result?.letter).toBe('A');
  });
});

// ─── todayOverride ────────────────────────────────────────────────────────────

describe('getRotationForDate — todayOverride', () => {
  // Build today's key the same way the source does.
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  it('override fires for today in letter-day mode', () => {
    // Skip on weekends — override only fires on weekdays.
    if (today.getDay() === 0 || today.getDay() === 6) return;
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'letter-day',
      rotationMapping: { [todayKey]: 'A' },
      todayOverride: { date: todayKey, letter: 'C' },
    };
    const result = getRotationForDate(today, config);
    expect(result).toEqual({ letter: 'C', special: 'Music' });
  });

  it('override fires for today in rolling mode', () => {
    if (today.getDay() === 0 || today.getDay() === 6) return;
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'rolling',
      rollingStartDate: todayKey,
      todayOverride: { date: todayKey, letter: 'B' },
    };
    const result = getRotationForDate(today, config);
    expect(result).toEqual({ letter: 'B', special: 'PE' });
  });

  it('override does NOT fire for a past date', () => {
    const pastDate = localDate(2024, 9, 9); // fixed weekday in the past
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'letter-day',
      rotationMapping: { '2024-09-09': 'A' },
      todayOverride: { date: '2024-09-09', letter: 'C' },
    };
    // Override only fires when dateKey === todayKey, which won't match a past date today.
    const result = getRotationForDate(pastDate, config);
    // Either the override didn't fire (returns A from mapping) or null — not C.
    expect(result?.letter).not.toBe('C');
  });

  it('override does NOT fire in day-of-week mode', () => {
    if (today.getDay() === 0 || today.getDay() === 6) return;
    const dowKey = String(today.getDay());
    const config: SpecialsConfig = {
      ...BASE_CONFIG,
      mode: 'day-of-week',
      dayOfWeekSpecials: { [dowKey]: 'Art' },
      todayOverride: { date: todayKey, letter: 'C' },
    };
    const result = getRotationForDate(today, config);
    // Should return the day-of-week result, not the override letter C
    expect(result?.special).toBe('Art');
  });
});

// ─── getForecast ──────────────────────────────────────────────────────────────

describe('getForecast', () => {
  it('returns 6 upcoming weekdays in letter-day mode', () => {
    // Build a mapping for the next 10 weekdays
    const mapping: Record<string, string> = {};
    const letters = ['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A'];
    const cur = new Date();
    cur.setHours(0, 0, 0, 0);
    let filled = 0;
    for (let i = 1; filled < 10; i++) {
      const d = new Date(cur);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        mapping[key] = letters[filled];
        filled++;
      }
    }
    const config: SpecialsConfig = { ...BASE_CONFIG, mode: 'letter-day', rotationMapping: mapping };
    const forecast = getForecast(config);
    expect(forecast).toHaveLength(6);
    expect(forecast[0]).toHaveProperty('letter');
    expect(forecast[0]).toHaveProperty('special');
    expect(forecast[0]).toHaveProperty('date');
  });

  it('returns empty array when mode is off', () => {
    const config: SpecialsConfig = { ...BASE_CONFIG, mode: 'off' };
    expect(getForecast(config)).toHaveLength(0);
  });
});
