import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Send, Loader2, CheckCircle2, Pencil, FileText, Map, MessageCircle, GraduationCap, ChevronRight, BookOpen, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

const NTFY_TOPIC = 'pulse-feedback-greg-1976';
const APP_VERSION = '1.0';

const CATEGORIES = [
  { value: 'Bug',     label: 'Bug Report',       emoji: '🐛', selectedClass: 'bg-red-50 border-red-300 text-red-600' },
  { value: 'Feature', label: 'Feature Request',  emoji: '✨', selectedClass: 'bg-blue-50 border-blue-300 text-blue-600' },
  { value: 'Praise',  label: 'Praise',            emoji: '❤️', selectedClass: 'bg-emerald-50 border-emerald-300 text-emerald-600' },
] as const;

type Category = typeof CATEGORIES[number]['value'];
type Panel = 'menu' | 'help' | 'feedback' | 'switch-confirm';

type NavAction = 'pulse' | 'students' | 'settings-import' | 'settings-getting-started' | null;

const tips: { icon: React.ReactNode; title: string; body: string; action: NavAction }[] = [
  {
    icon: <Pencil className="w-5 h-5 text-teal-500 flex-shrink-0" />,
    title: 'How to log a note',
    body: 'Tap the Log Notes tab at the bottom. Speak or type your note and hit Save.',
    action: 'pulse',
  },
  {
    icon: <FileText className="w-5 h-5 text-purple-500 flex-shrink-0" />,
    title: 'How to create a report',
    body: 'Go to the Students tab, tap a student, then tap "Write Reports."',
    action: 'students',
  },
  {
    icon: <Map className="w-5 h-5 text-orange-400 flex-shrink-0" />,
    title: 'Where to find everything',
    body: 'Log Notes → students. Students → profiles & reports. Settings → roster & preferences.',
    action: null,
  },
  {
    icon: <GraduationCap className="w-5 h-5 text-blue-500 flex-shrink-0" />,
    title: 'Import from Google Classroom',
    body: 'Connect Google Classroom in Settings to import your roster and student photos automatically.',
    action: 'settings-import',
  },
  {
    icon: <BookOpen className="w-5 h-5 text-sage flex-shrink-0" />,
    title: 'Getting Started checklist',
    body: 'Find the Getting Started guide at the top of Settings to walk through setup step by step.',
    action: 'settings-getting-started',
  },
];

interface FeedbackModalProps {
  currentView: string;
  onNavigate: (action: NonNullable<NavAction>) => void;
  onSwitchToRealClass?: () => void;
}

