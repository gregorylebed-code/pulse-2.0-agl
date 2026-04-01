import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import imageCompression from 'browser-image-compression';
import {
  ChevronLeft, Edit2, Send, Mic, Image as ImageIcon, Loader2,
  Trash2, Copy, Mail, MessageSquare, CheckCircle2, Archive,
  X, Sparkles, ClipboardList, FileText, Download,
  Smile, Meh, Frown, Users, Phone, Tag, ChevronDown, Settings2,
  Target, Plus, Printer, Cake
} from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { Note, Student, Report, CalendarEvent, StudentGoal, GoalCategory, GoalStatus, ParentCommunication, Shoutout } from '../types';
import ParentCommunicationLog from './ParentCommunicationLog';
import { Abbreviation } from '../utils/expandAbbreviations';
import { expandAbbreviations } from '../utils/expandAbbreviations';
import { categorizeNote, refineReport, refineQuickNote, parseVoiceLog, quickParentNote, suggestGoals, ReportData } from '../lib/gemini';
import { isFullMode } from '../lib/mode';
import { cn } from '../utils/cn';


// Re-exported from App to avoid circular imports — used for comm button display in edit mode
const DEFAULT_COMM_BUTTONS = [
  { label: 'ParentSquare', icon_name: 'ParentSquare' },
  { label: 'Email', icon_name: 'Mail' },
  { label: 'Phone', icon_name: 'Phone' },
  { label: 'Meeting', icon_name: 'Users' },
];

const getIconForName = (name: string, type: string): React.ReactNode => {
  switch (name) {
    case 'Sparkles': return <Sparkles className="w-4 h-4" />;
    case 'CheckCircle2': return <CheckCircle2 className="w-4 h-4" />;
    case 'Smile': return <Smile className="w-4 h-4 text-emerald-600" />;
    case 'Meh': return <Meh className="w-4 h-4 text-amber-500" />;
    case 'Frown': return <Frown className="w-4 h-4 text-red-500" />;
    case 'ParentSquare': return <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-blue-500 text-white text-[11px] font-black leading-none">PS</span>;
    case 'Users': return <Users className="w-4 h-4 text-blue-500" />;
    case 'MessageSquare': return <MessageSquare className="w-4 h-4 text-blue-500" />;
    case 'Mail': return <Mail className="w-4 h-4 text-blue-500" />;
    case 'Phone': return <Phone className="w-4 h-4 text-blue-500" />;
    default:
      if (type === 'positive') return <Smile className="w-4 h-4 text-emerald-600" />;
      if (type === 'growth') return <Frown className="w-4 h-4 text-red-500" />;
      if (type === 'neutral') return <Meh className="w-4 h-4 text-amber-500" />;
      return <MessageSquare className="w-4 h-4 text-blue-500" />;
  }
};

const GOAL_STAGES: { label: string; emoji: string; color: string }[] = [
  { label: 'Planted',   emoji: '🌱', color: 'text-slate-500'   },
  { label: 'Sprouting', emoji: '🌿', color: 'text-teal-600'    },
  { label: 'Growing',   emoji: '🌻', color: 'text-amber-500'   },
  { label: 'Bloomed',   emoji: '💐', color: 'text-violet-600'  },
];

const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  'academic': 'Academic',
  'social-emotional': 'Social-Emotional',
  'executive-functioning': 'Executive Functioning',
  'other': 'Other',
};

