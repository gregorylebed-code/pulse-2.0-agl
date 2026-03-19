import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { cn } from '../utils/cn';


const APP_VERSION = '1.0';

const CATEGORIES = [
  { value: 'Bug',     label: 'Bug Report',       emoji: '🐛', selectedClass: 'bg-red-50 border-red-300 text-red-600' },
  { value: 'Feature', label: 'Feature Request',  emoji: '✨', selectedClass: 'bg-blue-50 border-blue-300 text-blue-600' },
  { value: 'Praise',  label: 'Praise',            emoji: '❤️', selectedClass: 'bg-emerald-50 border-emerald-300 text-emerald-600' },
] as const;

type Category = typeof CATEGORIES[number]['value'];

interface FeedbackModalProps {
  currentView: string;
}

export default function FeedbackModal({ currentView }: FeedbackModalProps) {
  const [isOpen, setIsOpen]           = useState(false);
  const [category, setCategory]       = useState<Category>('Feature');
  const [message, setMessage]         = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted]     = useState(false);

  const handleOpen = () => {
    setSubmitted(false);
    setMessage('');
    setCategory('Feature');
    setIsOpen(true);
  };

  const handleClose = () => setIsOpen(false);

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
      setSubmitted(true);
      setTimeout(() => setIsOpen(false), 2200);
    } catch {
      toast.error('Could not send feedback — check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const placeholder =
    category === 'Bug'     ? 'Describe what happened and what you expected...' :
    category === 'Feature' ? 'What would make Classroom Pulse better for you?' :
                             "What's going well?";

  return (
    <>
      {/* Floating trigger */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={handleOpen}
        title="Send feedback"
        className="fixed bottom-24 left-4 z-40 w-11 h-11 bg-white border border-slate-200 rounded-2xl shadow-lg flex items-center justify-center text-slate-400 hover:text-sage hover:border-sage/40 transition-colors no-print"
      >
        <MessageCircle className="w-5 h-5" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80] no-print"
            />

            {/* Modal */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="fixed bottom-28 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-white rounded-[32px] shadow-2xl z-[90] p-8 border border-slate-100 no-print"
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
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-black text-slate-900 text-lg">Send Feedback</h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-wide">
                          v{APP_VERSION} · {currentView}
                        </p>
                      </div>
                      <button
                        onClick={handleClose}
                        className="p-2 text-slate-300 hover:text-slate-500 rounded-xl hover:bg-slate-50 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Category pills */}
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

                    {/* Message */}
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder={placeholder}
                      rows={4}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage transition-all leading-relaxed font-medium"
                    />

                    {/* Submit */}
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
          </>
        )}
      </AnimatePresence>
    </>
  );
}
