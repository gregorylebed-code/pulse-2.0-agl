import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, X, AlertTriangle, ArrowUpRight, ArrowDownLeft, Mail, Phone, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { ParentCommunication, Student } from '../types';
import { cn } from '../utils/cn';

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
  const dateStr = new Date(comm.comm_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
          <span className="text-[11px] text-slate-400 flex-shrink-0">{dateStr}</span>
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

export default function ParentCommsScreen({ students, communications, onAdd, onUpdate, onDelete, addTask, tasks, onStudentClick, isSandboxMode }: ParentCommsScreenProps) {
  const [filterStudentId, setFilterStudentId] = useState<string | null>(null);

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
        </div>

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
