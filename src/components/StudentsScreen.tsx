import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Note, Student, Report, CalendarEvent } from '../types';
import { Abbreviation } from '../utils/expandAbbreviations';
import { summarizeNotes } from '../lib/gemini';
import StudentDetailView from './StudentDetailView';
import { cn } from '../utils/cn';


interface StudentsScreenProps {
  students: Student[];
  notes: Note[];
  reports: Report[];
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
  addReport: (r: Omit<Report, 'id' | 'created_at'>) => Promise<Report | null>;
  deleteReport: (id: string) => Promise<void>;
  abbreviations: Abbreviation[];
}

export default function StudentsScreen({
  students,
  notes,
  reports,
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
  abbreviations,
}: StudentsScreenProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('All');
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const studentNotes = notes.filter(n => n.student_name === selectedStudent?.name).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const studentReports = reports.filter(r => r.student_name === selectedStudent?.name).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());


  const handleGenerateReport = async (length: 'Quick Pulse' | 'Standard' | 'Detailed', filteredNotes: Note[]) => {
    if (!selectedStudent) return;
    const summary = await summarizeNotes(filteredNotes, length);
    await addReport({
      student_name: selectedStudent.name,
      user_id: 'local',
      content: summary,
      length,
    });
    return summary;
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
        abbreviations={abbreviations}
      />
    );
  }

  const filteredStudents = students.filter(s => {
    const section = typeof s.class_id === 'object' ? (s.class_id as any)?.label || (s.class_id as any)?.value : s.class_id || s.class_period;
    const matchesFilter = filter === 'All' || section === filter;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Group students by section
  const groupedStudents = filteredStudents.reduce((acc, student) => {
    const section = typeof student.class_id === 'object' ? (student.class_id as any)?.label || (student.class_id as any)?.value : student.class_id || student.class_period || 'Unassigned';
    if (!acc[section]) acc[section] = [];
    acc[section].push(student);
    return acc;
  }, {} as Record<string, Student[]>);

  const sections = Object.keys(groupedStudents).sort();

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-bold text-slate-400">Your Roster</h2>
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
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black text-xs border", getAvatarColor(s.name))}>
                    {s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <h4 className="text-[10px] font-bold text-slate-900 line-clamp-2 leading-tight">{s.name}</h4>
                </div>
              ))}
            </div>
          </div>
        ))}

        {students.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-sm text-slate-400 font-medium">No students in your roster yet.</p>
          </div>
        )}
      </div>

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