interface StudentDetailViewProps {
  student: Student;
  students: Student[];
  notes: Note[];
  reports: Report[];
  goals: StudentGoal[];
  indicators: any[];
  commTypes: any[];
  calendarEvents: CalendarEvent[];
  parentCommunications: ParentCommunication[];
  onBack: () => void;
  onGenerateReport: (length: 'Quick Note' | 'Standard' | 'Detailed', filteredNotes: Note[]) => Promise<ReportData | undefined>;
  onNoteUpdate: () => void;
  addNote: (note: any) => Promise<any>;
  updateNote: (id: string, updates: any) => Promise<void>;
  updateStudent: (id: string, updates: any) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  addGoal: (goal: Omit<StudentGoal, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<StudentGoal | null>;
  updateGoal: (id: string, updates: Partial<Pick<StudentGoal, 'goal_text' | 'status' | 'teacher_note' | 'category'>>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addParentCommunication: (comm: Omit<ParentCommunication, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<ParentCommunication | null>;
  updateParentCommunication: (id: string, updates: Partial<Omit<ParentCommunication, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  deleteParentCommunication: (id: string) => Promise<void>;
  abbreviations: Abbreviation[];
  teacherTitle: string;
  teacherLastName: string;
  shoutouts: Shoutout[];
  addTask?: (task: { text: string; completed: boolean; color: string }) => Promise<any>;
}

// ─── Student Mini Dashboard ───────────────────────────────────────────────────

function StudentMiniDashboard({ student, notes, indicators }: {
  student: { id: string; name: string };
  notes: Note[];
  indicators: any[];
}) {
  const studentNotes = useMemo(() =>
    notes.filter(n => n.student_name === student.name),
    [notes, student.name]
  );

  const indicatorTypeMap = useMemo(() => {
    const map: Record<string, 'positive' | 'neutral' | 'growth'> = {};
    indicators.forEach((ind: any) => { if (ind.label) map[ind.label] = ind.type; });
    return map;
  }, [indicators]);

  // 8-week buckets
  const weeklyData = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Array.from({ length: 8 }, (_, i) => {
      const weekEnd = new Date(startOfToday);
      weekEnd.setDate(startOfToday.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      const weekNotes = studentNotes.filter(n => {
        const d = new Date(n.created_at);
        return d >= weekStart && d <= weekEnd;
      });
      const positive = weekNotes.filter(n => (n.tags || []).some(t => indicatorTypeMap[t] === 'positive')).length;
      const growth = weekNotes.filter(n => (n.tags || []).some(t => indicatorTypeMap[t] === 'growth')).length;
      return {
        label: i === 0 ? 'This wk' : `${i}w ago`,
        total: weekNotes.length,
        positive,
        growth,
        neutral: weekNotes.length - positive - growth,
      };
    }).reverse();
  }, [studentNotes, indicatorTypeMap]);

  const maxWeekly = Math.max(...weeklyData.map(w => w.total), 1);

  // Tag breakdown
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    studentNotes.forEach(n => (n.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [studentNotes]);
  const maxTag = tagCounts[0]?.[1] || 1;

  // Summary stats
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const notesThisWeek = studentNotes.filter(n => new Date(n.created_at) >= weekAgo).length;
  const positiveCount = studentNotes.filter(n => (n.tags || []).some(t => indicatorTypeMap[t] === 'positive')).length;
  const positivePct = studentNotes.length > 0 ? Math.round((positiveCount / studentNotes.length) * 100) : 0;
  const topTag = tagCounts[0]?.[0] ?? '—';

  if (studentNotes.length === 0) {
    return (
      <div className="bg-white rounded-[24px] border border-dashed border-slate-200 p-5 text-center">
        <p className="text-xs font-medium text-slate-400">No notes yet for this student.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[24px] card-shadow border border-slate-100 p-5 space-y-5">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Student Overview</p>

      {/* Stat pills */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[
            { val: studentNotes.length, label: 'Total notes' },
            { val: notesThisWeek, label: 'This week' },
            { val: `${positivePct}%`, label: 'Positive' },
          ].map(({ val, label }) => (
            <div key={label} className="bg-slate-50 rounded-2xl p-3 text-center">
              <div className="text-lg font-black text-slate-800 leading-none">{val}</div>
              <div className="text-[11px] font-bold text-slate-400 mt-1 leading-tight">{label}</div>
            </div>
          ))}
        </div>
        <div className="bg-slate-50 rounded-2xl px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Top tag</span>
          <span className="text-sm font-black text-slate-700 text-right leading-tight">{topTag}</span>
        </div>
      </div>

      {/* 8-week activity + positive/growth trend */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-300 mb-2">8-week activity</p>
        <div className="flex items-end gap-1.5">
          {weeklyData.map((week, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end rounded-t-md overflow-hidden bg-slate-100" style={{ height: 52 }}>
                {week.total > 0 && (
                  <div className="w-full flex flex-col justify-end" style={{ height: `${(week.total / maxWeekly) * 100}%` }}>
                    {week.growth > 0 && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(week.growth / week.total) * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="w-full bg-terracotta/60"
                      />
                    )}
                    {week.neutral > 0 && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(week.neutral / week.total) * 100}%` }}
                        transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
                        className="w-full bg-slate-300"
                      />
                    )}
                    {week.positive > 0 && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(week.positive / week.total) * 100}%` }}
                        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                        className="w-full bg-sage"
                      />
                    )}
                  </div>
                )}
              </div>
              <span className="text-[7px] font-bold text-slate-300 truncate w-full text-center">{week.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400"><span className="w-2 h-2 rounded-sm bg-sage inline-block" /> Positive</span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400"><span className="w-2 h-2 rounded-sm bg-slate-300 inline-block" /> Neutral</span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400"><span className="w-2 h-2 rounded-sm bg-terracotta/60 inline-block" /> Growth area</span>
        </div>
      </div>

      {/* Tag breakdown */}
      {tagCounts.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-300 mb-2">Behavior tags</p>
          <div className="space-y-1.5">
            {tagCounts.map(([tag, count]) => {
              const type = indicatorTypeMap[tag] ?? 'neutral';
              const barColor = type === 'positive' ? 'bg-sage' : type === 'growth' ? 'bg-terracotta' : 'bg-slate-300';
              const textColor = type === 'positive' ? 'text-sage-dark' : type === 'growth' ? 'text-terracotta' : 'text-slate-500';
              return (
                <div key={tag} className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold w-20 flex-shrink-0 truncate ${textColor}`}>{tag}</span>
                  <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / maxTag) * 100}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`h-full rounded-full ${barColor}`}
                    />
                  </div>
                  <span className="text-[11px] font-black text-slate-400 w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Student Progress Chart ───────────────────────────────────────────────────

type ProgressTimeFrame = '4w' | '8w' | '12w' | 'semester' | 'year';

const PROGRESS_FRAMES: { key: ProgressTimeFrame; label: string }[] = [
  { key: '4w',       label: '4 Weeks'  },
  { key: '8w',       label: '8 Weeks'  },
  { key: '12w',      label: '12 Weeks' },
  { key: 'semester', label: 'Semester' },
  { key: 'year',     label: 'Full Year' },
];

function StudentProgressChart({ student, notes, indicators }: {
  student: { id: string; name: string };
  notes: Note[];
  indicators: any[];
}) {
  const [timeFrame, setTimeFrame] = useState<ProgressTimeFrame>('8w');
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const indicatorTypeMap = useMemo(() => {
    const map: Record<string, 'positive' | 'neutral' | 'growth'> = {};
    indicators.forEach((ind: any) => { if (ind.label) map[ind.label] = ind.type; });
    return map;
  }, [indicators]);

  const studentNotes = useMemo(() =>
    notes.filter(n => n.student_name === student.name),
    [notes, student.name]
  );

  // Build weekly buckets (for 4w/8w/12w/semester) or monthly buckets (year)
  const chartData = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (timeFrame === 'year') {
      // School year: Sep of current or prior year → current month
      const schoolYearStart = today.getMonth() >= 8
        ? new Date(today.getFullYear(), 8, 1)       // Sep this year
        : new Date(today.getFullYear() - 1, 8, 1);  // Sep last year
      return Array.from({ length: 10 }, (_, i) => {
        const monthStart = new Date(schoolYearStart);
        monthStart.setMonth(schoolYearStart.getMonth() + i);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthStart.getMonth() + 1);
        const monthNotes = studentNotes.filter(n => {
          const d = new Date(n.created_at);
          return d >= monthStart && d < monthEnd;
        });
        const positive = monthNotes.filter(n =>
          (n.tags || []).some(t => indicatorTypeMap[t] === 'positive')
        ).length;
        const pct = monthNotes.length > 0 ? Math.round((positive / monthNotes.length) * 100) : null;
        const label = monthStart.toLocaleString('default', { month: 'short' });
        return { label, total: monthNotes.length, positive, pct };
      });
    }

    const weeks = timeFrame === '4w' ? 4 : timeFrame === '8w' ? 8 : timeFrame === '12w' ? 12 : 18;
    return Array.from({ length: weeks }, (_, i) => {
      const weekEnd = new Date(startOfToday);
      weekEnd.setDate(startOfToday.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      const weekNotes = studentNotes.filter(n => {
        const d = new Date(n.created_at);
        return d >= weekStart && d <= weekEnd;
      });
      const positive = weekNotes.filter(n =>
        (n.tags || []).some(t => indicatorTypeMap[t] === 'positive')
      ).length;
      const pct = weekNotes.length > 0 ? Math.round((positive / weekNotes.length) * 100) : null;
      const label = i === 0 ? 'Now' : `${i}w`;
      return { label, total: weekNotes.length, positive, pct };
    }).reverse();
  }, [studentNotes, indicatorTypeMap, timeFrame]);

  // Trend: compare avg % of first half vs second half (ignore null weeks)
  const trend = useMemo(() => {
    const withData = chartData.filter(d => d.pct !== null) as { pct: number }[];
    if (withData.length < 4) return 'stable';
    const mid = Math.floor(withData.length / 2);
    const firstHalf = withData.slice(0, mid);
    const secondHalf = withData.slice(mid);
    const avg = (arr: { pct: number }[]) => arr.reduce((s, d) => s + d.pct, 0) / arr.length;
    const diff = avg(secondHalf) - avg(firstHalf);
    if (diff > 5) return 'up';
    if (diff < -5) return 'down';
    return 'stable';
  }, [chartData]);

  const trendConfig = {
    up:     { label: 'Trending Up',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    stable: { label: 'Stable',        bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
    down:   { label: 'Needs Attention', bg: 'bg-red-50',   text: 'text-red-600',     dot: 'bg-red-500'     },
  }[trend];

  // SVG line chart dimensions
  const W = 400, H = 120, PAD_L = 28, PAD_R = 8, PAD_T = 10, PAD_B = 24;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = chartData.length;

  const points = chartData.map((d, i) => ({
    x: PAD_L + (i / Math.max(n - 1, 1)) * plotW,
    y: d.pct !== null ? PAD_T + (1 - d.pct / 100) * plotH : null,
    ...d,
  }));

  const linePoints = points
    .filter(p => p.y !== null)
    .map(p => `${p.x},${p.y}`)
    .join(' ');

  // Area fill path
  const areaPoints = points.filter(p => p.y !== null);
  const areaPath = areaPoints.length > 1
    ? `M${areaPoints[0].x},${PAD_T + plotH} ` +
      areaPoints.map(p => `L${p.x},${p.y}`).join(' ') +
      ` L${areaPoints[areaPoints.length - 1].x},${PAD_T + plotH} Z`
    : '';

  const handleCopyImage = async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Chart copied to clipboard');
    } catch {
      toast.error('Copy failed — try Export PDF instead');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`${student.name} — Behavior Progress`, 14, 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated ${new Date().toLocaleDateString()} · ${PROGRESS_FRAMES.find(f => f.key === timeFrame)?.label}`, 14, 26);
      doc.addImage(dataUrl, 'PNG', 14, 32, 268, 90);
      doc.save(`${student.name.replace(/\s+/g, '_')}_behavior_trend.pdf`);
      toast.success('PDF saved');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (studentNotes.length === 0) return null;

  const hasAnyData = chartData.some(d => d.total > 0);
  if (!hasAnyData) return null;

  return (
    <div className="bg-white rounded-[24px] card-shadow border border-slate-100 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Progress Over Time</p>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${trendConfig.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${trendConfig.dot}`} />
          <span className={`text-[11px] font-black ${trendConfig.text}`}>{trendConfig.label}</span>
        </div>
      </div>

      {/* Time frame selector */}
      <div className="flex gap-1.5 flex-wrap">
        {PROGRESS_FRAMES.map(f => (
          <button
            key={f.key}
            onClick={() => setTimeFrame(f.key)}
            className={`text-[11px] font-black px-3 py-1.5 rounded-full transition-all ${
              timeFrame === f.key
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div ref={chartRef} className="rounded-2xl overflow-hidden bg-white p-1">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
          {/* Y-axis grid lines + labels */}
          {[0, 50, 100].map(pct => {
            const y = PAD_T + (1 - pct / 100) * plotH;
            return (
              <g key={pct}>
                <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                <text x={PAD_L - 4} y={y + 3.5} textAnchor="end" fontSize={7} fill="#94a3b8" fontWeight="700">
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill="#10b981" fillOpacity={0.08} />
          )}

          {/* Volume bars (behind line) */}
          {(() => {
            const maxTotal = Math.max(...chartData.map(d => d.total), 1);
            return points.map((p, i) => {
              if (p.total === 0) return null;
              const barW = Math.max((plotW / n) * 0.5, 6);
              const barH = (p.total / maxTotal) * (plotH * 0.35);
              return (
                <rect
                  key={i}
                  x={p.x - barW / 2}
                  y={PAD_T + plotH - barH}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill="#e2e8f0"
                  fillOpacity={0.7}
                />
              );
            });
          })()}

          {/* Line */}
          {linePoints && (
            <polyline
              points={linePoints}
              fill="none"
              stroke="#10b981"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Data points */}
          {points.map((p, i) =>
            p.y !== null ? (
              <circle key={i} cx={p.x} cy={p.y} r={3} fill="white" stroke="#10b981" strokeWidth={2} />
            ) : null
          )}

          {/* X-axis labels */}
          {points.map((p, i) => {
            const skip = n > 12 ? i % 3 !== 0 : n > 8 ? i % 2 !== 0 : false;
            if (skip && i !== n - 1) return null;
            return (
              <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize={7} fill="#94a3b8" fontWeight="700">
                {p.label}
              </text>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-4 px-1 pb-1">
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded-full" /> % Positive
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <span className="w-3 h-2.5 bg-slate-200 inline-block rounded-sm" /> Volume
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCopyImage}
          disabled={exporting}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl py-2.5 transition-colors disabled:opacity-50"
        >
          <Copy className="w-3.5 h-3.5" /> Copy Image
        </button>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl py-2.5 transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" /> Export PDF
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function StudentDetailView({
  student,
  students,
  notes,
  reports,
  goals,
  indicators,
  commTypes,
  calendarEvents,
  parentCommunications,
  onBack,
  onGenerateReport,
  onNoteUpdate,
  addNote,
  updateNote,
  updateStudent,
  deleteNote,
  deleteReport,
  addGoal,
  updateGoal,
  deleteGoal,
  addParentCommunication,
  updateParentCommunication,
  deleteParentCommunication,
  abbreviations,
  teacherTitle,
  teacherLastName,
  shoutouts,
  addTask,
}: StudentDetailViewProps) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, []);

  const [reportLength, setReportLength] = useState<'Quick Note' | 'Standard' | 'Detailed'>('Standard');
  const [timeRange, setTimeRange] = useState('Last 7 Days');
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingContact, setIsUpdatingContact] = useState(false);
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const teacherSignOff = teacherLastName.trim() ? `\n— ${teacherTitle} ${teacherLastName}` : '';
  const reportToText = (report: ReportData): string =>
    [report.opening, '\nGlow:\n' + report.glow, '\nGrow:\n' + report.grow, '\nGoal:\n' + report.goal, '\n' + report.closing + teacherSignOff].join('\n');
  const [refineInstructions, setRefineInstructions] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editStudentName, setEditStudentName] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editComm, setEditComm] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const [noteContent, setNoteContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedComm, setSelectedComm] = useState<string[]>([]);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<'positive' | 'neutral' | 'growth' | 'comm' | null>(null);
  const [showReportOptions, setShowReportOptions] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const [selectedArchiveIds, setSelectedArchiveIds] = useState<string[]>([]);
  const [expandedArchiveIds, setExpandedArchiveIds] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<'timeline' | 'goals' | 'ai-report' | 'history' | 'quick-note' | 'parents'>('timeline');
  const [quickNote, setQuickNote] = useState<string | null>(null);
  const [isGeneratingQuickNote, setIsGeneratingQuickNote] = useState(false);
  const [quickNoteDays, setQuickNoteDays] = useState<0 | 1 | 3 | 5 | 7>(0);
  const [quickNoteRefineInstructions, setQuickNoteRefineInstructions] = useState('');
  const [isRefiningQuickNote, setIsRefiningQuickNote] = useState(false);
  const quickNoteRef = useRef<HTMLDivElement>(null);
  const goalsRef = useRef<HTMLDivElement>(null);
  const parentCommRef = useRef<HTMLDivElement>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoalText, setNewGoalText] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState<GoalCategory>('academic');
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [isSuggestingGoals, setIsSuggestingGoals] = useState(false);
  const [goalSuggestions, setGoalSuggestions] = useState<Array<{ category: GoalCategory; goal_text: string }>>([]);
  const [undoToast, setUndoToast] = useState<{ label: string; onUndo: () => void } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingDeleteNoteIds, setPendingDeleteNoteIds] = useState<Set<string>>(new Set());
  const [pendingDeleteArchiveIds, setPendingDeleteArchiveIds] = useState<Set<string>>(new Set());
  const [editingStudentName, setEditingStudentName] = useState(false);
  const [studentNameDraft, setStudentNameDraft] = useState(student.name);
  const timelineRef = useRef<HTMLDivElement>(null);
  const aiReportRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const handleDeleteGoal = (id: string) => {
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) deleteGoal(id); }, 3000);
    toast('Goal deleted', {
      duration: 3000,
      action: { label: 'Undo', onClick: () => { cancelled = true; clearTimeout(timer); toast.dismiss(); } },
    });
  };

  const handleClearNote = () => {
    setNoteContent('');
    setSelectedTags([]);
    setSelectedComm([]);
    setImage(null);
    setImagePreview(null);
  };

  const showUndo = (label: string, onUndo: () => void) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ label, onUndo });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000);
  };

  const softDeleteNote = (note: Note) => {
    // Remove from UI immediately
    // We rely on the parent filtering — signal via a local hidden set
    setPendingDeleteNoteIds(prev => new Set(prev).add(note.id));
    showUndo('Note deleted', () => {
      setPendingDeleteNoteIds(prev => { const s = new Set(prev); s.delete(note.id); return s; });
    });
    undoTimerRef.current = setTimeout(() => {
      deleteNote(note.id);
      setPendingDeleteNoteIds(prev => { const s = new Set(prev); s.delete(note.id); return s; });
    }, 5000);
  };

  const softDeleteArchive = (archiveId: string) => {
    setPendingDeleteArchiveIds(prev => new Set(prev).add(archiveId));
    showUndo('Summary deleted', () => {
      setPendingDeleteArchiveIds(prev => { const s = new Set(prev); s.delete(archiveId); return s; });
    });
    undoTimerRef.current = setTimeout(async () => {
      const updatedSummaries = (student.archivedSummaries || []).filter((a: any) => a.id !== archiveId);
      await updateStudent(student.id, { archivedSummaries: updatedSummaries });
      setPendingDeleteArchiveIds(prev => { const s = new Set(prev); s.delete(archiveId); return s; });
      onNoteUpdate();
    }, 5000);
  };

  const handleSaveStudentName = async () => {
    if (!studentNameDraft.trim() || studentNameDraft === student.name) {
      setEditingStudentName(false);
      return;
    }
    await updateStudent(student.id, { name: studentNameDraft.trim() });
    toast.success('Student name updated!');
    setEditingStudentName(false);
    onNoteUpdate();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleComm = (comm: string) => {
    setSelectedComm(prev => prev.includes(comm) ? prev.filter(c => c !== comm) : [...prev, comm]);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const compressed = await imageCompression(f, { maxSizeMB: 0.2, maxWidthOrHeight: 1200 });
    setImage(compressed);
    setImagePreview(URL.createObjectURL(compressed));
  };

  const handleVoiceLog = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsSavingNote(true);
      try {
        const studentNames = students.map(s => s.name);
        const indicatorLabels = indicators.map(i => i.label);
        const result = await parseVoiceLog(transcript, studentNames, indicatorLabels);

        if (result) {
          if (result.content) setNoteContent(result.content);
          if (result.tags && result.tags.length > 0) {
            setNoteContent(prev => prev ? `${prev}\n\nIndicators: ${result.tags.join(', ')}` : `Indicators: ${result.tags.join(', ')}`);
          }
        } else {
          setNoteContent(transcript);
        }
      } catch (err) {
        console.error("Voice parse error:", err);
        setNoteContent(transcript);
      } finally {
        setIsSavingNote(false);
      }
    };
    recognition.start();
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() && !image && selectedTags.length === 0 && selectedComm.length === 0) return;
    setIsSavingNote(true);
    const expandedContent = expandAbbreviations(noteContent, abbreviations);
    try {
      let imageUrl: string | null = null;
      if (image) {
        imageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(image);
        });
      }

      let finalTags = [...selectedTags];
      let isParentComm = selectedComm.length > 0;
      let commType = selectedComm.join(', ');

      if (finalTags.length === 0) {
        try {
          const aiResult = await categorizeNote(expandedContent, new Date().toLocaleString(), !!image, indicators.map(i => i.label));
          finalTags = aiResult.tags ?? [];
        } catch {
          // AI unavailable — save note without tags
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const todayEvent = calendarEvents?.find(e => e.date === today);
      if (todayEvent) {
        finalTags.push(`[${todayEvent.title}]`);
      }

      const newNote: Note = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        content: expandedContent,
        student_name: student.name,
        user_id: '',
        tags: finalTags,
        is_parent_communication: isParentComm,
        parent_communication_type: commType,
        image_url: imageUrl,
        is_pinned: false,
        is_checklist: false,
        checklist_data: [],
        deadline: null,
        created_at: new Date().toISOString()
      };

      // Save to Supabase
      await addNote({
        student_id: student.id,
        content: expandedContent,
        tags: finalTags,
        is_parent_communication: isParentComm,
        parent_communication_type: commType || null,
        image_url: imageUrl,
        is_pinned: false,
      });

      handleClearNote();
      toast.success('Note added successfully');
      onNoteUpdate();
    } catch (err) {
      console.error('Error saving note:', err);
      toast.error('Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  useEffect(() => {
    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      let maxRatio = 0;
      let visibleSection = activeSection;

      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          visibleSection = entry.target.id as 'timeline' | 'goals' | 'ai-report' | 'history' | 'quick-note' | 'parents';
        }
      });

      if (maxRatio > 0) {
        setActiveSection(visibleSection);
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-10% 0px -40% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1.0]
    });

    if (timelineRef.current) observer.observe(timelineRef.current);
    if (goalsRef.current) observer.observe(goalsRef.current);
    if (aiReportRef.current) observer.observe(aiReportRef.current);
    if (historyRef.current) observer.observe(historyRef.current);
    if (quickNoteRef.current) observer.observe(quickNoteRef.current);
    if (parentCommRef.current) observer.observe(parentCommRef.current);

    return () => observer.disconnect();
  }, [activeSection]);

  const scrollToSection = (sectionId: 'timeline' | 'goals' | 'ai-report' | 'history' | 'quick-note' | 'parents') => {
    const refs = {
      'timeline': timelineRef,
      'goals': goalsRef,
      'ai-report': aiReportRef,
      'history': historyRef,
      'quick-note': quickNoteRef,
      'parents': parentCommRef,
    };
    const targetRef = refs[sectionId];
    if (targetRef?.current) {
      const yOffset = -80; // Offset for sticky headers
      const y = targetRef.current.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleToggleArchiveSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedArchiveIds(prev =>
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };

  const handleSelectAllArchives = () => {
    if (!student.archivedSummaries) return;
    if (selectedArchiveIds.length === student.archivedSummaries.length) {
      setSelectedArchiveIds([]);
    } else {
      setSelectedArchiveIds(student.archivedSummaries.map(s => s.id));
    }
  };

  const handleToggleArchiveExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedArchiveIds(prev =>
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };


  const handleCopySelected = () => {
    if (!student.archivedSummaries) return;
    const selected = student.archivedSummaries.filter(s => selectedArchiveIds.includes(s.id));
    const textToCopy = selected.map(s => `[${new Date(s.date).toLocaleDateString()}]\n${s.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(textToCopy);
    toast.success('Copied selected summaries to clipboard');
  };

  const triggerEmail = (text: string, _subjectTitle?: string) => {
    const recipient = parentEmail || '';
    const firstName = student.name.split(' ')[0];
    const subject = encodeURIComponent(`A note about ${firstName}`);

    // Copy full text to clipboard first
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success('Copied to clipboard! Opening email…');

    // mailto: works on both desktop and mobile (opens default mail app / Gmail app)
    let bodyText = text;
    if (bodyText.length > 1800) {
      bodyText = bodyText.substring(0, 1800) + '\n\n[Full text copied to clipboard — paste to see the rest]';
    }
    const body = encodeURIComponent(bodyText);

    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  const handleEmailSelected = () => {
    if (!student.archivedSummaries) return;
    const selected = student.archivedSummaries.filter(s => selectedArchiveIds.includes(s.id));
    const bodyText = selected.map(s => `[${new Date(s.date).toLocaleDateString()}]\n${s.content}`).join('\n\n---\n\n');
    triggerEmail(bodyText);
  };

  const handleDownloadPDF = () => {
    if (!student.archivedSummaries) return;
    const selected = student.archivedSummaries.filter(s => selectedArchiveIds.includes(s.id));

    // Create new jspdf instance
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`${student.name} - Progress History`, 20, 20);

    let yPos = 35;

    selected.forEach(s => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(new Date(s.date).toLocaleDateString(), 20, yPos);
      yPos += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(s.content, 170);
      doc.text(splitText, 20, yPos);
      yPos += (splitText.length * 5) + 10;
    });

    doc.save(`${student.name.replace(/\s+/g, '_')}_Progress_History.pdf`);
    toast.success('PDF downloaded successfully');
  };

  const [parentName, setParentName] = useState(student.parent_guardian_names?.[0] || '');
  const extractContact = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'object') return val.value || '';
    try { const p = JSON.parse(String(val)); return p.value || String(val); } catch { return String(val); }
  };
  const [parentEmail, setParentEmail] = useState(() => extractContact(student.parent_emails?.[0]));
  const [parentPhone, setParentPhone] = useState(() => extractContact(student.parent_phones?.[0]));
  const [birthMonth, setBirthMonth] = useState<string>(student.birth_month?.toString() || '');
  const [birthDay, setBirthDay] = useState<string>(student.birth_day?.toString() || '');
  useEffect(() => {
    setBirthMonth(student.birth_month?.toString() || '');
    setBirthDay(student.birth_day?.toString() || '');
  }, [student.birth_month, student.birth_day]);

  const handleSaveContact = async () => {
    setIsUpdatingContact(true);
    try {
      const bm = parseInt(birthMonth);
      const bd = parseInt(birthDay);
      await updateStudent(student.id, {
        parent_guardian_names: [parentName],
        parent_emails: parentEmail ? [parentEmail] : [],
        parent_phones: parentPhone ? [parentPhone] : [],
        birth_month: !isNaN(bm) && bm >= 1 && bm <= 12 ? bm : null,
        birth_day: !isNaN(bd) && bd >= 1 && bd <= 31 ? bd : null,
      });
      toast.success('Contact info updated!');
      onNoteUpdate();
    } catch (err: any) {
      console.error('Error updating contact info:', err);
      toast.error('Failed to update contact info');
    } finally {
      setIsUpdatingContact(false);
    }
  };

  const clearStudentNotes = async () => {
    if (window.confirm("Are you sure you want to delete all notes for " + student.name + "? This cannot be undone.")) {
      try {
        // Get all notes for this student
        const studentNotesToDelete = notes.filter(n => n.student_name === student.name);
        // Delete each note
        await Promise.all(studentNotesToDelete.map(note => deleteNote(note.id)));
        toast.success('Notes cleared for ' + student.name);
        onNoteUpdate();
      } catch (err) {
        console.error('Error clearing notes:', err);
        toast.error('Failed to clear notes');
      }
    }
  };

  const archiveAndClearNotes = async () => {
    if (!currentReport) return;
    if (window.confirm("Are you sure you want to archive this summary for " + student.name + " AND clear their current notes?")) {
      try {
        const archived = { id: Date.now().toString(), content: reportToText(currentReport), date: new Date().toISOString() };
        await updateStudent(student.id, {
          archivedSummaries: [...(student.archivedSummaries || []), archived]
        });

        // Get all notes for this student and delete them
        const studentNotesToDelete = notes.filter(n => n.student_name === student.name);
        await Promise.all(studentNotesToDelete.map(note => deleteNote(note.id)));

        toast.success('Summary archived & notes cleared!');
        setCurrentReport(null);
        onNoteUpdate();
      } catch (err) {
        console.error('Error archiving and clearing notes:', err);
        toast.error('Failed to archive and clear notes');
      }
    }
  };

  const archiveAndKeepNotes = async () => {
    if (!currentReport) return;
    try {
      const archived = { id: Date.now().toString(), content: reportToText(currentReport), date: new Date().toISOString() };
      await updateStudent(student.id, {
        archivedSummaries: [...(student.archivedSummaries || []), archived]
      });

      toast.success('Summary archived! Notes were kept.');
      setCurrentReport(null);
      onNoteUpdate();
    } catch (err) {
      console.error('Error archiving summary:', err);
      toast.error('Failed to archive summary');
    }
  };

  const handleEmailReport = () => {
    if (!currentReport) return;
    triggerEmail(reportToText(currentReport));
  };

  const handleCopyReport = () => {
    if (!currentReport) return;
    navigator.clipboard.writeText(reportToText(currentReport));
    toast.success('Copied!');
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const handleEmailText = (text: string) => {
    triggerEmail(text);
  };

  const handleCopyShoutouts = () => {
    if (shoutouts.length === 0) return;
    const text = `⭐ Shoutouts for ${student.name}\n\n` +
      shoutouts.map(s =>
        `${new Date(s.created_at).toLocaleDateString()}${s.category ? ` · ${s.category}` : ''}\n${s.content}`
      ).join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success('Shoutouts copied!');
  };

  const handleEmailShoutouts = () => {
    if (shoutouts.length === 0) return;
    const body = shoutouts.map(s =>
      `${new Date(s.created_at).toLocaleDateString()}${s.category ? ` · ${s.category}` : ''}\n${s.content}`
    ).join('\n\n');
    window.location.href = `mailto:?subject=${encodeURIComponent(`⭐ Shoutouts for ${student.name}`)}&body=${encodeURIComponent(body)}`;
  };

  const handleDownloadShoutoutsPDF = () => {
    if (shoutouts.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`⭐ Shoutouts — ${student.name}`, 20, 20);
    let yPos = 35;
    shoutouts.forEach(s => {
      if (yPos > 260) { doc.addPage(); yPos = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const header = `${new Date(s.created_at).toLocaleDateString()}${s.category ? `  ·  ${s.category}` : ''}`;
      doc.text(header, 20, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(s.content, 170);
      doc.text(lines, 20, yPos);
      yPos += (lines.length * 5) + 10;
    });
    doc.save(`${student.name.replace(/\s+/g, '_')}_Shoutouts.pdf`);
    toast.success('PDF downloaded!');
  };

  const handleTextReport = () => {
    if (!currentReport) return;
    window.location.href = `sms:${parentPhone}?body=${encodeURIComponent(reportToText(currentReport))}`;
  };

  const handleCopyParentSquare = () => {
    if (!currentReport) return;
    navigator.clipboard.writeText(reportToText(currentReport));
    alert('Report copied for ParentSquare!');
  };

  const handleGenerateQuickNote = async () => {
    const today = new Date();
    const filtered = notes.filter(n => {
      const d = new Date(n.created_at);
      const noteDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (quickNoteDays === 0) {
        // Today only
        const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return noteDay.getTime() === todayDay.getTime();
      } else if (quickNoteDays === 1) {
        // Yesterday only
        const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        return noteDay.getTime() === yesterday.getTime();
      } else {
        // Last N calendar days (not including today if we want strict past, but include today too)
        const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (quickNoteDays - 1));
        return noteDay >= cutoff;
      }
    });
    const rangeLabel = quickNoteDays === 0 ? 'today' : quickNoteDays === 1 ? 'yesterday' : `the past ${quickNoteDays} days`;
    if (filtered.length === 0 && shoutouts.length === 0) {
      toast.error(`No notes from ${rangeLabel} to base this on.`);
      return;
    }
    setIsGeneratingQuickNote(true);
    try {
      const result = await quickParentNote(filtered, teacherTitle, teacherLastName, student.name, shoutouts);
      setQuickNote(result.trim());
    } catch {
      toast.error('Failed to generate quick note.');
    } finally {
      setIsGeneratingQuickNote(false);
    }
  };

  const handleRefineQuickNote = async () => {
    if (!quickNote || !quickNoteRefineInstructions.trim()) return;
    setIsRefiningQuickNote(true);
    try {
      const refined = await refineQuickNote(quickNote, quickNoteRefineInstructions);
      if (refined) {
        setQuickNote(refined);
        setQuickNoteRefineInstructions('');
      }
    } catch {
      toast.error('Failed to refine note.');
    } finally {
      setIsRefiningQuickNote(false);
    }
  };

  const handleRefine = async () => {
    if (!currentReport || !refineInstructions.trim()) return;
    setIsRefining(true);
    try {
      const refined = await refineReport(currentReport, refineInstructions);
      if (refined) {
        setCurrentReport(refined);
        setRefineInstructions('');
      }
    } finally {
      setIsRefining(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const filtered = filterNotesByTimeRange(notes, timeRange);
      console.log('[handleGenerate] filtered notes count:', filtered.length, 'timeRange:', timeRange);
      const summary = await onGenerateReport(reportLength, filtered);
      console.log('[handleGenerate] summary result:', summary);
      if (summary) setCurrentReport(summary);
      else toast.error('Failed to generate report. Please try again.');
    } catch (err: any) {
      toast.error(`Report error: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const filterNotesByTimeRange = (notesToFilter: Note[], range: string) => {
    const now = new Date();
    return notesToFilter.filter(n => {
      const noteDate = new Date(n.created_at);

      if (range === 'Custom Range') {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999); // Include the whole end day
        return noteDate >= start && noteDate <= end;
      }

      const diffTime = Math.abs(now.getTime() - noteDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (range === 'Today') return diffDays <= 1;
      if (range === 'Last 7 Days') return diffDays <= 7;
      if (range === '15 Days') return diffDays <= 15;
      if (range === 'Last 30 Days') return diffDays <= 30;
      if (range === '60 Days') return diffDays <= 60;
      if (range === 'Whole Year') return diffDays <= 365;
      return true;
    });
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditStudentName(note.student_name);
    setEditTags(note.tags);
    setEditComm(note.parent_communication_type ? note.parent_communication_type.split(', ') : []);
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId) return;
    setIsUpdating(true);
    try {
      const expandedEditContent = expandAbbreviations(editContent, abbreviations);
      await updateNote(editingNoteId, {
        content: expandedEditContent,
        student_id: students.find(s => s.name === editStudentName)?.id || '',
        tags: editTags,
        is_parent_communication: editComm.length > 0,
        parent_communication_type: editComm.length > 0 ? editComm.join(', ') : null,
      });
      setEditingNoteId(null);
      toast.success('Note updated successfully');
      onNoteUpdate();
    } catch (err) {
      console.error('Error updating note:', err);
      toast.error('Failed to update note');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleEditTag = (tag: string) => {
    setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleEditComm = (comm: string) => {
    setEditComm(prev => prev.includes(comm) ? prev.filter(c => c !== comm) : [...prev, comm]);
  };

  // Hero stats
  const heroStats = useMemo(() => {
    const studentNotes = notes.filter(n => n.student_name === student.name);
    const indicatorTypeMap: Record<string, string> = {};
    indicators.forEach((ind: any) => { if (ind.label) indicatorTypeMap[ind.label] = ind.type; });
    const positiveCount = studentNotes.filter(n => (n.tags || []).some((t: string) => indicatorTypeMap[t] === 'positive')).length;
    const positivePct = studentNotes.length > 0 ? Math.round((positiveCount / studentNotes.length) * 100) : 0;
    const lastNote = studentNotes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const daysSince = lastNote
      ? Math.floor((Date.now() - new Date(lastNote.created_at).getTime()) / 86400000)
      : null;
    const lastLogged = daysSince === null ? 'Never' : daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince}d ago`;
    return { total: studentNotes.length, positivePct, lastLogged };
  }, [notes, student.name, indicators]);

  // Hero gradient by class period (cycles through a palette)
  const HERO_GRADIENTS = [
    'from-violet-500 to-indigo-600',
    'from-rose-500 to-pink-600',
    'from-amber-400 to-orange-500',
    'from-emerald-500 to-teal-600',
    'from-sky-500 to-blue-600',
    'from-fuchsia-500 to-purple-600',
  ];
  const periodNum = parseInt(student.class_period || '0') || 0;
  const heroGradient = HERO_GRADIENTS[periodNum % HERO_GRADIENTS.length];

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 pb-10 relative">
      {/* Print-Only Header */}
      <div className="hidden print:flex flex-col items-center justify-center py-8 border-b-2 border-slate-100 mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="p-3 bg-slate-50 rounded-2xl">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Student Progress Report</h1>
        </div>
        <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
          <span>{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
          <span>Official Record</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-2 no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-all">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-[11px] font-bold">Back to Roster</span>
        </button>
      </div>

      {/* Hero Banner */}
      <div className={`bg-linear-to-br ${heroGradient} rounded-[36px] shadow-xl overflow-hidden no-print`}>
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-5">
            {/* Photo */}
            <div className="relative flex-shrink-0">
              {student.photo_url ? (
                <img src={student.photo_url} alt={student.name} className="w-24 h-24 rounded-[24px] object-cover ring-4 ring-white/30 shadow-lg" />
              ) : (
                <div className="w-24 h-24 bg-white/20 rounded-[24px] flex items-center justify-center text-white font-black text-4xl font-display shadow-lg ring-4 ring-white/30">
                  {student.name.split(' ').map((n: string) => n[0]).join('')}
                </div>
              )}
            </div>

            {/* Name + period */}
            <div className="flex-1 min-w-0">
              {editingStudentName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={studentNameDraft}
                    onChange={e => setStudentNameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveStudentName(); if (e.key === 'Escape') setEditingStudentName(false); }}
                    autoFocus
                    className="text-xl font-bold text-white bg-white/20 border border-white/40 rounded-xl px-3 py-1 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder-white/50"
                  />
                  <button onClick={handleSaveStudentName} className="text-[11px] font-bold text-white/80 hover:text-white">Save</button>
                  <button onClick={() => setEditingStudentName(false)} className="text-[11px] font-bold text-white/60 hover:text-white/80">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h2 className="text-[28px] font-black text-white font-display leading-tight drop-shadow-sm">
                    {student.name.split(' ')[0]}{' '}
                    <span className="text-white/80">{student.name.split(' ').slice(1).map((n: string) => n[0]).join('')}.</span>
                  </h2>
                  <button onClick={() => { setStudentNameDraft(student.name); setEditingStudentName(true); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-white/60 hover:text-white" title="Edit name">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <span className="inline-block mt-1.5 px-3 py-1 bg-white/20 text-white text-[11px] font-bold rounded-full backdrop-blur-sm">
                Period {student.class_period || '—'}
              </span>
            </div>
          </div>

          {/* Inline stats strip */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { val: heroStats.total, label: 'Total notes' },
              { val: heroStats.lastLogged, label: 'Last noted' },
              { val: `${heroStats.positivePct}%`, label: 'Positive' },
            ].map(({ val, label }) => (
              <div key={label} className="bg-white/15 backdrop-blur-sm rounded-2xl px-3 py-2.5 text-center">
                <div className="text-[22px] font-black text-white leading-none">{val}</div>
                <div className="text-[11px] font-bold text-white/70 mt-0.5 uppercase tracking-wide">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <StudentMiniDashboard student={student} notes={notes} indicators={indicators} />

      <StudentProgressChart student={student} notes={notes} indicators={indicators} />

      <div className="bg-white px-5 py-4 rounded-2xl card-shadow border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Parent Contact</h3>
          <button
            type="button"
            onClick={handleSaveContact}
            disabled={isUpdatingContact}
            className="text-[11px] font-black text-sage hover:text-sage-dark disabled:opacity-50"
          >
            {isUpdatingContact ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input
            id="parent_name"
            name="parent_name"
            type="text"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            placeholder="Parent name..."
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
          />
          <input
            id="parent_email"
            name="parent_email"
            type="email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            placeholder="Email..."
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
          />
          <input
            id="parent_phone"
            name="parent_phone"
            type="tel"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            placeholder="Phone..."
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Cake className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
          <span className="text-[11px] text-slate-400 font-medium w-16">Birthday</span>
          <select
            value={birthMonth}
            onChange={(e) => setBirthMonth(e.target.value)}
            className="px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
          >
            <option value="">Month</option>
            {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={birthDay}
            onChange={(e) => setBirthDay(e.target.value)}
            className="px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
          >
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="sticky top-4 z-40 bg-cream/90 backdrop-blur-md p-2 rounded-2xl shadow-sm border border-slate-100/50 flex flex-col gap-1.5 no-print">
        {/* Row 1: student-focused */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => scrollToSection('quick-note')}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-black transition-all",
              activeSection === 'quick-note' ? "bg-terracotta text-white shadow-md shadow-terracotta/20" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
          >
            Note
          </button>
          <button
            onClick={() => scrollToSection('timeline')}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-black transition-all",
              activeSection === 'timeline' ? "bg-sage text-white shadow-md shadow-sage/20" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
          >
            Timeline
          </button>
          {isFullMode && (
            <button
              onClick={() => scrollToSection('goals')}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-black transition-all",
                activeSection === 'goals' ? "bg-violet-500 text-white shadow-md shadow-violet-500/20" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              Goals
            </button>
          )}
        </div>
        {/* Row 2: communication-focused */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => scrollToSection('parents')}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-black transition-all",
              activeSection === 'parents' ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
          >
            Parents
          </button>
          <button
            onClick={() => scrollToSection('ai-report')}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-black transition-all",
              activeSection === 'ai-report' ? "bg-sage text-white shadow-md shadow-sage/20" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
          >
            Compose
          </button>
          <button
            onClick={() => scrollToSection('history')}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-black transition-all",
              activeSection === 'history' ? "bg-sage text-white shadow-md shadow-sage/20" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
          >
            History
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-8 card-shadow border border-sage/5 space-y-6 no-print">
        <label htmlFor="quick_note" className="text-[15px] font-black text-slate-400 ml-1">Quick Note</label>
        <div className="relative border border-slate-100/50 rounded-[32px] p-1 bg-white shadow-inner">
          <textarea
            id="quick_note"
            name="quick_note"
            ref={noteInputRef}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder={`Add a quick note for ${student.name}...`}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full min-h-[140px] p-6 bg-transparent border-0 focus:outline-none focus:ring-4 focus:ring-sage/5 rounded-[32px] transition-all text-base font-medium resize-none leading-relaxed"
          />
          <div className="absolute flex flex-col gap-2 right-4 bottom-4">
            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-sm border border-slate-100 hover:text-sage transition-all z-10">
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleVoiceLog}
              className={cn(
                "p-2.5 rounded-xl shadow-sm border border-slate-100 transition-all z-10",
                isListening ? "bg-terracotta text-white animate-pulse" : "bg-white text-slate-400 hover:text-terracotta"
              )}
            >
              <Mic className="w-4 h-4" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
          </div>
        </div>

        {imagePreview && (
          <div className="relative w-24 h-24 mt-2">
            <img src={imagePreview} className="w-full h-full object-cover rounded-2xl border-2 border-white shadow-md" />
            <button onClick={() => { setImage(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-terracotta text-white p-1 rounded-full shadow-lg"><X className="w-3 h-3" /></button>
          </div>
        )}

        <div className="space-y-2 pt-2">
          {([
            { key: 'positive' as const, label: 'Positive', color: 'emerald', items: indicators.filter(b => b.type === 'positive'), selectedCount: indicators.filter(b => b.type === 'positive' && selectedTags.includes(b.label)).length },
            { key: 'neutral' as const, label: 'Neutral', color: 'amber', items: indicators.filter(b => b.type === 'neutral'), selectedCount: indicators.filter(b => b.type === 'neutral' && selectedTags.includes(b.label)).length },
            { key: 'growth' as const, label: 'Growth Areas', color: 'rose', items: indicators.filter(b => b.type === 'growth'), selectedCount: indicators.filter(b => b.type === 'growth' && selectedTags.includes(b.label)).length },
            { key: 'comm' as const, label: 'Family Comm', color: 'sky', items: commTypes, selectedCount: selectedComm.length },
          ].map(cat => {
            const isOpen = expandedCategory === cat.key;
            const headerColors: Record<string, string> = {
              emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
              amber: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100',
              rose: 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100',
              sky: 'text-sky-600 bg-sky-50 border-sky-200 hover:bg-sky-100',
            };
            const badgeColors: Record<string, string> = {
              emerald: 'bg-emerald-500 text-white',
              amber: 'bg-amber-400 text-white',
              rose: 'bg-rose-500 text-white',
              sky: 'bg-sky-500 text-white',
            };
            const activeItemColors: Record<string, string> = {
              emerald: 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200',
              amber: 'bg-amber-400 border-amber-400 text-white shadow-lg shadow-amber-200',
              rose: 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-200',
              sky: 'bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-200',
            };
            const inactiveItemColors: Record<string, string> = {
              emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
              amber: 'bg-amber-50 border-amber-200 text-amber-700',
              rose: 'bg-rose-50 border-rose-200 text-rose-700',
              sky: 'bg-sky-50 border-sky-200 text-sky-700',
            };
            return (
              <div key={cat.key}>
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isOpen ? null : cat.key)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 font-black text-sm transition-all",
                    headerColors[cat.color]
                  )}
                >
                  <span className="uppercase tracking-widest text-[11px]">{cat.label}</span>
                  <div className="flex items-center gap-2">
                    {cat.selectedCount > 0 && (
                      <span className={cn("text-[11px] font-black px-2 py-0.5 rounded-full", badgeColors[cat.color])}>
                        {cat.selectedCount}
                      </span>
                    )}
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
                  </div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-2 pt-3 pb-1 px-1">
                        {cat.items.map((b: any) => {
                          const isSelected = cat.key === 'comm' ? selectedComm.includes(b.label) : selectedTags.includes(b.label);
                          return (
                            <motion.button
                              key={b.label}
                              onClick={() => cat.key === 'comm' ? toggleComm(b.label) : toggleTag(b.label)}
                              whileTap={{ scale: 0.88 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                              className={cn(
                                "px-3.5 py-2 rounded-2xl text-sm font-bold flex items-center gap-1.5 transition-colors border-2",
                                isSelected ? activeItemColors[cat.color] : inactiveItemColors[cat.color]
                              )}
                            >
                              <span className="text-base leading-none">{b.icon ?? getIconForName(b.icon_name, b.type)}</span> {b.label}
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {(noteContent || image || selectedTags.length > 0 || selectedComm.length > 0) && (
            <button
              type="button"
              onClick={handleClearNote}
              className="py-2.5 px-6 bg-slate-100 text-slate-500 rounded-xl font-black text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={isSavingNote || (!noteContent.trim() && !image && selectedTags.length === 0 && selectedComm.length === 0)}
            className="py-1.5 px-8 bg-linear-to-r from-orange-400 to-orange-500 text-white rounded-full font-black text-xl hover:brightness-110 transition-all shadow-md shadow-orange-200/50 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSavingNote ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Save Note</>}
          </button>
        </div>
      </div>

      {/* Quick Note to Parent */}
      <div id="quick-note" ref={quickNoteRef} className="space-y-4 scroll-mt-header">
        <div>
          <h3 className="text-sm font-bold text-terracotta flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Quick Note to Parent
          </h3>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            Choose which observations to include
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { label: 'Today', days: 0 },
            { label: 'Yesterday', days: 1 },
            { label: 'Last 3 Days', days: 3 },
            { label: 'Last 5 Days', days: 5 },
            { label: 'Last 7 Days', days: 7 },
          ] as { label: string; days: 0 | 1 | 3 | 5 | 7 }[]).map(opt => (
            <button
              key={opt.days}
              type="button"
              onClick={() => { setQuickNoteDays(opt.days); setQuickNote(null); }}
              className={cn(
                "px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border-2 transition-all",
                quickNoteDays === opt.days
                  ? "bg-terracotta text-white border-terracotta shadow-md"
                  : "bg-white text-slate-400 border-slate-100 hover:border-terracotta/40"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleGenerateQuickNote}
          disabled={isGeneratingQuickNote}
          className="w-full py-5 bg-terracotta text-white rounded-full font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-terracotta/20 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isGeneratingQuickNote
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Writing note...</>
            : <><MessageSquare className="w-4 h-4" /> Draft a Note Home</>
          }
        </button>

        <AnimatePresence>
          {quickNote && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-[28px] border border-terracotta/10 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-terracotta">
                  {quickNoteDays === 0 ? "Today's Note" : quickNoteDays === 1 ? "Yesterday's Note" : `Last ${quickNoteDays} Days`}
                </span>
                <button onClick={() => setQuickNote(null)} className="text-slate-300 hover:text-terracotta"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{quickNote}</p>

              {/* Refine with AI */}
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={quickNoteRefineInstructions}
                    onChange={(e) => setQuickNoteRefineInstructions(e.target.value)}
                    placeholder="Refine... (e.g. 'shorter', 'more positive')"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none focus:border-terracotta/40 pr-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && quickNoteRefineInstructions.trim() && !isRefiningQuickNote) {
                        handleRefineQuickNote();
                      }
                    }}
                  />
                  <Sparkles className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300" />
                </div>
                <button
                  type="button"
                  onClick={handleRefineQuickNote}
                  disabled={isRefiningQuickNote || !quickNoteRefineInstructions.trim()}
                  className="px-4 py-2 bg-terracotta text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {isRefiningQuickNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {isRefiningQuickNote ? 'Refining...' : 'Refine'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(quickNote); toast.success('Copied!'); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button
                  type="button"
                  onClick={() => triggerEmail(quickNote, `Note about ${student.name}`)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all"
                >
                  <Mail className="w-3.5 h-3.5" /> Email Parent
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = `sms:${parentPhone}?body=${encodeURIComponent(quickNote)}`; }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-green-600 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Text
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const archived = { id: Date.now().toString(), content: `Quick Note to Parent\n\n${quickNote}`, date: new Date().toISOString() };
                    await updateStudent(student.id, { archivedSummaries: [...(student.archivedSummaries || []), archived] });
                    toast.success('Saved to history!');
                    onNoteUpdate();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-terracotta/10 text-terracotta rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-terracotta/20 transition-all"
                >
                  <Archive className="w-3.5 h-3.5" /> Save to History
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div id="timeline" ref={timelineRef} className="space-y-6 pt-4 scroll-mt-header">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-black text-slate-400 ml-1">Observation Timeline</h3>
          {shoutouts.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-amber-400 mr-1">⭐ {shoutouts.length}</span>
              <button onClick={handleCopyShoutouts} title="Copy shoutouts" className="p-1.5 text-slate-300 hover:text-slate-600 transition-all">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleEmailShoutouts} title="Email shoutouts" className="p-1.5 text-slate-300 hover:text-blue-500 transition-all">
                <Mail className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleDownloadShoutoutsPDF} title="Download PDF" className="p-1.5 text-slate-300 hover:text-terracotta transition-all">
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
          {/* Shoutout entries */}
          {shoutouts.map((shoutout) => (
            <div key={`shoutout-${shoutout.id}`} className="relative">
              <div className="absolute -left-[29px] top-1 w-6 h-6 bg-amber-50 border-2 border-amber-400 rounded-full flex items-center justify-center z-10 shadow-sm">
                <span className="text-[10px]">⭐</span>
              </div>
              <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400">{new Date(shoutout.created_at).toLocaleDateString()}</span>
                  {shoutout.category && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-600 text-[11px] font-black rounded-md">{shoutout.category}</span>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{shoutout.content}</p>
              </div>
            </div>
          ))}
          {notes.filter(n => !pendingDeleteNoteIds.has(n.id)).map((note) => (
            <div key={note.id} className="relative">
              <div className="absolute -left-[29px] top-1 w-6 h-6 bg-white border-2 border-sage rounded-full flex items-center justify-center z-10 shadow-sm">
                <div className="w-2 h-2 bg-sage rounded-full" />
              </div>
              <div className="bg-white p-6 rounded-[32px] card-shadow border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">{new Date(note.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    {note.is_parent_communication && (
                      <span className="px-2 py-1 bg-terracotta/10 text-terracotta text-[11px] font-black rounded-md flex items-center gap-1">
                        <MessageSquare className="w-2.5 h-2.5" /> {note.parent_communication_type}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyText(note.content)}
                      className="p-1.5 text-slate-300 hover:text-slate-800 transition-all"
                      title="Copy Note"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEmailText(note.content)}
                      className="p-1.5 text-slate-300 hover:text-blue-500 transition-all"
                      title="Email Parent"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditing(note)}
                      className="p-1.5 text-slate-300 hover:text-sage transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => softDeleteNote(note)}
                      className="p-1.5 text-slate-300 hover:text-terracotta transition-all"
                      title="Delete Note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editingNoteId === note.id ? (
                  <div className="space-y-4 pt-2">
                    <div className="relative">
                      <label htmlFor="edit_student_name" className="sr-only">Edit Student Name</label>
                      <input
                        id="edit_student_name"
                        name="edit_student_name"
                        type="text"
                        list="detail-edit-student-names"
                        value={editStudentName}
                        onChange={(e) => setEditStudentName(e.target.value)}
                        placeholder="Student Name"
                        autoComplete="off"
                        data-1p-ignore
                        data-lpignore="true"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage"
                      />
                      <datalist id="detail-edit-student-names">
                        {students.map(s => (
                          <option key={s.id} value={s.name} />
                        ))}
                      </datalist>
                    </div>
                    <label htmlFor="edit_note_content" className="sr-only">Edit Note Content</label>
                    <textarea
                      id="edit_note_content"
                      name="edit_note_content"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage min-h-[100px]"
                    />
                    <div className="flex flex-wrap gap-2">
                      {indicators.map(ind => (
                        <button
                          key={ind.label}
                          onClick={() => toggleEditTag(ind.label)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all border",
                            editTags.includes(ind.label)
                              ? "bg-sage text-white border-sage"
                              : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                          )}
                        >
                          {ind.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_COMM_BUTTONS.map(comm => (
                        <button
                          key={comm.label}
                          onClick={() => toggleEditComm(comm.label)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all border",
                            editComm.includes(comm.label)
                              ? "bg-blue-500 text-white border-blue-500"
                              : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                          )}
                        >
                          {comm.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={isUpdating}
                        className="flex-1 py-3 bg-sage text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-sage-dark transition-all flex items-center justify-center gap-2"
                      >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">{note.content}</p>
                    {note.image_url && (
                      <img src={note.image_url} alt="Observation" className="w-full h-48 object-cover rounded-2xl border border-slate-100" referrerPolicy="no-referrer" />
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {note.tags.map(t => {
                        const indicator = indicators.find(i => i.label === t);
                        const isComm = note.is_parent_communication && note.parent_communication_type?.includes(t);

                        let colorClass = "bg-slate-50 text-slate-400 border-slate-100";
                        if (indicator?.type === 'positive') colorClass = "bg-sage/10 text-sage border-sage/20";
                        if (indicator?.type === 'growth') colorClass = "bg-terracotta/10 text-terracotta border-terracotta/20";
                        if (indicator?.type === 'neutral') colorClass = "bg-amber-100 text-amber-600 border-amber-200";
                        if (isComm) colorClass = "bg-blue-50 text-blue-500 border-blue-100";

                        return (
                          <span key={t} className={cn("px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border", colorClass)}>
                            {t}
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-slate-200">
              <p className="text-sm text-slate-400 font-medium">No notes yet for this student.</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100" />

      {/* ─── Goals ─────────────────────────────────────────────── */}
      {/* ─── Parent Communication Log ─────────────────────────────────── */}
      <div id="parents" ref={parentCommRef} className="bg-white rounded-[32px] p-6 card-shadow border border-slate-100 space-y-4 scroll-mt-header no-print">
        <ParentCommunicationLog
          student={student}
          communications={parentCommunications}
          onAdd={addParentCommunication}
          onUpdate={updateParentCommunication}
          onDelete={deleteParentCommunication}
          addTask={addTask}
        />
      </div>

      <div id="goals" ref={goalsRef} className={cn("space-y-4 scroll-mt-header", !isFullMode && "hidden")}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-violet-600 flex items-center gap-2">
              <Target className="w-4 h-4" /> Student Goals
            </h3>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              {goals.length} active goal{goals.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {goals.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const doc = new jsPDF();
                  const margin = 20;
                  const pageWidth = doc.internal.pageSize.getWidth();
                  const contentWidth = pageWidth - margin * 2;
                  let y = margin;

                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(16);
                  doc.setTextColor(109, 76, 170);
                  doc.text(`${student.name} — Goal Card`, margin, y);
                  y += 10;

                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(9);
                  doc.setTextColor(150, 150, 150);
                  doc.text(`Printed ${new Date().toLocaleDateString()}`, margin, y);
                  y += 12;

                  goals.forEach((goal, i) => {
                    const stage = GOAL_STAGES[goal.status];
                    if (y > 250) { doc.addPage(); y = margin; }

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9);
                    doc.setTextColor(100, 100, 100);
                    doc.text(`${GOAL_CATEGORY_LABELS[goal.category].toUpperCase()} · ${stage.label.toUpperCase()}`, margin, y);
                    y += 6;

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(11);
                    doc.setTextColor(30, 30, 30);
                    const lines = doc.splitTextToSize(goal.goal_text, contentWidth - 10);
                    doc.text(lines, margin + 4, y);
                    y += lines.length * 6 + 4;

                    // Progress boxes
                    const boxSize = 7;
                    const boxGap = 3;
                    const stages = ['Planted', 'Sprouting', 'Growing', 'Bloomed'];
                    stages.forEach((s, si) => {
                      const bx = margin + 4 + si * (boxSize + boxGap);
                      if (si <= goal.status) {
                        doc.setFillColor(109, 76, 170);
                        doc.roundedRect(bx, y, boxSize, boxSize, 1, 1, 'F');
                        doc.setTextColor(255, 255, 255);
                      } else {
                        doc.setDrawColor(200, 200, 200);
                        doc.roundedRect(bx, y, boxSize, boxSize, 1, 1, 'S');
                        doc.setTextColor(180, 180, 180);
                      }
                      doc.setFontSize(5);
                      doc.text(s[0], bx + 2.5, y + 5);
                    });
                    y += boxSize + 10;

                    if (i < goals.length - 1) {
                      doc.setDrawColor(230, 230, 230);
                      doc.line(margin, y - 4, pageWidth - margin, y - 4);
                    }
                  });

                  doc.save(`${student.name.replace(/\s+/g, '_')}_Goals.pdf`);
                }}
                className="p-2 rounded-xl text-violet-500 hover:bg-violet-50 transition-colors"
                title="Print Goal Card"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowGoalForm(f => !f); setGoalSuggestions([]); setNewGoalText(''); }}
              className="p-2 rounded-xl text-violet-500 hover:bg-violet-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Existing goals */}
        {goals.length === 0 && !showGoalForm && (
          <p className="text-xs text-slate-400 text-center py-6">No goals yet — tap + to add one or let AI suggest some.</p>
        )}

        <div className="space-y-3">
          {goals.map(goal => {
            const stage = GOAL_STAGES[goal.status];
            return (
              <div key={goal.id} className="bg-white rounded-2xl p-4 border border-violet-100 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-violet-400">
                      {GOAL_CATEGORY_LABELS[goal.category]}
                    </span>
                    <p className="text-sm font-medium text-slate-700 mt-0.5 leading-snug">{goal.goal_text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="p-1 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Status tap-to-advance */}
                <button
                  type="button"
                  onClick={() => updateGoal(goal.id, { status: ((goal.status + 1) % 4) as GoalStatus })}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                    goal.status === 0 && "bg-slate-100 text-slate-500 hover:bg-slate-200",
                    goal.status === 1 && "bg-teal-50 text-teal-600 hover:bg-teal-100",
                    goal.status === 2 && "bg-amber-50 text-amber-600 hover:bg-amber-100",
                    goal.status === 3 && "bg-violet-50 text-violet-600 hover:bg-violet-100",
                  )}
                >
                  <span>{stage.emoji}</span>
                  <span>{stage.label}</span>
                  <span className="text-[11px] opacity-50">tap to advance</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Add / Suggest form */}
        <AnimatePresence>
          {showGoalForm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-violet-50 rounded-2xl p-4 border border-violet-100 space-y-3"
            >
              {/* AI suggest button */}
              <button
                type="button"
                disabled={isSuggestingGoals}
                onClick={async () => {
                  setIsSuggestingGoals(true);
                  setGoalSuggestions([]);
                  try {
                    const suggestions = await suggestGoals(student.name, notes);
                    setGoalSuggestions(suggestions);
                  } catch {
                    toast.error('Could not generate suggestions');
                  } finally {
                    setIsSuggestingGoals(false);
                  }
                }}
                className="w-full py-3 bg-violet-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
              >
                {isSuggestingGoals ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isSuggestingGoals ? 'Thinking…' : 'Suggest from Notes'}
              </button>

              {/* AI suggestions */}
              {goalSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400">Tap a suggestion to add it</p>
                  {goalSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={isSavingGoal}
                      onClick={async () => {
                        setIsSavingGoal(true);
                        await addGoal({ student_id: student.id, category: s.category, goal_text: s.goal_text, status: 0 });
                        setGoalSuggestions(prev => prev.filter((_, idx) => idx !== i));
                        setIsSavingGoal(false);
                        toast.success('Goal added');
                      }}
                      className="w-full text-left p-3 bg-white rounded-xl border border-violet-100 hover:border-violet-300 transition-all"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-widest text-violet-400 block">
                        {GOAL_CATEGORY_LABELS[s.category]}
                      </span>
                      <span className="text-sm text-slate-700 font-medium">{s.goal_text}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Manual entry */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400">Or write your own</p>
                <select
                  value={newGoalCategory}
                  onChange={e => setNewGoalCategory(e.target.value as GoalCategory)}
                  className="w-full px-3 py-2 bg-white border border-violet-100 rounded-xl text-xs font-medium focus:outline-none focus:border-violet-400"
                >
                  {(Object.keys(GOAL_CATEGORY_LABELS) as GoalCategory[]).map(k => (
                    <option key={k} value={k}>{GOAL_CATEGORY_LABELS[k]}</option>
                  ))}
                </select>
                <textarea
                  value={newGoalText}
                  onChange={e => setNewGoalText(e.target.value)}
                  placeholder="I can…"
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-violet-100 rounded-xl text-sm font-medium resize-none focus:outline-none focus:border-violet-400 placeholder:text-slate-300"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!newGoalText.trim() || isSavingGoal}
                    onClick={async () => {
                      if (!newGoalText.trim()) return;
                      setIsSavingGoal(true);
                      await addGoal({ student_id: student.id, category: newGoalCategory, goal_text: newGoalText.trim(), status: 0 });
                      setNewGoalText('');
                      setIsSavingGoal(false);
                      setShowGoalForm(false);
                      toast.success('Goal added');
                    }}
                    className="flex-1 py-2.5 bg-violet-500 text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isSavingGoal ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save Goal
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowGoalForm(false); setGoalSuggestions([]); setNewGoalText(''); }}
                    className="px-4 py-2.5 bg-white text-slate-400 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all border border-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-6 border-t border-slate-100" />

      <div id="ai-report" ref={aiReportRef} className="space-y-6 pt-4 scroll-mt-header">
        <div className="bg-cream/30 p-8 rounded-[40px] border border-sage/10 space-y-6">
          <div className="space-y-4">
            {/* Primary action — always visible */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || (notes.length === 0 && shoutouts.length === 0)}
              className="w-full py-5 bg-linear-to-r from-orange-400 to-orange-500 text-white rounded-full font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-orange-200/50 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Compose with AI</>}
            </button>
            {notes.length === 0 && shoutouts.length === 0 && <p className="text-[11px] text-center text-slate-400 italic">No notes available to compose a report.</p>}

            {/* Customize options — hidden by default */}
            <button
              type="button"
              onClick={() => setShowReportOptions(v => !v)}
              className="flex items-center gap-1.5 mx-auto text-slate-400 hover:text-slate-600 transition-colors text-[11px] font-black uppercase tracking-widest"
            >
              <Settings2 className="w-3 h-3" />
              Customize ({timeRange}, {reportLength})
              <ChevronDown className={cn('w-3 h-3 transition-transform', showReportOptions && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showReportOptions && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-6 overflow-hidden">
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Timeframe</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {['Today', 'Last 7 Days', '15 Days', 'Last 30 Days', '60 Days', 'Whole Year', 'Custom Range'].map(range => (
                        <button key={range} onClick={() => setTimeRange(range)} className={cn("py-2 rounded-xl text-[10px] font-black uppercase tracking-wide border-2 transition-all leading-tight px-1", timeRange === range ? "bg-orange-400 text-white border-orange-400 shadow-md" : "bg-white text-slate-400 border-slate-100 hover:border-orange-300")}>
                          {range}
                        </button>
                      ))}
                    </div>
                    {timeRange === 'Custom Range' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <label htmlFor="custom_start_date" className="text-[8px] font-bold uppercase tracking-widest text-slate-400 ml-1">Start Date</label>
                          <input id="custom_start_date" name="custom_start_date" type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} autoComplete="off" data-1p-ignore data-lpignore="true" className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-[11px] focus:outline-none focus:ring-2 focus:ring-sage/20" />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="custom_end_date" className="text-[8px] font-bold uppercase tracking-widest text-slate-400 ml-1">End Date</label>
                          <input id="custom_end_date" name="custom_end_date" type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} autoComplete="off" data-1p-ignore data-lpignore="true" className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-[11px] focus:outline-none focus:ring-2 focus:ring-sage/20" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Report Type</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Quick Note', 'Standard', 'Detailed'] as const).map(len => (
                        <button key={len} onClick={() => setReportLength(len)} className={cn("py-2 rounded-xl text-[10px] font-black uppercase tracking-wide border-2 transition-all leading-tight px-1", reportLength === len ? "bg-orange-400 text-white border-orange-400 shadow-md" : "bg-white text-slate-400 border-slate-100 hover:border-orange-300")}>
                          {len}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {currentReport && (
            <>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-cream border border-cream-dark shadow-md rounded-[28px] overflow-hidden space-y-0">
              {/* Document header */}
              <div className="border-b-4 border-sage/30 px-8 pt-7 pb-5 flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sage/60 mb-1">Composed Report · {timeRange}</p>
                  <p className="text-base font-black text-slate-800">{student.name}</p>
                </div>
                <button onClick={() => setCurrentReport(null)} className="text-slate-300 hover:text-terracotta mt-1"><X className="w-4 h-4" /></button>
              </div>
              {/* Document body */}
              <div className="px-8 py-6 space-y-5">
                <p className="text-sm text-slate-500 italic leading-relaxed">{currentReport.opening}</p>
                <div className="border-l-4 border-emerald-400 pl-4 space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">Glow</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{currentReport.glow}</p>
                </div>
                <div className="border-l-4 border-amber-400 pl-4 space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-600">Grow</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{currentReport.grow}</p>
                </div>
                <div className="border-l-4 border-blue-400 pl-4 space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Goal</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{currentReport.goal}</p>
                </div>
                <p className="text-sm text-slate-500 italic leading-relaxed">{currentReport.closing}</p>
              </div>

              {/* Refinement Section */}
              <div className="space-y-3 px-8 pb-6 border-t border-cream-dark pt-5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <label htmlFor="refine_report_input" className="sr-only">Refine your draft</label>
                    <input
                      id="refine_report_input"
                      name="refine_report_input"
                      type="text"
                      value={refineInstructions}
                      onChange={(e) => setRefineInstructions(e.target.value)}
                      placeholder="Tweak this draft... (e.g., 'Make it more formal')"
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="w-full px-4 py-2 bg-white/70 border border-cream-dark rounded-xl text-xs focus:outline-none focus:border-sage pr-10"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && refineInstructions.trim() && !isRefining) {
                          handleRefine();
                        }
                      }}
                    />
                    <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  </div>
                  <button
                    type="button"
                    onClick={handleRefine}
                    disabled={isRefining || !refineInstructions.trim()}
                    className="px-6 py-2 bg-sage text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-sage-dark transition-all disabled:opacity-50 flex items-center gap-2 min-w-[100px] justify-center shadow-md shadow-sage/10"
                  >
                    {isRefining ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Thinking...</span>
                      </>
                    ) : (
                      'Refine'
                    )}
                  </button>
                </div>
              </div>

            </motion.div>

            {/* Send / archive actions — outside the document */}
            <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button
                  type="button"
                  onClick={handleEmailReport}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all"
                >
                  <Mail className="w-3.5 h-3.5" /> Email Parent
                </button>
                <button
                  type="button"
                  onClick={handleTextReport}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-green-600 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Text
                </button>
                <button
                  type="button"
                  onClick={handleCopyParentSquare}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  <ClipboardList className="w-3.5 h-3.5" /> Copy for ParentSquare
                </button>
                <div className="w-full grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={archiveAndKeepNotes}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all"
                  >
                    <Archive className="w-3.5 h-3.5" /> Archive & Keep Notes
                  </button>
                  <button
                    type="button"
                    onClick={archiveAndClearNotes}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Archive & Clear Notes
                  </button>
                </div>
            </div>
            </>
          )}

          <div id="history" ref={historyRef} className="space-y-4 pt-6 mt-6 border-t border-slate-100 scroll-mt-header">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-sage-dark flex items-center gap-2">
                  <Archive className="w-4 h-4 text-sage" /> Report History & Export Station
                </h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  {student.archivedSummaries?.length || 0} Saved {(student.archivedSummaries?.length || 0) === 1 ? 'Record' : 'Records'}
                </p>
              </div>

              {student.archivedSummaries && student.archivedSummaries.length > 0 && (
                <button
                  onClick={handleSelectAllArchives}
                  className="px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-colors"
                >
                  {selectedArchiveIds.length === student.archivedSummaries.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            <AnimatePresence>
              {selectedArchiveIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 overflow-hidden"
                >
                  <button
                    onClick={handleCopySelected}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Selected
                  </button>
                  <button
                    onClick={handleEmailSelected}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-sm shadow-blue-500/20"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email Parent
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-terracotta text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-terracotta-dark transition-all shadow-sm shadow-terracotta/20"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-3 pt-2">
              {!student.archivedSummaries || student.archivedSummaries.length === 0 ? (
                <div className="text-center py-10 bg-slate-50/50 rounded-[32px] border border-dashed border-slate-200 px-6 space-y-1.5">
                  <p className="text-xs font-black text-slate-400">No archived drafts yet.</p>
                  <p className="text-xs text-slate-400 leading-relaxed">Compose a report above, then tap <span className="font-bold">Archive</span> to save a snapshot of this student's progress. Archived reports can be emailed, copied, or downloaded as a PDF.</p>
                </div>
              ) : (
                student.archivedSummaries.filter((s: any) => !pendingDeleteArchiveIds.has(s.id)).map((s: any) => {
                  const isExpanded = expandedArchiveIds.includes(s.id);
                  const isSelected = selectedArchiveIds.includes(s.id);

                  return (
                    <div
                      key={s.id}
                      onClick={(e) => handleToggleArchiveExpand(s.id, e)}
                      className={cn(
                        "group cursor-pointer p-4 rounded-2xl border transition-all duration-200",
                        isSelected ? "bg-indigo-50/50 border-indigo-200 shadow-sm" : "bg-white border-slate-100 hover:border-sage/30 hover:shadow-sm card-shadow"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <button
                            onClick={(e) => handleToggleArchiveSelect(s.id, e)}
                            className={cn(
                              "w-5 h-5 rounded-md flex items-center justify-center border transition-all",
                              isSelected ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white border-slate-300 text-transparent hover:border-indigo-400 hover:bg-indigo-50"
                            )}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{new Date(s.date).toLocaleDateString()}</span>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCopyText(s.content); }}
                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Copy Archive"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEmailText(s.content); }}
                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Email Parent"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); softDeleteArchive(s.id); }}
                                className="p-1.5 text-slate-400 hover:text-terracotta hover:bg-terracotta/10 rounded-lg transition-colors"
                                title="Delete Archive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="relative">
                            <div className={cn(
                              "text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap transition-all overflow-hidden",
                              !isExpanded && "line-clamp-2"
                            )}>
                              {s.content}
                            </div>
                            {!isExpanded && s.content.length > 80 && (
                              <div className="absolute bottom-0 right-0 top-0 w-16 bg-gradient-to-l from-white group-hover:from-transparent to-transparent pointer-events-none" />
                            )}
                          </div>
                        </div>

                        <div className="pt-1">
                          {isExpanded ? <ChevronLeft className="w-4 h-4 text-slate-400 -rotate-90" /> : <ChevronLeft className="w-4 h-4 text-slate-400 rotate-180" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Undo delete toast */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-full flex items-center gap-4 shadow-xl z-50"
          >
            <span className="text-sm font-medium">{undoToast.label}</span>
            <button
              onClick={() => { undoToast.onUndo(); setUndoToast(null); if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }}
              className="text-teal-400 font-bold text-sm hover:text-teal-300 transition-colors"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
