import React, { useEffect, useRef, useState } from 'react';
import { FileText, Clock, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';

const NOTE_EMOJIS: Record<number, string> = { 10: '🌱', 25: '📈', 50: '🔥', 100: '⭐', 250: '🏆' };
const REPORT_EMOJIS: Record<number, string> = { 1: '✨', 5: '📋', 10: '🎯', 25: '🏅' };

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const raf = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(start + diff * eased));
      if (t < 1) requestAnimationFrame(raf);
      else prevTarget.current = target;
    };
    requestAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

interface StatsCardProps {
  notesCreated: number;
  reportsGenerated: number;
}

const NOTE_MILESTONES   = [10, 25, 50, 100, 250, 500];
const REPORT_MILESTONES = [1, 5, 10, 25, 50];
const HOUR_MILESTONES   = [1, 5, 10, 25, 50];

function MilestonePips({ value, milestones, color }: { value: number; milestones: number[]; color: string }) {
  return (
    <div className="flex gap-1 mt-2 flex-wrap">
      {milestones.map(m => (
        <span
          key={m}
          className={cn(
            'px-2 py-0.5 rounded-full text-[9px] font-black border transition-all',
            value >= m
              ? `${color} border-transparent`
              : 'bg-slate-50 text-slate-300 border-slate-100'
          )}
        >
          {m >= 1000 ? `${m / 1000}k` : m}
        </span>
      ))}
    </div>
  );
}

function getMotivationalMessage(notes: number): string {
  if (notes === 0)   return "Start adding notes to track your impact!";
  if (notes < 10)    return "Just getting started! 🌱";
  if (notes < 50)    return "Building great habits! 📈";
  if (notes < 100)   return "You're on a roll! 🔥";
  if (notes < 250)   return "Super Note-Taker! ⭐";
  return "ShortHand Legend! 🏆";
}

export default function StatsCard({ notesCreated, reportsGenerated }: StatsCardProps) {
  const animatedNotes = useCountUp(notesCreated);
  const animatedReports = useCountUp(reportsGenerated);
  const hoursSaved = Math.round(((notesCreated * 3) + (reportsGenerated * 15)) / 60 * 10) / 10;
  const animatedHours = useCountUp(hoursSaved * 10) / 10;

  const [burstEmoji, setBurstEmoji] = useState<string | null>(null);
  const prevNotes = useRef(notesCreated);
  const prevReports = useRef(reportsGenerated);
  useEffect(() => {
    const noteEmoji = Object.entries(NOTE_EMOJIS).find(([m]) => prevNotes.current < +m && notesCreated >= +m)?.[1];
    if (noteEmoji) { setBurstEmoji(noteEmoji); setTimeout(() => setBurstEmoji(null), 2000); }
    prevNotes.current = notesCreated;
  }, [notesCreated]);
  useEffect(() => {
    const repEmoji = Object.entries(REPORT_EMOJIS).find(([m]) => prevReports.current < +m && reportsGenerated >= +m)?.[1];
    if (repEmoji) { setBurstEmoji(repEmoji); setTimeout(() => setBurstEmoji(null), 2000); }
    prevReports.current = reportsGenerated;
  }, [reportsGenerated]);

  return (
    <div className="relative bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6 overflow-hidden">
      <AnimatePresence>
        {burstEmoji && (
          <motion.div
            key={burstEmoji + Date.now()}
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: [0.5, 1.4, 1], opacity: [0, 1, 1], y: [20, -10, -30] }}
            exit={{ opacity: 0, y: -60, scale: 0.8 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="absolute top-6 right-8 text-5xl pointer-events-none z-10 select-none"
          >
            {burstEmoji}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-black text-blue-600 ml-1 font-display">Your Impact</h3>
        <span className="text-sm">{getMotivationalMessage(notesCreated)}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Notes */}
        <div className="bg-orange-50 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-orange-400">
            <BookOpen className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Notes</span>
          </div>
          <p className="text-[32px] font-black text-orange-500 font-display">{animatedNotes}</p>
          <p className="text-[9px] text-orange-300 font-bold">scribbled</p>
        </div>

        {/* Reports */}
        <div className="bg-sage/10 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-sage">
            <FileText className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Reports</span>
          </div>
          <p className="text-[32px] font-black text-sage-dark font-display">{animatedReports}</p>
          <p className="text-[9px] text-sage/60 font-bold">generated</p>
        </div>

        {/* Hours saved */}
        <div className="bg-blue-50 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-blue-400">
            <Clock className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Saved</span>
          </div>
          <p className="text-[32px] font-black text-blue-500 font-display">{animatedHours}h</p>
          <p className="text-[9px] text-blue-300 font-bold">estimated</p>
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-slate-50">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes milestones</p>
          <MilestonePips value={notesCreated} milestones={NOTE_MILESTONES} color="bg-orange-100 text-orange-500" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reports milestones</p>
          <MilestonePips value={reportsGenerated} milestones={REPORT_MILESTONES} color="bg-sage/15 text-sage-dark" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hours saved milestones</p>
          <MilestonePips value={hoursSaved} milestones={HOUR_MILESTONES} color="bg-blue-100 text-blue-500" />
        </div>
      </div>
    </div>
  );
}
