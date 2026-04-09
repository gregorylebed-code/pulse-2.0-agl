import { supabase } from './supabase';

// Generate or reuse a session ID for this browser tab
const sessionId = (() => {
  const key = 'cp_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
})();

export async function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  try {
    await supabase.from('analytics_events').insert({
      event_name: eventName,
      session_id: sessionId,
      properties: properties ?? null,
    });
  } catch {
    // Never let analytics errors surface to the user
  }
}
