import React, { useState, useRef } from 'react';
import { Note, Student, CalendarEvent } from '../types';
import { parseVoiceLog, categorizeNote } from '../lib/gemini';
import imageCompression from 'browser-image-compression';
import {
  Mic, Image as ImageIcon, Send, Trash2, Edit2, Copy,
  Mail, MessageSquare, User, Calendar, Eye, X, AlertCircle, Loader2, School
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PulseScreenProps {
  notes: Note[];
  students: Student[];
  indicators: any[];
  commTypes: any[];
  calendarEvents: CalendarEvent[];
  classes: string[];
  onNoteAdded: () => void;
  addNote: (note: any) => Promise<any>;
  updateNote: (id: string, updates: any) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}

function PulseScreen({ notes, students, indicators, commTypes, calendarEvents, classes, onNoteAdded, addNote, updateNote, deleteNote }: PulseScreenProps) {
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [studentInput, setStudentInput] = useState('');
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedComm, setSelectedComm] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editStudentName, setEditStudentName] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editComm, setEditComm] = useState<string[]>([]);

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
      await updateNote(editingNoteId, {
        content: editContent,
        student_id: students.find(s => s.name === editStudentName)?.id || '',
        tags: editTags,
        is_parent_communication: editComm.length > 0,
        parent_communication_type: editComm.length > 0 ? editComm.join(', ') : null,
      });
      setEditingNoteId(null);
      toast.success('Note updated successfully');
      onNoteAdded();
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

  const [noteMode, setNoteMode] = useState<'student' | 'class'>('student');
  const [selectedClass, setSelectedClass] = useState<string>('');

  const [isListening, setIsListening] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarData = localStorage.getItem('school_calendar');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const levenshtein = (a: string, b: string): number => {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }
    return matrix[a.length][b.length];
  };

  const fuzzyMatch = (input: string) => {
    const normalized = input.toLowerCase().trim();
    if (!normalized) return null;
    const exact = students.find(s => s.name.toLowerCase() === normalized);
    if (exact) return exact;
    const startsWith = students.filter(s => s.name.toLowerCase().startsWith(normalized));
    if (startsWith.length === 1) return startsWith[0];
    let bestMatch = null;
    let minDistance = 3;
    for (const s of students) {
      const dist = levenshtein(normalized, s.name.toLowerCase());
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = s;
      }
    }
    return bestMatch;
  };

  const handleStudentInputChange = (val: string) => {
    setStudentInput(val);
    if (val.trim().length > 0) {
      const filtered = students.filter(s => s.name.toLowerCase().includes(val.toLowerCase()));
      setSuggestions(filtered);
      setShowSuggestions(true);
      setSelectedStudent('');
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedStudent('');
    }
  };

  const selectStudent = (name: string) => {
    setSelectedStudent(name);
    setStudentInput(name);
    setShowSuggestions(false);
    setValidationError(null);
    noteInputRef.current?.focus();
  };

  const handleClear = () => {
    setStudentInput('');
    setSelectedStudent('');
    setNoteContent('');
    setSelectedTags([]);
    setSelectedComm([]);
    setImage(null);
    setImagePreview(null);
    setSuggestions([]);
    setShowSuggestions(false);
    // Keep noteMode and selectedClass so teacher can log multiple class notes in a row
  };

  const validateSelection = () => {
    let studentToUse = selectedStudent;
    if (!studentToUse && studentInput.trim()) {
      const match = fuzzyMatch(studentInput);
      if (match) {
        selectStudent(match.name);
        studentToUse = match.name;
      }
    }

    if (!studentToUse) {
      setValidationError('Select a student before saving.');
      setTimeout(() => setValidationError(null), 3000);
      return false;
    }
    return true;
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleComm = (comm: string) => {
    setSelectedComm(prev => prev.includes(comm) ? prev.filter(c => c !== comm) : [...prev, comm]);
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
      setIsSaving(true);
      try {
        const studentNames = students.map(s => s.name);
        const indicatorLabels = indicators.map(i => i.label);
        const result = await parseVoiceLog(transcript, studentNames, indicatorLabels);

        if (result) {
          if (result.student_name) selectStudent(result.student_name);
          if (result.content) setNoteContent(result.content);
          if (result.tags && result.tags.length > 0) {
            setNoteContent(prev => `${prev}\n\nIndicators: ${result.tags.join(', ')}`);
          }
        } else {
          setNoteContent(transcript);
        }
      } catch (err) {
        console.error("Voice parse error:", err);
        setNoteContent(transcript);
      } finally {
        setIsSaving(false);
      }
    };
    recognition.start();
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await imageCompression(file, { maxSizeMB: 0.2, maxWidthOrHeight: 1200 });
    setImage(compressed);
    setImagePreview(URL.createObjectURL(compressed));
  };

  const handleSave = async () => {
    if (!noteContent.trim() && !image) return;

    // Class note path
    if (noteMode === 'class') {
      if (!selectedClass) {
        setValidationError('Select a class before saving.');
        setTimeout(() => setValidationError(null), 3000);
        return;
      }
      setIsSaving(true);
      try {
        let finalTags = [...selectedTags];
        if (finalTags.length === 0) {
          try {
            const aiResult = await categorizeNote(noteContent, new Date().toLocaleString(), false, indicators.map(i => i.label));
            finalTags = aiResult.tags ?? [];
          } catch {
            // AI unavailable — save note without tags
          }
        }
        const today = new Date().toISOString().split('T')[0];
        const todayEvent = calendarEvents?.find(e => e.date === today);
        if (todayEvent) finalTags.push(`[${todayEvent.title}]`);

        await addNote({
          student_id: null,
          class_name: selectedClass,
          content: noteContent,
          tags: finalTags,
          is_parent_communication: false,
          parent_communication_type: null,
          image_url: null,
          is_pinned: false,
        });
        handleClear();
        toast.success(`Class note saved for ${selectedClass}`);
        onNoteAdded();
      } catch (err) {
        console.error('Error saving class note:', err);
        toast.error('Failed to save class note');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Student note path
    let studentToUse = selectedStudent;
    if (!studentToUse && studentInput.trim()) {
      const match = fuzzyMatch(studentInput);
      if (match) {
        studentToUse = match.name;
      } else {
        studentToUse = studentInput.trim();
      }
    }

    if (!studentToUse) {
      setValidationError('Select a student before saving.');
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    setIsSaving(true);
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
          const aiResult = await categorizeNote(noteContent, new Date().toLocaleString(), !!image, indicators.map(i => i.label));
          finalTags = aiResult.tags ?? [];
        } catch {
          // AI unavailable — save note without tags
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const todayEvent = calendarEvents?.find(e => e.date === today);
      if (todayEvent) finalTags.push(`[${todayEvent.title}]`);

      const student = students.find(s => s.name === studentToUse);
      await addNote({
        student_id: student?.id || '',
        content: noteContent,
        tags: finalTags,
        is_parent_communication: isParentComm,
        parent_communication_type: commType || null,
        image_url: imageUrl,
        is_pinned: false,
      });

      handleClear();
      toast.success('Entry saved successfully');
      onNoteAdded();
    } catch (err) {
      console.error('Error saving note:', err);
      toast.error('Failed to save entry');
    } finally {
      setIsSaving(false);
    }
  };

  const nextEvent = calendarEvents
    ?.filter(e => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 relative">
      <AnimatePresence>
        {nextEvent && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-sage/10 border border-sage/20 px-6 py-3 rounded-2xl flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sage/20 rounded-full flex items-center justify-center">
                <Calendar className="w-4 h-4 text-sage" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-sage/60">Next School Event</span>
                <p className="text-xs font-bold text-slate-700">{nextEvent.title} • {new Date(nextEvent.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-sage/20 rounded-lg">
                <span className="text-[10px] font-bold text-sage">{nextEvent.type}</span>
              </div>
              {calendarData && (
                <button
                  onClick={() => setShowCalendar(true)}
                  className="p-1.5 bg-white/50 hover:bg-white text-sage rounded-lg transition-colors shadow-sm"
                  title="View Original Calendar"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCalendar && calendarData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex flex-col"
          >
            <div className="flex justify-end p-4">
              <button onClick={() => setShowCalendar(false)} className="p-2 text-white/70 hover:text-white bg-white/10 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {calendarData.startsWith('data:application/pdf') ? (
                <iframe src={calendarData} className="w-full h-full rounded-2xl bg-white" />
              ) : (
                <img src={calendarData} alt="School Calendar" className="max-w-full max-h-full object-contain rounded-2xl" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-6 right-6 z-[60] bg-terracotta text-white px-6 py-4 rounded-2xl shadow-xl font-bold text-sm text-center flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-5 h-5" />
            {validationError}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-[32px] p-8 card-shadow border border-sage/5 space-y-6">
        {calendarData && (
          <div className="flex justify-end -mt-2 mb-2">
            <button
              onClick={() => setShowCalendar(true)}
              className="flex items-center gap-2 px-4 py-2 bg-sage/10 text-sage rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-sage/20 transition-colors"
            >
              <Calendar className="w-4 h-4" /> View Calendar
            </button>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
          <button
            onClick={() => setNoteMode('student')}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              noteMode === 'student'
                ? "bg-white text-sage shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            Student Note
          </button>
          <button
            onClick={() => setNoteMode('class')}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              noteMode === 'class'
                ? "bg-white text-blue-500 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            Class Note
          </button>
        </div>

        {noteMode === 'class' ? (
          <div className="space-y-3">
            <label className="text-[13px] font-black text-slate-400 ml-1">Select Class</label>
            <div className="flex gap-2 flex-wrap">
              {classes.map(cls => (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={cn(
                    "px-6 py-3 rounded-2xl text-sm font-black border-2 transition-all",
                    selectedClass === cls
                      ? "bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"
                  )}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 relative max-w-2xl">
              <label className="text-[13px] font-black text-slate-400 ml-1">Select Student</label>
              <div className="relative">
                <input
                  type="text"
                  value={studentInput}
                  onChange={(e) => handleStudentInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      validateSelection();
                    }
                  }}
                  placeholder="Start typing a name..."
                  className={cn(
                    "w-full px-6 py-4 bg-slate-50 border rounded-2xl focus:outline-none transition-all text-base pr-12 font-medium",
                    selectedStudent ? "border-sage ring-4 ring-sage/5" : "border-slate-100 focus:ring-4 focus:ring-sage/5 focus:border-sage"
                  )}
                />
                {(studentInput || noteContent) && (
                  <button
                    onClick={handleClear}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-terracotta transition-colors"
                    title="Clear all fields"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden"
                    >
                      {suggestions.map(s => (
                        <button
                          key={s.id}
                          onClick={() => selectStudent(s.name)}
                          className="w-full text-left px-6 py-4 hover:bg-sage/5 transition-colors text-base font-bold border-b border-slate-50 last:border-0"
                        >
                          {s.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <AnimatePresence>
              {selectedStudent && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-sage/10 border border-sage/20 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <div className="w-2 h-2 bg-sage rounded-full animate-pulse" />
                    <span className="text-[13px] font-bold text-sage-dark">Selected: <span className="text-slate-900">{selectedStudent}</span></span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        <div className="relative max-w-2xl">
          <textarea
            ref={noteInputRef}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder={noteMode === 'class' ? "Type or record a note about the class..." : "Type or record a note about the student..."}
            className="w-full min-h-[100px] p-8 py-5 duration-300 bg-white border border-slate-100 rounded-[32px] focus:outline-none focus:ring-4 focus:ring-sage/5 focus:border-sage transition-all text-base shadow-inner resize-none leading-relaxed font-medium"
          />
          <div className="absolute right-4 bottom-4 flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-sm border border-slate-100 hover:text-sage transition-all">
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleVoiceLog}
              className={cn(
                "p-2.5 rounded-xl shadow-sm border border-slate-100 transition-all",
                isListening ? "bg-terracotta text-white animate-pulse" : "bg-white text-slate-400 hover:text-terracotta"
              )}
            >
              <Mic className="w-4 h-4" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 max-w-2xl w-full">
          <button
            onClick={handleClear}
            className="flex-1 py-1.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || (noteMode === 'class' ? !selectedClass : (!selectedStudent && !studentInput.trim()))}
            className="flex-[2] py-1.5 bg-linear-to-r from-orange-400 to-orange-500 text-white rounded-full font-black text-xl hover:brightness-110 transition-all shadow-lg shadow-orange-200/50 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Save Entry</>}
          </button>
        </div>

        {imagePreview && (
          <div className="relative w-24 h-24">
            <img src={imagePreview} className="w-full h-full object-cover rounded-2xl border-2 border-white shadow-md" />
            <button onClick={() => { setImage(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-terracotta text-white p-1 rounded-full shadow-lg"><X className="w-3 h-3" /></button>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-[13px] font-black text-slate-400 ml-1">Positive Indicators</h3>
          <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar -mx-2 px-2">
            {indicators.filter(b => b.type === 'positive').map(b => (
              <button
                key={b.label}
                onClick={() => toggleTag(b.label)}
                className={cn(
                  "flex-shrink-0 px-2.5 py-1 border-[3px] rounded-full text-base font-black flex items-center gap-3 transition-all pop-feedback shadow-sm",
                  selectedTags.includes(b.label)
                    ? "bg-neon-green/10 border-neon-green text-neon-green shadow-md"
                    : "bg-white border-neon-green text-neon-green hover:bg-neon-green/5"
                )}
              >
                <span>{b.icon}</span> {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[13px] font-black text-slate-400 ml-1">Neutral Indicators</h3>
          <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar -mx-2 px-2">
            {indicators.filter(b => b.type === 'neutral').map(b => (
              <button
                key={b.label}
                onClick={() => toggleTag(b.label)}
                className={cn(
                  "flex-shrink-0 px-2.5 py-1 border-[3px] rounded-full text-base font-black flex items-center gap-3 transition-all pop-feedback shadow-sm",
                  selectedTags.includes(b.label)
                    ? "bg-neon-yellow/10 border-neon-yellow text-neon-yellow shadow-md"
                    : "bg-white border-neon-yellow text-neon-yellow hover:bg-neon-yellow/5"
                )}
              >
                <span>{b.icon}</span> {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[13px] font-black text-slate-400 ml-1">Areas for Growth</h3>
          <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar -mx-2 px-2">
            {indicators.filter(b => b.type === 'growth').map(b => (
              <button
                key={b.label}
                onClick={() => toggleTag(b.label)}
                className={cn(
                  "flex-shrink-0 px-2.5 py-1 border-[3px] rounded-full text-base font-black flex items-center gap-3 transition-all pop-feedback shadow-sm",
                  selectedTags.includes(b.label)
                    ? "bg-neon-red/10 border-neon-red text-neon-red shadow-md"
                    : "bg-white border-neon-red text-neon-red hover:bg-neon-red/5"
                )}
              >
                <span>{b.icon}</span> {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[13px] font-black text-slate-400 ml-1">Family Communication</h3>
          <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar -mx-2 px-2">
            {commTypes.map(b => (
              <button
                key={b.label}
                onClick={() => toggleComm(b.label)}
                className={cn(
                  "flex-shrink-0 px-2.5 py-1 border-[3px] rounded-full text-base font-black flex items-center gap-3 transition-all pop-feedback shadow-sm",
                  selectedComm.includes(b.label)
                    ? "bg-neon-cyan/10 border-neon-cyan text-neon-cyan shadow-md"
                    : "bg-white border-neon-cyan text-neon-cyan hover:bg-neon-cyan/5"
                )}
              >
                <span>{b.icon}</span> {b.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || (noteMode === 'class' ? !selectedClass : (!selectedStudent && !studentInput.trim()))}
          className="w-full py-1.5 bg-linear-to-r from-orange-400 to-orange-500 text-white rounded-full font-black text-xl tracking-tight hover:brightness-110 transition-all shadow-xl shadow-orange-200 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Finalize & Save</>}
        </button>
      </div>

      <div className="space-y-4 pb-20">
        <h2 className="text-[13px] font-black text-slate-400 ml-1">Recent Activity</h2>
        {notes.slice(0, 5).map(note => (
          <div key={note.id} className={cn(
            "bg-white p-6 rounded-[32px] card-shadow border flex items-start gap-4",
            note.class_name ? "border-blue-100" : "border-slate-100"
          )}>
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              note.class_name ? "bg-blue-500/10" : "bg-sage/10"
            )}>
              {note.class_name
                ? <School className="text-blue-500 w-5 h-5" />
                : <User className="text-sage w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                {note.class_name ? (
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-slate-900 text-base">{note.class_name}</h4>
                    <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">Class Note</span>
                  </div>
                ) : (
                  <h4 className="font-black text-slate-900 text-base truncate">{note.student_name}</h4>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-300 tracking-tight">{new Date(note.created_at).toLocaleDateString()}</span>
                  <button
                    onClick={() => startEditing(note)}
                    className="p-1 text-slate-300 hover:text-sage transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this note? This cannot be undone.')) {
                        deleteNote(note.id);
                      }
                    }}
                    className="p-1 text-slate-300 hover:text-terracotta transition-all"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {editingNoteId === note.id ? (
                <div className="space-y-4 pt-2">
                  <div className="relative">
                    <input
                      type="text"
                      list="edit-student-names"
                      value={editStudentName}
                      onChange={(e) => setEditStudentName(e.target.value)}
                      placeholder="Student Name"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage"
                    />
                    <datalist id="edit-student-names">
                      {students.map(s => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage min-h-[100px]"
                  />
                  <div className="flex flex-wrap gap-2">
                    {indicators.map(ind => (
                      <button
                        key={ind.label}
                        onClick={() => toggleEditTag(ind.label)}
                        className={cn(
                          "px-2 py-1 rounded-xl text-base font-black transition-all border",
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
                    {commTypes.map(comm => (
                      <button
                        key={comm.label}
                        onClick={() => toggleEditComm(comm.label)}
                        className={cn(
                          "px-2 py-1 rounded-xl text-base font-black transition-all border",
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
                      onClick={handleSaveEdit}
                      disabled={isUpdating}
                      className="flex-1 py-3 bg-sage text-white rounded-xl font-bold text-xs hover:bg-sage-dark transition-all flex items-center justify-center gap-2"
                    >
                      {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingNoteId(null)}
                      className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{note.content}</p>
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {note.tags.map(t => {
                      const indicator = indicators.find(i => i.label === t);
                      const isComm = note.is_parent_communication && note.parent_communication_type?.includes(t);

                      let colorClass = "bg-slate-50 text-slate-400 border-slate-100";
                      if (indicator?.type === 'positive') colorClass = "bg-sage/10 text-sage border-sage/20";
                      if (indicator?.type === 'growth') colorClass = "bg-terracotta/10 text-terracotta border-terracotta/20";
                      if (indicator?.type === 'neutral') colorClass = "bg-amber-100 text-amber-600 border-amber-200";
                      if (isComm) colorClass = "bg-blue-50 text-blue-500 border-blue-100";

                      return (
                        <span key={t} className={cn("px-2.5 py-1 rounded-md text-[10px] font-black border", colorClass)}>
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
      </div>
    </motion.div>
  );
}

export default PulseScreen;