import { supabase } from '../lib/supabase';

const TEXT_TABLES = ['notes','students','tasks','reports','calendar_events','indicators','comm_types','classes'] as const;

export async function migrateLocalDataToUser(userId: string): Promise<void> {
  const flag = `pulse_migrated_${userId}`;
  if (localStorage.getItem(flag)) return;

  const errors: string[] = [];
  for (const table of TEXT_TABLES) {
    const { error } = await (supabase.from(table) as any).update({ user_id: userId }).eq('user_id', 'local');
    if (error) errors.push(`${table}: ${error.message}`);
  }

  // Settings rows have NULL user_id (column was just added)
  const { error: se } = await supabase.from('settings').update({ user_id: userId }).is('user_id', null);
  if (se) errors.push(`settings: ${se.message}`);

  if (errors.length === 0) {
    localStorage.setItem(flag, 'true');
  } else {
    console.warn('Migration had errors (will retry next login):', errors);
  }
}
