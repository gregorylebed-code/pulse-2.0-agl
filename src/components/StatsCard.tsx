import React from 'react';
import { FileText, Clock, BookOpen } from 'lucide-react';
import { cn } from '../utils/cn';

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
  const hoursSaved = Math.round(((notesCreated * 3) + (reportsGenerated * 15)) / 60 * 10) / 10;

  return (
    <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
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
          <p className="text-[32px] font-black text-orange-500 font-display">{notesCreated}</p>
          <p className="text-[9px] text-orange-300 font-bold">scribbled</p>
        </div>

        {/* Reports */}
        <div className="bg-sage/10 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-sage">
            <FileText className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Reports</span>
          </div>
          <p className="text-[32px] font-black text-sage-dark font-display">{reportsGenerated}</p>
          <p className="text-[9px] text-sage/60 font-bold">generated</p>
        </div>

        {/* Hours saved */}
        <div className="bg-blue-50 rounded-2xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-blue-400">
            <Clock className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Saved</span>
          </div>
          <p className="text-[32px] font-black text-blue-500 font-display">{hoursSaved}h</p>
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
