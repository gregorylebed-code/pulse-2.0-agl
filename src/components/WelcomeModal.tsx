import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Users, PenLine, Calendar, ChevronRight, Sparkles, Zap, FlaskConical, X } from 'lucide-react';

const DEMO_STUDENTS = [
  'Falcon', 'Blueberry', 'Math-Wiz', 'Rocket', 'Zigzag', 'Panda', 'Thunderbolt', 'Comet',
];

interface WelcomeModalProps {
  show: boolean;
  teacherName: string;
  onGoToProfile: () => void;
  onGoToRoster: () => void;
  onGoToPulse: () => void;
  onGoToCalendar: () => void;
  onDismiss: () => void;
  onAddStudents: (names: string[]) => Promise<void>;
}

type Screen = 'main' | 'quick-start';

const profileStep = {
  icon: <User className="w-5 h-5" />,
  color: 'bg-sage/10 text-sage border-sage/20',
  title: 'Set up your profile',
  desc: 'Add your name and school so composed reports sign off correctly.',
  action: 'onGoToProfile' as const,
  badge: 'Start here',
};

const otherSteps = [
  {
    icon: <PenLine className="w-5 h-5" />,
    color: 'bg-amber-50 text-amber-500 border-amber-100',
    title: 'Add your first note',
    desc: 'Tap a student, tap an indicator, done in 10 seconds.',
    action: 'onGoToPulse' as const,
    badge: null,
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    color: 'bg-violet-50 text-violet-500 border-violet-100',
    title: 'Upload your school calendar',
    desc: 'Get specials rotation and event reminders automatically.',
    action: 'onGoToCalendar' as const,
    badge: 'Optional',
  },
];

export default function WelcomeModal({
  show,
  teacherName,
  onGoToProfile,
  onGoToRoster,
  onGoToPulse,
  onGoToCalendar,
  onDismiss,
  onAddStudents,
}: WelcomeModalProps) {
  const [screen, setScreen] = useState<Screen>('main');
  const [nicknames, setNicknames] = useState<string[]>(Array(5).fill(''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlers = { onGoToProfile, onGoToRoster, onGoToPulse, onGoToCalendar };

  const filledNicknames = nicknames.map(n => n.trim()).filter(Boolean);
  const isValid = filledNicknames.length >= 3;

  function handleNicknameChange(index: number, value: string) {
    setNicknames(prev => {
      const next = [...prev];
      next[index] = value;
      // Auto-expand up to 10 rows: if last row is being typed in, add a new blank row
      if (index === next.length - 1 && value.trim() && next.length < 10) {
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

  async function handleQuickStart() {
    if (!isValid) {
      setError('Add at least 3 names to get started.');
      return;
    }
    setSaving(true);
    await onAddStudents(filledNicknames);
    setSaving(false);
    onDismiss();
  }

  async function handleDemoMode() {
    setSaving(true);
    await onAddStudents(DEMO_STUDENTS);
    setSaving(false);
    onDismiss();
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
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
                <div className="bg-sage px-8 pt-8 pb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white/80 text-xs font-bold uppercase tracking-widest">ShortHand</span>
                  </div>
                  <h1 className="text-white font-black text-2xl leading-tight">
                    Welcome{teacherName ? `, ${teacherName}` : ''}! 👋
                  </h1>
                  <p className="text-white/75 text-sm mt-2 leading-relaxed">
                    You're all set up. Let's get your students in here.
                  </p>
                </div>

                {/* Student setup choices */}
                <div className="px-6 pt-5 pb-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">How do you want to add students?</p>
                  <div className="space-y-3">

                    {/* Quick Start */}
                    <button
                      type="button"
                      onClick={() => setScreen('quick-start')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-sage/30 bg-sage/5 hover:border-sage/60 hover:bg-sage/10 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl border border-sage/30 bg-sage/10 flex items-center justify-center flex-shrink-0 text-sage">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800">Quick Start</span>
                          <span className="text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sage/10 text-sage">Recommended</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 leading-snug">Type 3–10 nicknames or code names. No real data needed.</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                    </button>

                    {/* Full Class */}
                    <button
                      type="button"
                      onClick={onGoToRoster}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl border border-blue-100 bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-500">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-black text-slate-800">Upload My Class</span>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 leading-snug">Paste your roster or import from Google Classroom.</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                    </button>

                    {/* Demo Mode */}
                    <button
                      type="button"
                      onClick={handleDemoMode}
                      disabled={saving}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left group disabled:opacity-60"
                    >
                      <div className="w-10 h-10 rounded-xl border border-violet-100 bg-violet-50 flex items-center justify-center flex-shrink-0 text-violet-500">
                        <FlaskConical className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-black text-slate-800">Just Let Me Click Around</span>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 leading-snug">We'll load 8 fake students so you can explore with zero setup.</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                    </button>

                  </div>
                </div>

                {/* Profile + other steps */}
                <div className="px-6 pb-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 mt-4">Also worth doing</p>
                  <div className="space-y-2">
                    {[profileStep, ...otherSteps].map((step) => (
                      <button
                        key={step.title}
                        type="button"
                        onClick={() => handlers[step.action]()}
                        className="w-full flex items-center gap-4 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left group"
                      >
                        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${step.color}`}>
                          {step.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-700">{step.title}</span>
                            {step.badge && (
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                step.badge === 'Start here' ? 'bg-sage/10 text-sage' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {step.badge}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2 flex justify-center">
                  <button type="button" onClick={onDismiss} className="text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors">
                    Skip for now
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Quick Start screen */}
                <div className="bg-sage px-8 pt-8 pb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white/80 text-xs font-bold uppercase tracking-widest">Quick Start</span>
                    </div>
                    <button type="button" onClick={() => setScreen('main')} className="text-white/60 hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <h1 className="text-white font-black text-2xl leading-tight">Add your students</h1>
                  <p className="text-white/75 text-sm mt-2 leading-relaxed">
                    Use real names, nicknames, or codes — whatever you're comfortable with. You can always change them later.
                  </p>
                </div>

                <div className="px-6 py-5">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                    Names (3–10) · <span className="text-sage">{filledNicknames.length} added</span>
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
                    💡 You can use nicknames, seat numbers, or codes. Real names are never required.
                  </p>
                </div>

                <div className="px-6 pb-6 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleQuickStart}
                    disabled={saving || !isValid}
                    className="w-full py-4 bg-sage text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-sage/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Adding students…' : `Add ${filledNicknames.length || ''}${filledNicknames.length ? ' ' : ''}Students & Start →`}
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
