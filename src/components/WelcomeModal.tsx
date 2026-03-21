import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Users, PenLine, Calendar, ChevronRight, Sparkles } from 'lucide-react';

interface WelcomeModalProps {
  show: boolean;
  teacherName: string;
  onGoToProfile: () => void;
  onGoToRoster: () => void;
  onGoToPulse: () => void;
  onGoToCalendar: () => void;
  onDismiss: () => void;
}

const steps = [
  {
    icon: <User className="w-5 h-5" />,
    color: 'bg-sage/10 text-sage border-sage/20',
    title: 'Set up your profile',
    desc: 'Add your name and school so AI reports sign off correctly.',
    action: 'onGoToProfile' as const,
    badge: 'Start here',
  },
  {
    icon: <Users className="w-5 h-5" />,
    color: 'bg-blue-50 text-blue-500 border-blue-100',
    title: 'Add your students',
    desc: 'Import a roster CSV or add students one by one.',
    action: 'onGoToRoster' as const,
    badge: null,
  },
  {
    icon: <PenLine className="w-5 h-5" />,
    color: 'bg-amber-50 text-amber-500 border-amber-100',
    title: 'Log your first note',
    desc: 'Tap a student, type an observation, done in 10 seconds.',
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
}: WelcomeModalProps) {
  const handlers = { onGoToProfile, onGoToRoster, onGoToPulse, onGoToCalendar };

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
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="bg-sage px-8 pt-8 pb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-white/80 text-xs font-bold uppercase tracking-widest">Classroom Pulse</span>
              </div>
              <h1 className="text-white font-black text-2xl leading-tight">
                Welcome{teacherName ? `, ${teacherName}` : ''}! 👋
              </h1>
              <p className="text-white/75 text-sm mt-2 leading-relaxed">
                You're all set up. Here's how to get the most out of Pulse in the next few minutes.
              </p>
            </div>

            {/* Steps */}
            <div className="px-6 py-5 space-y-3">
              {steps.map((step) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => {
                    handlers[step.action]();
                    onDismiss();
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left group"
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${step.color}`}>
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-800">{step.title}</span>
                      {step.badge && (
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          step.badge === 'Start here'
                            ? 'bg-sage/10 text-sage'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {step.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5 leading-snug">{step.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-4 bg-sage text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-sage/20"
              >
                Let's Go →
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
