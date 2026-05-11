import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, PenLine, ChevronRight, Sparkles, Zap, FlaskConical, X } from 'lucide-react';

interface WelcomeModalProps {
  show: boolean;
  teacherName: string;
  isDemo?: boolean;
  onGoToProfile: () => void;
  onGoToRoster: () => void;
  onGoToPulse: () => void;
  onGoToCalendar: () => void;
  onDismiss: () => void;
  onAddStudents: (names: string[], isDemo?: boolean) => Promise<void>;
  onGoToStudents?: () => void;
  onSwitchFromDemo?: () => void;
}

type Screen = 'main' | 'add-real';

const DEMO_STUDENTS = [
  'Falcon', 'Blueberry', 'Math-Wiz', 'Rocket', 'Zigzag', 'Panda', 'Thunderbolt', 'Comet',
];

export default function WelcomeModal({
  show,
  teacherName,
  isDemo = false,
  onGoToProfile,
  onGoToRoster,
  onGoToPulse,
  onGoToCalendar,
  onDismiss,
  onAddStudents,
  onGoToStudents,
  onSwitchFromDemo,
}: WelcomeModalProps) {
  const [screen, setScreen] = useState<Screen>('main');
  const [nicknames, setNicknames] = useState<string[]>(Array(5).fill(''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filledNicknames = nicknames.map(n => n.trim()).filter(Boolean);
  const isValid = filledNicknames.length >= 1;

  function handleNicknameChange(index: number, value: string) {
    setNicknames(prev => {
      const next = [...prev];
      next[index] = value;
      if (index === next.length - 1 && value.trim()) {
        next.push('');
      }
      return next;
    });
    setError('');
  }

  function handleNicknameKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.getElementById(`nickname-${index + 1}`);
      if (nextInput) (nextInput as HTMLInputElement).focus();
    }
  }

  async function handleSandbox() {
    setSaving(true);
    await onAddStudents(DEMO_STUDENTS, true);
    setSaving(false);
    onDismiss();
  }

  async function handleRealClass() {
    if (!isValid) {
      setError('Add at least one name to get started.');
      return;
    }
    setSaving(true);
    await onAddStudents(filledNicknames, false);
    setSaving(false);
    onDismiss();
  }

  // Demo mode screen (existing demo account view — unchanged)
  if (isDemo) {
    return (
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="bg-white px-8 pt-8 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center">
                    <FlaskConical className="w-5 h-5 text-violet-500" />
                  </div>
                  <span className="text-violet-400 text-xs font-bold uppercase tracking-widest">Demo Mode</span>
                </div>
                <h1 className="text-slate-800 font-black text-2xl leading-tight">
                  Welcome! Here's your demo class. 👋
                </h1>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                  8 fake students are loaded with notes. Tap around, try everything — nothing is saved to a real account.
                </p>
              </div>
              <div className="px-6 py-5 space-y-3">
                <button
                  type="button"
                  onClick={onGoToPulse}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-sage/30 bg-sage/5 hover:border-sage/60 hover:bg-sage/10 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl border border-sage/30 bg-sage/10 flex items-center justify-center flex-shrink-0 text-sage">
                    <PenLine className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-black text-slate-800">Add a note on a student</span>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Tap a student, pick a tag, see the AI draft a parent message.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                </button>
                <button
                  type="button"
                  onClick={onGoToStudents ?? onDismiss}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl border border-blue-100 bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-500">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-black text-slate-800">Browse the student roster</span>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">See how behavior history is tracked per student.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                </button>
              </div>
              <div className="px-6 pb-6 flex flex-col gap-2">
                {onSwitchFromDemo && (
                  <button
                    type="button"
                    onClick={onSwitchFromDemo}
                    className="w-full py-4 bg-sage text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-sage/20"
                  >
                    Save my class for free →
                  </button>
                )}
                <button type="button" onClick={onDismiss} className="text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors text-center">
                  Just let me explore
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl"
          >
            {screen === 'main' ? (
              <>
                {/* Header */}
                <div className="bg-white px-8 pt-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-blue-500" />
                    </div>
                    <span className="text-blue-400 text-xs font-bold uppercase tracking-widest">ShortHand</span>
                  </div>
                  <h1 className="text-blue-700 font-black text-2xl leading-tight">
                    Welcome{teacherName ? `, ${teacherName}` : ''}! 👋
                  </h1>
                  <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                    You're all set up. See what ShortHand can do — or jump straight in with your real class.
                  </p>
                </div>

                {/* Two choices */}
                <div className="px-6 pt-5 pb-6 space-y-3">

                  {/* Sandbox — primary */}
                  <button
                    type="button"
                    onClick={handleSandbox}
                    disabled={saving}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100 transition-all text-left group disabled:opacity-60"
                  >
                    <div className="w-10 h-10 rounded-xl border border-violet-200 bg-violet-100 flex items-center justify-center flex-shrink-0 text-violet-600">
                      <FlaskConical className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800">Explore with sample students</span>
                        <span className="text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-200 text-violet-700">Try first</span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5 leading-snug">8 demo students load instantly — see AI parent emails, behavior history, and insights before adding your real class.</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                  </button>

                  {/* Real class — secondary */}
                  <button
                    type="button"
                    onClick={() => setScreen('add-real')}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl border border-sage/30 bg-sage/10 flex items-center justify-center flex-shrink-0 text-sage">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-black text-slate-800">I'm ready to add my real class</span>
                      <p className="text-xs text-slate-400 font-medium mt-0.5 leading-snug">Type first names or nicknames — no last names needed. Takes 2 minutes.</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={onGoToRoster}
                    className="w-full text-center text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors pt-1"
                  >
                    Upload a roster or connect Google Classroom →
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Add real class screen */}
                <div className="bg-sage px-8 pt-8 pb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white/80 text-xs font-bold uppercase tracking-widest">Add Your Class</span>
                    </div>
                    <button type="button" onClick={() => setScreen('main')} className="flex items-center gap-1 text-white/70 hover:text-white transition-colors text-xs font-bold">
                      <X className="w-4 h-4" /> Back
                    </button>
                  </div>
                  <h1 className="text-white font-black text-2xl leading-tight">Add your students</h1>
                  <p className="text-white/75 text-sm mt-2 leading-relaxed">
                    Use real names, nicknames, or codes. You can always change them later.
                  </p>
                </div>

                <div className="px-6 py-5">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                    Names · <span className="text-sage">{filledNicknames.length} added</span>
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {nicknames.map((val, i) => (
                      <input
                        key={i}
                        id={`nickname-${i}`}
                        type="text"
                        value={val}
                        onChange={e => handleNicknameChange(i, e.target.value)}
                        onKeyDown={e => handleNicknameKeyDown(i, e)}
                        placeholder={`Student ${i + 1} — e.g. "Falcon", "Table 3", "J.R."`}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition-all"
                      />
                    ))}
                  </div>
                  {error && <p className="text-xs text-red-500 font-medium mt-2">{error}</p>}
                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                    💡 Nicknames, seat numbers, or initials all work. Real names are never required.
                  </p>
                </div>

                <div className="px-6 pb-6 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleRealClass}
                    disabled={saving || !isValid}
                    className="w-full py-4 bg-sage text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-sage/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Adding students…' : `Add ${filledNicknames.length > 0 ? filledNicknames.length + ' ' : ''}Students & Start →`}
                  </button>
                  <button type="button" onClick={() => setScreen('main')} className="text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors text-center">
                    ← Back
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
