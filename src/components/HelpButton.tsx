import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Pencil, FileText, Map } from 'lucide-react';

const tips = [
  {
    icon: <Pencil className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />,
    title: 'How to log a note',
    body: 'Tap the Log Notes tab at the bottom. Then tap any student — speak or type your note and hit Save. Done in under 5 seconds.',
  },
  {
    icon: <FileText className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />,
    title: 'How to create a report',
    body: 'Go to the Students tab, tap a student to open their profile, then tap "Write Report." Choose Quick Note, Standard, or Detailed.',
  },
  {
    icon: <Map className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />,
    title: 'Where to find everything',
    body: 'Log Notes tab → log notes on students. Students tab → view profiles, write reports, see history. Settings → your roster and preferences.',
  },
];

export default function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-28 right-4 z-50 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden no-print"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="font-black text-slate-800 text-sm tracking-wide">Quick Help</span>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {tips.map((tip) => (
                <div key={tip.title} className="flex gap-3 px-5 py-4">
                  {tip.icon}
                  <div>
                    <div className="font-bold text-slate-800 text-sm mb-1">{tip.title}</div>
                    <div className="text-slate-500 text-xs leading-relaxed">{tip.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.08 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        className="fixed bottom-24 right-4 z-50 w-11 h-11 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-teal-500 transition-colors no-print"
        aria-label="Help"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="w-5 h-5" /></motion.span>
            : <motion.span key="q" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><HelpCircle className="w-5 h-5" /></motion.span>
          }
        </AnimatePresence>
      </motion.button>
    </>
  );
}
