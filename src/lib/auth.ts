import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, loading: false });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, session, loading: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}

export const signIn  = (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
export const signUp  = (email: string, password: string) => supabase.auth.signUp({ email, password });
export const signOut = () => supabase.auth.signOut();
