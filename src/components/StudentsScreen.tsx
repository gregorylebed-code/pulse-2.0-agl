import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Trash2, Sparkles, Loader2, X, Send, Copy, Mic, MicOff, Cake } from 'lucide-react';
import { toast } from 'sonner';
import { Note, Student, Report, CalendarEvent, StudentGoal } from '../types';
import { Abbreviation } from '../utils/expandAbbreviations';
import { summarizeNotes, ReportData, parseBirthdays } from '../lib/gemini';
import { askAboutStudents } from '../utils/aiAssistant';
import StudentDetailView from './StudentDetailView';
import { cn } from '../utils/cn';


interface StudentsScreenProps {
  students: Student[];
  notes: Note[];
  reports: Report[];
  goals: StudentGoal[];
  indicators: any[];
  commTypes: any[];
  calendarEvents: CalendarEvent[];
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
  abbreviations: Abbreviation[];
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
  teacherTitle: string;
  teacherLastName: string;
}

export default function StudentsScreen({
  students,
  notes,
  reports,
  goals,
  indicators,
  commTypes,
  calendarEvents,
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
  abbreviations,
  selectedStudentId,
  setSelectedStudentId,
  teacherTitle,
  teacherLastName,
}: StudentsScreenProps) {
  const [filter, setFilter] = useState<string>('All');
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
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


  const reportToText = (report: ReportData): string =>
    [report.opening, '\nGlow:\n' + report.glow, '\nGrow:\n' + report.grow, '\nGoal:\n' + report.goal, '\n' + report.closing].join('\n');

  const handleGenerateReport = async (length: 'Quick Pulse' | 'Standard' | 'Detailed', filteredNotes: Note[]): Promise<ReportData | undefined> => {
    if (!selectedStudent) return;
    const report = await summarizeNotes(filteredNotes, length);
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
        abbreviations={abbreviations}
        teacherTitle={teacherTitle}
        teacherLastName={teacherLastName}
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

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-bold text-slate-400">Your Roster</h2>
          <button
            onClick={() => setIsBirthdayModalOpen(true)}
            className="p-1.5 bg-pink-50 text-pink-400 rounded-lg hover:bg-pink-100 hover:text-pink-500 transition-colors"
            title="Import Birthdays"
          >
            <Cake className="w-4 h-4" />
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
          {['All', ...classes].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
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

      {/* AI Ask Box */}
      <div className="px-2">
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
      </div>

      <div className="space-y-10">
        {sections.map(section => (
          <div key={section} className="space-y-4">
            <h3 className="text-[11px] font-black text-slate-400 ml-2 flex items-center gap-3">
              <span className="w-8 h-[1px] bg-slate-200" />
              Class Period {section}
              <span className="flex-1 h-[1px] bg-slate-200" />
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2">
              {groupedStudents[section].map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  className="bg-white p-2 rounded-2xl card-shadow border border-slate-100 flex flex-col items-center justify-center gap-1.5 group cursor-pointer hover:border-sage/30 hover:-translate-y-0.5 transition-all text-center"
                >
                  {s.photo_url ? (
                    <img src={s.photo_url} alt={s.name} className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                  ) : (
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border text-base", getAvatarColor(s.name))} style={{ fontFamily: "'Boogaloo', cursive" }}>
                      {s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <h4 className="text-[10px] font-bold text-slate-900 line-clamp-2 leading-tight">{s.name}</h4>
                </div>
              ))}
            </div>
          </div>
        ))}

        {students.length === 0 && (
          <div className="text-center py-20 space-y-3 px-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-sm font-black text-slate-400">Your roster is empty.</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              Go to <span className="font-bold text-sage">Settings → Roster Management</span> to add students manually, or use <span className="font-bold text-sage">Data Management</span> to import a class list.
            </p>
          </div>
        )}
      </div>

      {/* Birthday Import Modal */}
      <AnimatePresence>
        {isBirthdayModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end justify-center p-4 pb-8"
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
                            <p className="text-[10px] text-green-500 mt-0.5">→ {resolvedName}</p>
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
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
