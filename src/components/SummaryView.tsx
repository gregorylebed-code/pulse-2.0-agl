import React, { useState, useMemo } from 'react';
import { Sparkles, Loader2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Note, Student } from '../types';
import { summarizeClassPeriod } from '../lib/gemini';
import { toast } from 'sonner';
import { cn } from '../utils/cn';


type Period = 'today' | 'week' | 'lastWeek';
type ViewMode = 'notes' | 'summary';

interface Props {
  notes: Note[];
  students: Student[];
  classes: string[];
}

export default function SummaryView({ notes, students, classes }: Props) {
  const [period, setPeriod] = useState<Period>('today');
  const [viewMode, setViewMode] = useState<ViewMode>('notes');
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
    students.forEach(s => {
      const cls = typeof s.class_id === 'object'
        ? (s.class_id as any)?.label || (s.class_id as any)?.value
        : s.class_id || s.class_period || 'Unassigned';
      map[s.name] = cls;
    });
    return map;
  }, [students]);

  const notesByClass = useMemo(() => {
    const groups: Record<string, Note[]> = {};
    filteredNotes.forEach(note => {
      const cls = note.class_name || studentClassMap[note.student_name] || 'Unassigned';
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(note);
    });
    // Sort notes within each class newest first
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
      if (!summaries[cls] && !generating[cls]) {
        await handleGenerateSummary(cls);
      }
    }
  };

  const periodLabel = period === 'today' ? "Today's" : period === 'week' ? "This Week's" : "Last Week's";

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

      {/* No notes state */}
      {sortedClasses.length === 0 && (
        <div className="text-center py-14 text-slate-400 text-sm font-medium">
          No notes found for {periodLabel.toLowerCase()} period.
        </div>
      )}

      {/* Class sections */}
      {sortedClasses.map(cls => {
        const clsNotes = notesByClass[cls];
        const isCollapsed = collapsed[cls];
        const hasSummary = !!summaries[cls];
        const isGenerating = !!generating[cls];

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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
