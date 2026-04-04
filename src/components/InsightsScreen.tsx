import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AlertTriangle, Users, FileText, Flame, TrendingUp, TrendingDown, Minus, ArrowLeft, Maximize2, ChevronDown, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Note, Student } from '../types';
import { cn } from '../utils/cn';
import { useAliasMode } from '../context/AliasModeContext';
import { getDisplayName } from '../utils/getDisplayName';

type Period = 'week' | 'lastWeek' | 'month';
type ExpandedCard = 'indicators' | 'streak' | 'perStudent' | 'classBreakdown' | 'heatmap' | 'trendGrid' | null;

interface InsightsScreenProps {
  notes: Note[];
  students: Student[];
  indicators: { id?: string; label: string; type: 'positive' | 'neutral' | 'growth' }[];
  onStudentClick: (studentId: string) => void;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-pink-100 text-pink-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function StudentAvatar({ student, size = 28 }: { student: Student; size?: number }) {
  if (student.photo_url) {
    return (
      <img
        src={student.photo_url}
        alt={student.name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-bold flex-shrink-0', avatarColor(student.name))}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {getInitials(student.name)}
    </div>
  );
}

function StatTile({ value, label, sub, subColor, icon }: {
  value: string | number;
  label: string;
  sub?: string;
  subColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-1">
      {icon && <div className="mb-1">{icon}</div>}
      <div className="text-2xl font-black text-slate-800 leading-none">{value}</div>
      <div className="text-[11px] font-medium text-slate-400 leading-tight">{label}</div>
      {sub && <div className={cn('text-[11px] font-bold mt-0.5', subColor || 'text-slate-300')}>{sub}</div>}
    </div>
  );
}

// ─── Card Header (clickable) ──────────────────────────────────────────────────

function CardHeader({ title, onExpand }: { title: string; onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      className="w-full flex items-center justify-between mb-4 group"
    >
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">
        {title}
      </p>
      <Maximize2 className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
    </button>
  );
}

// ─── Full Screen Wrapper ──────────────────────────────────────────────────────

function FullScreenCard({ title, onBack, shareText, children }: { title: string; onBack: () => void; shareText?: string; children: React.ReactNode }) {
  const handleShare = async () => {
    const text = shareText ?? title;
    if (navigator.share) {
      try {
        await navigator.share({ title: `ShortHand — ${title}`, text });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not share');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sage font-black text-[12px] uppercase tracking-widest hover:text-sage-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Insights
        </button>
        {shareText && (
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 hover:text-sage transition-colors px-3 py-1.5 rounded-xl hover:bg-slate-100"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        )}
      </div>
      {/* Content */}
      <div className="p-4 pb-12">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-5">{title}</p>
        {children}
      </div>
    </motion.div>
  );
}

// ─── Class Comparison ────────────────────────────────────────────────────────

function ClassComparisonContent({ notes, students, indicatorTypeMap }: {
  notes: Note[];
  students: Student[];
  indicatorTypeMap: Record<string, 'positive' | 'neutral' | 'growth'>;
}) {
  const classCounts = useMemo(() => {
    const studentClassMap: Record<string, string> = {};
    students.forEach(s => { studentClassMap[s.name] = s.class_period || 'Unassigned'; });

    const classes: Record<string, { positive: number; growth: number; neutral: number }> = {};
    notes.forEach(n => {
      const cls = n.class_name || studentClassMap[n.student_name] || 'Unassigned';
      if (!classes[cls]) classes[cls] = { positive: 0, growth: 0, neutral: 0 };
      const types = (n.tags || []).map(t => indicatorTypeMap[t] || 'neutral');
      if (types.includes('growth')) classes[cls].growth++;
      else if (types.includes('positive')) classes[cls].positive++;
      else classes[cls].neutral++;
    });

    return Object.entries(classes)
      .map(([cls, counts]) => ({ cls, ...counts, total: counts.positive + counts.growth + counts.neutral }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [notes, students, indicatorTypeMap]);

  if (classCounts.length === 0) return <p className="text-xs text-slate-300 italic py-4 text-center">No data for this period.</p>;
  const maxTotal = classCounts[0]?.total || 1;

  return (
    <>
      <div className="space-y-3">
        {classCounts.map(({ cls, positive, growth, neutral, total }) => (
          <div key={cls}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-slate-600">Period {cls}</span>
              <span className="text-[11px] font-bold text-slate-400">{total} notes</span>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden bg-slate-100 gap-px">
              {positive > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(positive / maxTotal) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="bg-sage h-full rounded-l-full"
                  title={`${positive} positive`}
                />
              )}
              {neutral > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(neutral / maxTotal) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                  className="bg-slate-300 h-full"
                  title={`${neutral} neutral`}
                />
              )}
              {growth > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(growth / maxTotal) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
                  className="bg-terracotta h-full rounded-r-full"
                  title={`${growth} growth-area`}
                />
              )}
            </div>
            <div className="flex gap-3 mt-1">
              {positive > 0 && <span className="text-[11px] font-bold text-sage">{positive} positive</span>}
              {neutral > 0 && <span className="text-[11px] font-bold text-slate-400">{neutral} neutral</span>}
              {growth > 0 && <span className="text-[11px] font-bold text-terracotta">{growth} growth</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-sage inline-block" /> Positive</span>
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block" /> Neutral</span>
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-terracotta inline-block" /> Growth area</span>
      </div>
    </>
  );
}

function ClassComparisonCard({ notes, students, indicatorTypeMap, label, onExpand }: {
  notes: Note[];
  students: Student[];
  indicatorTypeMap: Record<string, 'positive' | 'neutral' | 'growth'>;
  label: string;
  onExpand: () => void;
}) {
  const hasData = useMemo(() => {
    const studentClassMap: Record<string, string> = {};
    students.forEach(s => { studentClassMap[s.name] = s.class_period || 'Unassigned'; });
    const classes = new Set(notes.map(n => n.class_name || studentClassMap[n.student_name] || 'Unassigned'));
    return classes.size >= 2;
  }, [notes, students]);

  if (!hasData) return null;

  return (
    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5">
      <CardHeader title={`Class breakdown · ${label}`} onExpand={onExpand} />
      <ClassComparisonContent notes={notes} students={students} indicatorTypeMap={indicatorTypeMap} />
    </div>
  );
}

// ─── Logging Heatmap ─────────────────────────────────────────────────────────

function LoggingHeatmapContent({ notes }: { notes: Note[] }) {
  const { weeks, months } = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const countByDate: Record<string, number> = {};
    notes.forEach(n => {
      const d = new Date(n.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      countByDate[key] = (countByDate[key] || 0) + 1;
    });

    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 26 * 7);
    start.setDate(start.getDate() - start.getDay());

    const weeks: { date: Date; count: number; isToday: boolean; isFuture: boolean }[][] = [];
    const monthLabels: { label: string; col: number }[] = [];
    const cursor = new Date(start);
    let lastMonth = -1;

    while (cursor <= startOfToday) {
      const week: typeof weeks[0] = [];
      for (let i = 0; i < 7; i++) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
        if (i === 0 && cursor.getMonth() !== lastMonth) {
          monthLabels.push({
            label: cursor.toLocaleDateString(undefined, { month: 'short' }),
            col: weeks.length,
          });
          lastMonth = cursor.getMonth();
        }
        week.push({
          date: new Date(cursor),
          count: countByDate[key] || 0,
          isToday: cursor.getTime() === startOfToday.getTime(),
          isFuture: cursor > startOfToday,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }

    return { weeks, months: monthLabels };
  }, [notes]);

  const cellColor = (count: number, isFuture: boolean) => {
    if (isFuture) return 'bg-transparent';
    if (count === 0) return 'bg-slate-100';
    if (count <= 2) return 'bg-sage/30';
    if (count <= 5) return 'bg-sage/60';
    if (count <= 9) return 'bg-sage';
    return 'bg-sage-dark';
  };

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
          less
          {['bg-slate-100', 'bg-sage/30', 'bg-sage/60', 'bg-sage', 'bg-sage-dark'].map(c => (
            <span key={c} className={cn('w-2.5 h-2.5 rounded-sm inline-block', c)} />
          ))}
          more
        </div>
      </div>
      <div className="overflow-x-auto -mx-1 px-1" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
        <div style={{ display: 'grid', gridTemplateRows: 'auto repeat(7, 11px)', gridTemplateColumns: `16px repeat(${weeks.length}, 11px)`, gap: '2px', width: 'max-content' }}>
          <div />
          {weeks.map((_, wi) => {
            const ml = months.find(m => m.col === wi);
            return (
              <div key={wi} style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, lineHeight: '11px', overflow: 'visible', whiteSpace: 'nowrap' }}>
                {ml?.label || ''}
              </div>
            );
          })}
          {DAY_LABELS.map((day, di) => (
            <React.Fragment key={di}>
              <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, lineHeight: '11px', textAlign: 'right', paddingRight: 3 }}>
                {di % 2 === 1 ? day : ''}
              </div>
              {weeks.map((week, wi) => {
                const cell = week[di];
                return (
                  <div
                    key={wi}
                    title={cell ? `${cell.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${cell.count} notes` : ''}
                    className={cn(
                      'rounded-sm transition-colors',
                      cell ? cellColor(cell.count, cell.isFuture) : 'bg-transparent',
                      cell?.isToday && 'ring-1 ring-terracotta ring-offset-1'
                    )}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  );
}

function LoggingHeatmap({ notes, onExpand }: { notes: Note[]; onExpand: () => void }) {
  return (
    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5">
      <CardHeader title="Logging activity · 6 months" onExpand={onExpand} />
      <LoggingHeatmapContent notes={notes} />
    </div>
  );
}

// ─── Class Trend Grid ────────────────────────────────────────────────────────

function useStudentTrends(
  students: Student[],
  notes: Note[],
  indicatorTypeMap: Record<string, 'positive' | 'neutral' | 'growth'>
) {
  return useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return students.map(student => {
      const sNotes = notes.filter(n => n.student_name === student.name);

      // 4 weekly buckets for sparkline + trend
      const weeks = Array.from({ length: 4 }, (_, i) => {
        const weekEnd = new Date(startOfToday);
        weekEnd.setDate(startOfToday.getDate() - i * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 6);
        const wNotes = sNotes.filter(n => {
          const d = new Date(n.created_at);
          return d >= weekStart && d <= weekEnd;
        });
        const positive = wNotes.filter(n =>
          (n.tags || []).some(t => indicatorTypeMap[t] === 'positive')
        ).length;
        return { total: wNotes.length, positive, pct: wNotes.length > 0 ? Math.round((positive / wNotes.length) * 100) : null };
      }).reverse(); // oldest → newest

      const thisWeek = weeks[3];
      const lastWeek = weeks[2];
      const delta = thisWeek.pct !== null && lastWeek.pct !== null ? thisWeek.pct - lastWeek.pct : null;

      // Trend based on 4-week shape
      const withData = weeks.filter(w => w.pct !== null) as { pct: number }[];
      let trend: 'up' | 'stable' | 'down' = 'stable';
      if (withData.length >= 2) {
        const first = withData.slice(0, Math.floor(withData.length / 2));
        const second = withData.slice(Math.floor(withData.length / 2));
        const avg = (arr: { pct: number }[]) => arr.reduce((s, d) => s + d.pct, 0) / arr.length;
        const diff = avg(second) - avg(first);
        if (diff > 5) trend = 'up';
        else if (diff < -5) trend = 'down';
      }

      return { student, weeks, thisWeek, lastWeek, delta, trend, totalNotes: sNotes.length };
    }).sort((a, b) => {
      // Needs attention first, then stable, then up
      const order = { down: 0, stable: 1, up: 2 };
      return order[a.trend] - order[b.trend];
    });
  }, [students, notes, indicatorTypeMap]);
}

const TREND_CONFIG = {
  up:     { label: 'Trending Up',      bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500', icon: TrendingUp   },
  stable: { label: 'Stable',           bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400',   icon: Minus        },
  down:   { label: 'Needs Attention',  bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-500',     icon: TrendingDown },
};

function StudentTrendCard({ data, onClick }: {
  key?: React.Key;
  data: ReturnType<typeof useStudentTrends>[0];
  onClick: () => void;
}) {
  const { student, weeks, thisWeek, delta, trend } = data;
  const cfg = TREND_CONFIG[trend];
  const Icon = cfg.icon;

  // Mini sparkline (SVG)
  const sparkW = 44, sparkH = 20;
  const validWeeks = weeks.map((w, i) => ({ ...w, i })).filter(w => w.pct !== null) as { pct: number; i: number; total: number }[];
  const sparkPoints = validWeeks.map(w => `${(w.i / 3) * sparkW},${sparkH - (w.pct / 100) * sparkH}`).join(' ');

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex items-center gap-3 hover:border-slate-200 hover:shadow-md transition-all active:scale-[0.98]"
    >
      <StudentAvatar student={student} size={32} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-slate-700 truncate leading-tight">{student.name.split(' ')[0]} {student.name.split(' ').slice(-1)[0]?.[0]}.</p>
        <div className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full ${cfg.bg}`}>
          <Icon className={`w-2.5 h-2.5 ${cfg.text}`} />
          <span className={`text-[9px] font-black ${cfg.text}`}>{cfg.label}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {thisWeek.pct !== null ? (
          <span className="text-sm font-black text-slate-700 leading-none">{thisWeek.pct}%</span>
        ) : (
          <span className="text-[10px] font-bold text-slate-300 leading-none">—</span>
        )}
        {delta !== null && (
          <span className={`text-[9px] font-black leading-none ${delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-red-400' : 'text-slate-300'}`}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
        {validWeeks.length >= 2 && (
          <svg width={sparkW} height={sparkH} className="mt-0.5">
            <polyline
              points={sparkPoints}
              fill="none"
              stroke={trend === 'up' ? '#10b981' : trend === 'down' ? '#f87171' : '#94a3b8'}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </button>
  );
}

function ClassTrendGridContent({ studentTrends, onStudentClick }: {
  studentTrends: ReturnType<typeof useStudentTrends>;
  onStudentClick: (id: string) => void;
}) {
  const downCount = studentTrends.filter(d => d.trend === 'down').length;
  const upCount = studentTrends.filter(d => d.trend === 'up').length;

  return (
    <>
      {/* Summary pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { label: `${downCount} Need Attention`, color: 'bg-red-50 text-red-600', show: downCount > 0 },
          { label: `${studentTrends.length - downCount - upCount} Stable`, color: 'bg-slate-100 text-slate-500', show: true },
          { label: `${upCount} Trending Up`, color: 'bg-emerald-50 text-emerald-700', show: upCount > 0 },
        ].filter(p => p.show).map(p => (
          <span key={p.label} className={`text-[11px] font-black px-2.5 py-1 rounded-full ${p.color}`}>{p.label}</span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {studentTrends.map(data => (
          <StudentTrendCard
            key={data.student.id}
            data={data}
            onClick={() => onStudentClick(data.student.id)}
          />
        ))}
      </div>
      <p className="text-[10px] text-slate-300 font-bold text-center mt-3">% positive · this week vs prior weeks · tap to open student</p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function InsightsScreen({ notes, students, indicators, onStudentClick }: InsightsScreenProps) {
  const { aliasMode } = useAliasMode();
  const [period, setPeriod] = useState<Period>('week');
  const [expandedCard, setExpandedCard] = useState<ExpandedCard>(null);
  const [alertOpen, setAlertOpen] = useState(false);

  // Push a history entry when a card opens so the phone's back button closes it
  useEffect(() => {
    if (expandedCard) {
      history.pushState({ insightsCard: expandedCard }, '');
    }
  }, [expandedCard]);
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      if (expandedCard && !e.state?.insightsCard) {
        setExpandedCard(null);
        // Re-push so App.tsx back handler still has entries
        setTimeout(() => history.pushState({}, ''), 50);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [expandedCard]);

  const indicatorTypeMap = useMemo(() => {
    const map: Record<string, 'positive' | 'neutral' | 'growth'> = {};
    indicators.forEach(ind => { map[ind.label] = ind.type; });
    return map;
  }, [indicators]);

  const bounds = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = today.getDay();

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - dow);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    if (period === 'week') return {
      start: thisWeekStart, end: now,
      prevStart: lastWeekStart, prevEnd: thisWeekStart,
      label: 'This Week', prevLabel: 'last week',
    };
    if (period === 'lastWeek') return {
      start: lastWeekStart, end: thisWeekStart,
      prevStart: new Date(lastWeekStart.getTime() - 7 * 86400000), prevEnd: lastWeekStart,
      label: 'Last Week', prevLabel: 'week before',
    };
    return {
      start: thisMonthStart, end: now,
      prevStart: lastMonthStart, prevEnd: thisMonthStart,
      label: 'This Month', prevLabel: 'last month',
    };
  }, [period]);

  const filteredNotes = useMemo(() =>
    notes.filter(n => { const d = new Date(n.created_at); return d >= bounds.start && d <= bounds.end; }),
    [notes, bounds]
  );

  const prevNotes = useMemo(() =>
    notes.filter(n => { const d = new Date(n.created_at); return d >= bounds.prevStart && d < bounds.prevEnd; }),
    [notes, bounds]
  );

  const teacherStreak = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const loggedDates = new Set(
      notes.map(n => {
        const d = new Date(n.created_at);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
    );
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(startOfToday);
      d.setDate(startOfToday.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (loggedDates.has(key)) streak++;
      else break;
    }
    return streak;
  }, [notes]);

  const notLoggedStudents = useMemo(() => {
    const now = new Date();
    const lastNote: Record<string, Date> = {};
    notes.forEach(n => {
      if (!n.student_name) return;
      const d = new Date(n.created_at);
      if (!lastNote[n.student_name] || d > lastNote[n.student_name]) lastNote[n.student_name] = d;
    });
    return students
      .map(s => {
        const last = lastNote[s.name];
        const days = last
          ? Math.floor((now.getTime() - last.getTime()) / 86400000)
          : 999;
        return { student: s, daysSince: days };
      })
      .filter(({ daysSince }) => daysSince >= 5)
      .sort((a, b) => b.daysSince - a.daysSince);
  }, [notes, students]);

  const studentTrends = useStudentTrends(students, notes, indicatorTypeMap);

  const topIndicators = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredNotes.forEach(n => {
      (n.tags || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
  }, [filteredNotes]);

  const maxIndicator = topIndicators[0]?.[1] || 1;

  const notesPerStudent = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredNotes.forEach(n => { if (n.student_name) counts[n.student_name] = (counts[n.student_name] || 0) + 1; });
    return students
      .map(s => ({ student: s, count: counts[s.name] || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredNotes, students]);

  const maxStudentNotes = notesPerStudent[0]?.count || 1;

  const sevenDays = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfToday);
      d.setDate(startOfToday.getDate() - (6 - i));
      return d;
    });
  }, []);

  const streakStudents = useMemo(() => {
    const notesByStudentDate: Record<string, Set<string>> = {};
    notes.forEach(n => {
      if (!n.student_name) return;
      const d = new Date(n.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!notesByStudentDate[n.student_name]) notesByStudentDate[n.student_name] = new Set();
      notesByStudentDate[n.student_name].add(key);
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const byActivity = [...students]
      .map(s => {
        const dots = sevenDays.map(d => {
          const isToday = d.getTime() === startOfToday.getTime();
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const hasNote = notesByStudentDate[s.name]?.has(key) || false;
          return { date: d, hasNote, isToday };
        });
        const recentCount = dots.filter(dot => dot.hasNote).length;
        return { student: s, dots, recentCount };
      })
      .sort((a, b) => b.recentCount - a.recentCount);

    const top5 = byActivity.slice(0, 5);
    const notLogged = byActivity.filter(x => x.recentCount === 0).slice(0, 3);
    const seen = new Set(top5.map(x => x.student.id));
    const combined = [...top5, ...notLogged.filter(x => !seen.has(x.student.id))];
    return combined;
  }, [notes, students, sevenDays]);

  const studentsLoggedCount = new Set(filteredNotes.map(n => n.student_name)).size;
  const prevStudentsLogged = new Set(prevNotes.map(n => n.student_name)).size;
  const noteDelta = filteredNotes.length - prevNotes.length;
  const studentDelta = studentsLoggedCount - prevStudentsLogged;

  // ─── Expanded card content ─────────────────────────────────────────────────

  const expandedTitles: Record<NonNullable<ExpandedCard>, string> = {
    indicators: `Top indicators · ${bounds.label}`,
    streak: 'Note streak · last 7 days',
    perStudent: `Notes per student · ${bounds.label}`,
    classBreakdown: `Class breakdown · ${bounds.label}`,
    heatmap: 'Logging activity · 6 months',
    trendGrid: 'Student behavior trends · 4 weeks',
  };

  // Build plain-text summaries for sharing
  const shareTexts: Partial<Record<NonNullable<ExpandedCard>, string>> = {
    indicators: topIndicators.length > 0
      ? `📊 Top indicators (${bounds.label}):\n` + topIndicators.map(([tag, count]) => `• ${tag}: ${count}`).join('\n')
      : undefined,
    perStudent: notesPerStudent.length > 0
      ? `📝 Notes per student (${bounds.label}):\n` + notesPerStudent.map(({ student, count }) => `• ${getDisplayName(student, aliasMode)}: ${count}`).join('\n')
      : undefined,
    classBreakdown: undefined,
    streak: undefined,
    heatmap: undefined,
    trendGrid: studentTrends.length > 0
      ? `📈 Student behavior trends (4 weeks):\n` + [...studentTrends].sort((a, b) => a.student.name.localeCompare(b.student.name)).map(d => `• ${getDisplayName(d.student, aliasMode)}: ${d.trend === 'up' ? '↑ Trending Up' : d.trend === 'down' ? '↓ Needs Attention' : '→ Stable'} (${d.totalNotes} notes)`).join('\n')
      : undefined,
  };

  return (
    <>
      <AnimatePresence>
        {expandedCard && (
          <FullScreenCard title={expandedTitles[expandedCard]} onBack={() => setExpandedCard(null)} shareText={shareTexts[expandedCard]}>
            {expandedCard === 'indicators' && (
              topIndicators.length === 0 ? (
                <p className="text-xs text-slate-300 italic py-4 text-center">No tagged notes yet this period.</p>
              ) : (
                <div className="space-y-3">
                  {topIndicators.map(([tag, count]) => {
                    const type = indicatorTypeMap[tag] ?? 'neutral';
                    const barColor = type === 'positive' ? 'bg-sage' : type === 'growth' ? 'bg-terracotta' : 'bg-slate-300';
                    const textColor = type === 'positive' ? 'text-sage-dark' : type === 'growth' ? 'text-terracotta' : 'text-slate-500';
                    const pct = Math.round((count / maxIndicator) * 100);
                    return (
                      <div key={tag} className="flex items-center gap-3">
                        <span className={cn('text-[13px] font-bold w-32 flex-shrink-0 truncate', textColor)}>{tag}</span>
                        <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.05, ease: 'easeOut' }}
                            className={cn('h-full rounded-full', barColor)}
                          />
                        </div>
                        <span className="text-[13px] font-black text-slate-400 w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {expandedCard === 'streak' && (
              streakStudents.length === 0 ? (
                <p className="text-xs text-slate-300 italic py-4 text-center">No students yet.</p>
              ) : (
                <>
                  <div className="flex items-center justify-end mb-4 gap-3 text-[11px] font-bold text-slate-300">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-sage inline-block" /> noted</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-terracotta inline-block" /> missing today</span>
                  </div>
                  <div className="space-y-0">
                    {streakStudents.map(({ student, dots }) => (
                      <button
                        key={student.id}
                        onClick={() => { setExpandedCard(null); onStudentClick(student.id); }}
                        className="w-full flex items-center gap-3 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 rounded-xl px-1 transition-colors"
                      >
                        <StudentAvatar student={student} size={32} />
                        <span className="flex-1 text-left text-sm font-semibold text-slate-700 truncate">{getDisplayName(student, aliasMode)}</span>
                        <div className="flex gap-1.5">
                          {dots.map((dot, i) => (
                            <div
                              key={i}
                              title={dot.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              className={cn(
                                'w-3.5 h-3.5 rounded-sm',
                                dot.hasNote ? 'bg-sage' : dot.isToday ? 'bg-terracotta opacity-50' : 'bg-slate-100 border border-slate-200'
                              )}
                            />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )
            )}

            {expandedCard === 'perStudent' && (
              notesPerStudent.length === 0 ? (
                <p className="text-xs text-slate-300 italic py-4 text-center">No notes this period.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {notesPerStudent.map(({ student, count }) => {
                      const pct = maxStudentNotes > 0 ? (count / maxStudentNotes) * 100 : 0;
                      const barColor = count === 0 ? 'bg-red-300' : count <= 2 ? 'bg-amber-300' : 'bg-sage';
                      return (
                        <button
                          key={student.id}
                          onClick={() => { setExpandedCard(null); onStudentClick(student.id); }}
                          className="w-full flex items-center gap-3 py-2 hover:bg-slate-50 rounded-xl px-2 transition-colors"
                        >
                          <StudentAvatar student={student} size={28} />
                          <span className="flex-1 text-left text-sm font-semibold text-slate-700 truncate">{getDisplayName(student, aliasMode)}</span>
                          <div className="w-32 h-4 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                              className={cn('h-full rounded-full', barColor)}
                            />
                          </div>
                          <span className="text-sm font-black text-slate-400 w-6 text-right">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-5 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-sage inline-block" /> 3+ notes</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-amber-300 inline-block" /> 1–2 notes</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /> not logged</span>
                  </div>
                </>
              )
            )}

            {expandedCard === 'classBreakdown' && (
              <ClassComparisonContent notes={filteredNotes} students={students} indicatorTypeMap={indicatorTypeMap} />
            )}

            {expandedCard === 'heatmap' && (
              <LoggingHeatmapContent notes={notes} />
            )}

            {expandedCard === 'trendGrid' && (
              <ClassTrendGridContent
                studentTrends={[...studentTrends].sort((a, b) => a.student.name.localeCompare(b.student.name))}
                onStudentClick={(id) => { setExpandedCard(null); onStudentClick(id); }}
              />
            )}
          </FullScreenCard>
        )}
      </AnimatePresence>

      <div className="space-y-5 pt-2">
        {/* Period picker */}
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl">
          {(['week', 'lastWeek', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all',
                period === p ? 'bg-white text-sage shadow-sm' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              {p === 'week' ? 'This Week' : p === 'lastWeek' ? 'Last Week' : 'Month'}
            </button>
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2.5">
          <StatTile
            value={filteredNotes.length}
            label="Notes"
            sub={noteDelta === 0 ? undefined : `${noteDelta > 0 ? '+' : ''}${noteDelta} vs ${bounds.prevLabel}`}
            subColor={noteDelta > 0 ? 'text-emerald-500' : noteDelta < 0 ? 'text-terracotta' : undefined}
          />
          <StatTile
            value={studentsLoggedCount}
            label="Students noted"
            sub={`of ${students.length}`}
            subColor="text-slate-400"
          />
          <StatTile
            value={teacherStreak}
            label={teacherStreak === 1 ? 'Day streak' : 'Day streak'}
            sub={teacherStreak >= 5 ? '🔥 Keep it up' : teacherStreak === 0 ? 'Start today!' : undefined}
            subColor="text-sage"
            icon={<Flame className="w-3.5 h-3.5 text-terracotta" />}
          />
          <StatTile
            value={notLoggedStudents.length}
            label="Not seen 5+ days"
            sub={notLoggedStudents.length > 0 ? 'Need attention' : 'All good!'}
            subColor={notLoggedStudents.length > 0 ? 'text-amber-500' : 'text-emerald-500'}
            icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
          />
        </div>

        {/* Top indicators */}
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5">
          <CardHeader title={`Top indicators · ${bounds.label}`} onExpand={() => setExpandedCard('indicators')} />
          {topIndicators.length === 0 ? (
            <p className="text-xs text-slate-300 italic py-4 text-center">No tagged notes yet this period.</p>
          ) : (
            <div className="space-y-2.5">
              {topIndicators.map(([tag, count]) => {
                const type = indicatorTypeMap[tag] ?? 'neutral';
                const barColor = type === 'positive' ? 'bg-sage' : type === 'growth' ? 'bg-terracotta' : 'bg-slate-300';
                const textColor = type === 'positive' ? 'text-sage-dark' : type === 'growth' ? 'text-terracotta' : 'text-slate-500';
                const pct = Math.round((count / maxIndicator) * 100);
                return (
                  <div key={tag} className="flex items-center gap-3">
                    <span className={cn('text-[11px] font-bold w-24 flex-shrink-0 truncate', textColor)}>{tag}</span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.05, ease: 'easeOut' }}
                        className={cn('h-full rounded-full', barColor)}
                      />
                    </div>
                    <span className="text-[11px] font-black text-slate-400 w-5 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 7-day student logging streak */}
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setExpandedCard('streak')}
              className="flex items-center gap-2 group"
            >
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">Note streak · last 7 days</p>
              <Maximize2 className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-sage inline-block" /> noted
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-terracotta inline-block" /> missing today
              </span>
            </div>
          </div>
          {streakStudents.length === 0 ? (
            <p className="text-xs text-slate-300 italic py-4 text-center">No students yet.</p>
          ) : (
            <div className="space-y-0">
              {streakStudents.map(({ student, dots }) => (
                <button
                  key={student.id}
                  onClick={() => onStudentClick(student.id)}
                  className="w-full flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 rounded-xl px-1 transition-colors"
                >
                  <StudentAvatar student={student} size={26} />
                  <span className="flex-1 text-left text-xs font-semibold text-slate-700 truncate">{getDisplayName(student, aliasMode)}</span>
                  <div className="flex gap-1.5">
                    {dots.map((dot, i) => (
                      <div
                        key={i}
                        title={dot.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        className={cn(
                          'w-2.5 h-2.5 rounded-sm',
                          dot.hasNote
                            ? 'bg-sage'
                            : dot.isToday
                            ? 'bg-terracotta opacity-50'
                            : 'bg-slate-100 border border-slate-200'
                        )}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes per student */}
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5">
          <CardHeader title={`Notes per student · ${bounds.label}`} onExpand={() => setExpandedCard('perStudent')} />
          {notesPerStudent.length === 0 ? (
            <p className="text-xs text-slate-300 italic py-4 text-center">No notes this period.</p>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1 pb-1" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
              <div className="flex items-end gap-2" style={{ minWidth: Math.max(notesPerStudent.length * 42, 100) }}>
                {notesPerStudent.map(({ student, count }) => {
                  const pct = maxStudentNotes > 0 ? (count / maxStudentNotes) * 100 : 0;
                  const barColor = count === 0 ? 'bg-red-300' : count <= 2 ? 'bg-amber-300' : 'bg-sage';
                  return (
                    <button
                      key={student.id}
                      onClick={() => onStudentClick(student.id)}
                      className="flex flex-col items-center gap-1 group flex-shrink-0"
                      style={{ width: 36 }}
                    >
                      <span className="text-[11px] font-black text-slate-400 group-hover:text-sage transition-colors">
                        {count}
                      </span>
                      <div className="w-full flex flex-col justify-end rounded-t-lg overflow-hidden" style={{ height: 80, background: 'rgb(241 245 249)' }}>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                          transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
                          className={cn('w-full rounded-t-lg', barColor)}
                        />
                      </div>
                      {student.photo_url ? (
                        <img src={student.photo_url} alt={student.name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black', avatarColor(student.name))}>
                          {getInitials(student.name).slice(0, 2)}
                        </div>
                      )}
                      <span className="text-[8px] text-slate-400 truncate w-full text-center leading-none">
                        {getDisplayName(student, aliasMode).split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-sage inline-block" /> 3+ notes
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-300 inline-block" /> 1–2 notes
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /> not logged
            </span>
          </div>
        </div>

        {/* Class Comparison */}
        <ClassComparisonCard
          notes={filteredNotes}
          students={students}
          indicatorTypeMap={indicatorTypeMap}
          label={bounds.label}
          onExpand={() => setExpandedCard('classBreakdown')}
        />

        {/* Logging Heatmap */}
        <LoggingHeatmap notes={notes} onExpand={() => setExpandedCard('heatmap')} />

        {/* Students not seen accordion */}
        {notLoggedStudents.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setAlertOpen(o => !o)}
              className="w-full flex items-center gap-3 px-4 py-3.5"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="flex-1 text-left text-sm font-black text-amber-700">
                {notLoggedStudents.length} student{notLoggedStudents.length !== 1 ? 's' : ''} not seen in 5+ days
              </span>
              <motion.div animate={{ rotate: alertOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4 text-amber-400" />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {alertOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 border-t border-amber-200 pt-3">
                    <p className="text-[11px] text-amber-600 mb-3">Tap a student to add a quick note.</p>
                    <div className="flex flex-wrap gap-2">
                      {notLoggedStudents.map(({ student, daysSince }) => (
                        <button
                          key={student.id}
                          onClick={() => onStudentClick(student.id)}
                          className={cn(
                            'text-[11px] font-black px-3 py-1.5 rounded-full border transition-all active:scale-95',
                            daysSince >= 8
                              ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                              : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                          )}
                        >
                          {getDisplayName(student, aliasMode)}
                          &nbsp;·&nbsp;
                          {daysSince >= 999 ? 'never' : `${daysSince}d`}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Class Trend Grid */}
        {studentTrends.length > 0 && (
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
            <CardHeader title="Student behavior trends · 4 weeks" onExpand={() => setExpandedCard('trendGrid')} />
            <ClassTrendGridContent
              studentTrends={[...studentTrends].sort((a, b) => b.weeks[3].total - a.weeks[3].total).slice(0, 6)}
              onStudentClick={onStudentClick}
            />
            {studentTrends.length > 6 && (
              <button
                onClick={() => setExpandedCard('trendGrid')}
                className="w-full mt-3 text-[11px] font-black text-sage hover:text-sage-dark transition-colors text-center"
              >
                See all {studentTrends.length} students →
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
