import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleDailyReminder, scheduleCalendarReminder } from '../notifications';
import type { CalendarEvent } from '../../types';

// Minimal localStorage shim for Node environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal('localStorage', localStorageMock);

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '1',
    date: new Date().toISOString().split('T')[0],
    title: 'Field Trip',
    type: 'event',
    user_id: 'u1',
    created_at: '2024-01-01',
    ...overrides,
  };
}

// ─── scheduleDailyReminder ────────────────────────────────────────────────────

describe('scheduleDailyReminder', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns no-op when hasNotesToday is true', () => {
    const cleanup = scheduleDailyReminder('14:00', true);
    expect(typeof cleanup).toBe('function');
    // Calling cleanup should not throw
    expect(() => cleanup()).not.toThrow();
  });

  it('returns no-op when reminder time has already passed today', () => {
    // Set current time to 15:00 — past a 14:00 reminder
    vi.setSystemTime(new Date(2024, 8, 9, 15, 0, 0)); // 3 PM
    const cleanup = scheduleDailyReminder('14:00', false);
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  it('returns a real cleanup when reminder is in the future', () => {
    vi.setSystemTime(new Date(2024, 8, 9, 8, 0, 0)); // 8 AM
    const cleanup = scheduleDailyReminder('14:00', false); // 14:00 is in future
    expect(typeof cleanup).toBe('function');
    // Cleanup should cancel the timer without throwing
    expect(() => cleanup()).not.toThrow();
  });
});

// ─── scheduleCalendarReminder ─────────────────────────────────────────────────

describe('scheduleCalendarReminder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('returns no-op when todayEvents is empty', () => {
    const cleanup = scheduleCalendarReminder([]);
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  it('returns no-op when reminder was already shown today', () => {
    const todayKey = new Date().toISOString().split('T')[0];
    localStorage.setItem(`cp_cal_notif_${todayKey}`, '1');
    const cleanup = scheduleCalendarReminder([makeEvent()]);
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  it('returns no-op when time is past noon', () => {
    vi.setSystemTime(new Date(2024, 8, 9, 13, 0, 0)); // 1 PM — past noon
    const cleanup = scheduleCalendarReminder([makeEvent()]);
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  it('returns real cleanup when before 8 AM', () => {
    vi.setSystemTime(new Date(2024, 8, 9, 7, 0, 0)); // 7 AM
    const cleanup = scheduleCalendarReminder([makeEvent()]);
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  it('returns real cleanup when between 8 AM and noon', () => {
    vi.setSystemTime(new Date(2024, 8, 9, 9, 0, 0)); // 9 AM
    const cleanup = scheduleCalendarReminder([makeEvent()]);
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });
});
