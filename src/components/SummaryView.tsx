import React, { useState, useMemo } from 'react';
import {
  Sparkles, Loader2, Copy, ChevronDown, ChevronUp,
  BookOpen, CheckCircle, RotateCcw, ClipboardList, ChevronRight,
  Download, X, History
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Note, Student, SELTopic, SELLesson, DeliveredLesson } from '../types';
import { summarizeClassPeriod, suggestSELTopics, generateSELLesson } from '../lib/gemini';
import { toast } from 'sonner';
import { cn } from '../utils/cn';

type Period = 'today' | 'week' | 'lastWeek';
type ViewMode = 'notes' | 'summary';

const THEME_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  Empathy:    { bg: 'bg-purple-50',  border: 'border-purple-100',  text: 'text-purple-700',  badge: 'bg-purple-100 text-purple-600' },
  Conflict:   { bg: 'bg-red-50',     border: 'border-red-100',     text: 'text-red-700',     badge: 'bg-red-100 text-red-600' },
  Focus:      { bg: 'bg-blue-50',    border: 'border-blue-100',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-600' },
  Belonging:  { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-600' },
  Respect:    { bg: 'bg-amber-50',   border: 'border-amber-100',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-600' },
  Kindness:   { bg: 'bg-pink-50',    border: 'border-pink-100',    text: 'text-pink-700',    badge: 'bg-pink-100 text-pink-600' },
  default:    { bg: 'bg-sage/5',     border: 'border-sage/20',     text: 'text-sage-dark',   badge: 'bg-sage/10 text-sage-dark' },
};

function getThemeColors(theme: string) {
  return THEME_COLORS[theme] || THEME_COLORS.default;
}

interface Props {
  notes: Note[];
  students: Student[];
  classes: string[];
  lessonHistory: DeliveredLesson[];
  saveLessonHistory: (history: DeliveredLesson[]) => Promise<void>;
}

export default function SummaryView({ notes, students, classes, lessonHistory, saveLessonHistory }: Props) {
  const [period, setPeriod] = useState<Period>('week');
  const [viewMode, setViewMode] = useState<ViewMode>('notes');
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // SEL state — per class
  const [selTopics, setSelTopics] = useState<Record<string, SELTopic[]>>({});
  const [selGenerating, setSelGenerating] = useState<Record<string, boolean>>({});
  const [selLesson, setSelLesson] = useState<Record<string, SELLesson | null>>({});
  const [lessonGenerating, setLessonGenerating] = useState<Record<string, boolean>>({});
  const [selectedTopic, setSelectedTopic] = useState<Record<string, SELTopic | null>>({});
  const [showSEL, setShowSEL] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});

  const filteredNotes = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = startOfToday.getDay();
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - dayOfWeek);
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);

    return notes.filter(note => {
      const d = new Date(note.created_at);
      if (period === 'today') return d >= startOfToday;
      if (period === 'week') return d >= startOfWeek;
      if (period === 'lastWeek') return d >= startOfLastWeek && d < startOfWeek;
      return true;
    });
  }, [notes, period]);

  const studentClassMap = useMemo(() => {
    const map: Record<string, string> = {};
    students.forEach(s => { map[s.name] = s.class_period || 'Unassigned'; });
    return map;
  }, [students]);

  const notesByClass = useMemo(() => {
    const groups: Record<string, Note[]> = {};
    filteredNotes.forEach(note => {
      const cls = note.class_name || studentClassMap[note.student_name] || 'Unassigned';
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(note);
    });
    Object.keys(groups).forEach(cls => {
      groups[cls].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });
    return groups;
  }, [filteredNotes, studentClassMap]);

  const sortedClasses = Object.keys(notesByClass).sort();

  const handleGenerateSummary = async (cls: string) => {
    const clsNotes = notesByClass[cls];
    if (!clsNotes?.length) return;
    setGenerating(prev => ({ ...prev, [cls]: true }));
    try {
      const summary = await summarizeClassPeriod(clsNotes, cls);
      setSummaries(prev => ({ ...prev, [cls]: summary }));
    } catch {
      toast.error('Could not generate summary. Try again.');
    } finally {
      setGenerating(prev => ({ ...prev, [cls]: false }));
    }
  };

  const handleGenerateAll = async () => {
    for (const cls of sortedClasses) {
      if (!summaries[cls] && !generating[cls]) await handleGenerateSummary(cls);
    }
  };

  const handleGetSELSuggestions = async (cls: string) => {
    const clsNotes = notesByClass[cls];
    if (!clsNotes?.length) return;
    setSelGenerating(prev => ({ ...prev, [cls]: true }));
    setShowSEL(prev => ({ ...prev, [cls]: true }));
    try {
      const deliveredForClass = lessonHistory
        .filter(l => l.className === cls)
        .map(l => l.title);
      const topics = await suggestSELTopics(clsNotes, deliveredForClass);
      setSelTopics(prev => ({ ...prev, [cls]: topics }));
    } catch {
      toast.error('Could not generate SEL suggestions. Try again.');
    } finally {
      setSelGenerating(prev => ({ ...prev, [cls]: false }));
    }
  };

  const handleGenerateLesson = async (cls: string, topic: SELTopic) => {
    setSelectedTopic(prev => ({ ...prev, [cls]: topic }));
    setSelLesson(prev => ({ ...prev, [cls]: null }));
    setLessonGenerating(prev => ({ ...prev, [cls]: true }));
    try {
      const lesson = await generateSELLesson(topic);
      setSelLesson(prev => ({ ...prev, [cls]: lesson }));
    } catch {
      toast.error('Could not generate lesson plan. Try again.');
    } finally {
      setLessonGenerating(prev => ({ ...prev, [cls]: false }));
    }
  };

  const handleMarkDelivered = async (cls: string, topic: SELTopic) => {
    const entry: DeliveredLesson = { className: cls, title: topic.title, date: new Date().toISOString() };
    const updated = [...lessonHistory, entry];
    await saveLessonHistory(updated);
    setSelTopics(prev => ({ ...prev, [cls]: [] }));
    setSelLesson(prev => ({ ...prev, [cls]: null }));
    setSelectedTopic(prev => ({ ...prev, [cls]: null }));
    setShowSEL(prev => ({ ...prev, [cls]: false }));
    toast.success(`"${topic.title}" marked as delivered!`);
  };

  const handleUndoDelivered = async (cls: string, title: string, date: string) => {
    const updated = lessonHistory.filter(l => !(l.className === cls && l.title === title && l.date === date));
    await saveLessonHistory(updated);
    toast.success('Removed from delivered lessons.');
  };

  const handleDownloadPDF = (cls: string, topic: SELTopic, lesson: SELLesson) => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const addText = (text: string, fontSize: number, isBold: boolean, color: [number, number, number] = [30, 30, 30]) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, contentWidth);
      if (y + lines.length * (fontSize * 0.4) > 270) { doc.addPage(); y = 20; }
      doc.text(lines, margin, y);
      y += lines.length * (fontSize * 0.4) + 4;
    };

    addText('SEL Micro-Lesson Plan', 18, true, [80, 120, 100]);
    addText(`${cls} · ${new Date().toLocaleDateString()}`, 10, false, [150, 150, 150]);
    y += 4;
    addText(topic.title, 14, true);
    addText(`Theme: ${topic.theme}`, 10, false, [100, 100, 100]);
    y += 6;

    if (lesson.materials.length > 0) {
      addText('Materials Needed', 11, true, [100, 100, 100]);
      addText(lesson.materials.join(', '), 10, false);
      y += 4;
    }
    addText('3-Minute Opener', 11, true, [100, 100, 100]);
    addText(lesson.opener, 10, false);
    y += 4;
    addText('10-Minute Activity', 11, true, [100, 100, 100]);
    addText(lesson.activity, 10, false);
    y += 4;
    addText('2-Minute Exit Ticket', 11, true, [100, 100, 100]);
    addText(lesson.exitTicket, 10, false);
    y += 8;
    addText('Generated by Classroom Pulse', 8, false, [180, 180, 180]);

    doc.save(`SEL-Lesson-${topic.title.replace(/\s+/g, '-')}.pdf`);
    toast.success('Lesson plan downloaded!');
  };

  const periodLabel = period === 'today' ? "Today's" : period === 'week' ? "This Week's" : "Last Week's";

  // Global empty state — no notes at all for the selected period
  const hasNoNotes = sortedClasses.length === 0;

  return (
    <div className="space-y-5 pt-2">
      {/* Period picker */}
      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl">
        {(['today', 'week', 'lastWeek'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setSummaries({}); }}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
              period === p ? 'bg-white text-sage shadow-sm' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'Last Week'}
          </button>
        ))}
      </div>

      {/* View mode */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('notes')}
          className={cn(
            'flex-1 py-2 rounded-full text-xs font-black border-2 transition-all',
            viewMode === 'notes' ? 'bg-sage text-white border-sage' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
          )}
        >
          All Notes
        </button>
        <button
          onClick={() => setViewMode('summary')}
          className={cn(
            'flex-1 py-2 rounded-full text-xs font-black border-2 transition-all flex items-center justify-center gap-1.5',
            viewMode === 'summary' ? 'bg-orange-400 text-white border-orange-400' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
          )}
        >
          <Sparkles className="w-3 h-3" /> AI Summary
        </button>
      </div>

      {/* Generate all button (AI mode) */}
      {viewMode === 'summary' && sortedClasses.length > 1 && (
        <button
          onClick={handleGenerateAll}
          className="w-full py-2 border-2 border-dashed border-orange-200 rounded-2xl text-orange-500 text-xs font-black hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" /> Generate All Classes
        </button>
      )}

      {/* Empty state — no notes this period */}
      {hasNoNotes && (
        <div className="text-center py-14 space-y-3 bg-white rounded-[28px] border border-dashed border-slate-200 px-6">
          <div className="w-14 h-14 bg-sage/10 rounded-full flex items-center justify-center mx-auto">
            <ClipboardList className="w-7 h-7 text-sage/50" />
          </div>
          <p className="font-black text-slate-500 text-sm">No notes {period === 'today' ? 'today' : period === 'week' ? 'this week' : 'last week'} yet.</p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Head to the <span className="font-bold text-sage">Pulse tab</span> and log a few observations. Once you do, they'll show up here grouped by class — and you can generate AI summaries and SEL lesson suggestions.
          </p>
        </div>
      )}

      {/* Class sections */}
      {sortedClasses.map(cls => {
        const clsNotes = notesByClass[cls];
        const isCollapsed = collapsed[cls];
        const hasSummary = !!summaries[cls];
        const isGenerating = !!generating[cls];
        const isSelGenerating = !!selGenerating[cls];
        const topics = selTopics[cls] || [];
        const lesson = selLesson[cls] || null;
        const isLessonGenerating = !!lessonGenerating[cls];
        const activeTopic = selectedTopic[cls] || null;
        const isSelOpen = !!showSEL[cls];
        const deliveredForClass = lessonHistory.filter(l => l.className === cls);

        return (
          <div key={cls} className="bg-white rounded-[28px] card-shadow border border-slate-100 overflow-hidden">
            {/* Class header */}
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
              onClick={() => setCollapsed(prev => ({ ...prev, [cls]: !prev[cls] }))}
            >
              <div>
                <h3 className="font-black text-slate-800 text-sm">{cls}</h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {clsNotes.length} note{clsNotes.length !== 1 ? 's' : ''} · {periodLabel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {viewMode === 'summary' && !hasSummary && !isGenerating && (
                  <button
                    onClick={e => { e.stopPropagation(); handleGenerateSummary(cls); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-500 rounded-full text-[10px] font-black hover:bg-orange-100 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" /> Generate
                  </button>
                )}
                {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronUp className="w-4 h-4 text-slate-300" />}
              </div>
            </div>

            {/* Content */}
            {!isCollapsed && (
              <div className="px-5 pb-5 space-y-3 border-t border-slate-50">
                {viewMode === 'notes' ? (
                  <div className="space-y-2 pt-3">
                    {clsNotes.map(note => (
                      <div key={note.id} className="p-3 bg-slate-50 rounded-2xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700">
                            {note.class_name ? `📋 ${note.class_name}` : note.student_name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{note.content}</p>
                        {note.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {note.tags.map(t => (
                              <span key={t} className="text-[9px] font-bold bg-white border border-slate-200 text-slate-400 rounded px-1.5 py-0.5">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pt-3">
                    {isGenerating ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-medium">Generating summary…</span>
                      </div>
                    ) : hasSummary ? (
                      <div className="p-4 bg-orange-50/40 rounded-2xl border border-orange-100 space-y-3">
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{summaries[cls]}</p>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => { navigator.clipboard.writeText(summaries[cls]); toast.success('Copied!'); }}
                            className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                          <span className="text-slate-200">·</span>
                          <button
                            onClick={() => { setSummaries(prev => { const n = { ...prev }; delete n[cls]; return n; }); }}
                            className="text-[10px] font-black text-orange-400 hover:text-orange-600 transition-colors"
                          >
                            Regenerate
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs font-medium">
                        Tap Generate above to create an AI summary for this class.
                      </div>
                    )}
                  </div>
                )}

                {/* ─── SEL Suggestions Section ─── */}
                <div className="pt-3 border-t border-slate-50">
                  {!isSelOpen ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">SEL Lesson</span>
                          {deliveredForClass.length > 0 && (
                            <button
                              onClick={() => setShowHistory(prev => ({ ...prev, [cls]: !prev[cls] }))}
                              className="flex items-center gap-1 text-[9px] font-bold bg-purple-50 text-purple-400 px-2 py-0.5 rounded-full hover:bg-purple-100 transition-colors"
                            >
                              <History className="w-2.5 h-2.5" /> {deliveredForClass.length} delivered
                            </button>
                          )}
                        </div>
                        {clsNotes.length >= 2 ? (
                          <button
                            onClick={() => handleGetSELSuggestions(cls)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full text-[10px] font-black hover:bg-purple-100 transition-colors"
                          >
                            <Sparkles className="w-3 h-3" /> Get Suggestions
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-medium italic">Log 2+ notes to unlock</span>
                        )}
                      </div>

                      {/* Delivered history panel — toggled by the badge */}
                      {showHistory[cls] && deliveredForClass.length > 0 && (
                        <div className="bg-purple-50/50 rounded-2xl p-3 space-y-1.5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2">Delivered Lessons</p>
                          {deliveredForClass.map((l, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                              <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                              <span className="flex-1 font-medium">{l.title}</span>
                              <span className="text-slate-300">{new Date(l.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                              <button
                                onClick={() => handleUndoDelivered(cls, l.title, l.date)}
                                title="Remove from delivered"
                                className="p-0.5 text-slate-300 hover:text-terracotta transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">SEL Lesson Suggestions</span>
                        </div>
                        <button
                          onClick={() => { setShowSEL(prev => ({ ...prev, [cls]: false })); setSelTopics(prev => ({ ...prev, [cls]: [] })); setSelLesson(prev => ({ ...prev, [cls]: null })); setSelectedTopic(prev => ({ ...prev, [cls]: null })); }}
                          className="text-[10px] font-black text-slate-300 hover:text-slate-500 transition-colors"
                        >
                          Close
                        </button>
                      </div>

                      {isSelGenerating ? (
                        <div className="flex items-center justify-center py-6 gap-2 text-purple-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs font-medium">Analyzing your class notes…</span>
                        </div>
                      ) : topics.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 text-xs">
                          Could not generate suggestions. Try again.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-400 font-medium">Based on this {period === 'today' ? "day's" : period === 'week' ? "week's" : "last week's"} observations — pick one to generate a 15-min lesson:</p>
                          {topics.map((topic, i) => {
                            const colors = getThemeColors(topic.theme);
                            const isActive = activeTopic?.title === topic.title;
                            return (
                              <div key={i} className={cn('rounded-2xl border p-3 transition-all', colors.bg, colors.border)}>
                                <button
                                  onClick={() => !isActive && handleGenerateLesson(cls, topic)}
                                  className="w-full text-left space-y-1"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={cn('text-sm font-black', colors.text)}>{topic.title}</span>
                                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', colors.badge)}>{topic.theme}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-relaxed">{topic.rationale}</p>
                                </button>

                                {/* Lesson plan — expanded inline */}
                                {isActive && (
                                  <div className="mt-3 pt-3 border-t border-white/60 space-y-3">
                                    {isLessonGenerating ? (
                                      <div className="flex items-center gap-2 text-slate-400 py-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span className="text-xs">Building lesson plan…</span>
                                      </div>
                                    ) : lesson ? (
                                      <>
                                        {lesson.materials.length > 0 && (
                                          <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Materials</p>
                                            <p className="text-xs text-slate-600">{lesson.materials.join(', ')}</p>
                                          </div>
                                        )}
                                        <div>
                                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">3-Min Opener</p>
                                          <p className="text-xs text-slate-700 leading-relaxed">{lesson.opener}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">10-Min Activity</p>
                                          <p className="text-xs text-slate-700 leading-relaxed">{lesson.activity}</p>
                                        </div>
                                        <div>
                                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">2-Min Exit Ticket</p>
                                          <p className="text-xs text-slate-700 leading-relaxed">{lesson.exitTicket}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-2">
                                          <button
                                            onClick={() => {
                                              const text = `SEL Lesson: ${topic.title}\n\nMaterials: ${lesson.materials.join(', ')}\n\n3-Min Opener:\n${lesson.opener}\n\n10-Min Activity:\n${lesson.activity}\n\n2-Min Exit Ticket:\n${lesson.exitTicket}`;
                                              navigator.clipboard.writeText(text);
                                              toast.success('Lesson plan copied!');
                                            }}
                                            className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-slate-700 transition-colors"
                                          >
                                            <Copy className="w-3 h-3" /> Copy
                                          </button>
                                          <span className="text-slate-200">·</span>
                                          <button
                                            onClick={() => handleDownloadPDF(cls, topic, lesson)}
                                            className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-slate-700 transition-colors"
                                          >
                                            <Download className="w-3 h-3" /> PDF
                                          </button>
                                          <span className="text-slate-200">·</span>
                                          <button
                                            onClick={() => handleMarkDelivered(cls, topic)}
                                            className="flex items-center gap-1 text-[10px] font-black text-emerald-500 hover:text-emerald-700 transition-colors"
                                          >
                                            <CheckCircle className="w-3 h-3" /> Mark Delivered
                                          </button>
                                          <span className="text-slate-200">·</span>
                                          <button
                                            onClick={() => handleGenerateLesson(cls, topic)}
                                            className="flex items-center gap-1 text-[10px] font-black text-purple-400 hover:text-purple-600 transition-colors"
                                          >
                                            <RotateCcw className="w-3 h-3" /> Regenerate
                                          </button>
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                )}

                                {!isActive && (
                                  <div className="flex items-center gap-1 mt-2 text-[10px] font-black text-slate-400">
                                    <ChevronRight className="w-3 h-3" /> Tap to generate lesson plan
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Delivered history for this class */}
                          {deliveredForClass.length > 0 && (
                            <div className="pt-1">
                              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mb-1.5">Already Delivered</p>
                              <div className="space-y-1.5">
                                {deliveredForClass.map((l, i) => (
                                  <div key={i} className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                    <span className="flex-1">{l.title}</span>
                                    <span className="text-slate-300">{new Date(l.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                    <button
                                      onClick={() => handleUndoDelivered(cls, l.title, l.date)}
                                      title="Remove from delivered"
                                      className="p-0.5 text-slate-300 hover:text-terracotta transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
