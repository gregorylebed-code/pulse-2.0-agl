import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { createPortal } from 'react-dom';
import { Note, Student, CalendarEvent } from '../types';
import { parseVoiceLog, categorizeNote, cleanNoteContent } from '../lib/gemini';
import { expandAbbreviations, Abbreviation } from '../utils/expandAbbreviations';
import imageCompression from 'browser-image-compression';
import {
  Mic, MicOff, Image as ImageIcon, Send, Trash2, Edit2, Copy,
  Mail, MessageSquare, User, Calendar, Eye, X, AlertCircle, Loader2, School, Cake, ChevronDown, Smile, Frown, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { useAliasMode } from '../context/AliasModeContext';
import { getDisplayName, getDisplayFirst } from '../utils/getDisplayName';
import { isFullMode } from '../lib/mode';


interface PulseScreenProps {
  notes: Note[];
  students: Student[];
  indicators: any[];
  commTypes: any[];
  calendarEvents: CalendarEvent[];
  classes: string[];
  onNoteAdded: () => void;
  addNote: (note: any, createdAt?: string) => Promise<any>;
  updateNote: (id: string, updates: any) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  abbreviations: Abbreviation[];
  resetKey?: number;
  onStudentClick?: (studentId: string) => void;
  onboardingComplete?: boolean;
  onGoToSettings?: () => void;
  onSwitchToRealClass?: () => void;
}

// ─── Today at a Glance ───────────────────────────────────────────────────────

function TodayAtAGlance({ notes, indicators }: { notes: Note[]; indicators: any[] }) {
  const indicatorTypeMap = React.useMemo(() => {
    const map: Record<string, 'positive' | 'neutral' | 'growth'> = {};
    indicators.forEach((ind: any) => { if (ind.label) map[ind.label] = ind.type; });
    return map;
  }, [indicators]);

  const todayStats = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayNotes = notes.filter(n => new Date(n.created_at) >= startOfToday);
    if (todayNotes.length === 0) return null;

    let positive = 0, growth = 0, neutral = 0;
    todayNotes.forEach(n => {
      const types = (n.tags || []).map((t: string) => indicatorTypeMap[t] || 'neutral');
      if (types.includes('growth')) growth++;
      else if (types.includes('positive')) positive++;
      else neutral++;
    });
    const students = new Set(todayNotes.map(n => n.student_name).filter(Boolean)).size;
    return { total: todayNotes.length, positive, neutral, growth, students };
  }, [notes, indicatorTypeMap]);

  if (!todayStats) return null;

  const { total, positive, neutral, growth, students } = todayStats;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[24px] border border-slate-100 shadow-sm px-5 py-4"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Today at a glance</p>
        <div className="flex items-center gap-3 text-[11px] font-bold">
          <span className="text-slate-400">{total} note{total !== 1 ? 's' : ''}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-400">{students} student{students !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {/* Segmented bar */}
      <div className="flex h-5 rounded-full overflow-hidden bg-slate-100 gap-px mb-2">
        {positive > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(positive / total) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="bg-sage h-full"
          />
        )}
        {neutral > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(neutral / total) * 100}%` }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            className="bg-slate-300 h-full"
          />
        )}
        {growth > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(growth / total) * 100}%` }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="bg-terracotta h-full"
          />
        )}
      </div>
      <div className="flex items-center gap-4">
        {positive > 0 && <span className="flex items-center gap-1 text-[11px] font-bold text-sage"><span className="w-2 h-2 rounded-full bg-sage inline-block" />{positive} positive</span>}
        {neutral > 0 && <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />{neutral} neutral</span>}
        {growth > 0 && <span className="flex items-center gap-1 text-[11px] font-bold text-terracotta"><span className="w-2 h-2 rounded-full bg-terracotta inline-block" />{growth} growth area</span>}
      </div>
    </motion.div>
  );
}

// ─── Sparkle Canvas ──────────────────────────────────────────────────────────

