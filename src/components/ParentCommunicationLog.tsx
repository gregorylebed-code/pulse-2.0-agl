import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Phone, Users, MessageSquare, Plus, Trash2, Edit2,
  CheckCircle2, Circle, ChevronDown, ChevronUp, AlertTriangle,
  Calendar, ArrowUpRight, ArrowDownLeft, X, Save, Copy,
  ClipboardList, BookOpen, Filter, Mic, MicOff
} from 'lucide-react';
import { toast } from 'sonner';
import { ParentCommunication, Student } from '../types';
import { cn } from '../utils/cn';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParentCommunicationLogProps {
  student: Student;
  communications: ParentCommunication[];
  onAdd: (comm: Omit<ParentCommunication, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<ParentCommunication | null>;
  onUpdate: (id: string, updates: Partial<Omit<ParentCommunication, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  addTask?: (task: { text: string; completed: boolean; color: string }) => Promise<any>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COMM_TYPES = [
  { label: 'Email',        icon: Mail,           color: 'text-blue-500',    bg: 'bg-blue-50',   border: 'border-blue-100' },
  { label: 'Phone',        icon: Phone,          color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { label: 'Meeting',      icon: Users,          color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
  { label: 'ParentSquare', icon: MessageSquare,  color: 'text-sky-500',     bg: 'bg-sky-50',     border: 'border-sky-100' },
];

const getCommMeta = (label: string) =>
  COMM_TYPES.find(t => t.label === label) ?? COMM_TYPES[0];

const CommIcon = ({ type, size = 'sm' }: { type: string; size?: 'sm' | 'md' }) => {
  const meta = getCommMeta(type);
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  if (type === 'ParentSquare') {
    return (
      <span className={cn('inline-flex items-center justify-center rounded-sm bg-sky-500 text-white font-black leading-none', size === 'sm' ? 'w-3.5 h-3.5 text-[8px]' : 'w-4 h-4 text-[9px]')}>
        PS
      </span>
    );
  }
  const Icon = meta.icon;
  return <Icon className={cn(sz, meta.color)} />;
};

// ─── Blank form state ─────────────────────────────────────────────────────────

const detectDirection = (notes: string): 'outbound' | 'inbound' => {
  const lower = notes.toLowerCase();
  // Inbound signals: parent initiated
  if (/\b(they called|she called|he called|parent called|mom called|dad called|guardian called|they reached out|they contacted|they emailed|received a call|got a call|they left a message|they texted|incoming)\b/.test(lower)) return 'inbound';
  // Outbound signals: teacher initiated
  if (/\b(i called|i emailed|i reached out|i texted|i contacted|i sent|i left a message|i left a voicemail|i messaged|called the|emailed the|reached out to)\b/.test(lower)) return 'outbound';
  // Default to outbound (most common)
  return 'outbound';
};

const blankForm = (student: Student) => ({
  comm_type: '' as string,
  direction: '' as '' | 'outbound' | 'inbound',
  subject: '',
  notes: '',
  parent_name: student.parent_guardian_names?.[0] ?? '',
  comm_date_date: new Date().toISOString().slice(0, 10),
  comm_date_time: '',
  follow_up_date: '',
  follow_up_done: false,
  is_iep_related: false,
  is_urgent: false,
});

// ─── Timeline Entry ───────────────────────────────────────────────────────────

interface TimelineEntryProps {
  comm: ParentCommunication;
  onDelete: (id: string) => void | Promise<void>;
  onUpdate: (id: string, updates: Partial<Omit<ParentCommunication, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => void | Promise<void>;
}

const TimelineEntry: React.FC<TimelineEntryProps> = ({
  comm,
  onDelete,
  onUpdate,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ subject: comm.subject ?? '', notes: comm.notes, is_urgent: comm.is_urgent, is_iep_related: comm.is_iep_related });

  const meta = getCommMeta(comm.comm_type);
  const dateObj = new Date(comm.comm_date);
  const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const hasTime = dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0;
  const timeStr = hasTime ? dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;

  const followUpDate = comm.follow_up_date ? new Date(comm.follow_up_date + 'T00:00') : null;
  const followUpOverdue = followUpDate && !comm.follow_up_done && followUpDate < new Date();

  const handleSaveEdit = () => {
    onUpdate(comm.id, { subject: draft.subject || null, notes: draft.notes, is_urgent: draft.is_urgent, is_iep_related: draft.is_iep_related });
    setEditing(false);
    toast.success('Updated');
  };

  const handleCopy = () => {
    const text = [
      comm.subject ? `Re: ${comm.subject}` : null,
      `Date: ${dateStr} ${timeStr}`,
      `Type: ${comm.comm_type} (${comm.direction})`,
      comm.parent_name ? `Parent: ${comm.parent_name}` : null,
      '',
      comm.notes,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'relative bg-white rounded-2xl border transition-all overflow-hidden',
        comm.is_urgent ? 'border-red-200 shadow-red-50/80' : 'border-slate-100',
        'shadow-sm'
      )}
    >
      {/* Left accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl', meta.bg.replace('bg-', 'bg-').replace('-50', '-400'))} />

      <div className="pl-4 pr-4 py-3">
        {/* Row 1: type badge + date + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black border', meta.bg, meta.border, meta.color)}>
            <CommIcon type={comm.comm_type} />
            {comm.comm_type}
          </span>

          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
            {comm.direction === 'outbound'
              ? <ArrowUpRight className="w-3 h-3 text-slate-300" />
              : <ArrowDownLeft className="w-3 h-3 text-emerald-400" />}
            {comm.direction}
          </span>

          {comm.is_iep_related && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 border border-violet-100 text-violet-600 rounded-lg text-[11px] font-black">
              <BookOpen className="w-3 h-3" /> IEP
            </span>
          )}
          {comm.is_urgent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-100 text-red-500 rounded-lg text-[11px] font-black">
              <AlertTriangle className="w-3 h-3" /> Urgent
            </span>
          )}

          <span className="ml-auto text-[11px] text-slate-400 font-medium">{dateStr}{timeStr ? ` · ${timeStr}` : ''}</span>
        </div>

        {/* Row 2: subject + parent */}
        {(comm.subject || comm.parent_name) && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {comm.subject && (
              <span className="text-[13px] font-bold text-slate-700 leading-snug">{comm.subject}</span>
            )}
            {comm.parent_name && (
              <span className="text-[11px] text-slate-400">· {comm.parent_name}</span>
            )}
          </div>
        )}

        {/* Notes preview (collapsed) */}
        {!expanded && comm.notes && (
          <p className="mt-1.5 text-[12px] text-slate-500 leading-relaxed line-clamp-2">{comm.notes}</p>
        )}

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2">
                {editing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={draft.subject}
                      onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))}
                      placeholder="Subject / topic..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium focus:outline-none focus:border-sage"
                    />
                    <textarea
                      value={draft.notes}
                      onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium focus:outline-none focus:border-sage resize-none leading-relaxed"
                    />
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setDraft(d => ({ ...d, is_urgent: !d.is_urgent }))}
                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all', draft.is_urgent ? 'bg-red-50 border-red-200 text-red-500' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100')}
                      >
                        {draft.is_urgent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />} Urgent
                      </button>
                      <button
                        onClick={() => setDraft(d => ({ ...d, is_iep_related: !d.is_iep_related }))}
                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all', draft.is_iep_related ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100')}
                      >
                        {draft.is_iep_related ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />} IEP Related
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-sage text-white rounded-xl text-[12px] font-black hover:bg-sage-dark transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                      <button
                        onClick={() => { setEditing(false); setDraft({ subject: comm.subject ?? '', notes: comm.notes, is_urgent: comm.is_urgent, is_iep_related: comm.is_iep_related }); }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-[12px] font-black hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{comm.notes}</p>
                )}

                {/* Follow-up row */}
                {(followUpDate || comm.follow_up_date) && !editing && (
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium',
                    followUpOverdue ? 'bg-red-50 text-red-600' : comm.follow_up_done ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'
                  )}>
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    Follow-up: {followUpDate?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {followUpOverdue && ' · OVERDUE'}
                    {comm.follow_up_done && ' · Done'}
                    {!comm.follow_up_done && (
                      <button
                        onClick={() => onUpdate(comm.id, { follow_up_done: true })}
                        className="ml-auto flex items-center gap-1 font-black hover:opacity-70"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark done
                      </button>
                    )}
                  </div>
                )}

                {/* Action row */}
                {!editing && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-sage transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-sage transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                    <button
                      onClick={() => onDelete(comm.id)}
                      className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-red-500 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-slate-500 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Less' : 'More'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Add Form ─────────────────────────────────────────────────────────────────

function AddCommForm({
  student,
  onSave,
  onCancel,
}: {
  student: Student;
  onSave: (data: Omit<ParentCommunication, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(blankForm(student));
  const [saving, setSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const detectCommType = (text: string): string | null => {
    const lower = text.toLowerCase();
    if (/\b(called|phone|phoned|spoke on the phone|talked on the phone|left a voicemail|voicemail|cell|rang)\b/.test(lower)) return 'Phone';
    if (/\b(email|emailed|sent an email|wrote an email)\b/.test(lower)) return 'Email';
    if (/\b(met|meeting|conference|in person|face to face|visited|sit down)\b/.test(lower)) return 'Meeting';
    if (/\b(parentsquare|parent square|ps message|sent a ps)\b/.test(lower)) return 'ParentSquare';
    return null;
  };

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
      const detectedType = detectCommType(t);
      const detectedDir = detectDirection(t);
      setForm(f => {
        const updatedNotes = f.notes ? f.notes + ' ' + t : t;
        return {
          ...f,
          notes: updatedNotes,
          comm_type: (!f.comm_type && detectedType) ? detectedType : f.comm_type,
          direction: !f.direction ? detectedDir : f.direction,
        };
      });
      const hints: string[] = [];
      if (detectedType) hints.push(detectedType);
      hints.push(detectedDir === 'outbound' ? 'I reached out' : 'They contacted me');
      if (hints.length) toast.success(`Detected: ${hints.join(' · ')}`);
    };
    recognitionRef.current = r;
    r.start();
  };

  const handleSubmit = async () => {
    if (!form.notes.trim()) { toast.error('Please add notes about the communication.'); return; }
    setSaving(true);
    const commDate = form.comm_date_time
      ? new Date(form.comm_date_date + 'T' + form.comm_date_time).toISOString()
      : new Date(form.comm_date_date + 'T00:00').toISOString();
    try {
      await onSave({
        student_id: student.id,
        student_name: student.name,
        comm_type: form.comm_type,
        direction: form.direction || detectDirection(form.notes),
        subject: form.subject || null,
        notes: form.notes.trim(),
        parent_name: form.parent_name || null,
        comm_date: commDate,
        follow_up_date: form.follow_up_date || null,
        follow_up_done: form.follow_up_done,
        is_iep_related: form.is_iep_related,
        is_urgent: form.is_urgent,
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
      className="bg-white border border-sage/20 rounded-2xl p-4 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-black text-slate-600 uppercase tracking-wider">Log Communication</span>
        <button onClick={onCancel} className="text-slate-300 hover:text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Type + Direction */}
      <div className="flex gap-2 flex-wrap">
        {COMM_TYPES.map(t => (
          <button
            key={t.label}
            onClick={() => set('comm_type', t.label)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all',
              form.comm_type === t.label
                ? cn(t.bg, t.border, t.color, 'shadow-sm')
                : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
            )}
          >
            <CommIcon type={t.label} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Direction */}
      <div className="space-y-1">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Who initiated? <span className="normal-case font-medium text-slate-300">(optional — AI will infer from your note)</span></p>
        <div className="flex gap-2">
          {(['outbound', 'inbound'] as const).map(d => (
            <button
              key={d}
              onClick={() => set('direction', form.direction === d ? '' : d)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all',
                form.direction === d
                  ? 'bg-slate-700 border-slate-700 text-white'
                  : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
              )}
            >
              {d === 'outbound'
                ? <><ArrowUpRight className="w-3.5 h-3.5" /> I reached out</>
                : <><ArrowDownLeft className="w-3.5 h-3.5" /> They contacted me</>}
            </button>
          ))}
        </div>
      </div>

      {/* Subject + Parent name */}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={form.subject}
          onChange={e => set('subject', e.target.value)}
          placeholder="Subject / topic..."
          className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium focus:outline-none focus:border-sage"
        />
        <input
          type="text"
          value={form.parent_name}
          onChange={e => set('parent_name', e.target.value)}
          placeholder="Parent name..."
          className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium focus:outline-none focus:border-sage"
        />
      </div>

      {/* Notes */}
      <div className="relative">
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="What was discussed? Key points, next steps, tone of the conversation..."
          rows={7}
          className="w-full px-3 py-2 pr-32 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium focus:outline-none focus:border-sage resize-none leading-relaxed"
        />
        <button
          type="button"
          onClick={handleVoice}
          className={cn('absolute right-2 bottom-2 flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-sm border transition-all font-bold text-[11px] uppercase tracking-widest', isListening ? 'bg-terracotta text-white border-terracotta animate-pulse shadow-lg shadow-terracotta/30' : 'bg-white text-slate-500 border-slate-200 hover:bg-terracotta/10 hover:text-terracotta hover:border-terracotta/40')}
          title={isListening ? 'Stop recording' : 'Tap to dictate your note'}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{isListening ? 'Stop' : 'Voice'}</span>
        </button>
      </div>

      {/* Date + Time + Follow-up */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">Date</label>
          <input
            type="date"
            value={form.comm_date_date}
            onChange={e => set('comm_date_date', e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[12px] font-medium focus:outline-none focus:border-sage"
          />
        </div>
        <div>
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">Time <span className="normal-case font-medium">(optional)</span></label>
          <input
            type="time"
            value={form.comm_date_time}
            onChange={e => set('comm_date_time', e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[12px] font-medium focus:outline-none focus:border-sage"
          />
        </div>
      </div>
      <div>
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">Follow-up Date <span className="normal-case font-medium">(optional)</span></label>
        <input
          type="date"
          value={form.follow_up_date}
          onChange={e => set('follow_up_date', e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[12px] font-medium focus:outline-none focus:border-sage"
        />
      </div>

      {/* Flags */}
      <div className="flex gap-3">
        <button
          onClick={() => set('is_iep_related', !form.is_iep_related)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all',
            form.is_iep_related
              ? 'bg-violet-50 border-violet-200 text-violet-600'
              : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
          )}
        >
          {form.is_iep_related ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
          IEP Related
        </button>
        <button
          onClick={() => set('is_urgent', !form.is_urgent)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-black transition-all',
            form.is_urgent
              ? 'bg-red-50 border-red-200 text-red-500'
              : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
          )}
        >
          {form.is_urgent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
          Urgent
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full py-2.5 bg-sage text-white rounded-xl text-[13px] font-black hover:bg-sage-dark disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Communication Log'}
      </button>
    </motion.div>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function CommSummary({ communications }: { communications: ParentCommunication[] }) {
  const stats = useMemo(() => {
    const total = communications.length;
    const iep = communications.filter(c => c.is_iep_related).length;
    const urgent = communications.filter(c => c.is_urgent).length;
    const pendingFollowUp = communications.filter(c => c.follow_up_date && !c.follow_up_done).length;
    const lastComm = communications[0];
    const lastDate = lastComm
      ? (() => {
          const d = new Date(lastComm.comm_date);
          const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
          return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff}d ago`;
        })()
      : 'Never';

    const byType: Record<string, number> = {};
    communications.forEach(c => { byType[c.comm_type] = (byType[c.comm_type] ?? 0) + 1; });

    return { total, iep, urgent, pendingFollowUp, lastDate, byType };
  }, [communications]);

  if (stats.total === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {[
        { val: stats.total,           label: 'Total logs',     color: 'text-slate-700' },
        { val: stats.lastDate,        label: 'Last contact',   color: 'text-slate-700' },
        { val: stats.iep,             label: 'IEP entries',    color: 'text-violet-600' },
        { val: stats.pendingFollowUp, label: 'Follow-ups due', color: stats.pendingFollowUp > 0 ? 'text-amber-600' : 'text-slate-700' },
      ].map(({ val, label, color }) => (
        <div key={label} className="bg-white border border-slate-100 rounded-2xl px-3 py-2.5 text-center shadow-sm">
          <div className={cn('text-[22px] font-black leading-none', color)}>{val}</div>
          <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Copy All (for IEP meetings) ──────────────────────────────────────────────

function buildFullLog(student: Student, comms: ParentCommunication[]): string {
  const lines: string[] = [
    `PARENT COMMUNICATION LOG`,
    `Student: ${student.name}`,
    `Generated: ${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`,
    `Total Entries: ${comms.length}`,
    '',
    '═'.repeat(60),
  ];

  [...comms].reverse().forEach((c, i) => {
    const d = new Date(c.comm_date);
    lines.push('');
    lines.push(`[${i + 1}] ${c.comm_type.toUpperCase()} · ${c.direction.toUpperCase()} · ${d.toLocaleDateString()} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
    if (c.subject) lines.push(`Subject: ${c.subject}`);
    if (c.parent_name) lines.push(`Parent/Guardian: ${c.parent_name}`);
    if (c.is_iep_related) lines.push('⚑ IEP Related');
    if (c.is_urgent) lines.push('⚠ Urgent');
    lines.push('');
    lines.push(c.notes);
    if (c.follow_up_date) {
      const fu = new Date(c.follow_up_date + 'T00:00');
      lines.push('');
      lines.push(`Follow-up: ${fu.toLocaleDateString()} — ${c.follow_up_done ? 'COMPLETED' : 'PENDING'}`);
    }
    lines.push('─'.repeat(40));
  });

  return lines.join('\n');
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ParentCommunicationLog({
  student,
  communications,
  onAdd,
  onUpdate,
  onDelete,
  addTask,
}: ParentCommunicationLogProps) {
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showIepOnly, setShowIepOnly] = useState(false);

  // Filter to this student only, sorted newest first
  const allComms = useMemo(() =>
    communications
      .filter(c => c.student_id === student.id)
      .sort((a, b) => new Date(b.comm_date).getTime() - new Date(a.comm_date).getTime()),
    [communications, student.id]
  );

  const filtered = useMemo(() => {
    let list = allComms;
    if (filterType) list = list.filter(c => c.comm_type === filterType);
    if (showIepOnly) list = list.filter(c => c.is_iep_related);
    return list;
  }, [allComms, filterType, showIepOnly]);

  const handleAdd = async (data: Omit<ParentCommunication, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    const result = await onAdd(data);
    if (result) {
      setShowForm(false);
      if (data.is_urgent && addTask) {
        const taskText = data.subject
          ? `Follow up: ${data.subject} (${student.name.split(' ')[0]})`
          : `Urgent parent comm — ${student.name.split(' ')[0]}`;
        toast('⚠ Urgent logged — add to task list?', {
          duration: 8000,
          action: {
            label: 'Add task',
            onClick: () => {
              addTask({ text: taskText, completed: false, color: 'urgent' });
              toast.success('Added to task list');
            },
          },
        });
      } else {
        toast.success('Communication logged');
      }
    } else {
      toast.error('Failed to save — please try again.');
    }
  };

  const handleDelete = (id: string) => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) onDelete(id);
    }, 3000);
    toast('Entry deleted', {
      duration: 3000,
      action: {
        label: 'Undo',
        onClick: () => { cancelled = true; clearTimeout(timer); toast.dismiss(); },
      },
    });
  };

  const handleCopyAll = () => {
    if (allComms.length === 0) return;
    navigator.clipboard.writeText(buildFullLog(student, allComms));
    toast.success(`Copied full log (${allComms.length} entries)`);
  };

  // Group by month for timeline rendering
  const grouped = useMemo(() => {
    const groups: { label: string; items: ParentCommunication[] }[] = [];
    filtered.forEach(c => {
      const d = new Date(c.comm_date);
      const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(c);
      } else {
        groups.push({ label, items: [c] });
      }
    });
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-[15px] font-black text-blue-600">Parent Communication Log</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Every contact, automatically timestamped</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-sage text-white rounded-xl text-[13px] font-black hover:bg-sage-dark transition-colors shadow-sm"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Add Parent Communication'}
          </button>
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <AddCommForm student={student} onSave={handleAdd} onCancel={() => setShowForm(false)} />
        )}
      </AnimatePresence>

      {/* Summary stats */}
      <CommSummary communications={allComms} />

      {/* Copy / Email full log */}
      {allComms.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            title="Copy full communication log"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-100 text-violet-600 rounded-xl text-[11px] font-black hover:bg-violet-100 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Copy Full Log
          </button>
          <button
            onClick={() => {
              const body = buildFullLog(student, allComms);
              window.location.href = `mailto:?subject=${encodeURIComponent(`Parent Communication Log — ${student.name}`)}&body=${encodeURIComponent(body)}`;
            }}
            title="Email full communication log"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl text-[11px] font-black hover:bg-blue-100 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Email Full Log
          </button>
        </div>
      )}

      {/* Filters */}
      {allComms.length > 2 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Filter saved logs by type <span className="normal-case font-medium">(optional)</span></p>
          <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
          {COMM_TYPES.map(t => (
            <button
              key={t.label}
              onClick={() => setFilterType(f => f === t.label ? null : t.label)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-black transition-all',
                filterType === t.label
                  ? cn(t.bg, t.border, t.color)
                  : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
              )}
            >
              <CommIcon type={t.label} />
              {t.label}
            </button>
          ))}
          <button
            onClick={() => setShowIepOnly(v => !v)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-black transition-all',
              showIepOnly
                ? 'bg-violet-50 border-violet-100 text-violet-600'
                : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            IEP Only
          </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {allComms.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-[13px] font-medium">No communication logged yet</p>
          <p className="text-[12px] mt-1">Tap <strong>Log</strong> to record your first contact with {student.name.split(' ')[0]}'s family</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-slate-400">
          <p className="text-[13px] font-medium">No entries match your filter</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.label}>
              {/* Month divider */}
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{group.label}</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {group.items.map(comm => (
                    <TimelineEntry
                      key={comm.id}
                      comm={comm}
                      onDelete={handleDelete}
                      onUpdate={onUpdate}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
