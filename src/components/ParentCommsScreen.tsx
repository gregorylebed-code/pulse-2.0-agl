import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, X, AlertTriangle, ArrowUpRight, ArrowDownLeft, Mail, Phone, Users, Calendar, ChevronDown, ChevronUp, CheckCircle2, Circle, Mic, MicOff, Sparkles, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ParentCommunication, Student } from '../types';
import { cn } from '../utils/cn';
import { generateCallScript } from '../lib/gemini';
import { captureAiFlowError } from '../lib/captureAiError';

interface ParentCommsScreenProps {
  students: Student[];
  communications: ParentCommunication[];
  onAdd: (comm: Omit<ParentCommunication, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<ParentCommunication | null>;
  onUpdate: (id: string, updates: Partial<Omit<ParentCommunication, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  addTask?: (task: { text: string; completed: boolean; color: string }) => Promise<any>;
  tasks?: { id: string; text: string }[];
  onStudentClick: (studentId: string) => void;
  isSandboxMode?: boolean;
  teacherName?: string;
}

const COMM_TYPES = [
  { label: 'Email',        color: 'text-blue-500',    accent: 'bg-blue-400'    },
  { label: 'Phone',        color: 'text-emerald-600', accent: 'bg-emerald-400' },
  { label: 'Meeting',      color: 'text-violet-600',  accent: 'bg-violet-400'  },
  { label: 'ParentSquare', color: 'text-amber-600',   accent: 'bg-amber-400'   },
];

const getAccent = (type: string) => COMM_TYPES.find(t => t.label === type)?.accent ?? 'bg-slate-300';
const getColor  = (type: string) => COMM_TYPES.find(t => t.label === type)?.color  ?? 'text-slate-500';

function CommTypeBadge({ type }: { type: string }) {
  if (type === 'ParentSquare') {
    return <span className="inline-flex items-center justify-center rounded-sm bg-amber-400 text-white font-black leading-none w-3.5 h-3.5 text-[8px]">PS</span>;
  }
  const icons: Record<string, React.ReactNode> = {
    Email:   <Mail    className={cn('w-3.5 h-3.5', getColor(type))} />,
    Phone:   <Phone   className={cn('w-3.5 h-3.5', getColor(type))} />,
    Meeting: <Users   className={cn('w-3.5 h-3.5', getColor(type))} />,
  };
  return <>{icons[type] ?? <MessageSquare className="w-3.5 h-3.5 text-slate-400" />}</>;
}

interface CommRowProps {
  comm: ParentCommunication;
  onDelete: (id: string) => void | Promise<void>;
  onUpdate: (id: string, updates: any) => void | Promise<void>;
  key?: React.Key | null;
}

function CommRow({ comm, onDelete, onUpdate }: CommRowProps) {
  const [expanded, setExpanded] = useState(false);
  const dateObj = new Date(comm.comm_date);
  const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const hasExplicitTime = dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0;
  const timeStr = (hasExplicitTime ? dateObj : new Date(comm.created_at)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const followUpDate = comm.follow_up_date ? new Date(comm.follow_up_date + 'T00:00') : null;
  const followUpOverdue = followUpDate && !comm.follow_up_done && followUpDate < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className={cn('relative bg-white rounded-2xl border shadow-sm overflow-hidden', comm.is_urgent ? 'border-red-200' : 'border-slate-100')}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl', getAccent(comm.comm_type))} />
      <button className="w-full text-left pl-4 pr-4 py-3" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-2">
          <CommTypeBadge type={comm.comm_type} />
          <span className="text-[12px] font-black text-slate-700 truncate flex-1">{comm.student_name}</span>
          {comm.is_urgent    && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
          {followUpOverdue   && <Calendar      className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
          <span className={cn('text-[11px] flex-shrink-0', comm.direction === 'inbound' ? 'text-emerald-600' : 'text-slate-400')}>
            {comm.direction === 'inbound' ? <ArrowDownLeft className="w-3 h-3 inline" /> : <ArrowUpRight className="w-3 h-3 inline" />}
          </span>
          <span className="text-[11px] text-slate-400 flex-shrink-0">{dateStr} · {timeStr}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
        </div>
        {comm.subject && <p className="mt-1 text-[12px] font-semibold text-slate-600 truncate">{comm.subject}</p>}
        {!expanded && comm.notes && <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">{comm.notes}</p>}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pl-4 pr-4 pb-3 space-y-2">
              <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{comm.notes}</p>
              {followUpDate && (
                <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium', followUpOverdue ? 'bg-red-50 text-red-600' : comm.follow_up_done ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700')}>
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  Follow-up: {followUpDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {followUpOverdue && ' · OVERDUE'}
                  {comm.follow_up_done && ' · Done'}
                  {!comm.follow_up_done && (
                    <button onClick={() => onUpdate(comm.id, { follow_up_done: true })} className="ml-auto font-black hover:opacity-70">✓ Mark done</button>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  let cancelled = false;
                  const timer = setTimeout(() => { if (!cancelled) onDelete(comm.id); }, 3000);
                  toast('Entry deleted', { duration: 3000, action: { label: 'Undo', onClick: () => { cancelled = true; clearTimeout(timer); toast.dismiss(); } } });
                }}
                className="text-[11px] font-black text-slate-300 hover:text-red-400 transition-colors pt-1 block"
              >
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const FORM_COMM_TYPES = [
  { label: 'Email',        icon: Mail,          color: 'text-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-100'    },
  { label: 'Phone',        icon: Phone,         color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { label: 'Meeting',      icon: Users,         color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100'  },
  { label: 'ParentSquare', icon: MessageSquare, color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100'   },
];

const detectDirection = (notes: string): 'outbound' | 'inbound' => {
  const lower = notes.toLowerCase();
  if (/\b(they called|she called|he called|parent called|mom called|dad called|they reached out|they contacted|they emailed|received a call|got a call|they left a message|incoming)\b/.test(lower)) return 'inbound';
  return 'outbound';
};

function QuickAddForm({
  students,
  onSave,
  onCancel,
  teacherName,
}: {
  students: Student[];
  onSave: (data: Omit<ParentCommunication, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<ParentCommunication | null>;
  onCancel: () => void;
  teacherName?: string;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id ?? '');
  const [commType, setCommType] = useState('');
  const [direction, setDirection] = useState<'' | 'outbound' | 'inbound'>('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [parentName, setParentName] = useState('');
  const [commDate, setCommDate] = useState(new Date().toISOString().slice(0, 10));
  const [followUpDate, setFollowUpDate] = useState('');
  const [isIepRelated, setIsIepRelated] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [callScript, setCallScript] = useState<string[]>([]);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);

  const selectedStudent = students.find(s => s.id === selectedStudentId) ?? students[0];

  const handleVoice = () => {
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice not supported on this browser.'); return; }
    const r = new SR();
    r.lang = 'en-US';
    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setNotes(n => n ? n + ' ' + t : t);
      if (!direction) setDirection(detectDirection(t));
    };
    recognitionRef.current = r;
    r.start();
  };

  const handleGenerateScript = async () => {
    if (!selectedStudent) return;
    setGeneratingScript(true);
    setCallScript([]);
    try {
      const bullets = await generateCallScript(selectedStudent.name, subject, notes, teacherName);
      setCallScript(bullets);
    } catch (err: any) {
      captureAiFlowError('call_script_generation', err, { noteCount: notes.length });
      toast.error(err?.message || 'Failed to generate script. Try again.');
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleCopyScript = () => {
    const text = callScript.map((b, i) => `${i + 1}. ${b}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    });
  };

  const handleSubmit = async () => {
    if (!notes.trim()) { toast.error('Please add notes about the communication.'); return; }
    if (!selectedStudent) { toast.error('Please select a student.'); return; }
    setSaving(true);
    try {
      await onSave({
        student_id: selectedStudent.id,
        student_name: selectedStudent.name,
        comm_type: commType,
        direction: direction || detectDirection(notes),
        subject: subject || null,
        notes: notes.trim(),
        parent_name: parentName || null,
        comm_date: new Date(commDate + 'T00:00').toISOString(),
        follow_up_date: followUpDate || null,
        follow_up_done: false,
        is_iep_related: isIepRelated,
        is_urgent: isUrgent,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-black text-slate-600 uppercase tracking-wider">Log Communication</span>
        <button onClick={onCancel} className="text-slate-300 hover:text-slate-500"><X className="w-4 h-4" /></button>
      </div>

      {/* Student picker */}
      <div>
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">Student</label>
        <select
          value={selectedStudentId}
          onChange={e => {
            setSelectedStudentId(e.target.value);
            const s = students.find(st => st.id === e.target.value);
            setParentName(s?.parent_guardian_names?.[0] ?? '');
          }}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium focus:outline-none focus:border-sage"
        >
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Comm type */}
      <div className="flex gap-2 flex-wrap">
        {FORM_COMM_TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              onClick={() => setCommType(c => c === t.label ? '' : t.label)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all',
                commType === t.label ? cn(t.bg, t.border, t.color, 'shadow-sm') : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
              )}
            >
              {t.label === 'ParentSquare'
                ? <span className="inline-flex items-center justify-center rounded-sm bg-amber-400 text-white font-black leading-none w-3.5 h-3.5 text-[8px]">PS</span>
                : <Icon className={cn('w-3.5 h-3.5', commType === t.label ? t.color : 'text-slate-400')} />}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Direction */}
      <div className="flex gap-2">
        {(['outbound', 'inbound'] as const).map(d => (
          <button
            key={d}
            onClick={() => setDirection(v => v === d ? '' : d)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all',
              direction === d ? 'bg-slate-700 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
            )}
          >
            {d === 'outbound' ? <><ArrowUpRight className="w-3.5 h-3.5" /> I reached out</> : <><ArrowDownLeft className="w-3.5 h-3.5" /> They contacted me</>}
          </button>
        ))}
      </div>

      {/* Subject + Parent */}
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject / topic..." className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium focus:outline-none focus:border-sage" />
        <input type="text" value={parentName} onChange={e => setParentName(e.target.value)} placeholder="Parent name..." className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium focus:outline-none focus:border-sage" />
      </div>

      {/* Notes + voice */}
      <div className="relative">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="What was discussed? Key points, next steps, tone..."
          rows={5}
          className="w-full px-3 py-2 pr-28 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium focus:outline-none focus:border-sage resize-none leading-relaxed"
        />
        <button
          type="button"
          onClick={handleVoice}
          className={cn('absolute right-2 bottom-2 flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-sm border transition-all font-bold text-[11px] uppercase tracking-widest', isListening ? 'bg-terracotta text-white border-terracotta animate-pulse' : 'bg-white text-slate-500 border-slate-200 hover:bg-terracotta/10 hover:text-terracotta hover:border-terracotta/40')}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{isListening ? 'Stop' : 'Voice'}</span>
        </button>
      </div>

      {/* AI call script — Phone only */}
      {commType === 'Phone' && (
        <div>
          <button
            type="button"
            onClick={handleGenerateScript}
            disabled={generatingScript}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-black transition-all',
              generatingScript
                ? 'bg-slate-100 border-slate-200 text-slate-400'
                : 'bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {generatingScript ? 'Generating script...' : 'Prep call script'}
          </button>

          <AnimatePresence>
            {callScript.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2 bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black text-violet-500 uppercase tracking-wider">Call Script</span>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="flex items-center gap-1 text-[11px] font-black text-violet-400 hover:text-violet-600 transition-colors"
                  >
                    {scriptCopied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                {callScript.map((bullet, i) => (
                  <div key={i} className="flex gap-2 text-[12px] text-violet-800 leading-relaxed">
                    <span className="font-black text-violet-400 flex-shrink-0">{i + 1}.</span>
                    <span>{bullet}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Date + follow-up */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">Date</label>
          <input type="date" value={commDate} onChange={e => setCommDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[12px] font-medium focus:outline-none focus:border-sage" />
        </div>
        <div>
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">Follow-up <span className="normal-case font-medium">(optional)</span></label>
          <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[12px] font-medium focus:outline-none focus:border-sage" />
        </div>
      </div>

      {/* Flags */}
      <div className="flex gap-3">
        <button onClick={() => setIsIepRelated(v => !v)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all', isIepRelated ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100')}>
          {isIepRelated ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />} IEP Related
        </button>
        <button onClick={() => setIsUrgent(v => !v)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all', isUrgent ? 'bg-red-50 border-red-200 text-red-500' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100')}>
          {isUrgent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />} Urgent
        </button>
      </div>

      <button onClick={handleSubmit} disabled={saving} className="w-full py-2.5 bg-sage text-white rounded-xl text-[13px] font-black hover:bg-sage-dark disabled:opacity-50 transition-colors">
        {saving ? 'Saving...' : 'Save Communication Log'}
      </button>
    </motion.div>
  );
}

export default function ParentCommsScreen({ students, communications, onAdd, onUpdate, onDelete, addTask, tasks, onStudentClick, isSandboxMode, teacherName }: ParentCommsScreenProps) {
  const [filterStudentId, setFilterStudentId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const realStudents = useMemo(() =>
    isSandboxMode ? students.filter(s => !!s.is_demo) : students.filter(s => !s.is_demo),
    [students, isSandboxMode]
  );

  const realComms = useMemo(() =>
    communications.filter(c => isSandboxMode ? !!c.is_demo : !c.is_demo),
    [communications, isSandboxMode]
  );

  const sorted = useMemo(() =>
    [...realComms]
      .filter(c => !filterStudentId || c.student_id === filterStudentId)
      .sort((a, b) => new Date(b.comm_date).getTime() - new Date(a.comm_date).getTime()),
    [realComms, filterStudentId]
  );

  const urgentCount  = useMemo(() => realComms.filter(c => c.is_urgent && !c.follow_up_done).length, [realComms]);
  const overdueCount = useMemo(() => realComms.filter(c => c.follow_up_date && !c.follow_up_done && new Date(c.follow_up_date + 'T00:00') < new Date()).length, [realComms]);

  const studentsWithComms = useMemo(() =>
    realStudents.filter(s => realComms.some(c => c.student_id === s.id)),
    [realStudents, realComms]
  );

  return (
    <div className="min-h-screen pb-24 bg-slate-50">
      <div className="px-4 pt-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-black text-slate-800">Parent Comms</h1>
            <p className="text-[12px] text-slate-400 font-medium">Every contact, timestamped</p>
          </div>
          {realStudents.length > 0 && (
            <button
              onClick={() => setShowForm(f => !f)}
              className="flex items-center gap-1.5 px-4 py-2 bg-sage text-white rounded-xl text-[13px] font-black hover:bg-sage-dark transition-colors shadow-sm"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'Add'}
            </button>
          )}
        </div>

        {/* Quick add form */}
        <AnimatePresence>
          {showForm && (
            <QuickAddForm
              students={realStudents}
              teacherName={teacherName}
              onSave={async (data) => {
                const result = await onAdd(data);
                if (result) {
                  setShowForm(false);
                  toast.success('Communication logged');
                } else {
                  toast.error('Failed to save — please try again.');
                }
                return result;
              }}
              onCancel={() => setShowForm(false)}
            />
          )}
        </AnimatePresence>

        {/* Alert strip */}
        {(urgentCount > 0 || overdueCount > 0) && (
          <div className="flex gap-2 flex-wrap">
            {urgentCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-[12px] font-black text-red-500">
                <AlertTriangle className="w-3.5 h-3.5" /> {urgentCount} urgent
              </div>
            )}
            {overdueCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[12px] font-black text-amber-600">
                <Calendar className="w-3.5 h-3.5" /> {overdueCount} overdue follow-up{overdueCount > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {realComms.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-[15px] font-black text-slate-500">No communications logged yet</p>
            <p className="text-[12px] mt-2 max-w-[260px] mx-auto leading-relaxed">
              Open any student from the <strong>Student Hub</strong> tab and tap <strong>Add Parent Communication</strong> at the bottom of their profile.
            </p>
            {realStudents.length > 0 && (
              <button
                onClick={() => onStudentClick(realStudents[0].id)}
                className="mt-4 px-5 py-2.5 bg-teal-500 text-white rounded-xl text-[13px] font-black hover:bg-teal-600 transition-colors shadow-sm"
              >
                Go to {realStudents[0].name} →
              </button>
            )}
          </div>
        )}

        {/* Student filter pills */}
        {studentsWithComms.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-swipe pb-1 -mx-4 px-4">
            <button
              onClick={() => setFilterStudentId(null)}
              className={cn('flex-shrink-0 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all', !filterStudentId ? 'bg-teal-500 border-teal-500 text-white' : 'bg-white border-slate-200 text-slate-500')}
            >
              All
            </button>
            {studentsWithComms.map(s => (
              <button
                key={s.id}
                onClick={() => setFilterStudentId(id => id === s.id ? null : s.id)}
                className={cn('flex-shrink-0 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all', filterStudentId === s.id ? 'bg-teal-500 border-teal-500 text-white' : 'bg-white border-slate-200 text-slate-500')}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        {sorted.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {sorted.map((comm: ParentCommunication) => (
                <CommRow key={comm.id} comm={comm} onDelete={onDelete} onUpdate={onUpdate} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {realComms.length > 0 && sorted.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <p className="text-[13px] font-medium">No entries for this student yet</p>
          </div>
        )}

      </div>
    </div>
  );
}
