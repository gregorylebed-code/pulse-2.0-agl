import React, { useState } from 'react';
import { Sparkles, Edit2, Plus, School, ChevronDown, ClipboardList, Beaker, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import ClassroomPulseLogo from './ClassroomPulseLogo';
import { getForecast } from '../utils/rotationHelpers';

interface Task { id: string; text: string; completed: boolean; color?: string; }

interface HeaderProps {
  userName: string;
  quote: string;
  tempName: string;
  setTempName: (v: string) => void;
  saveName: () => void;
  resetUserName: () => void;
  todayRotation: { letter: string; special: string } | null;
  showRotationForecast: boolean;
  setShowRotationForecast: (v: boolean) => void;
  rotationMapping: Record<string, string>;
  specialsNames: Record<string, string>;
  tasks: Task[];
  setShowTasks: (v: boolean) => void;
}

const getGreeting = (name: string) => {
  const hour = new Date().getHours();
  const isFriday = new Date().getDay() === 5;
  let base = hour < 12 ? `Good morning, ${name}!` : `Good afternoon, ${name}!`;
  if (isFriday) base += ' Happy Friday! 🎉';
  return base;
};

export default function Header({
  userName,
  quote,
  tempName,
  setTempName,
  saveName,
  resetUserName,
  todayRotation,
  showRotationForecast,
  setShowRotationForecast,
  rotationMapping,
  specialsNames,
  tasks,
  setShowTasks,
}: HeaderProps) {
  const forecast = getForecast(rotationMapping, specialsNames);
  const pendingTasks = tasks.filter(t => !t.completed).length;

  return (
    <header className="px-4 pt-3 pb-1 no-print">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          {userName === 'Teacher' && !localStorage.getItem('cp_profile')?.includes('userName') ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-bold text-sage">Welcome! What should I call you?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveName()}
                  placeholder="e.g., Mr. Smith"
                  className="px-3 py-1.5 bg-white border border-slate-100 rounded-lg text-xs focus:outline-none focus:border-sage shadow-sm w-48"
                />
                <button onClick={saveName} className="p-1.5 bg-sage text-white rounded-lg hover:bg-sage-dark transition-all">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <div className="flex items-center gap-2 pr-8">
                <h1 className="text-sm font-bold text-sage-dark leading-tight">
                  {getGreeting(userName)}
                </h1>
                <button
                  onClick={resetUserName}
                  className="p-1 text-slate-300 hover:text-sage opacity-0 group-hover:opacity-100 transition-all"
                  title="Change Name"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Sparkles className="w-2.5 h-2.5 text-terracotta" />
                <p className="text-[9px] font-medium text-slate-400 italic truncate max-w-[180px]">"{quote}"</p>
                <ClassroomPulseLogo size={14} />
                <span className="text-[8px] font-semibold text-slate-300">v2.0</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Rotation Dashboard Badge */}
          <div className="relative">
            <button
              onClick={() => setShowRotationForecast(!showRotationForecast)}
              className={cn(
                'px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 transition-all hover:border-sage/30 group',
                showRotationForecast && 'ring-2 ring-sage/20 border-sage/40'
              )}
            >
              <div className="p-1.5 bg-sage/10 text-sage rounded-lg group-hover:bg-sage/20 transition-colors">
                <School className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-bold text-slate-400 leading-none">Rotation</p>
                <p className="text-xs font-bold text-sage-dark">
                  {todayRotation ? `Day ${todayRotation.letter}: ${todayRotation.special}` : 'No School'}
                </p>
              </div>
              <ChevronDown className={cn('w-3.5 h-3.5 text-slate-300 transition-transform', showRotationForecast && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showRotationForecast && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowRotationForecast(false)}
                    className="fixed inset-0 z-[80]"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-64 bg-white rounded-[24px] shadow-2xl border border-slate-100 p-5 z-[90] overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[11px] font-bold text-slate-400">6-Day Forecast</h4>
                      <Beaker className="w-3.5 h-3.5 text-sage/40" />
                    </div>
                    <div className="space-y-3">
                      {forecast.map((day, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100/50">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400">
                              {day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-xs font-bold text-slate-700">{day.special}</span>
                          </div>
                          <div className="px-2 py-1 bg-sage/10 text-sage rounded-lg text-[10px] font-black underline decoration-2 underline-offset-2">
                            Day {day.letter}
                          </div>
                        </div>
                      ))}
                      {forecast.length === 0 && (
                        <div className="text-center py-4 text-[10px] font-medium text-slate-400 italic">
                          No rotation data found. Scan your calendar in Settings.
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setShowTasks(true)}
            className="p-2.5 bg-white text-slate-400 rounded-xl hover:text-sage transition-all shadow-sm border border-slate-100 flex items-center justify-center relative no-print"
            title="Daily Tasks"
          >
            <ClipboardList className="w-5 h-5" />
            {pendingTasks > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-terracotta text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {pendingTasks}
              </span>
            )}
          </button>

          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
            <Activity className="text-sage w-5 h-5" />
          </div>
        </div>
      </div>
    </header>
  );
}
