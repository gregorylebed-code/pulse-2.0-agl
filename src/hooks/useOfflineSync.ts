import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getAllQueued, dequeueNote, getQueueCount } from '../lib/offlineQueue';
import { toast } from 'sonner';

// Drains the offline note queue whenever the device comes back online.
export function useOfflineSync(userId: string, onSynced: () => void) {
  const isSyncing = useRef(false);

  const drain = async () => {
    if (isSyncing.current) return;
    const queued = await getAllQueued();
    if (queued.length === 0) return;

    isSyncing.current = true;
    const toastId = toast.loading(`Syncing ${queued.length} offline note${queued.length > 1 ? 's' : ''}…`);

    let synced = 0;
    for (const entry of queued) {
      if (entry.userId !== userId) continue;
      try {
        const { error } = await supabase
          .from('notes')
          .insert([{
            ...entry.note,
            user_id: userId,
            created_at: entry.createdAt ?? entry.queuedAt,
          }]);
        if (!error) {
          await dequeueNote(entry.id);
          synced++;
        }
      } catch {
        // network still down — leave it in the queue
      }
    }

    isSyncing.current = false;
    toast.dismiss(toastId);
    if (synced > 0) {
      toast.success(`${synced} note${synced > 1 ? 's' : ''} synced`);
      onSynced();
    }
  };

  // Drain on mount (in case they were offline last session) and on reconnect
  useEffect(() => {
    getQueueCount().then(count => { if (count > 0) drain(); });
    window.addEventListener('online', drain);
    return () => window.removeEventListener('online', drain);
  }, [userId]);
}
