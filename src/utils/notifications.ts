import type { CalendarEvent } from '../types';

export interface NotificationPrefs {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // "HH:MM" 24-hour format
  calendarEventReminderEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dailyReminderEnabled: false,
  dailyReminderTime: '14:00',
  calendarEventReminderEnabled: false,
};

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function notificationsSupported(): boolean {
  return 'Notification' in window;
}

function fireNotification(title: string, body: string, tag: string) {
  if (Notification.permission !== 'granted') return;
  const opts: NotificationOptions = { body, icon: '/icon-192.png', badge: '/icon-192.png', tag };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, opts))
      .catch(() => new Notification(title, opts));
  } else {
    new Notification(title, opts);
  }
}

// Schedule the daily logging reminder.
// Returns a cleanup function that cancels the scheduled notification.
export function scheduleDailyReminder(time: string, hasNotesToday: boolean): () => void {
  // Skip if teacher already logged notes today
  if (hasNotesToday) return () => {};

  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // Already past the reminder time today
  if (target <= now) return () => {};

  const id = setTimeout(() => {
    fireNotification(
      '📝 Classroom Pulse',
      "Don't forget to log today's observations!",
      'daily-reminder'
    );
  }, target.getTime() - now.getTime());

  return () => clearTimeout(id);
}

// Schedule a calendar event reminder for today's events.
// Fires at 8 AM, or immediately if opened after 8 AM and not yet shown today.
// Returns a cleanup function.
export function scheduleCalendarReminder(todayEvents: CalendarEvent[]): () => void {
  if (todayEvents.length === 0) return () => {};

  const todayKey = new Date().toISOString().split('T')[0];
  const shownKey = `cp_cal_notif_${todayKey}`;

  // Already shown this reminder today
  if (localStorage.getItem(shownKey)) return () => {};

  const now = new Date();
  const eightAM = new Date();
  eightAM.setHours(8, 0, 0, 0);

  const label =
    todayEvents.length === 1
      ? todayEvents[0].title
      : `${todayEvents[0].title} + ${todayEvents.length - 1} more`;

  const fire = () => {
    localStorage.setItem(shownKey, '1');
    fireNotification(`📅 Today: ${label}`, 'Tap to open Classroom Pulse', 'calendar-reminder');
  };

  if (eightAM <= now) {
    // Already past 8 AM — fire after a short delay so the app is fully loaded
    const id = setTimeout(fire, 1500);
    return () => clearTimeout(id);
  }

  const id = setTimeout(fire, eightAM.getTime() - now.getTime());
  return () => clearTimeout(id);
}
