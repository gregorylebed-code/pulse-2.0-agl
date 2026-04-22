export type SpecialsMode = 'off' | 'letter-day' | 'day-of-week' | 'rolling';

export interface SpecialsConfig {
  mode: SpecialsMode;
  specialsNames: Record<string, string>;      // letter → subject (letter-day + rolling)
  rotationMapping: Record<string, string>;    // YYYY-MM-DD → letter (letter-day only)
  dayOfWeekSpecials: Record<string, string>;  // '1'=Mon … '5'=Fri → subject (day-of-week only)
  rollingStartDate: string;                   // YYYY-MM-DD that is "Day A" (rolling only)
  rollingLetterCount: number;                 // default 5 (A–E)
  todayOverride: { date: string; letter: string } | null;
}

export const DEFAULT_SPECIALS_CONFIG: SpecialsConfig = {
  mode: 'letter-day',
  specialsNames: { A: 'Art', B: 'PE', C: 'Music', D: 'Library', E: 'STEM' },
  rotationMapping: {},
  dayOfWeekSpecials: { '1': 'Art', '2': 'PE', '3': 'Music', '4': 'Library', '5': 'STEM' },
  rollingStartDate: '',
  rollingLetterCount: 5,
  todayOverride: null,
};

function toLocalKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const LETTERS = 'ABCDEFGHIJ';

/** Count Mon–Fri days from start (inclusive) to end (exclusive). */
function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endMs = new Date(end).setHours(0, 0, 0, 0);
  while (cur.getTime() < endMs) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function getRotationForDate(
  date: Date,
  config: SpecialsConfig
): { letter: string; special: string } | null {
  if (config.mode === 'off') return null;

  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return null;

  const dateKey = toLocalKey(date);
  const todayKey = toLocalKey(new Date());

  // Today override applies to letter-day and rolling modes
  if (
    dateKey === todayKey &&
    config.todayOverride?.date === todayKey &&
    (config.mode === 'letter-day' || config.mode === 'rolling')
  ) {
    const letter = config.todayOverride.letter;
    return { letter, special: config.specialsNames[letter] || 'No Special' };
  }

  if (config.mode === 'letter-day') {
    const letter = config.rotationMapping[dateKey];
    if (!letter) return null;
    return { letter, special: config.specialsNames[letter] || 'No Special' };
  }

  if (config.mode === 'day-of-week') {
    const key = String(dayOfWeek);
    const special = config.dayOfWeekSpecials[key];
    if (!special) return null;
    const names: Record<string, string> = { '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri' };
    return { letter: names[key] || '', special };
  }

  if (config.mode === 'rolling') {
    if (!config.rollingStartDate) return null;
    const startDate = new Date(config.rollingStartDate + 'T00:00:00');
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    let idx: number;
    if (target >= startDate) {
      idx = countWeekdays(startDate, target);
    } else {
      idx = -countWeekdays(target, startDate);
    }

    const letterCount = config.rollingLetterCount || 5;
    const letterIdx = ((idx % letterCount) + letterCount) % letterCount;
    const letter = LETTERS[letterIdx];
    return { letter, special: config.specialsNames[letter] || 'No Special' };
  }

  return null;
}

export function getForecast(
  config: SpecialsConfig
): { date: Date; letter: string; special: string }[] {
  const forecast: { date: Date; letter: string; special: string }[] = [];
  const current = new Date();
  current.setHours(0, 0, 0, 0);

  let count = 0;
  let daysChecked = 0;
  while (count < 6 && daysChecked < 30) {
    current.setDate(current.getDate() + 1);
    daysChecked++;

    const rotation = getRotationForDate(current, config);
    if (rotation) {
      forecast.push({ date: new Date(current), ...rotation });
      count++;
    }
  }
  return forecast;
}
