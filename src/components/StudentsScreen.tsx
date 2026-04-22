import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Trash2, Sparkles, Loader2, X, Send, Copy, Mic, MicOff, Cake, Pin, Calendar, ChevronDown, ChevronUp, ClipboardCheck, Mail, LayoutGrid, Map } from 'lucide-react';
import { toast } from 'sonner';
import { Note, Student, Report, CalendarEvent, StudentGoal, ParentCommunication, Shoutout, Accommodation, AttendanceRecord } from '../types';
import { Abbreviation } from '../utils/expandAbbreviations';
import { summarizeNotes, ReportData, parseBirthdays } from '../lib/gemini';
import { askAboutStudents } from '../utils/aiAssistant';
import StudentDetailView from './StudentDetailView';
import { cn } from '../utils/cn';
import { isFullMode } from '../lib/mode';
import { useAliasMode } from '../context/AliasModeContext';
import { getDisplayName, getDisplayFirst } from '../utils/getDisplayName';
import SeatingChart from './SeatingChart';


interface StudentsScreenProps {
  students: Student[];
  notes: Note[];
  reports: Report[];
  goals: StudentGoal[];
  indicators: any[];
  commTypes: any[];
  calendarEvents: CalendarEvent[];
  parentCommunications: ParentCommunication[];
  classes: string[];
  onUpdate: () => void;
  deleteStudent: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addNote: (note: any) => Promise<any>;
  updateNote: (id: string, updates: any) => Promise<void>;
  updateStudent: (id: string, updates: any) => Promise<void>;
  addReport: (r: Omit<Report, 'id' | 'created_at' | 'user_id'>) => Promise<Report | null>;
  deleteReport: (id: string) => Promise<void>;
  addGoal: (goal: Omit<StudentGoal, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<StudentGoal | null>;
  updateGoal: (id: string, updates: Partial<Pick<StudentGoal, 'goal_text' | 'status' | 'teacher_note' | 'category'>>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  accommodations: Accommodation[];
  addAccommodation: (acc: Omit<Accommodation, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<Accommodation | null>;
  updateAccommodation: (id: string, updates: Partial<Omit<Accommodation, 'id' | 'user_id' | 'student_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  deleteAccommodation: (id: string) => Promise<void>;
  addParentCommunication: (comm: Omit<ParentCommunication, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<ParentCommunication | null>;
  updateParentCommunication: (id: string, updates: Partial<Omit<ParentCommunication, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  deleteParentCommunication: (id: string) => Promise<void>;
  attendanceRecords: AttendanceRecord[];
  addAttendanceRecords: (records: { student_id: string; date: string; status: 'absent' | 'tardy' }[]) => Promise<void>;
  deleteAttendanceRecord: (id: string) => Promise<void>;
  abbreviations: Abbreviation[];
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
  teacherTitle: string;
  teacherLastName: string;
  shoutouts: Shoutout[];
  addTask?: (task: { text: string; completed: boolean; color: string }) => Promise<any>;
  seatingChart: Record<string, { x: number; y: number }>;
  saveSeatingChart: (chart: Record<string, { x: number; y: number }>) => Promise<void>;
}

// ─── Attendance Banner ────────────────────────────────────────────────────────

function AttendanceBanner({
  attendanceRecords,
  students,
  onStudentClick,
  onDelete,
}: {
  attendanceRecords: AttendanceRecord[];
  students: Student[];
  onStudentClick: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  // Group by date, most recent first
  const byDate = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    attendanceRecords.forEach(r => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [attendanceRecords]);

  if (byDate.length === 0) return null;

  const todayRecords = attendanceRecords.filter(r => r.date === today);
  const todayAbsent = todayRecords.filter(r => r.status === 'absent').length;
  const todayTardy = todayRecords.filter(r => r.status === 'tardy').length;

  const summaryParts: string[] = [];
  if (todayAbsent > 0) summaryParts.push(`${todayAbsent} absent`);
  if (todayTardy > 0) summaryParts.push(`${todayTardy} tardy`);
  const todaySummary = summaryParts.length > 0 ? summaryParts.join(', ') : null;

  return (
    <div className="px-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center gap-2 px-4 py-2.5"
        >
          <ClipboardCheck className="w-4 h-4 flex-shrink-0 text-slate-400" />
          <span className="text-[12px] font-black flex-1 text-left text-slate-600">
            Attendance
            {todaySummary && <span className="ml-1.5 text-slate-400 font-bold">· Today: {todaySummary}</span>}
          </span>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
        </button>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 space-y-3">
                {byDate.slice(0, 14).map(([date, records]) => {
                  const isToday = date === today;
                  const d = new Date(date + 'T00:00');
                  const dateStr = isToday ? 'Today' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  const absent = records.filter(r => r.status === 'absent');
                  const tardy = records.filter(r => r.status === 'tardy');
                  return (
                    <div key={date} className="space-y-1">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-wide">{dateStr}</span>
                      {[...absent, ...tardy].map(rec => {
                        const student = students.find(s => s.id === rec.student_id);
                        if (!student) return null;
                        return (
                          <div key={rec.id} className="flex items-center gap-2">
                            <button
                              onClick={() => { onStudentClick(rec.student_id); setCollapsed(true); }}
                              className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-left hover:opacity-80 transition-all"
                            >
                              <span className={cn(
                                'text-[10px] font-black px-1.5 py-0.5 rounded-md',
                                rec.status === 'absent' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                              )}>
                                {rec.status === 'absent' ? 'ABS' : 'TAR'}
                              </span>
                              <span className="text-[12px] font-bold text-slate-700 flex-1 truncate">{student.name}</span>
                            </button>
                            <button
                              onClick={() => onDelete(rec.id)}
                              className="p-1.5 text-slate-300 hover:text-red-400 transition-colors"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Pending Follow-ups Banner ────────────────────────────────────────────────

function PendingFollowUpsBanner({
  parentCommunications,
  students,
  onStudentClick,
}: {
  parentCommunications: ParentCommunication[];
  students: Student[];
  onStudentClick: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  const pending = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parentCommunications
      .filter(c => c.follow_up_date && !c.follow_up_done)
      .sort((a, b) => new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime());
  }, [parentCommunications]);

  if (pending.length === 0) return null;

  const overdue = pending.filter(c => {
    const d = new Date(c.follow_up_date! + 'T00:00');
    return d < new Date();
  });

  return (
    <div className="px-2">
      <div className={cn('rounded-2xl border overflow-hidden', overdue.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-blue-100 bg-blue-50')}>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center gap-2 px-4 py-2.5"
        >
          <Calendar className={cn('w-4 h-4 flex-shrink-0', overdue.length > 0 ? 'text-amber-500' : 'text-blue-400')} />
          <span className={cn('text-[12px] font-black flex-1 text-left', overdue.length > 0 ? 'text-amber-700' : 'text-blue-600')}>
            {pending.length} pending follow-up{pending.length > 1 ? 's' : ''}
            {overdue.length > 0 && ` · ${overdue.length} overdue`}
          </span>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
        </button>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 space-y-1.5">
                {pending.map(c => {
                  const student = students.find(s => s.id === c.student_id);
                  const fuDate = new Date(c.follow_up_date! + 'T00:00');
                  const isOverdue = fuDate < new Date();
                  const dateStr = fuDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  return (
                    <button
                      key={c.id}
                      onClick={() => { onStudentClick(c.student_id); setCollapsed(true); }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all hover:opacity-80',
                        isOverdue ? 'bg-red-50 border border-red-100' : 'bg-white border border-blue-100'
                      )}
                    >
                      <span className={cn('text-[12px] font-black flex-1 truncate', isOverdue ? 'text-red-600' : 'text-slate-700')}>
                        {student?.name ?? c.student_name}
                      </span>
                      {c.subject && (
                        <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{c.subject}</span>
                      )}
                      <span className={cn('text-[11px] font-bold flex-shrink-0', isOverdue ? 'text-red-500' : 'text-blue-400')}>
                        {isOverdue ? `Overdue · ${dateStr}` : dateStr}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function StudentsScreen({
  students,
  notes,
  reports,
  goals,
  indicators,
  commTypes,
  calendarEvents,
  parentCommunications,
  classes,
  onUpdate,
  deleteStudent,
  deleteNote,
  addNote,
  updateNote,
  updateStudent,
  addReport,
  deleteReport,
  addGoal,
  updateGoal,
  deleteGoal,
  accommodations,
  addAccommodation,
  updateAccommodation,
  deleteAccommodation,
  addParentCommunication,
  updateParentCommunication,
  deleteParentCommunication,
  attendanceRecords,
  addAttendanceRecords,
  deleteAttendanceRecord,
  abbreviations,
  selectedStudentId,
  setSelectedStudentId,
  teacherTitle,
  teacherLastName,
  shoutouts,
  addTask,
  seatingChart,
  saveSeatingChart,
}: StudentsScreenProps) {
  const { aliasMode } = useAliasMode();
  const [filter, setFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'seating'>('grid');

  React.useEffect(() => {
    if (filter === 'All' && viewMode === 'seating') {
      setViewMode('grid');
    }
  }, [filter, viewMode]);

  // ─── Attendance mode ─────────────────────────────────────────────────────
  const [attendanceMode, setAttendanceMode] = useState(false);
  const [attendanceSelections, setAttendanceSelections] = useState<Record<string, 'absent' | 'tardy'>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const toggleAttendanceStudent = (id: string) => {
    setAttendanceSelections(prev => {
      const current = prev[id];
      if (!current) return { ...prev, [id]: 'absent' };
      if (current === 'absent') return { ...prev, [id]: 'tardy' };
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const cancelAttendanceMode = () => {
    setAttendanceMode(false);
    setAttendanceSelections({});
    setAttendanceDate(new Date().toISOString().split('T')[0]);
  };

  const submitAttendance = async () => {
    const records = (Object.entries(attendanceSelections) as [string, 'absent' | 'tardy'][]).map(([student_id, status]) => ({ student_id, date: attendanceDate, status }));
    if (records.length === 0) { cancelAttendanceMode(); return; }
    setAttendanceSaving(true);
    await addAttendanceRecords(records);
    setAttendanceSaving(false);
    setAttendanceMode(false);
    setAttendanceSelections({});
    const absentCount = records.filter(r => r.status === 'absent').length;
    const tardyCount = records.filter(r => r.status === 'tardy').length;
    const parts: string[] = [];
    if (absentCount > 0) parts.push(`${absentCount} absent`);
    if (tardyCount > 0) parts.push(`${tardyCount} tardy`);
    const todayStr = new Date().toISOString().split('T')[0];
    const dateLabel = attendanceDate === todayStr ? 'today' : new Date(attendanceDate + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    toast.success(`Attendance saved for ${dateLabel} · ${parts.join(', ')}`);
  };
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [showStudentHint, setShowStudentHint] = useState(() => {
    return localStorage.getItem('pulse_dismissed_student_hint') !== '1';
  });
  const dismissStudentHint = () => {
    localStorage.setItem('pulse_dismissed_student_hint', '1');
    setShowStudentHint(false);
  };

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('pulse_pinned_students');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  const togglePin = (id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('pulse_pinned_students', JSON.stringify([...next]));
      return next;
    });
  };

  const [pressingId, setPressingId] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didPin = useRef(false);

  const startPress = (id: string) => {
    didPin.current = false;
    setPressingId(id);
    pressTimer.current = setTimeout(() => {
      didPin.current = true;
      const willBePinned = !pinnedIds.has(id);
      togglePin(id);
      setPressingId(null);
      const student = students.find(s => s.id === id);
      if (student) toast(willBePinned ? `📌 ${getDisplayFirst(student, aliasMode)} pinned to top` : `${getDisplayFirst(student, aliasMode)} unpinned`);
    }, 2000);
  };

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    setPressingId(null);
  };
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [birthdayText, setBirthdayText] = useState('');
  const [birthdayParsing, setBirthdayParsing] = useState(false);
  const [birthdayPreview, setBirthdayPreview] = useState<Array<{ studentName: string; birthMonth: number; birthDay: number; matchedId: string | null; manualId?: string }> | null>(null);
  const [birthdaySaving, setBirthdaySaving] = useState(false);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const studentNotes = notes.filter(n => n.student_name === selectedStudent?.name).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const studentReports = reports.filter(r => r.student_name === selectedStudent?.name).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const studentGoals = goals.filter(g => g.student_id === selectedStudent?.id);
  const studentAccommodations = accommodations.filter(a => a.student_id === selectedStudent?.id);


  const reportToText = (report: ReportData): string =>
    [report.opening, '\nGlow:\n' + report.glow, '\nGrow:\n' + report.grow, '\nGoal:\n' + report.goal, '\n' + report.closing].join('\n');

  const handleGenerateReport = async (length: 'Quick Note' | 'Standard' | 'Detailed', filteredNotes: Note[]): Promise<ReportData | undefined> => {
    if (!selectedStudent) return;
    const studentShoutouts = shoutouts.filter(s => s.student_id === selectedStudent.id);
    const { report } = await summarizeNotes(filteredNotes, length, studentShoutouts, selectedStudent.pronouns);
    await addReport({
      student_name: selectedStudent.name,
      content: report ? reportToText(report) : '',
      length,
    });
    return report ?? undefined;
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      // Delete all students
      for (const student of students) {
        await deleteStudent(student.id);
      }
      // Delete all notes
      for (const note of notes) {
        await deleteNote(note.id);
      }
      toast.success('All students deleted successfully');
      setIsCleanupModalOpen(false);
      onUpdate();
    } catch (err: any) {
      toast.error(`Failed to delete students: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClass = async () => {
    if (filter === 'All') return;
    setIsDeleting(true);
    try {
      // Delete students in this class
      const classStudents = students.filter(s => s.class_period === filter || s.class_id === filter);
      for (const student of classStudents) {
        await deleteStudent(student.id);
      }
      toast.success(`Class Period ${filter} students deleted`);
      setIsCleanupModalOpen(false);
      onUpdate();
    } catch (err: any) {
      toast.error(`Failed to delete class: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMicClick = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);
    recognition.start();
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiQuery(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  const handleEmailAllParents = () => {
    const emails: string[] = [];
    filteredStudents.forEach(s => {
      (s.parent_emails ?? []).forEach(e => {
        const val = typeof e === 'object' ? (e as any).value : String(e);
        if (val && !emails.includes(val)) emails.push(val);
      });
    });
    if (emails.length === 0) {
      toast.error('No parent emails found for the current class filter.');
      return;
    }
    const subject = encodeURIComponent(filter === 'All' ? 'A note from your teacher' : `A note from your ${filter} teacher`);
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${subject}`;
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim() || isAiLoading) return;
    setIsAiLoading(true);
    setAiResponse(null);
    try {
      const answer = await askAboutStudents(aiQuery, notes, students);
      setAiResponse(answer);
    } catch {
      setAiResponse('Could not get a response. Please try again.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const avatarColors = [
    'bg-blue-100 text-blue-600 border-blue-200',
    'bg-green-100 text-green-600 border-green-200',
    'bg-amber-100 text-amber-600 border-amber-200',
    'bg-purple-100 text-purple-600 border-purple-200',
    'bg-rose-100 text-rose-600 border-rose-200',
    'bg-cyan-100 text-cyan-600 border-cyan-200'
  ];

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  // Per-student last-note lookup for status rings
  const lastNoteByStudent = useMemo(() => {
    const map: Record<string, Date> = {};
    notes.forEach(n => {
      if (!n.student_name) return;
      const d = new Date(n.created_at);
      if (!map[n.student_name] || d > map[n.student_name]) map[n.student_name] = d;
    });
    return map;
  }, [notes]);

  const getStudentStatus = (name: string) => {
    const last = lastNoteByStudent[name];
    if (!last) return 'never';
    const days = Math.floor((Date.now() - last.getTime()) / 86400000);
    if (days === 0) return 'today';
    if (days <= 4) return 'recent';
    if (days <= 7) return 'fading';
    return 'neglected';
  };

  const statusRing: Record<string, string> = {
    today:     'ring-[3px] ring-emerald-400 ring-offset-2',
    recent:    'ring-[3px] ring-sage/60 ring-offset-2',
    fading:    'ring-[3px] ring-amber-400 ring-offset-2',
    neglected: 'ring-[3px] ring-red-400 ring-offset-2',
    never:     'ring-2 ring-slate-200 ring-offset-1',
  };

  const statusDot: Record<string, string> = {
    today:     'bg-emerald-400',
    recent:    'bg-sage',
    fading:    'bg-amber-400',
    neglected: 'bg-red-400',
    never:     'bg-slate-300',
  };

  const CLASS_PALETTE = [
    { bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-600', badge: 'bg-violet-100 text-violet-600' },
    { bg: 'bg-sky-50',    border: 'border-sky-100',    text: 'text-sky-600',    badge: 'bg-sky-100 text-sky-600' },
    { bg: 'bg-emerald-50',border: 'border-emerald-100',text: 'text-emerald-600',badge: 'bg-emerald-100 text-emerald-600' },
    { bg: 'bg-amber-50',  border: 'border-amber-100',  text: 'text-amber-600',  badge: 'bg-amber-100 text-amber-600' },
    { bg: 'bg-rose-50',   border: 'border-rose-100',   text: 'text-rose-600',   badge: 'bg-rose-100 text-rose-600' },
    { bg: 'bg-cyan-50',   border: 'border-cyan-100',   text: 'text-cyan-600',   badge: 'bg-cyan-100 text-cyan-600' },
  ];

  if (selectedStudent) {
    return (
      <StudentDetailView
        student={selectedStudent}
        students={students}
        notes={studentNotes}
        reports={studentReports}
        goals={studentGoals}
        indicators={indicators}
        commTypes={commTypes}
        calendarEvents={calendarEvents}
        parentCommunications={parentCommunications}
        onBack={() => { setSelectedStudentId(null); }}
        onGenerateReport={handleGenerateReport}
        onNoteUpdate={onUpdate}
        addNote={addNote}
        updateNote={updateNote}
        updateStudent={updateStudent}
        deleteNote={deleteNote}
        deleteReport={deleteReport}
        addGoal={addGoal}
        updateGoal={updateGoal}
        deleteGoal={deleteGoal}
        accommodations={studentAccommodations}
        addAccommodation={addAccommodation}
        updateAccommodation={updateAccommodation}
        deleteAccommodation={deleteAccommodation}
        addParentCommunication={addParentCommunication}
        updateParentCommunication={updateParentCommunication}
        deleteParentCommunication={deleteParentCommunication}
        abbreviations={abbreviations}
        teacherTitle={teacherTitle}
        teacherLastName={teacherLastName}
        shoutouts={shoutouts.filter(s => s.student_id === selectedStudent.id)}
        addTask={addTask}
        attendanceRecords={attendanceRecords.filter(r => r.student_id === selectedStudent.id)}
        deleteAttendanceRecord={deleteAttendanceRecord}
      />
    );
  }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const handleParseBirthdays = async () => {
    if (!birthdayText.trim()) return;
    setBirthdayParsing(true);
    try {
      const results = await parseBirthdays(birthdayText, students.map(s => s.name));
      const withMatch = results.map(r => {
        // First try AI's suggested matchedName
        const aiMatch = r.matchedName
          ? students.find(s => s.name.toLowerCase() === r.matchedName!.toLowerCase())
          : null;
        // Fallback to local string match
        const localMatch = !aiMatch
          ? students.find(s =>
              s.name.toLowerCase().includes(r.studentName.toLowerCase()) ||
              r.studentName.toLowerCase().includes(s.name.toLowerCase())
            )
          : null;
        return { studentName: r.studentName, birthMonth: r.birthMonth, birthDay: r.birthDay, matchedId: (aiMatch ?? localMatch)?.id ?? null };
      });
      setBirthdayPreview(withMatch);
    } catch {
      toast.error('Failed to parse birthdays');
    } finally {
      setBirthdayParsing(false);
    }
  };

  const handleSaveBirthdays = async () => {
    if (!birthdayPreview) return;
    setBirthdaySaving(true);
    const matched = birthdayPreview.filter(b => b.manualId || b.matchedId);
    try {
      for (const b of matched) {
        await updateStudent((b.manualId || b.matchedId)!, { birth_month: b.birthMonth, birth_day: b.birthDay });
      }
      toast.success(`Saved ${matched.length} birthday${matched.length !== 1 ? 's' : ''}!`);
      setIsBirthdayModalOpen(false);
      setBirthdayText('');
      setBirthdayPreview(null);
    } catch {
      toast.error('Failed to save birthdays');
    } finally {
      setBirthdaySaving(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const section = s.class_period || s.class_id;
    const matchesFilter = filter === 'All' || section === filter;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Group students by section
  const groupedStudents = filteredStudents.reduce((acc, student) => {
    const section = student.class_period || student.class_id || 'Unassigned';
    if (!acc[section]) acc[section] = [];
    acc[section].push(student);
    return acc;
  }, {} as Record<string, Student[]>);

  const sections = Object.keys(groupedStudents).sort();

  // Sort students within each section: pinned first (by pin order), then alphabetical by last name
  const sortKey = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : parts[0].toLowerCase();
  };
  const pinnedOrder = [...pinnedIds]; // preserve insertion order
  sections.forEach(section => {
    groupedStudents[section].sort((a, b) => {
      const aPinned = pinnedIds.has(a.id);
      const bPinned = pinnedIds.has(b.id);
      if (aPinned && bPinned) return pinnedOrder.indexOf(a.id) - pinnedOrder.indexOf(b.id);
      if (aPinned) return -1;
      if (bPinned) return 1;
      return sortKey(a.name).localeCompare(sortKey(b.name));
    });
  });

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-bold text-blue-600">Your Roster</h2>
          <button
            onClick={() => setIsBirthdayModalOpen(true)}
            className="p-1.5 bg-pink-50 text-pink-400 rounded-lg hover:bg-pink-100 hover:text-pink-500 transition-colors"
            title="Import Birthdays"
          >
            <Cake className="w-4 h-4" />
          </button>
          <button
            onClick={handleEmailAllParents}
            className="p-1.5 bg-blue-50 text-blue-400 rounded-lg hover:bg-blue-100 hover:text-blue-500 transition-colors"
            title="Email All Parents"
          >
            <Mail className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCleanupModalOpen(true)}
            className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-500 transition-colors"
            title="Cleanup Roster"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-100 overflow-x-auto no-scrollbar max-w-[240px]">
          {(
             <div className="flex mr-2 pr-2 border-r border-slate-100">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn("px-2 py-1.5 rounded-lg transition-all", viewMode === 'grid' ? "bg-slate-100 text-slate-700 font-bold" : "text-slate-400 hover:bg-slate-50")}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('seating')}
                  className={cn("px-2 py-1.5 rounded-lg transition-all", viewMode === 'seating' ? "bg-slate-100 text-slate-700 font-bold" : "text-slate-400 hover:bg-slate-50")}
                  title="Seating Chart"
                >
                  <Map className="w-4 h-4" />
                </button>
             </div>
          )}
          {['All', ...classes].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap",
                filter === f ? "bg-sage text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by student name..."
          className="w-full p-4 bg-white border border-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-sage/20 text-sm font-medium shadow-inner"
        />
      </div>

      {/* Attendance mode instruction bar */}
      <AnimatePresence>
        {attendanceMode && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="px-2"
          >
            <div className="rounded-2xl bg-slate-800 text-white px-4 py-3 space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[12px] font-black">Tap once = Absent · Tap again = Tardy · Tap again = Clear</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {Object.keys(attendanceSelections).length === 0
                      ? 'No students selected yet'
                      : `${Object.values(attendanceSelections).filter(s => s === 'absent').length} absent · ${Object.values(attendanceSelections).filter(s => s === 'tardy').length} tardy`}
                  </p>
                </div>
                <button
                  onClick={submitAttendance}
                  disabled={attendanceSaving || Object.keys(attendanceSelections).length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white rounded-xl text-[12px] font-black transition-colors"
                >
                  {attendanceSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Submit
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-bold">Date:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setAttendanceDate(e.target.value)}
                  className="bg-slate-700 text-white text-[11px] font-bold rounded-lg px-2 py-1 border border-slate-600 focus:outline-none focus:border-teal-400"
                />
                {attendanceDate !== new Date().toISOString().split('T')[0] && (
                  <span className="text-[11px] text-amber-400 font-bold">Backdated</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attendance history banner — hidden in public version */}

      {/* Pending Follow-ups Banner */}
      <PendingFollowUpsBanner
        parentCommunications={parentCommunications}
        students={students}
        onStudentClick={setSelectedStudentId}
      />

      {/* AI Ask Box */}
      {isFullMode && <div className="px-2">
        <form onSubmit={handleAskAI} className="relative">
          <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400 pointer-events-none" />
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder='Ask AI about your students… e.g. "Who needs the most support?"'
            className="w-full pl-11 pr-24 py-3.5 bg-white border border-orange-100 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-200 text-sm font-medium shadow-sm"
          />
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isAiLoading}
            className={cn(
              'absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors disabled:opacity-40',
              isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'text-slate-300 hover:text-orange-400'
            )}
            title="Speak your question"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            type="submit"
            disabled={!aiQuery.trim() || isAiLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-orange-400 text-white rounded-full hover:bg-orange-500 transition-colors disabled:opacity-40"
          >
            {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>

        <AnimatePresence>
          {(aiResponse || isAiLoading) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-3 p-4 bg-orange-50 border border-orange-100 rounded-[20px] relative"
            >
              {isAiLoading ? (
                <div className="flex items-center gap-2 text-orange-400 text-sm font-medium py-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking...
                </div>
              ) : (
                <>
                  <button
                    onClick={() => { setAiResponse(null); setAiQuery(''); }}
                    className="absolute top-3 right-3 p-1 text-orange-300 hover:text-orange-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex gap-3 pr-6">
                    <Sparkles className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{aiResponse}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(aiResponse!); toast.success('Copied!'); }}
                    className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-orange-400 hover:text-orange-600 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy to clipboard
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>}

      {/* Tap a student hint banner */}
      <AnimatePresence>
        {showStudentHint && students.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="px-2"
          >
            <div className="flex items-center gap-3 bg-teal-500 text-white rounded-2xl px-4 py-3">
              <span className="flex-1 text-[17px] font-semibold">Tap any student to see their full profile →</span>
              <button onClick={dismissStudentHint} className="p-1 rounded-full hover:bg-teal-400 transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {viewMode === 'seating' ? (
        <div className="px-2 pb-10 mt-2">
          <SeatingChart 
            students={filteredStudents} 
            seatingChart={seatingChart}
            saveSeatingChart={saveSeatingChart}
            onStudentClick={(id) => {
              if (attendanceMode) { toggleAttendanceStudent(id); return; }
              if (!didPin.current) setSelectedStudentId(id);
              didPin.current = false;
            }}
            statusDot={statusDot}
            getStudentStatus={getStudentStatus}
          />
        </div>
      ) : (
      <div className="space-y-8">
        {sections.map((section, sIdx) => {
          const palette = CLASS_PALETTE[sIdx % CLASS_PALETTE.length];
          const sectionNotes = notes.filter(n => {
            const st = groupedStudents[section].find(s => s.name === n.student_name);
            return !!st;
          });
          const thisWeekNotes = sectionNotes.filter(n => Date.now() - new Date(n.created_at).getTime() < 7 * 86400000).length;
          return (
            <div key={section} className="space-y-3">
              {/* Colorful section header */}
              <div className={cn('flex items-center gap-3 px-1 py-2 rounded-2xl border', palette.bg, palette.border)}>
                <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center font-black text-sm ml-1', palette.badge)}>
                  {section === 'Unassigned' ? '?' : section[0]}
                </div>
                <span className={cn('font-black text-sm flex-1', palette.text)}>
                  {section === 'Unassigned' ? 'Unassigned' : `Period ${section}`}
                </span>
                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-lg', palette.badge)}>
                  {groupedStudents[section].length} students
                </span>
                {thisWeekNotes > 0 && (
                  <span className="text-[11px] font-bold text-slate-400 mr-2">
                    {thisWeekNotes} notes this week
                  </span>
                )}
              </div>

              {/* Student grid */}
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2">
                {groupedStudents[section].map(s => {
                  const status = getStudentStatus(s.name);
                  const noteCount = notes.filter(n => n.student_name === s.name).length;
                  const isPinned = pinnedIds.has(s.id);
                  const isPressing = pressingId === s.id;
                  const attendanceSel = attendanceSelections[s.id];
                  return (
                    <motion.div
                      key={s.id}
                      onClick={() => {
                        if (attendanceMode) { toggleAttendanceStudent(s.id); return; }
                        if (!didPin.current) setSelectedStudentId(s.id);
                        didPin.current = false;
                      }}
                      onMouseDown={() => { if (!attendanceMode) startPress(s.id); }}
                      onMouseUp={cancelPress}
                      onMouseLeave={cancelPress}
                      onTouchStart={() => { if (!attendanceMode) startPress(s.id); }}
                      onTouchEnd={cancelPress}
                      onTouchCancel={cancelPress}
                      onContextMenu={e => e.preventDefault()}
                      whileTap={{ scale: 0.94 }}
                      className={cn(
                        "bg-white p-2 rounded-2xl card-shadow border flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:-translate-y-0.5 transition-all text-center relative select-none",
                        attendanceMode && attendanceSel === 'absent' && "border-red-300 bg-red-50",
                        attendanceMode && attendanceSel === 'tardy' && "border-amber-300 bg-amber-50",
                        attendanceMode && !attendanceSel && "opacity-70",
                        !attendanceMode && isPinned && "border-amber-200 bg-amber-50/40 hover:border-amber-300",
                        !attendanceMode && !isPinned && "border-slate-100 hover:border-sage/30",
                        isPressing && "scale-95"
                      )}
                    >
                      {/* Long-press progress overlay */}
                      {isPressing && (
                        <span className="pin-press-ring absolute inset-0 rounded-2xl pointer-events-none" style={{ zIndex: 10 }} />
                      )}

                      {/* Attendance badge overlay */}
                      {attendanceMode && attendanceSel && (
                        <span className={cn(
                          'absolute top-1 right-1 text-[9px] font-black px-1 py-0.5 rounded-md z-10',
                          attendanceSel === 'absent' ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'
                        )}>
                          {attendanceSel === 'absent' ? 'ABS' : 'TAR'}
                        </span>
                      )}

                      {/* Status dot (hidden in attendance mode) */}
                      {!attendanceMode && <span className={cn('absolute top-1.5 right-1.5 w-2 h-2 rounded-full', statusDot[status])} />}

                      {/* Pin indicator (pinned students only, hidden in attendance mode) */}
                      {!attendanceMode && isPinned && (
                        <span className="absolute top-1 left-1">
                          <Pin className="w-3 h-3 text-amber-400 fill-amber-400" />
                        </span>
                      )}

                      {/* Photo / avatar with status ring */}
                      {s.photo_url ? (
                        <img src={s.photo_url} alt={s.name} className={cn('w-10 h-10 rounded-full object-cover', !attendanceMode && statusRing[status])} />
                      ) : (
                        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center border text-lg', getAvatarColor(s.name), !attendanceMode && statusRing[status])} style={{ fontFamily: "'Boogaloo', cursive" }}>
                          {aliasMode ? getDisplayName(s, true).substring(0, 2).toUpperCase() : s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                      )}

                      <h4 className="text-[12px] font-bold text-slate-900 line-clamp-2 leading-tight font-display h-[30px] flex items-start justify-center">{getDisplayName(s, aliasMode)}</h4>

                      {/* Note count (hidden in attendance mode) */}
                      {!attendanceMode && noteCount > 0 && (
                        <span className="text-[11px] font-bold text-slate-400">{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              <p className="text-center text-[11px] text-red-400 font-medium pt-1 pb-2 flex items-center justify-center gap-1">
                <Pin className="w-2.5 h-2.5 inline" /> Hold a student card for 2 seconds to pin to top
              </p>
            </div>
          );
        })}

        {students.length === 0 && (
          <div className="text-center py-20 space-y-3 px-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-sm font-black text-slate-600">No students yet</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              To get started, go to <span className="font-bold text-sage">Settings</span> (bottom right) → tap <span className="font-bold text-sage">Roster Management</span> → paste in your class list and the AI will sort it out. Takes about 30 seconds.
            </p>
          </div>
        )}
      </div>
      )}

      {/* Birthday Import Modal */}
      <AnimatePresence>
        {isBirthdayModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end justify-center p-4 pb-28"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cake className="w-5 h-5 text-pink-400" />
                  <h3 className="text-base font-black text-slate-900">Import Birthdays</h3>
                </div>
                <button onClick={() => { setIsBirthdayModalOpen(false); setBirthdayText(''); setBirthdayPreview(null); }} className="p-1.5 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-400 font-medium">Paste any list of names and birthdays — AI will figure it out.</p>
              {!birthdayPreview ? (
                <>
                  <textarea
                    value={birthdayText}
                    onChange={(e) => setBirthdayText(e.target.value)}
                    placeholder={"Sarah Johnson - March 14\nMike Chen 5/22\nEmma Davis, born April 3rd..."}
                    rows={6}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium focus:outline-none focus:border-pink-200 resize-none"
                  />
                  <button
                    onClick={handleParseBirthdays}
                    disabled={!birthdayText.trim() || birthdayParsing}
                    className="w-full py-3 bg-pink-400 text-white rounded-full font-bold text-sm hover:bg-pink-500 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {birthdayParsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</> : <><Sparkles className="w-4 h-4" /> Parse with AI</>}
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {birthdayPreview.map((b, i) => {
                      const resolved = b.manualId || b.matchedId;
                      const resolvedName = resolved ? students.find(s => s.id === resolved)?.name : null;
                      return (
                        <div key={i} className={`px-3 py-2 rounded-xl text-xs font-medium ${resolved ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-100'}`}>
                          <div className="flex items-center justify-between">
                            <span className={resolved ? 'text-slate-700' : 'text-amber-600'}>{b.studentName}</span>
                            <span className="text-slate-500 ml-2">{MONTH_NAMES[b.birthMonth - 1]} {b.birthDay}</span>
                          </div>
                          {!b.matchedId && (
                            <select
                              value={b.manualId || ''}
                              onChange={e => setBirthdayPreview(prev => prev!.map((x, j) => j === i ? { ...x, manualId: e.target.value || undefined } : x))}
                              className="mt-1.5 w-full px-2 py-1 bg-white border border-amber-200 rounded-lg text-[11px] font-medium focus:outline-none focus:border-pink-300"
                            >
                              <option value="">— pick student —</option>
                              {students.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          )}
                          {b.matchedId && resolvedName && resolvedName !== b.studentName && (
                            <p className="text-[11px] text-green-500 mt-0.5">→ {resolvedName}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400">{birthdayPreview.filter(b => b.manualId || b.matchedId).length} of {birthdayPreview.length} ready to save.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setBirthdayPreview(null)} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-full font-bold text-sm hover:bg-slate-50 transition-colors">
                      Back
                    </button>
                    <button
                      onClick={handleSaveBirthdays}
                      disabled={birthdaySaving || birthdayPreview.filter(b => b.manualId || b.matchedId).length === 0}
                      className="flex-1 py-3 bg-pink-400 text-white rounded-full font-bold text-sm hover:bg-pink-500 transition-colors disabled:opacity-40"
                    >
                      {birthdaySaving ? 'Saving...' : 'Save Birthdays'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCleanupModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 pb-12"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Start Over</h3>
                <p className="text-sm text-slate-500 font-medium">Wait! This will permanently remove these students. Are you sure?</p>
              </div>

              <div className="space-y-3 pt-4">
                <button
                  onClick={handleDeleteAll}
                  disabled={isDeleting}
                  className="w-full py-3.5 bg-red-500 text-white rounded-full font-bold text-sm shadow-md shadow-red-500/20 hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete All Students'}
                </button>
                {filter !== 'All' && (
                  <button
                    onClick={handleDeleteClass}
                    disabled={isDeleting}
                    className="w-full py-3.5 bg-linear-to-r from-orange-400 to-orange-500 text-white rounded-full font-bold text-sm shadow-md shadow-orange-500/20 hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : `Delete Class Period ${filter}`}
                  </button>
                )}
                <button
                  onClick={() => setIsCleanupModalOpen(false)}
                  disabled={isDeleting}
                  className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-full font-bold text-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
