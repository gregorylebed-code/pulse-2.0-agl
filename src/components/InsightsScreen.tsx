import React, { useMemo, useState } from 'react';
import { AlertTriangle, Users, FileText, Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Note, Student } from '../types';
import { cn } from '../utils/cn';

type Period = 'week' | 'lastWeek' | 'month';

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
      {sub && <div className={cn('text-[10px] font-bold mt-0.5', subColor || 'text-slate-300')}>{sub}</div>}
    </div>
  );
}

export default function InsightsScreen({ notes, students, indicators, onStudentClick }: InsightsScreenProps) {
  const [period, setPeriod] = useState<Period>('week');

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

  // Teacher logging streak (consecutive school days with notes, going back from today)
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
      if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (loggedDates.has(key)) streak++;
      else break;
    }
    return streak;
  }, [notes]);

  // Students not logged in 5+ days
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

  // Top indicators by tag count in period
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

  // Notes per student in period
  const notesPerStudent = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredNotes.forEach(n => { if (n.student_name) counts[n.student_name] = (counts[n.student_name] || 0) + 1; });
    return students
      .map(s => ({ student: s, count: counts[s.name] || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredNotes, students]);

  const maxStudentNotes = notesPerStudent[0]?.count || 1;

  // 7-day dot streak per student (show top 6 active + any not-logged-recently)
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

    // Top 5 active + top 3 not-logged (if any overlap, dedupe)
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

  return (
    <div className="space-y-5 pt-2">
      {/* Period picker */}
      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl">
        {(['week', 'lastWeek', 'month'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
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
          label="Notes logged"
          sub={noteDelta === 0 ? undefined : `${noteDelta > 0 ? '+' : ''}${noteDelta} vs ${bounds.prevLabel}`}
          subColor={noteDelta > 0 ? 'text-emerald-500' : noteDelta < 0 ? 'text-terracotta' : undefined}
        />
        <StatTile
          value={studentsLoggedCount}
          label="Students logged"
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

      {/* Alert banner */}
      {notLoggedStudents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-amber-700">
                {notLoggedStudents.length} student{notLoggedStudents.length !== 1 ? 's' : ''} haven't been logged in 5+ days
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">Tap a student to log a quick note now.</p>
              <div className="flex flex-wrap gap-2 mt-3">
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
                    {student.name.split(' ')[0]} {student.name.split(' ').slice(-1)[0][0]}.
                    &nbsp;·&nbsp;
                    {daysSince >= 999 ? 'never' : `${daysSince}d`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Top indicators */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">
          Top indicators · {bounds.label}
        </p>
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
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Logging streak · last 7 days</p>
          <div className="flex items-center gap-3 text-[9px] font-bold text-slate-300">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-sage inline-block" /> logged
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
                <span className="flex-1 text-left text-xs font-semibold text-slate-700 truncate">{student.name}</span>
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

      {/* Notes per student — vertical bars, horizontally scrollable */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">
          Notes per student · {bounds.label}
        </p>
        {notesPerStudent.length === 0 ? (
          <p className="text-xs text-slate-300 italic py-4 text-center">No notes this period.</p>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
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
                    <span className="text-[9px] font-black text-slate-400 group-hover:text-sage transition-colors">
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
                      <img
                        src={student.photo_url}
                        alt={student.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black', avatarColor(student.name))}>
                        {getInitials(student.name).slice(0, 2)}
                      </div>
                    )}
                    <span className="text-[8px] text-slate-400 truncate w-full text-center leading-none">
                      {student.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50">
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-sage inline-block" /> 3+ notes
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-300 inline-block" /> 1–2 notes
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /> not logged
          </span>
        </div>
      </div>
    </div>
  );
}
