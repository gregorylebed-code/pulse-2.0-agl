import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Plus, Trash2, X, AlertCircle, Mic, MicOff, Copy, Mail, Download } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { Student, Shoutout } from '../types';
import { cn } from '../utils/cn';

const CATEGORIES = ['Kindness', 'Leadership', 'Persistence', 'Teamwork', 'Growth', 'Participation', 'Creativity', 'Courage'];

interface ShoutoutsScreenProps {
  shoutouts: Shoutout[];
  students: Student[];
  addShoutout: (shoutout: Omit<Shoutout, 'id' | 'created_at' | 'user_id'>) => Promise<Shoutout | null>;
  deleteShoutout: (id: string) => Promise<void>;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ShoutoutsScreen({ shoutouts, students, addShoutout, deleteShoutout }: ShoutoutsScreenProps) {
  const [showForm, setShowForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [filterStudent, setFilterStudent] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [exportRange, setExportRange] = useState<'day' | 'week' | 'month'>('week');

  const exportRangeShoutouts = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = todayStart;
    if (exportRange === 'week') {
      // Monday of the current week
      const day = todayStart.getDay(); // 0=Sun,1=Mon,...
      const diff = day === 0 ? 6 : day - 1;
      start = new Date(todayStart);
      start.setDate(todayStart.getDate() - diff);
    } else if (exportRange === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return shoutouts.filter(s => new Date(s.created_at) >= start);
  }, [shoutouts, exportRange]);

  const weekMondayLabel = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = todayStart.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(todayStart);
    monday.setDate(todayStart.getDate() - diff);
    return monday.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
  }, []);

  const exportRangeLabel = exportRange === 'day'
    ? 'Today'
    : exportRange === 'week'
    ? `Week of ${weekMondayLabel}`
    : `${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;

  const formatExportText = (list: Shoutout[]) =>
    `⭐ Shoutouts — ${exportRangeLabel}\n\n` +
    (list.length === 0
      ? 'No shoutouts for this period.'
      : list.map(s => {
          const header = `${new Date(s.created_at).toLocaleDateString()} · ${s.student_name}${s.category ? ` · ${s.category}` : ''}`;
          return s.content ? `${header}\n${s.content}` : header;
        }).join('\n\n'));

  const handleExportCopy = () => {
    navigator.clipboard.writeText(formatExportText(exportRangeShoutouts));
    toast.success('Copied!');
  };

  const handleExportEmail = () => {
    const body = formatExportText(exportRangeShoutouts);
    window.location.href = `mailto:?subject=${encodeURIComponent(`⭐ Shoutouts — ${exportRangeLabel}`)}&body=${encodeURIComponent(body)}`;
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Shoutouts — ${exportRangeLabel}`, 20, 20);
    let y = 35;
    if (exportRangeShoutouts.length === 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('No shoutouts for this period.', 20, y);
    } else {
      exportRangeShoutouts.forEach(s => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${new Date(s.created_at).toLocaleDateString()} · ${s.student_name}${s.category ? ` · ${s.category}` : ''}`, 20, y);
        y += 6;
        if (s.content) {
          doc.setFont('helvetica', 'normal');
          const lines = doc.splitTextToSize(s.content, 170);
          doc.text(lines, 20, y);
          y += lines.length * 5 + 8;
        } else {
          y += 8;
        }
      });
    }
    doc.save(`Shoutouts_${exportRange}.pdf`);
    toast.success('PDF downloaded!');
  };

  // Students who haven't received a shoutout in the last 14 days
  const overlookedStudents = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const recentlyShoutedIds = new Set(
      shoutouts
        .filter(s => new Date(s.created_at) > cutoff && s.student_id)
        .map(s => s.student_id)
    );
    return students.filter(s => !recentlyShoutedIds.has(s.id));
  }, [shoutouts, students]);

  const filtered = useMemo(() => {
    if (filterStudent === 'all') return shoutouts;
    return shoutouts.filter(s => s.student_id === filterStudent);
  }, [shoutouts, filterStudent]);

  const handleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error('Voice not supported on this browser.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setContent(prev => prev ? prev + ' ' + transcript : transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSubmit = async () => {
    if (!selectedStudent || (!content.trim() && !category)) {
      toast.error('Pick a student and add a category or write something.');
      return;
    }
    setSaving(true);
    const result = await addShoutout({
      student_id: selectedStudent.id,
      student_name: selectedStudent.name,
      content: content.trim(),
      category,
    });
    setSaving(false);
    if (result) {
      toast.success(`⭐ Shoutout for ${selectedStudent.name}!`);
      setShowForm(false);
      setSelectedStudent(null);
      setContent('');
      setCategory(null);
    } else {
      toast.error('Failed to save shoutout.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 pt-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-black text-violet-600">Shoutout Wall</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{shoutouts.length} total shoutouts</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-white text-[12px] font-black px-4 py-2.5 rounded-2xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Give a Shoutout
        </motion.button>
      </div>

      {/* Overlooked students alert */}
      {overlookedStudents.length > 0 && students.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-black text-amber-700 mb-2">
                {overlookedStudents.length} student{overlookedStudents.length > 1 ? 's' : ''} haven't had a shoutout in 14+ days
              </p>
              <div className="flex flex-wrap gap-1.5">
                {overlookedStudents.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudent(s); setShowForm(true); }}
                    className="text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 px-2.5 py-1 rounded-xl transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter by student */}
      {students.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
          <button
            onClick={() => setFilterStudent('all')}
            className={cn('text-[11px] font-black px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors', filterStudent === 'all' ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
          >
            All
          </button>
          {students.map(s => (
            <button
              key={s.id}
              onClick={() => setFilterStudent(s.id)}
              className={cn('text-[11px] font-black px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors', filterStudent === s.id ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Export section */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-4 space-y-3">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Export Shoutouts</p>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map(r => (
            <button
              key={r}
              onClick={() => setExportRange(r)}
              className={cn(
                'flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border-2 transition-all',
                exportRange === r ? 'bg-violet-500 text-white border-violet-500 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-violet-300'
              )}
            >
              {r === 'day' ? 'Today' : r === 'week' ? `Wk of ${weekMondayLabel}` : 'This Month'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400 font-bold flex-1">
            {exportRangeShoutouts.length} shoutout{exportRangeShoutouts.length !== 1 ? 's' : ''}
          </span>
          <button onClick={handleExportCopy} title="Copy" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black transition-all">
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          <button onClick={handleExportEmail} title="Email" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-[11px] font-black transition-all">
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          <button onClick={handleExportPDF} title="PDF" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-600 text-[11px] font-black transition-all">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Shoutout feed */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Star className="w-12 h-12 text-amber-200" />
          <p className="text-[13px] font-black text-slate-400">No shoutouts yet — be the first!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map(s => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-800 rounded-[20px] p-4 card-shadow border border-amber-100 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[13px] font-black text-slate-800 dark:text-white">{s.student_name}</span>
                    {s.category && (
                      <span className="text-[10px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-lg">{s.category}</span>
                    )}
                    <span className="text-[10px] font-bold text-slate-400 ml-auto">{formatDate(s.created_at)}</span>
                  </div>
                  <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">{s.content}</p>
                </div>
                <button
                  onClick={async () => {
                    await deleteShoutout(s.id);
                    toast.success('Removed.');
                  }}
                  className="text-slate-300 hover:text-terracotta transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add shoutout modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-t-[32px] w-full max-w-lg p-6 pb-10 space-y-5 mb-16"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> Give a Shoutout
                </h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Student picker */}
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Student</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar">
                  {students.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudent(s)}
                      className={cn('text-[12px] font-bold px-3 py-1.5 rounded-xl transition-colors', selectedStudent?.id === s.id ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category picker */}
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Category (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setCategory(category === c ? null : c)}
                      className={cn('text-[11px] font-bold px-2.5 py-1 rounded-xl transition-colors', category === c ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block">What did they do? <span className="normal-case font-medium text-slate-400">(optional if category selected)</span></label>
                <div className="relative">
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="e.g. Helped a classmate without being asked"
                    rows={3}
                    className="w-full text-[13px] bg-slate-50 dark:bg-slate-700 rounded-2xl px-4 py-3 pr-12 resize-none outline-none border border-slate-200 dark:border-slate-600 focus:border-amber-400 transition-colors text-slate-800 dark:text-white placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleVoice}
                    className={cn(
                      'absolute right-3 bottom-3 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                      isListening ? 'bg-terracotta text-white animate-pulse' : 'bg-slate-200 text-slate-500 hover:bg-amber-100 hover:text-amber-600'
                    )}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSubmit}
                disabled={saving}
                className="w-full bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-white font-black text-[13px] py-3.5 rounded-2xl transition-colors"
              >
                {saving ? 'Saving…' : '⭐ Post Shoutout'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
