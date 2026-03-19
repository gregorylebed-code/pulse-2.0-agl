import { supabase } from '../lib/supabase';

const TEXT_TABLES = ['notes','students','tasks','reports','calendar_events','indicators','comm_types','classes'] as const;

export async function migrateLocalDataToUser(userId: string): Promise<void> {
  const flag = `pulse_migrated_${userId}`;
  const flagV2 = `pulse_migrated_v2_${userId}`;
  if (localStorage.getItem(flagV2)) return;
  // Clear old v1 flag so migration re-runs with the null-row fix
  localStorage.removeItem(flag);

  const errors: string[] = [];
  for (const table of TEXT_TABLES) {
    // Claim rows with user_id = 'local' (created while app was running after column was added)
    const { error: e1 } = await (supabase.from(table) as any).update({ user_id: userId }).eq('user_id', 'local');
    if (e1) errors.push(`${table} (local): ${e1.message}`);
    // Claim rows with user_id = NULL (existing data from before the user_id column existed)
    const { error: e2 } = await (supabase.from(table) as any).update({ user_id: userId }).is('user_id', null);
    if (e2) errors.push(`${table} (null): ${e2.message}`);
  }

  // Settings rows also have NULL user_id
  const { error: se } = await supabase.from('settings').update({ user_id: userId }).is('user_id', null);
  if (se) errors.push(`settings: ${se.message}`);

  if (errors.length === 0) {
    localStorage.setItem(flagV2, 'true');
  } else {
    console.warn('Migration had errors (will retry next login):', errors);
  }
}