export default function FeedbackModal({ currentView, onNavigate, onSwitchToRealClass }: FeedbackModalProps) {
  const [panel, setPanel]              = useState<Panel | null>(null);
  const [category, setCategory]        = useState<Category>('Feature');
  const [message, setMessage]          = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted]      = useState(false);

  const close = () => setPanel(null);

  const openFeedback = () => {
    setSubmitted(false);
    setMessage('');
    setCategory('Feature');
    setPanel('feedback');
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        category,
        message: message.trim(),
        app_version: APP_VERSION,
        current_view: currentView,
      });
      if (error) throw error;

      fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: { 'Title': `ShortHand Feedback — ${category}`, 'Priority': 'default' },
        body: `${message.trim()}\n\nScreen: ${currentView}`,
      }).catch(() => {});

      setSubmitted(true);
      setTimeout(() => close(), 2200);
    } catch {
      toast.error('Could not send feedback — check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const placeholder =
    category === 'Bug'     ? 'Describe what happened and what you expected...' :
    category === 'Feature' ? 'What would make ShortHand better for you?' :
                             "What's going well?";

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {panel && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 no-print"
            onClick={close}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence mode="wait">
        {panel === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-28 left-4 z-50 w-56 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden no-print"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <span className="font-black text-slate-800 text-sm">How can we help?</span>
              <button onClick={close} className="text-slate-300 hover:text-slate-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 flex flex-col gap-1">
              <button
                onClick={() => setPanel('help')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-left w-full"
              >
                <HelpCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
                <span className="text-sm font-bold text-slate-700">How does this work?</span>
              </button>
              <button
                onClick={openFeedback}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-left w-full"
              >
                <MessageCircle className="w-4 h-4 text-sage flex-shrink-0" />
                <span className="text-sm font-bold text-slate-700">Send feedback</span>
              </button>
              {onSwitchToRealClass && (
                <button
                  onClick={() => setPanel('switch-confirm')}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-violet-50 transition-colors text-left w-full"
                >
                  <RefreshCw className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <span className="text-sm font-bold text-violet-600">Switch to my real class</span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {panel === 'switch-confirm' && (
          <motion.div
            key="switch-confirm"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-28 left-4 z-50 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden no-print"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <button onClick={() => setPanel('menu')} className="text-slate-300 hover:text-slate-500 transition-colors text-sm">←</button>
              <span className="font-black text-slate-800 text-sm">Switch class</span>
              <button onClick={close} className="text-slate-300 hover:text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">This will remove your current students and notes so you can start fresh with your real class. This can't be undone.</p>
              <button
                onClick={() => { onSwitchToRealClass!(); close(); }}
                className="w-full py-2.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-black rounded-2xl transition-colors mb-2"
              >
                Yes, switch to my real class
              </button>
              <button
                onClick={() => setPanel('menu')}
                className="w-full py-2 text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {panel === 'help' && (
          <motion.div
            key="help"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="fixed bottom-28 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-white rounded-[32px] shadow-2xl z-50 p-8 border border-slate-100 no-print"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-2">
                <button onClick={() => setPanel('menu')} className="text-slate-300 hover:text-slate-500 transition-colors text-sm">←</button>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Quick Help</h3>
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5 tracking-wide">How things work</p>
                </div>
              </div>
              <button onClick={close} className="p-2 text-slate-300 hover:text-slate-500 rounded-xl hover:bg-slate-50 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tips.map((tip) => {
                const Tag = tip.action ? 'button' : 'div';
                return (
                  <Tag
                    key={tip.title}
                    onClick={tip.action ? () => { onNavigate(tip.action!); close(); } : undefined}
                    className={`bg-slate-50 rounded-2xl p-4 flex flex-col gap-2 text-left ${tip.action ? 'hover:bg-slate-100 transition-colors cursor-pointer' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      {tip.icon}
                      {tip.action && <ChevronRight className="w-3 h-3 text-slate-300" />}
                    </div>
                    <div className="font-black text-slate-800 text-xs">{tip.title}</div>
                    <div className="text-slate-500 text-[11px] leading-relaxed">{tip.body}</div>
                  </Tag>
                );
              })}
            </div>
          </motion.div>
        )}

        {panel === 'feedback' && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="fixed bottom-28 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-white rounded-[32px] shadow-2xl z-50 p-8 border border-slate-100 no-print"
          >
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-6"
                >
                  <div className="w-16 h-16 bg-sage/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-sage" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-black text-slate-900 text-lg">Thanks! 🎉</h3>
                    <p className="text-sm text-slate-400 mt-1 font-medium">Your feedback was sent.</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="form" className="space-y-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPanel('menu')} className="text-slate-300 hover:text-slate-500 transition-colors text-sm">←</button>
                      <div>
                        <h3 className="font-black text-slate-900 text-lg">Send Feedback</h3>
                        <p className="text-[11px] text-slate-400 font-bold mt-0.5 tracking-wide">v{APP_VERSION} · {currentView}</p>
                      </div>
                    </div>
                    <button onClick={close} className="p-2 text-slate-300 hover:text-slate-500 rounded-xl hover:bg-slate-50 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 text-[11px] font-black transition-all',
                          category === cat.value
                            ? cat.selectedClass
                            : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200'
                        )}
                      >
                        <span className="text-xl leading-none">{cat.emoji}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={placeholder}
                    rows={4}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage transition-all leading-relaxed font-medium"
                  />

                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || isSubmitting}
                    className="w-full py-4 bg-sage text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-sage-dark transition-all shadow-lg shadow-sage/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><Send className="w-4 h-4" /> Send Feedback</>}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single floating trigger */}
      <div className="fixed bottom-24 left-4 z-50 flex flex-col items-center gap-0.5 no-print">
        <motion.button
          onClick={() => setPanel(v => v ? null : 'menu')}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className="w-11 h-11 bg-teal-500 rounded-2xl shadow-lg flex items-center justify-center text-white hover:bg-teal-600 transition-colors"
          aria-label="Help and feedback"
        >
          <AnimatePresence mode="wait">
            {panel
              ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="w-5 h-5" /></motion.span>
              : <motion.span key="q" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><HelpCircle className="w-5 h-5" /></motion.span>
            }
          </AnimatePresence>
        </motion.button>
        <span className="text-[10px] font-black text-teal-600 tracking-wide pointer-events-none">Help</span>
      </div>
    </>
  );
}