function SparkleCanvas({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Fallback to bottom-center if origin is (0,0)
    const ox = x || window.innerWidth / 2;
    const oy = y || window.innerHeight * 0.8;

    const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fbbf24', '#fff', '#ea580c'];
    const particles = Array.from({ length: 36 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 12;
      return {
        x: ox, y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        size: 5 + Math.random() * 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.4,
      };
    });

    let frame: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.alpha -= 0.022;
        p.rotation += p.rotSpeed;
        if (p.alpha <= 0) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      if (alive) {
        frame = requestAnimationFrame(animate);
      } else {
        onDone();
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function PulseScreen({ notes, students, indicators, commTypes, calendarEvents, classes, onNoteAdded, addNote, updateNote, deleteNote, abbreviations, resetKey, onStudentClick, onboardingComplete, onGoToSettings, onSwitchToRealClass }: PulseScreenProps) {
  const { aliasMode } = useAliasMode();
  const [onboardingBannerDismissed, setOnboardingBannerDismissed] = useState(() =>
    localStorage.getItem('cp_onboarding_banner_dismissed') === 'true'
  );
  const showOnboardingBanner = !onboardingBannerDismissed && students.length > 0 && notes.length < 3;

  const dismissOnboardingBanner = () => {
    localStorage.setItem('cp_onboarding_banner_dismissed', 'true');
    setOnboardingBannerDismissed(true);
  };

  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [studentInput, setStudentInput] = useState('');
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedConfirm, setSavedConfirm] = useState<{ studentName: string; content: string; tags: string[] } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<'positive' | 'neutral' | 'growth' | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [latestNoteId, setLatestNoteId] = useState<string | null>(null);
  const [visibleNoteCount, setVisibleNoteCount] = useState(5);
  const placeholders = useMemo(() => [
    "Add a note... (optional — indicators alone work fine)",
    "E.g. 'hw = missing' (Your abbreviations will auto-expand!)",
    "Try the mic: 'Alice did a great job helping clean up today.'",
    "Tip: Capture a photo of a student's work to attach it to a note.",
    "Try 'attendance: present' to log attendance via voice."
  ], []);
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [placeholders.length]);

  // Streak: count consecutive school days (Mon–Fri) going back from today with at least one note
  const streak = useMemo(() => {
    const loggedDates = new Set(notes.map(n => n.created_at.slice(0, 10)));
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 30; i++) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) { // skip weekends
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (loggedDates.has(key)) count++;
        else if (i > 0) break; // gap — streak ends (allow today to be incomplete)
      }
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [notes]);

  const quickTags = useMemo(() => {
    const counts: Record<string, number> = {};
    // If a student is selected, show their top tags; otherwise show global top tags
    const sourceNotes = selectedStudent
      ? notes.filter(n => n.student_name === selectedStudent)
      : notes.filter(n => n.student_id).slice(0, 80);
    sourceNotes.forEach(n => {
      n.tags?.forEach(t => {
        // Skip calendar event tags and ParentSquare/Email/etc
        if (!t.startsWith('[') && !['ParentSquare', 'Email', 'Phone', 'Meeting'].includes(t)) {
          counts[t] = (counts[t] || 0) + 1;
        }
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(entry => entry[0]);
  }, [notes, selectedStudent]);

  const filteredNotes = useMemo(
    () => notes.filter(n => !pendingDeleteNoteIds.has(n.id)),
    [notes, pendingDeleteNoteIds]
  );

  const studentByName = useMemo(() => {
    const map: Record<string, Student> = {};
    students.forEach(s => { map[s.name] = s; });
    return map;
  }, [students]);

  const selectedStudentObj = studentByName[selectedStudent] ?? null;

  const indicatorCategories = useMemo(() => [
    { key: 'positive' as const, label: 'Positive', color: 'emerald', items: indicators.filter(b => b.type === 'positive') },
    { key: 'neutral' as const, label: 'Neutral', color: 'amber', items: indicators.filter(b => b.type === 'neutral') },
    { key: 'growth' as const, label: 'Growth Areas', color: 'rose', items: indicators.filter(b => b.type === 'growth') },
  ], [indicators]);

  const [editContent, setEditContent] = useState('');
  const [editStudentName, setEditStudentName] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  // Flash the newest note green when it arrives
  const prevTopNoteId = useRef<string | null>(null);
  useEffect(() => {
    const top = notes[0]?.id ?? null;
    if (top && top !== prevTopNoteId.current) {
      setLatestNoteId(top);
      const t = setTimeout(() => setLatestNoteId(null), 1500);
      prevTopNoteId.current = top;
      return () => clearTimeout(t);
    }
  }, [notes]);

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditStudentName(note.student_name);
    setEditTags(note.tags);
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId) return;
    setIsUpdating(true);
    try {
      const expandedEditContent = expandAbbreviations(editContent, abbreviations);
      await updateNote(editingNoteId, {
        content: expandedEditContent,
        student_id: students.find(s => s.name === editStudentName)?.id || '',
        tags: editTags,
        is_parent_communication: false,
        parent_communication_type: null,
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


  const [noteMode, setNoteMode] = useState<'student' | 'class'>('student');
  useEffect(() => { if (resetKey) setNoteMode('student'); }, [resetKey]);
  const [selectedClass, setSelectedClass] = useState<string>('');

  const handleVoiceResult = useCallback(async (transcript: string) => {
    setIsSaving(true);
    try {
      const studentNames = students.map(s => s.name);
      const indicatorLabels = indicators.map(i => i.label);
      const result = await parseVoiceLog(transcript, studentNames, indicatorLabels);

      if (result) {
        if (result.student_name) {
          const aiName = result.student_name.toLowerCase();
          const fullMatch = students.find(s =>
            s.name.toLowerCase() === aiName ||
            s.name.toLowerCase().startsWith(aiName + ' ')
          );
          selectStudent(fullMatch ? fullMatch.name : result.student_name);
        }
        if (result.content) setNoteContent(result.content);
        if (result.tags && result.tags.length > 0) {
          const matchedTags = result.tags.filter((t: string) =>
            indicatorLabels.some(l => l.toLowerCase() === t.toLowerCase())
          );
          if (matchedTags.length > 0) setSelectedTags(matchedTags);
        }
      } else {
        setNoteContent(transcript);
      }
    } catch (err) {
      console.error('Voice parse error:', err);
      setNoteContent(transcript);
    } finally {
      setIsSaving(false);
    }
  }, [students, indicators]);

  const { isListening, toggleListening } = useVoiceRecognition(handleVoiceResult);

  const [undoToast, setUndoToast] = useState<{ label: string; onUndo: () => void } | null>(null);
  // Map of noteId → timer, so multiple pending deletes each have their own countdown
  const pendingDeleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [pendingDeleteNoteIds, setPendingDeleteNoteIds] = useState<Set<string>>(new Set());

  // On unmount, immediately flush any pending deletes so navigating away doesn't rescue notes
  useEffect(() => {
    return () => {
      pendingDeleteTimers.current.forEach((timer, id) => {
        clearTimeout(timer);
        deleteNote(id);
      });
      pendingDeleteTimers.current.clear();
    };
  }, []);

  const softDeleteNote = (note: any) => {
    setPendingDeleteNoteIds(prev => new Set(prev).add(note.id));
    // Each note gets its own timer — deleting a second note won't cancel the first
    const timer = setTimeout(() => {
      deleteNote(note.id);
      pendingDeleteTimers.current.delete(note.id);
      setPendingDeleteNoteIds(prev => { const s = new Set(prev); s.delete(note.id); return s; });
      setUndoToast(null);
    }, 5000);
    pendingDeleteTimers.current.set(note.id, timer);
    setUndoToast({ label: 'Note deleted', onUndo: () => {
      clearTimeout(timer);
      pendingDeleteTimers.current.delete(note.id);
      setPendingDeleteNoteIds(prev => { const s = new Set(prev); s.delete(note.id); return s; });
      setUndoToast(null);
    }});
  };
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const todayStr = new Date().toISOString().split('T')[0];
  const [noteDate, setNoteDate] = useState(todayStr);
  const noteDateInputRef = useRef<HTMLInputElement>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const calendarData = localStorage.getItem('school_calendar');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [showSparkles, setShowSparkles] = useState(false);
  const sparkleOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
  };

  const handleClear = () => {
    setStudentInput('');
    setSelectedStudent('');
    setNoteContent('');
    setSelectedTags([]);

    setImage(null);
    setImagePreview(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setNoteDate(new Date().toISOString().split('T')[0]);
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

  const handleVoiceLog = () => {
    toggleListening();
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await imageCompression(file, { maxSizeMB: 0.2, maxWidthOrHeight: 1200 });
    setImage(compressed);
    setImagePreview(URL.createObjectURL(compressed));
  };

  const handleSave = async () => {
    if (!noteContent.trim() && !image && selectedTags.length === 0) return;

    // Class note path
    if (noteMode === 'class') {
      if (!selectedClass) {
        setValidationError('Select a class before saving.');
        setTimeout(() => setValidationError(null), 3000);
        return;
      }
      setIsSaving(true);
      try {
        const expandedContent = expandAbbreviations(noteContent, abbreviations);
        let finalTags = [...selectedTags];
        let cleanedContent = expandedContent;
        if (expandedContent.trim()) {
          try {
            const [aiResult, cleaned] = await Promise.all([
              finalTags.length === 0 ? categorizeNote(expandedContent, new Date().toLocaleString(), false, indicators.map(i => i.label)) : Promise.resolve({ tags: finalTags }),
              cleanNoteContent(expandedContent),
            ]);
            if (finalTags.length === 0) finalTags = aiResult.tags ?? [];
            cleanedContent = cleaned;
          } catch {
            // AI unavailable — save note without tags
          }
        }
        const noteDateEvent = calendarEvents?.find(e => e.date === noteDate);
        if (noteDateEvent) finalTags.push(`[${noteDateEvent.title}]`);

        const noteCreatedAt = noteDate !== todayStr ? `${noteDate}T12:00:00.000Z` : undefined;
        await addNote({
          student_id: null,
          class_name: selectedClass,
          content: cleanedContent,
          tags: finalTags,
          is_parent_communication: false,
          parent_communication_type: null,
          image_url: null,
          is_pinned: false,
        }, noteCreatedAt);
        if (!navigator.onLine) {
          toast(`Class note saved offline — will sync when reconnected`, { icon: '📶' });
        } else {
          setSavedConfirm({ studentName: selectedClass, content: expandedContent, tags: finalTags });
          if (saveButtonRef.current) {
            const r = saveButtonRef.current.getBoundingClientRect();
            sparkleOrigin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
          setShowSparkles(true);
          setTimeout(() => setSavedConfirm(null), 1800);
        }
        handleClear();
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

    // No student selected — try to find a name mentioned in the note text
    if (!studentToUse && noteContent.trim()) {
      const words = noteContent.toLowerCase().split(/\s+/);
      const nameMatch = students.find(s => {
        const first = s.name.split(' ')[0].toLowerCase();
        return words.includes(first);
      });
      if (nameMatch) studentToUse = nameMatch.name;
    }

    if (!studentToUse) {
      setValidationError('Select a student before saving.');
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    setIsSaving(true);
    try {
      const expandedContent = expandAbbreviations(noteContent, abbreviations);
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
      let cleanedContent = expandedContent;
      if (expandedContent.trim()) {
        try {
          const [aiResult, cleaned] = await Promise.all([
            finalTags.length === 0 ? categorizeNote(expandedContent, new Date().toLocaleString(), !!image, indicators.map(i => i.label)) : Promise.resolve({ tags: finalTags }),
            cleanNoteContent(expandedContent),
          ]);
          if (finalTags.length === 0) finalTags = aiResult.tags ?? [];
          cleanedContent = cleaned;
        } catch {
          // AI unavailable — save note without cleaning
        }
      }

      const noteDateEvent = calendarEvents?.find(e => e.date === noteDate);
      if (noteDateEvent) finalTags.push(`[${noteDateEvent.title}]`);

      const noteCreatedAt = noteDate !== todayStr ? `${noteDate}T12:00:00.000Z` : undefined;
      const student = students.find(s => s.name === studentToUse);
      await addNote({
        student_id: student?.id ?? null,
        content: cleanedContent,
        tags: finalTags,
        is_parent_communication: false,
        parent_communication_type: null,
        image_url: imageUrl,
        is_pinned: false,
      }, noteCreatedAt);

      if (!navigator.onLine) {
        toast('Note saved offline — will sync when reconnected', { icon: '📶' });
      } else {
        setSavedConfirm({ studentName: studentToUse, content: cleanedContent, tags: finalTags });
        if (saveButtonRef.current) {
          const r = saveButtonRef.current.getBoundingClientRect();
          sparkleOrigin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
        setShowSparkles(true);
        setTimeout(() => setSavedConfirm(null), 1800);
      }
      handleClear();
      onNoteAdded();
    } catch (err) {
      console.error('Error saving note:', err);
      toast.error('Failed to save entry');
    } finally {
      setIsSaving(false);
    }
  };

  // Parse "YYYY-MM-DD" as local midnight (not UTC) to avoid timezone off-by-one
  const parseLocalDate = useCallback((d: string) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); }, []);

  const { upcomingEvents, nextEvent, upcomingBirthdays } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const eventCutoff = now.getHours() >= 16 ? tomorrowStart : todayStart;

    const upcoming = (calendarEvents ?? [])
      .filter(e => parseLocalDate(e.date) >= eventCutoff)
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime())
      .slice(0, 10);

    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();
    const tomorrowMonth = tomorrowStart.getMonth() + 1;
    const tomorrowDay = tomorrowStart.getDate();
    const todayBirthdays = students.filter(s => s.birth_month === todayMonth && s.birth_day === todayDay);
    const tomorrowBirthdays = students.filter(s => s.birth_month === tomorrowMonth && s.birth_day === tomorrowDay);
    const birthdays = [
      ...todayBirthdays.map(s => ({ student: s, when: 'today' as const })),
      ...tomorrowBirthdays.map(s => ({ student: s, when: 'tomorrow' as const })),
    ];

    return { upcomingEvents: upcoming, nextEvent: upcoming[0], upcomingBirthdays: birthdays };
  }, [calendarEvents, students, parseLocalDate]);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 relative">

      {/* ONBOARDING BANNER */}
      {showOnboardingBanner && (
        <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3 flex items-start gap-3 relative shadow-sm">
          <span className="text-lg leading-none mt-0.5">👋</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-blue-700">Welcome to ShortHand!</p>
            <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-relaxed">
              Tap a student's name below to log your first note. The <span className="font-black">Help</span> button on the left has tips if you get stuck.
            </p>
            {onSwitchToRealClass && (
              <button
                onClick={onSwitchToRealClass}
                className="text-[11px] font-black text-violet-500 hover:text-violet-700 transition-colors mt-1.5"
              >
                Using fake students? Switch to your real class →
              </button>
            )}
            <button onClick={dismissOnboardingBanner} className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors mt-2 font-medium">
              Don't show this again
            </button>
          </div>
          <button onClick={dismissOnboardingBanner} className="absolute top-2 right-2 text-slate-300 hover:text-slate-500 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* NOTE SAVED CONFIRMATION OVERLAY — rendered via portal to escape transform stacking context */}
      {createPortal(
        <AnimatePresence>
          {savedConfirm && (
            <motion.div
              initial={{ y: 120, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 120, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              style={{ position: 'fixed', bottom: '96px', left: '16px', right: '16px', zIndex: 9999, pointerEvents: 'none' }}
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-green-300/40"
                style={{ background: 'linear-gradient(135deg, #052e16 0%, #14532d 100%)' }}>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.8, ease: 'linear' }}
                  style={{ transformOrigin: 'left', height: '4px', background: '#4ade80', width: '100%' }}
                />
                <div className="px-5 py-4 flex items-start gap-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.1 }}
                    style={{ width: 44, height: 44, borderRadius: '50%', background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#052e16" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </motion.div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#86efac', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Note Saved</div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{savedConfirm.studentName}</div>
                    {savedConfirm.content && (
                      <div style={{ color: 'rgba(220,252,231,0.7)', fontSize: '0.75rem', marginTop: 4, lineHeight: 1.5 }}>
                        &ldquo;{savedConfirm.content}&rdquo;
                      </div>
                    )}
                    {savedConfirm.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {savedConfirm.tags.slice(0, 3).map(tag => (
                          <span key={tag} style={{ padding: '2px 10px', borderRadius: 999, background: 'rgba(74,222,128,0.15)', color: '#86efac', fontSize: '0.65rem', fontWeight: 700, border: '1px solid rgba(74,222,128,0.3)' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* SPARKLES */}
      {showSparkles && createPortal(
        <SparkleCanvas
          x={sparkleOrigin.current.x}
          y={sparkleOrigin.current.y}
          onDone={() => setShowSparkles(false)}
        />,
        document.body
      )}

      {/* Getting Started Banner — shown until onboarding is complete */}
      <AnimatePresence>
        {onboardingComplete === false && students.length === 0 && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={onGoToSettings}
            className="w-full flex items-center gap-3 px-5 py-4 bg-blue-50 border border-blue-200 rounded-[24px] text-left hover:bg-blue-100 transition-all shadow-sm"
          >
            <div className="w-9 h-9 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">✨</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-blue-700">New here? Start the setup guide →</p>
              <p className="text-[11px] text-blue-500 font-medium mt-0.5">Takes 2 minutes · tap to open Getting Started in Settings</p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFullMode && nextEvent && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-sage/10 border border-sage/20 rounded-2xl overflow-hidden"
          >
            {/* Header row — tappable */}
            <button
              onClick={() => setEventsExpanded(v => !v)}
              className="w-full px-6 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-sage/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-sage" />
                </div>
                <div className="text-left">
                  <span className="text-[11px] font-bold text-sage/60">Next School Event</span>
                  <p className="text-xs font-bold text-slate-700">{nextEvent.title} • {parseLocalDate(nextEvent.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 bg-sage/20 rounded-lg">
                  <span className="text-[11px] font-bold text-sage">{nextEvent.type}</span>
                </div>
                {calendarData && (
                  <button
                    onClick={e => { e.stopPropagation(); setShowCalendar(true); }}
                    className="p-1.5 bg-white/50 hover:bg-white text-sage rounded-lg transition-colors shadow-sm"
                    title="View Original Calendar"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <ChevronDown className={cn('w-4 h-4 text-sage transition-transform duration-200', eventsExpanded && 'rotate-180')} />
              </div>
            </button>

            {/* Expanded event list */}
            <AnimatePresence>
              {eventsExpanded && upcomingEvents.length > 1 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-sage/20 px-4 py-2 space-y-1">
                    {upcomingEvents.slice(1).map(event => (
                      <div key={event.id} className="flex items-center justify-between py-1.5 px-2">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{event.title}</p>
                          <p className="text-[11px] text-sage/70">{parseLocalDate(event.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wide bg-sage/20 text-sage px-2 py-0.5 rounded-md">{event.type}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFullMode && upcomingBirthdays.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-pink-50 border border-pink-100 px-6 py-3 rounded-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Cake className="w-4 h-4 text-pink-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold text-pink-300">Upcoming Birthdays</span>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {upcomingBirthdays.map(({ student, when }) => (
                    <p key={student.id} className="text-xs font-bold text-slate-700">
                      {getDisplayName(student, aliasMode)} <span className="text-pink-400 font-medium">({when})</span>
                    </p>
                  ))}
                </div>
              </div>
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
              className="flex items-center gap-2 px-4 py-2 bg-sage/10 text-sage rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-sage/20 transition-colors"
            >
              <Calendar className="w-4 h-4" /> View Calendar
            </button>
          </div>
        )}

        {/* Mode toggle — pill style so both options are discoverable */}
        {isFullMode ? (
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl self-start">
            <button
              onClick={() => setNoteMode('student')}
              className={cn(
                "px-4 py-1.5 rounded-xl text-[12px] font-black transition-all",
                noteMode === 'student' ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Student Note
            </button>
            <button
              onClick={() => setNoteMode('class')}
              className={cn(
                "px-4 py-1.5 rounded-xl text-[12px] font-black transition-all",
                noteMode === 'class' ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Class Note
            </button>
          </div>
        ) : (
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Write a note about a student</span>
        )}

        {noteMode === 'class' ? (
          <div className="space-y-3">
            <label className="text-[15px] font-black text-slate-400 ml-1">Select Class</label>
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
              <label className="text-[15px] font-black text-blue-600 ml-1">Select Student <span className="text-slate-400 font-medium normal-case text-[13px]">(optional)</span></label>
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
                          className="w-full text-left px-6 py-4 hover:bg-sage/5 transition-colors text-base font-bold border-b border-slate-50 last:border-0 flex items-center gap-3"
                        >
                          {s.photo_url ? (
                            <img src={s.photo_url} alt={s.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 text-[11px] font-black text-sage-dark">
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {getDisplayName(s, aliasMode)}
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
                    {selectedStudentObj?.photo_url ? (
                      <img src={selectedStudentObj.photo_url} alt={selectedStudentObj.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-2 h-2 bg-sage rounded-full animate-pulse" />
                    )}
                    <span className="text-[13px] font-bold text-sage-dark">Selected: <span className="text-slate-900">{selectedStudentObj ? getDisplayName(selectedStudentObj, aliasMode) : selectedStudent}</span></span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* ── Quick Tags ───────────────────────────────────────────────────────── */}
        {quickTags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="w-full text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Frequently Used</span>
            {quickTags.map(tag => {
              const isSelected = selectedTags.includes(tag);
              const indicator = indicators.find(i => i.label === tag);
              const type = indicator?.type || 'neutral';
              const colors = {
                positive: isSelected ? 'bg-sage border-sage text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-sage/40',
                growth: isSelected ? 'bg-terracotta border-terracotta text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-terracotta/40',
                neutral: isSelected ? 'bg-slate-500 border-slate-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              };
              
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all flex items-center gap-1.5",
                    colors[type]
                  )}
                >
                  {type === 'positive' && <Smile className="w-3 h-3" />}
                  {type === 'growth' && <Frown className="w-3 h-3" />}
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Indicators — accordion by category ── */}
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-400 font-medium px-1">Tap a behavior label to tag this note — the AI uses these to write parent reports</p>
          {indicatorCategories.map(cat => {
            const selectedCount = cat.items.filter(b => selectedTags.includes(b.label)).length;
            const isOpen = expandedCategory === cat.key;
            const headerColors: Record<string, string> = {
              emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
              amber: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100',
              rose: 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100',
              sky: 'text-sky-600 bg-sky-50 border-sky-200 hover:bg-sky-100',
            };
            const badgeColors: Record<string, string> = {
              emerald: 'bg-emerald-500 text-white',
              amber: 'bg-amber-400 text-white',
              rose: 'bg-rose-500 text-white',
              sky: 'bg-sky-500 text-white',
            };
            const activeItemColors: Record<string, string> = {
              emerald: 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200',
              amber: 'bg-amber-400 border-amber-400 text-white shadow-lg shadow-amber-200',
              rose: 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-200',
              sky: 'bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-200',
            };
            const inactiveItemColors: Record<string, string> = {
              emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
              amber: 'bg-amber-50 border-amber-200 text-amber-700',
              rose: 'bg-rose-50 border-rose-200 text-rose-700',
              sky: 'bg-sky-50 border-sky-200 text-sky-700',
            };
            return (
              <div key={cat.key}>
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isOpen ? null : cat.key)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 font-black text-sm transition-all",
                    headerColors[cat.color]
                  )}
                >
                  <span className="flex flex-col items-start">
                    <span className="uppercase tracking-widest text-[11px] font-black">{cat.label}</span>
                    {!isOpen && <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">tap to expand</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedCount > 0 && (
                      <span className={cn("text-[11px] font-black px-2 py-0.5 rounded-full", badgeColors[cat.color])}>
                        {selectedCount}
                      </span>
                    )}
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
                  </div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-1.5 pt-3 pb-1 px-1">
                        {cat.items.map((b: any) => {
                          const isSelected = selectedTags.includes(b.label);
                          return (
                            <motion.button
                              key={b.label}
                              onClick={() => toggleTag(b.label)}
                              whileTap={{ scale: 0.88 }}
                              animate={isSelected ? { scale: [1, 1.15, 0.95, 1] } : { scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                              className={cn(
                                "px-3 py-2 rounded-xl text-[12px] font-bold flex items-center gap-1 transition-colors border-2",
                                isSelected ? activeItemColors[cat.color] : inactiveItemColors[cat.color]
                              )}
                            >
                              <span className="text-sm leading-none">{b.icon}</span> {b.label}
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* ── Optional text note ── */}
        <div className="relative max-w-2xl">
          <textarea
            ref={noteInputRef}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            onFocus={() => setTimeout(() => noteInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
            placeholder={noteMode === 'class' ? "Add a note about the class... (optional)" : placeholders[currentPlaceholderIndex]}
            className="w-full min-h-[140px] p-5 pb-16 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-sage/5 focus:border-sage transition-all text-sm shadow-inner resize-none leading-relaxed font-medium"
          />
          <div className="absolute left-2 right-2 bottom-2 flex items-center justify-between px-2 bg-gradient-to-t from-slate-50 to-transparent pt-4 pb-1 rounded-b-xl pointer-events-none">
            <span className="text-[10px] font-bold text-slate-400 opacity-80 flex items-center gap-1.5 translate-y-[2px] pointer-events-auto">
              <Sparkles className="w-3 h-3 text-sage" />
              Tip: Speak naturally (e.g. "Alice was focused")
            </span>
            <button
              onClick={handleVoiceLog}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border transition-all font-bold text-[10px] uppercase tracking-widest pointer-events-auto",
                isListening ? "bg-terracotta text-white border-terracotta animate-pulse shadow-terracotta/30" : "bg-white text-slate-500 border-slate-200 hover:bg-terracotta/10 hover:text-terracotta hover:border-terracotta/40"
              )}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isListening ? 'Stop' : 'Voice'}</span>
            </button>
          </div>
        </div>

        {false && imagePreview && (
          <div className="relative w-24 h-24">
            <img src={imagePreview} className="w-full h-full object-cover rounded-2xl border-2 border-white shadow-md" />
            <button onClick={() => { setImage(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-terracotta text-white p-1 rounded-full shadow-lg"><X className="w-3 h-3" /></button>
          </div>
        )}

        <div className="flex items-center gap-3 max-w-2xl w-full">
          <button
            onClick={handleClear}
            className="px-5 py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => noteDateInputRef.current?.showPicker?.() ?? noteDateInputRef.current?.click()}
            className="px-4 py-3.5 bg-slate-100 text-slate-500 hover:text-blue-500 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 rounded-2xl font-bold text-[11px] transition-all whitespace-nowrap flex items-center gap-1"
            title="Tap to change the date of this note"
          >
            📅 {noteDate === todayStr ? 'Today' : new Date(noteDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            <span className="text-[9px] text-slate-400 font-medium ml-0.5">▼</span>
          </button>
          <input
            ref={noteDateInputRef}
            type="date"
            value={noteDate}
            max={todayStr}
            onChange={e => setNoteDate(e.target.value || todayStr)}
            className="sr-only"
          />
          <div className={cn(
            "flex-1 rounded-full transition-all",
            (noteContent.trim() || selectedTags.length > 0 || selectedStudent) && !isSaving
              ? "animate-pulse ring-4 ring-orange-400/70"
              : ""
          )}>
            <button
              ref={saveButtonRef}
              onClick={handleSave}
              disabled={isSaving || (noteMode === 'class' ? !selectedClass : (!selectedStudent && !studentInput.trim() && !noteContent.trim())) || (!noteContent.trim() && !image && selectedTags.length === 0)}
              className="w-full py-3.5 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-full font-black text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-orange-300/50 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Save Note</>}
            </button>
          </div>
        </div>
      </div>

      <TodayAtAGlance notes={notes} indicators={indicators} />

      <div className="space-y-4 pb-20">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-black text-blue-600 ml-1">Recent Activity</h2>
          <AnimatePresence>
            {streak >= 3 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 border border-orange-200 rounded-full"
              >
                <span className="text-sm">🔥</span>
                <span className="text-[11px] font-black text-orange-500">{streak} day streak</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {filteredNotes.length === 0 && (
          <div className="text-center py-10 space-y-3 bg-white rounded-[28px] border border-dashed border-slate-200 px-6">
            <p className="text-sm font-black text-slate-400">No notes yet today.</p>
            <p className="text-xs text-slate-400">Pick a student and start tapping. ✌️</p>
          </div>
        )}
        {filteredNotes.slice(0, visibleNoteCount).map((note, i) => (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
          <motion.div
            animate={latestNoteId === note.id ? {
              backgroundColor: ['#ffffff', '#d1fae5', '#ffffff'],
              boxShadow: ['0 1px 3px rgba(0,0,0,0.04)', '0 0 0 3px rgba(52,211,153,0.3)', '0 1px 3px rgba(0,0,0,0.04)'],
            } : {}}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className={cn(
              "p-6 rounded-[32px] card-shadow border flex items-start gap-4",
              note.class_name
                ? "bg-gradient-to-br from-white to-blue-50/40 border-blue-100"
                : "bg-gradient-to-br from-white to-slate-50/60 border-slate-100"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              note.class_name ? "bg-blue-500/10" : "bg-sage/10"
            )}>
              {note.class_name
                ? <School className="text-blue-500 w-5 h-5" />
                : <User className="text-sage w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                {note.class_name ? (
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-slate-900 text-base font-display">{note.class_name}</h4>
                    <span className="text-[11px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">Class Note</span>
                  </div>
                ) : (
                  <h4
                    className={cn("font-black text-slate-900 text-base truncate font-display", onStudentClick && note.student_id && "cursor-pointer hover:underline")}
                    onClick={onStudentClick && note.student_id ? (e) => { e.stopPropagation(); onStudentClick(note.student_id!); } : undefined}
                  >{studentByName[note.student_name] ? getDisplayName(studentByName[note.student_name], aliasMode) : note.student_name}</h4>
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
                    onClick={() => softDeleteNote(note)}
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
                  {/* Unknown tags added by AI that aren't in indicators */}
                  {(() => {
                    const knownLabels = new Set(indicators.map(i => i.label));
                    const unknownTags = editTags.filter(t => !knownLabels.has(t));
                    if (unknownTags.length === 0) return null;
                    return (
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">AI-added tags</p>
                        <div className="flex flex-wrap gap-2">
                          {unknownTags.map(tag => (
                            <button
                              key={tag}
                              onClick={() => setEditTags(prev => prev.filter(t => t !== tag))}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-all"
                            >
                              {tag}
                              <X className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Clear all tags */}
                  {editTags.length > 0 && (
                    <button
                      onClick={() => setEditTags([])}
                      className="text-[11px] font-bold text-slate-300 hover:text-terracotta transition-colors self-start"
                    >
                      Clear all tags
                    </button>
                  )}
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
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {note.tags.map(t => {
                      const indicator = indicators.find(i => i.label === t);
                      const isComm = note.is_parent_communication && note.parent_communication_type?.includes(t);

                      let colorClass = "bg-slate-50 text-slate-400 border-slate-100";
                      if (indicator?.type === 'positive') colorClass = "bg-sage/10 text-sage border-sage/20";
                      if (indicator?.type === 'growth') colorClass = "bg-terracotta/10 text-terracotta border-terracotta/20";
                      if (indicator?.type === 'neutral') colorClass = "bg-amber-100 text-amber-600 border-amber-200";
                      if (isComm) colorClass = "bg-blue-50 text-blue-500 border-blue-100";

                      return (
                        <span key={t} className={cn("px-3 py-1 rounded-full text-[11px] font-black border", colorClass)}>
                          {t}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
          </motion.div>
        ))}
        {filteredNotes.length > visibleNoteCount && (
            <button
              onClick={() => setVisibleNoteCount(c => c + 10)}
              className="w-full py-3 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-sage transition-colors"
            >
              See 10 more
            </button>
          )}
      </div>

      <AnimatePresence>
        {undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-full flex items-center gap-4 shadow-xl z-50"
          >
            <span className="text-sm font-medium">{undoToast.label}</span>
            <button
              onClick={() => undoToast.onUndo()}
              className="text-teal-400 font-bold text-sm hover:text-teal-300 transition-colors"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default PulseScreen;