import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { signIn, signUp } from '../lib/auth';
import { cn } from '../utils/cn';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password);
      if (authError) {
        setError(authError.message);
      }
    } catch (err: any) {
      setError(err.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-[32px] card-shadow border border-sage/5 p-8 w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-0.5">
            {['S','h','o','r','t','H','a','n','d'].map((letter, i) => {
              const colors = [
                'text-sage',
                'text-terracotta',
                'text-blue-400',
                'text-amber-400',
                'text-purple-400',
                'text-sage',
                'text-pink-400',
                'text-cyan-400',
                'text-terracotta',
              ];
              return (
                <motion.span
                  key={i}
                  className={`text-4xl font-black ${colors[i]}`}
                  animate={{ y: [0, -6, 0] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut',
                  }}
                  style={{ fontFamily: "'Boogaloo', cursive" }}
                >
                  {letter}
                </motion.span>
              );
            })}
          </div>
          <p className="text-sm text-slate-400 font-medium">Your classroom, organized.</p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-slate-100 rounded-2xl p-1">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(null); }}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-black transition-all',
              mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-black transition-all',
              mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
            )}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            required
            autoComplete="email"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
          />

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-2xl px-4 py-3 text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-sage text-white rounded-2xl font-black text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : mode === 'signin' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>

        {/* Toggle link */}
        <p className="text-center text-xs text-slate-400">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
            className="font-black text-sage hover:brightness-110 transition-all"
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
