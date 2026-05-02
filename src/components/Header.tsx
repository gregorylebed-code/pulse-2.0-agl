import React, { useState } from 'react';
import { Sparkles, Edit2, Plus, School, ChevronDown, ClipboardList, Beaker, PenLine, RotateCcw, EyeOff, Eye } from 'lucide-react';
import { useAliasMode } from '../context/AliasModeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import { getForecast, SpecialsConfig } from '../utils/rotationHelpers';
import { useFullMode } from '../context/FullModeContext';

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
  specialsConfig: SpecialsConfig;
  onSetTodayOverride: (letter: string | null) => void;
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
  specialsConfig,
  onSetTodayOverride,
  tasks,
  setShowTasks,
}: HeaderProps) {
  const forecast = getForecast(specialsConfig);
  const [showOverridePicker, setShowOverridePicker] = useState(false);
  const { aliasMode, toggleAliasMode } = useAliasMode();
  const letters = Array.from({ length: specialsConfig.rollingLetterCount || 5 }, (_, i) => String.fromCharCode(65 + i));
  const canOverride = specialsConfig.mode === 'letter-day' || specialsConfig.mode === 'rolling';
  const isFullMode = useFullMode();
  const hasOverride = !!specialsConfig.todayOverride;
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
                <button onClick={saveName} className="p-1.5 bg-sage text-white rounded-xl hover:bg-sage-dark transition-all">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <div className="flex items-center gap-2 pr-8">
                <h1 className="text-base font-bold text-sage-dark leading-tight">
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
              <div className="flex items-center mt-0.5">
                <p className="text-[11px] font-medium text-slate-300 italic leading-snug">"{quote}"</p>
              </div>
            </div>
          )}
        </div>

        <span className="self-center text-[16px] font-bold tracking-wide mx-2 flex-shrink-0 flex">
          {['S','h','o','r','t','H','a','n','d'].map((letter, i) => {
            const colors = ['#e2725b','#34d399','#f59e0b','#60a5fa','#a78bfa','#e2725b','#34d399','#f59e0b','#60a5fa'];
            return (
              <motion.span
                key={i}
                style={{ color: colors[i], display: 'inline-block' }}
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
              >
                {letter}
              </motion.span>
            );
          })}
        </span>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {/* Rotation Dashboard Badge */}
          {isFullMode && <div className="relative">
            <button
              onClick={() => setShowRotationForecast(!showRotationForecast)}
              className={cn(
                'p-2 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-1.5 transition-all hover:border-sage/30 group',
                showRotationForecast && 'ring-2 ring-sage/20 border-sage/40'
              )}
              title={specialsConfig.mode === 'off' ? 'Rotation off' : todayRotation ? `Day ${todayRotation.letter}: ${todayRotation.special}` : 'No School'}
            >
              <div className="p-1.5 bg-sage/10 text-sage rounded-lg group-hover:bg-sage/20 transition-colors">
                <School className="w-4 h-4" />
              </div>
              {todayRotation && specialsConfig.mode !== 'off' && (
                <span className="text-[11px] font-bold text-slate-600 max-w-[80px] truncate">
                  {todayRotation.special}
                </span>
              )}
              <ChevronDown className={cn('w-3 h-3 text-slate-300 transition-transform', showRotationForecast && 'rotate-180')} />
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
                            <span className="text-[11px] font-bold text-slate-400">
                              {day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-xs font-bold text-slate-700">{day.special}</span>
                          </div>
                          <div className="px-2 py-1 bg-sage/10 text-sage rounded-lg text-[11px] font-black underline decoration-2 underline-offset-2">
                            Day {day.letter}
                          </div>
                        </div>
                      ))}
                      {forecast.length === 0 && specialsConfig.mode !== 'off' && (
                        <div className="text-center py-4 text-[11px] font-medium text-slate-400 italic">
                          {specialsConfig.mode === 'letter-day'
                            ? 'No rotation data found. Scan your calendar in Settings.'
                            : specialsConfig.mode === 'rolling'
                            ? 'Set a start date in Settings → Rotation & Specials.'
                            : 'Configure specials in Settings → Rotation & Specials.'}
                        </div>
                      )}
                      {specialsConfig.mode === 'off' && (
                        <div className="text-center py-4 text-[11px] font-medium text-slate-400 italic">
                          Rotation is turned off. Enable it in Settings.
                        </div>
                      )}
                    </div>

                    {/* Today override — only for letter-day and rolling modes */}
                    {canOverride && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-slate-400">Override Today</span>
                          {hasOverride && (
                            <button
                              onClick={() => { onSetTodayOverride(null); setShowOverridePicker(false); }}
                              className="flex items-center gap-1 text-[11px] font-bold text-terracotta hover:underline"
                            >
                              <RotateCcw className="w-2.5 h-2.5" /> Clear
                            </button>
                          )}
                        </div>
                        {hasOverride ? (
                          <p className="text-[11px] text-sage font-bold">
                            Today set to Day {specialsConfig.todayOverride!.letter} ({specialsConfig.specialsNames[specialsConfig.todayOverride!.letter] || 'No Special'})
                          </p>
                        ) : showOverridePicker ? (
                          <div className="flex flex-wrap gap-1.5">
                            {letters.map(l => (
                              <button
                                key={l}
                                onClick={() => { onSetTodayOverride(l); setShowOverridePicker(false); }}
                                className="w-8 h-8 bg-sage/10 text-sage rounded-lg text-[11px] font-black hover:bg-sage/20 transition-colors"
                              >
                                {l}
                              </button>
                            ))}
                            <button onClick={() => setShowOverridePicker(false)} className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg text-[11px] font-black hover:bg-slate-200 transition-colors">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowOverridePicker(true)}
                            className="text-[11px] font-bold text-slate-400 hover:text-sage transition-colors"
                          >
                            + Set today's day letter
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>}

          {/* Alias Mode Toggle — below rotation badge */}
          <button
            onClick={toggleAliasMode}
            title={aliasMode ? 'Student names are hidden — tap to show them' : 'Tap to hide student names (great for public spaces)'}
            className={cn(
              'p-1.5 rounded-xl border transition-all',
              aliasMode
                ? 'bg-amber-50 border-amber-200 text-amber-500'
                : 'bg-white border-slate-100 text-slate-300 hover:text-slate-400'
            )}
          >
            {aliasMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
