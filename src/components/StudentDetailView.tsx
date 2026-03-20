import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import imageCompression from 'browser-image-compression';
import {
  ChevronLeft, Edit2, Send, Mic, Image as ImageIcon, Loader2,
  Trash2, Copy, Mail, MessageSquare, CheckCircle2, Archive,
  X, Sparkles, ClipboardList, FileText, Download,
  Smile, Meh, Frown, Users, Phone, Tag, ChevronDown, Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { Note, Student, Report, CalendarEvent } from '../types';
import { Abbreviation } from '../utils/expandAbbreviations';
import { expandAbbreviations } from '../utils/expandAbbreviations';
import { categorizeNote, refineReport, parseVoiceLog, quickParentNote, ReportData } from '../lib/gemini';
import { cn } from '../utils/cn';


// Re-exported from App to avoid circular imports — used for comm button display in edit mode
const DEFAULT_COMM_BUTTONS = [
  { label: 'ParentSquare', icon_name: 'ParentSquare' },
  { label: 'Email', icon_name: 'Mail' },
  { label: 'Phone', icon_name: 'Phone' },
  { label: 'Meeting', icon_name: 'Users' },
];

const getIconForName = (name: string, type: string): React.ReactNode => {
  switch (name) {
    case 'Sparkles': return <Sparkles className="w-4 h-4" />;
    case 'CheckCircle2': return <CheckCircle2 className="w-4 h-4" />;
    case 'Smile': return <Smile className="w-4 h-4 text-emerald-600" />;
    case 'Meh': return <Meh className="w-4 h-4 text-amber-500" />;
    case 'Frown': return <Frown className="w-4 h-4 text-red-500" />;
    case 'ParentSquare': return <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-blue-500 text-white text-[9px] font-black leading-none">PS</span>;
    case 'Users': return <Users className="w-4 h-4 text-blue-500" />;
    case 'MessageSquare': return <MessageSquare className="w-4 h-4 text-blue-500" />;
    case 'Mail': return <Mail className="w-4 h-4 text-blue-500" />;
    case 'Phone': return <Phone className="w-4 h-4 text-blue-500" />;
    default:
      if (type === 'positive') return <Smile className="w-4 h-4 text-emerald-600" />;
      if (type === 'growth') return <Frown className="w-4 h-4 text-red-500" />;
      if (type === 'neutral') return <Meh className="w-4 h-4 text-amber-500" />;
      return <MessageSquare className="w-4 h-4 text-blue-500" />;
  }
};

interface StudentDetailViewProps {
  student: Student;
  students: Student[];
  notes: Note[];
  reports: Report[];
  indicators: any[];
  commTypes: any[];
  calendarEvents: CalendarEvent[];
  onBack: () => void;
  onGenerateReport: (length: 'Quick Pulse' | 'Standard' | 'Detailed', filteredNotes: Note[]) => Promise<ReportData | undefined>;
  onNoteUpdate: () => void;
  addNote: (note: any) => Promise<any>;
  updateNote: (id: string, updates: any) => Promise<void>;
  updateStudent: (id: string, updates: any) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  abbreviations: Abbreviation[];
  teacherTitle: string;
  teacherLastName: string;
}

export default function StudentDetailView({
  student,
  students,
  notes,
  reports,
  indicators,
  commTypes,
  calendarEvents,
  onBack,
  onGenerateReport,
  onNoteUpdate,
  addNote,
  updateNote,
  updateStudent,
  deleteNote,
  deleteReport,
  abbreviations,
  teacherTitle,
  teacherLastName,
}: StudentDetailViewProps) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, []);

  const [reportLength, setReportLength] = useState<'Quick Pulse' | 'Standard' | 'Detailed'>('Standard');
  const [timeRange, setTimeRange] = useState('Last 7 Days');
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingContact, setIsUpdatingContact] = useState(false);
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const teacherSignOff = teacherLastName.trim() ? `\n— ${teacherTitle} ${teacherLastName}` : '';
  const reportToText = (report: ReportData): string =>
    [report.opening, '\nGlow:\n' + report.glow, '\nGrow:\n' + report.grow, '\nGoal:\n' + report.goal, '\n' + report.closing + teacherSignOff].join('\n');
  const [refineInstructions, setRefineInstructions] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editStudentName, setEditStudentName] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editComm, setEditComm] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const [noteContent, setNoteContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedComm, setSelectedComm] = useState<string[]>([]);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showReportOptions, setShowReportOptions] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const [selectedArchiveIds, setSelectedArchiveIds] = useState<string[]>([]);
  const [expandedArchiveIds, setExpandedArchiveIds] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<'timeline' | 'ai-report' | 'history' | 'quick-note'>('timeline');
  const [quickNote, setQuickNote] = useState<string | null>(null);
  const [isGeneratingQuickNote, setIsGeneratingQuickNote] = useState(false);
  const quickNoteRef = useRef<HTMLDivElement>(null);
  const [undoToast, setUndoToast] = useState<{ label: string; onUndo: () => void } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingDeleteNoteIds, setPendingDeleteNoteIds] = useState<Set<string>>(new Set());
  const [pendingDeleteArchiveIds, setPendingDeleteArchiveIds] = useState<Set<string>>(new Set());
  const [editingStudentName, setEditingStudentName] = useState(false);
  const [studentNameDraft, setStudentNameDraft] = useState(student.name);
  const timelineRef = useRef<HTMLDivElement>(null);
  const aiReportRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const handleClearNote = () => {
    setNoteContent('');
    setSelectedTags([]);
    setSelectedComm([]);
    setImage(null);
    setImagePreview(null);
  };

  const showUndo = (label: string, onUndo: () => void) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ label, onUndo });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000);
  };

  const softDeleteNote = (note: Note) => {
    // Remove from UI immediately
    // We rely on the parent filtering — signal via a local hidden set
    setPendingDeleteNoteIds(prev => new Set(prev).add(note.id));
    showUndo('Note deleted', () => {
      setPendingDeleteNoteIds(prev => { const s = new Set(prev); s.delete(note.id); return s; });
    });
    undoTimerRef.current = setTimeout(() => {
      deleteNote(note.id);
      setPendingDeleteNoteIds(prev => { const s = new Set(prev); s.delete(note.id); return s; });
    }, 5000);
  };

  const softDeleteArchive = (archiveId: string) => {
    setPendingDeleteArchiveIds(prev => new Set(prev).add(archiveId));
    showUndo('Summary deleted', () => {
      setPendingDeleteArchiveIds(prev => { const s = new Set(prev); s.delete(archiveId); return s; });
    });
    undoTimerRef.current = setTimeout(async () => {
      const updatedSummaries = (student.archivedSummaries || []).filter((a: any) => a.id !== archiveId);
      await updateStudent(student.id, { archivedSummaries: updatedSummaries });
      setPendingDeleteArchiveIds(prev => { const s = new Set(prev); s.delete(archiveId); return s; });
      onNoteUpdate();
    }, 5000);
  };

  const handleSaveStudentName = async () => {
    if (!studentNameDraft.trim() || studentNameDraft === student.name) {
      setEditingStudentName(false);
      return;
    }
    await updateStudent(student.id, { name: studentNameDraft.trim() });
    toast.success('Student name updated!');
    setEditingStudentName(false);
    onNoteUpdate();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleComm = (comm: string) => {
    setSelectedComm(prev => prev.includes(comm) ? prev.filter(c => c !== comm) : [...prev, comm]);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const compressed = await imageCompression(f, { maxSizeMB: 0.2, maxWidthOrHeight: 1200 });
    setImage(compressed);
    setImagePreview(URL.createObjectURL(compressed));
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
      setIsSavingNote(true);
      try {
        const studentNames = students.map(s => s.name);
        const indicatorLabels = indicators.map(i => i.label);
        const result = await parseVoiceLog(transcript, studentNames, indicatorLabels);

        if (result) {
          if (result.content) setNoteContent(result.content);
          if (result.tags && result.tags.length > 0) {
            setNoteContent(prev => prev ? `${prev}\n\nIndicators: ${result.tags.join(', ')}` : `Indicators: ${result.tags.join(', ')}`);
          }
        } else {
          setNoteContent(transcript);
        }
      } catch (err) {
        console.error("Voice parse error:", err);
        setNoteContent(transcript);
      } finally {
        setIsSavingNote(false);
      }
    };
    recognition.start();
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() && !image) return;
    setIsSavingNote(true);
    const expandedContent = expandAbbreviations(noteContent, abbreviations);
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
          const aiResult = await categorizeNote(expandedContent, new Date().toLocaleString(), !!image, indicators.map(i => i.label));
          finalTags = aiResult.tags ?? [];
        } catch {
          // AI unavailable — save note without tags
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const todayEvent = calendarEvents?.find(e => e.date === today);
      if (todayEvent) {
        finalTags.push(`[${todayEvent.title}]`);
      }

      const newNote: Note = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        content: expandedContent,
        student_name: student.name,
        user_id: '',
        tags: finalTags,
        is_parent_communication: isParentComm,
        parent_communication_type: commType,
        image_url: imageUrl,
        is_pinned: false,
        is_checklist: false,
        checklist_data: [],
        deadline: null,
        created_at: new Date().toISOString()
      };

      // Save to Supabase
      await addNote({
        student_id: student.id,
        content: expandedContent,
        tags: finalTags,
        is_parent_communication: isParentComm,
        parent_communication_type: commType || null,
        image_url: imageUrl,
        is_pinned: false,
      });

      handleClearNote();
      toast.success('Note added successfully');
      onNoteUpdate();
    } catch (err) {
      console.error('Error saving note:', err);
      toast.error('Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  useEffect(() => {
    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      let maxRatio = 0;
      let visibleSection = activeSection;

      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          visibleSection = entry.target.id as 'timeline' | 'ai-report' | 'history' | 'quick-note';
        }
      });

      if (maxRatio > 0) {
        setActiveSection(visibleSection);
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-10% 0px -40% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1.0]
    });

    if (timelineRef.current) observer.observe(timelineRef.current);
    if (aiReportRef.current) observer.observe(aiReportRef.current);
    if (historyRef.current) observer.observe(historyRef.current);
    if (quickNoteRef.current) observer.observe(quickNoteRef.current);

    return () => observer.disconnect();
  }, [activeSection]);

  const scrollToSection = (sectionId: 'timeline' | 'ai-report' | 'history' | 'quick-note') => {
    const refs = {
      'timeline': timelineRef,
      'ai-report': aiReportRef,
      'history': historyRef,
      'quick-note': quickNoteRef,
    };
    const targetRef = refs[sectionId];
    if (targetRef?.current) {
      const yOffset = -80; // Offset for sticky headers
      const y = targetRef.current.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleToggleArchiveSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedArchiveIds(prev =>
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };

  const handleSelectAllArchives = () => {
    if (!student.archivedSummaries) return;
    if (selectedArchiveIds.length === student.archivedSummaries.length) {
      setSelectedArchiveIds([]);
    } else {
      setSelectedArchiveIds(student.archivedSummaries.map(s => s.id));
    }
  };

  const handleToggleArchiveExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedArchiveIds(prev =>
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };


  const handleCopySelected = () => {
    if (!student.archivedSummaries) return;
    const selected = student.archivedSummaries.filter(s => selectedArchiveIds.includes(s.id));
    const textToCopy = selected.map(s => `[${new Date(s.date).toLocaleDateString()}]\n${s.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(textToCopy);
    toast.success('Copied selected summaries to clipboard');
  };

  const triggerEmail = (text: string, _subjectTitle?: string) => {
    const recipient = parentEmail || '';
    const firstName = student.name.split(' ')[0];
    const subject = encodeURIComponent(`A note about ${firstName}`);

    // Copy full text to clipboard first
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success('Copied to clipboard! Opening email…');

    // mailto: works on both desktop and mobile (opens default mail app / Gmail app)
    let bodyText = text;
    if (bodyText.length > 1800) {
      bodyText = bodyText.substring(0, 1800) + '\n\n[Full text copied to clipboard — paste to see the rest]';
    }
    const body = encodeURIComponent(bodyText);

    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  const handleEmailSelected = () => {
    if (!student.archivedSummaries) return;
    const selected = student.archivedSummaries.filter(s => selectedArchiveIds.includes(s.id));
    const bodyText = selected.map(s => `[${new Date(s.date).toLocaleDateString()}]\n${s.content}`).join('\n\n---\n\n');
    triggerEmail(bodyText);
  };

  const handleDownloadPDF = () => {
    if (!student.archivedSummaries) return;
    const selected = student.archivedSummaries.filter(s => selectedArchiveIds.includes(s.id));

    // Create new jspdf instance
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`${student.name} - Progress History`, 20, 20);

    let yPos = 35;

    selected.forEach(s => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(new Date(s.date).toLocaleDateString(), 20, yPos);
      yPos += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(s.content, 170);
      doc.text(splitText, 20, yPos);
      yPos += (splitText.length * 5) + 10;
    });

    doc.save(`${student.name.replace(/\s+/g, '_')}_Progress_History.pdf`);
    toast.success('PDF downloaded successfully');
  };

  const [parentName, setParentName] = useState(student.parent_guardian_names?.[0] || '');
  const extractContact = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'object') return val.value || '';
    try { const p = JSON.parse(String(val)); return p.value || String(val); } catch { return String(val); }
  };
  const [parentEmail, setParentEmail] = useState(() => extractContact(student.parent_emails?.[0]));
  const [parentPhone, setParentPhone] = useState(() => extractContact(student.parent_phones?.[0]));

  const handleSaveContact = async () => {
    setIsUpdatingContact(true);
    try {
      await updateStudent(student.id, {
        parent_guardian_names: [parentName],
        parent_emails: parentEmail ? [parentEmail] : [],
        parent_phones: parentPhone ? [parentPhone] : []
      });
      toast.success('Contact info updated!');
      onNoteUpdate();
    } catch (err: any) {
      console.error('Error updating contact info:', err);
      toast.error('Failed to update contact info');
    } finally {
      setIsUpdatingContact(false);
    }
  };

  const clearStudentNotes = async () => {
    if (window.confirm("Are you sure you want to delete all notes for " + student.name + "? This cannot be undone.")) {
      try {
        // Get all notes for this student
        const studentNotesToDelete = notes.filter(n => n.student_name === student.name);
        // Delete each note
        await Promise.all(studentNotesToDelete.map(note => deleteNote(note.id)));
        toast.success('Notes cleared for ' + student.name);
        onNoteUpdate();
      } catch (err) {
        console.error('Error clearing notes:', err);
        toast.error('Failed to clear notes');
      }
    }
  };

  const archiveAndClearNotes = async () => {
    if (!currentReport) return;
    if (window.confirm("Are you sure you want to archive this summary for " + student.name + " AND clear their current notes?")) {
      try {
        const archived = { id: Date.now().toString(), content: reportToText(currentReport), date: new Date().toISOString() };
        await updateStudent(student.id, {
          archivedSummaries: [...(student.archivedSummaries || []), archived]
        });

        // Get all notes for this student and delete them
        const studentNotesToDelete = notes.filter(n => n.student_name === student.name);
        await Promise.all(studentNotesToDelete.map(note => deleteNote(note.id)));

        toast.success('Summary archived & notes cleared!');
        setCurrentReport(null);
        onNoteUpdate();
      } catch (err) {
        console.error('Error archiving and clearing notes:', err);
        toast.error('Failed to archive and clear notes');
      }
    }
  };

  const archiveAndKeepNotes = async () => {
    if (!currentReport) return;
    try {
      const archived = { id: Date.now().toString(), content: reportToText(currentReport), date: new Date().toISOString() };
      await updateStudent(student.id, {
        archivedSummaries: [...(student.archivedSummaries || []), archived]
      });

      toast.success('Summary archived! Notes were kept.');
      setCurrentReport(null);
      onNoteUpdate();
    } catch (err) {
      console.error('Error archiving summary:', err);
      toast.error('Failed to archive summary');
    }
  };

  const handleEmailReport = () => {
    if (!currentReport) return;
    triggerEmail(reportToText(currentReport));
  };

  const handleCopyReport = () => {
    if (!currentReport) return;
    navigator.clipboard.writeText(reportToText(currentReport));
    toast.success('Copied!');
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const handleEmailText = (text: string) => {
    triggerEmail(text);
  };

  const handleTextReport = () => {
    if (!currentReport) return;
    window.location.href = `sms:${parentPhone}?body=${encodeURIComponent(reportToText(currentReport))}`;
  };

  const handleCopyParentSquare = () => {
    if (!currentReport) return;
    navigator.clipboard.writeText(reportToText(currentReport));
    alert('Report copied for ParentSquare!');
  };

  const handleGenerateQuickNote = async () => {
    const today = new Date();
    const todayNotes = notes.filter(n => {
      const d = new Date(n.created_at);
      return d.getFullYear() === today.getFullYear() &&
             d.getMonth() === today.getMonth() &&
             d.getDate() === today.getDate();
    });
    if (todayNotes.length === 0) {
      toast.error('No notes from today to base this on.');
      return;
    }
    setIsGeneratingQuickNote(true);
    try {
      const result = await quickParentNote(todayNotes, teacherTitle, teacherLastName);
      setQuickNote(result.trim());
    } catch {
      toast.error('Failed to generate quick note.');
    } finally {
      setIsGeneratingQuickNote(false);
    }
  };

  const handleRefine = async () => {
    if (!currentReport || !refineInstructions.trim()) return;
    setIsRefining(true);
    try {
      const refined = await refineReport(currentReport, refineInstructions);
      if (refined) {
        setCurrentReport(refined);
        setRefineInstructions('');
      }
    } finally {
      setIsRefining(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const filtered = filterNotesByTimeRange(notes, timeRange);
      const summary = await onGenerateReport(reportLength, filtered);
      if (summary) setCurrentReport(summary);
    } finally {
      setIsGenerating(false);
    }
  };

  const filterNotesByTimeRange = (notesToFilter: Note[], range: string) => {
    const now = new Date();
    return notesToFilter.filter(n => {
      const noteDate = new Date(n.created_at);

      if (range === 'Custom Range') {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999); // Include the whole end day
        return noteDate >= start && noteDate <= end;
      }

      const diffTime = Math.abs(now.getTime() - noteDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (range === 'Today') return diffDays <= 1;
      if (range === 'Last 7 Days') return diffDays <= 7;
      if (range === '15 Days') return diffDays <= 15;
      if (range === 'Last 30 Days') return diffDays <= 30;
      if (range === '60 Days') return diffDays <= 60;
      if (range === 'Whole Year') return diffDays <= 365;
      return true;
    });
  };

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
      const expandedEditContent = expandAbbreviations(editContent, abbreviations);
      await updateNote(editingNoteId, {
        content: expandedEditContent,
        student_id: students.find(s => s.name === editStudentName)?.id || '',
        tags: editTags,
        is_parent_communication: editComm.length > 0,
        parent_communication_type: editComm.length > 0 ? editComm.join(', ') : null,
      });
      setEditingNoteId(null);
      toast.success('Note updated successfully');
      onNoteUpdate();
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

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 pb-10 relative">
      {/* Print-Only Header */}
      <div className="hidden print:flex flex-col items-center justify-center py-8 border-b-2 border-slate-100 mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="p-3 bg-slate-50 rounded-2xl">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Student Progress Report</h1>
        </div>
        <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
          <span>{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
          <span>Official Record</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-2 no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-all">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-[11px] font-bold">Back to Roster</span>
        </button>
      </div>

      <div className="bg-white p-8 rounded-[40px] card-shadow border border-sage/5 flex items-center gap-6">
        <div className="w-20 h-20 bg-cream-dark rounded-[28px] flex items-center justify-center text-terracotta font-bold text-3xl shadow-inner">
          {student.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div className="flex-1">
          {editingStudentName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={studentNameDraft}
                onChange={e => setStudentNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveStudentName(); if (e.key === 'Escape') setEditingStudentName(false); }}
                autoFocus
                className="text-xl font-bold text-sage-dark bg-sage/5 border border-sage/30 rounded-xl px-3 py-1 focus:outline-none focus:ring-2 focus:ring-sage/20"
              />
              <button onClick={handleSaveStudentName} className="text-[11px] font-bold text-sage hover:text-sage-dark">Save</button>
              <button onClick={() => setEditingStudentName(false)} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h2 className="text-2xl font-bold text-sage-dark">{student.name}</h2>
              <button onClick={() => { setStudentNameDraft(student.name); setEditingStudentName(true); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-300 hover:text-sage" title="Edit name">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex gap-3 mt-1">
            <span className="px-3 py-1 bg-sage/10 text-sage text-[10px] font-bold rounded-lg">
              Class Period {student.class_period || 'Unassigned'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white px-5 py-4 rounded-2xl card-shadow border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Parent Contact</h3>
          <button
            type="button"
            onClick={handleSaveContact}
            disabled={isUpdatingContact}
            className="text-[11px] font-black text-sage hover:text-sage-dark disabled:opacity-50"
          >
            {isUpdatingContact ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input
            id="parent_name"
            name="parent_name"
            type="text"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            placeholder="Parent name..."
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
          />
          <input
            id="parent_email"
            name="parent_email"
            type="email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            placeholder="Email..."
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
          />
          <input
            id="parent_phone"
            name="parent_phone"
            type="tel"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            placeholder="Phone..."
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
          />
        </div>
      </div>

      <div className="sticky top-4 z-40 bg-cream/90 backdrop-blur-md p-2 rounded-2xl shadow-sm border border-slate-100/50 flex items-center justify-between gap-2 no-print">
        <button
          onClick={() => scrollToSection('timeline')}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-sm font-black transition-all",
            activeSection === 'timeline' ? "bg-sage text-white shadow-md shadow-sage/20" : "text-slate-500 hover:bg-white/60"
          )}
        >
          Timeline
        </button>
        <button
          onClick={() => scrollToSection('ai-report')}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-sm font-black transition-all",
            activeSection === 'ai-report' ? "bg-sage text-white shadow-md shadow-sage/20" : "text-slate-500 hover:bg-white/60"
          )}
        >
          AI Report
        </button>
        <button
          onClick={() => scrollToSection('history')}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-sm font-black transition-all",
            activeSection === 'history' ? "bg-sage text-white shadow-md shadow-sage/20" : "text-slate-500 hover:bg-white/60"
          )}
        >
          History
        </button>
        <button
          onClick={() => scrollToSection('quick-note')}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-sm font-black transition-all",
            activeSection === 'quick-note' ? "bg-terracotta text-white shadow-md shadow-terracotta/20" : "text-slate-500 hover:bg-white/60"
          )}
        >
          Quick Note
        </button>
      </div>

      <div className="bg-white rounded-[32px] p-8 card-shadow border border-sage/5 space-y-6 no-print">
        <label htmlFor="quick_note" className="text-[13px] font-black text-slate-400 ml-1">Quick Note</label>
        <div className="relative border border-slate-100/50 rounded-[32px] p-1 bg-white shadow-inner">
          <textarea
            id="quick_note"
            name="quick_note"
            ref={noteInputRef}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder={`Add a quick note for ${student.name}...`}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="w-full min-h-[140px] p-6 bg-transparent border-0 focus:outline-none focus:ring-4 focus:ring-sage/5 rounded-[32px] transition-all text-base font-medium resize-none leading-relaxed"
          />
          <div className="absolute flex flex-col gap-2 right-4 bottom-4">
            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-sm border border-slate-100 hover:text-sage transition-all z-10">
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleVoiceLog}
              className={cn(
                "p-2.5 rounded-xl shadow-sm border border-slate-100 transition-all z-10",
                isListening ? "bg-terracotta text-white animate-pulse" : "bg-white text-slate-400 hover:text-terracotta"
              )}
            >
              <Mic className="w-4 h-4" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
          </div>
        </div>

        {imagePreview && (
          <div className="relative w-24 h-24 mt-2">
            <img src={imagePreview} className="w-full h-full object-cover rounded-2xl border-2 border-white shadow-md" />
            <button onClick={() => { setImage(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-terracotta text-white p-1 rounded-full shadow-lg"><X className="w-3 h-3" /></button>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => setShowTags(v => !v)}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-xs font-black uppercase tracking-widest"
          >
            <Tag className="w-3.5 h-3.5" />
            {showTags ? 'Hide tags' : 'Add tags'}
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showTags && 'rotate-180')} />
          </button>

          {!showTags && (selectedTags.length > 0 || selectedComm.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map(t => <span key={t} className="px-2 py-0.5 bg-sage/10 text-sage text-xs font-bold rounded-full">{t}</span>)}
              {selectedComm.map(t => <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-500 text-xs font-bold rounded-full">{t}</span>)}
            </div>
          )}

          <AnimatePresence>
            {showTags && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar px-1">
                  {indicators.map(b => (
                    <button key={b.label} onClick={() => toggleTag(b.label)} className={cn("flex-shrink-0 px-4 py-2 border-2 rounded-full text-base font-black flex items-center gap-2 transition-all shadow-sm", selectedTags.includes(b.label) ? b.type === 'positive' ? "bg-sage/15 border-sage text-sage-dark shadow-md" : b.type === 'neutral' ? "bg-amber-500/15 border-amber-500 text-amber-700 shadow-md" : "bg-terracotta/15 border-terracotta text-terracotta-dark shadow-md" : "bg-white border-slate-100 text-slate-500 hover:border-slate-300")}>
                      <span>{b.icon ?? getIconForName(b.icon_name, b.type)}</span> {b.label}
                    </button>
                  ))}
                </div>
                <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar px-1">
                  {commTypes.map(c => (
                    <button key={c.label} onClick={() => toggleComm(c.label)} className={cn("flex-shrink-0 px-4 py-2 border-2 rounded-full text-base font-black flex items-center gap-2 transition-all shadow-sm", selectedComm.includes(c.label) ? "bg-blue-500/15 border-blue-500 text-blue-700 shadow-md" : "bg-white border-slate-100 text-slate-500 hover:border-slate-300")}>
                      <span>{c.icon ?? getIconForName(c.icon_name, 'neutral')}</span> {c.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {(noteContent || image || selectedTags.length > 0 || selectedComm.length > 0) && (
            <button
              type="button"
              onClick={handleClearNote}
              className="py-2.5 px-6 bg-slate-100 text-slate-500 rounded-xl font-black text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={isSavingNote || (!noteContent.trim() && !image)}
            className="py-1.5 px-8 bg-linear-to-r from-orange-400 to-orange-500 text-white rounded-full font-black text-xl hover:brightness-110 transition-all shadow-md shadow-orange-200/50 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSavingNote ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Save Note</>}
          </button>
        </div>
      </div>

      <div id="timeline" ref={timelineRef} className="space-y-6 pt-4 scroll-mt-header">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-black text-slate-400 ml-1">Observation Timeline</h3>
        </div>
        <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
          {notes.filter(n => !pendingDeleteNoteIds.has(n.id)).map((note) => (
            <div key={note.id} className="relative">
              <div className="absolute -left-[29px] top-1 w-6 h-6 bg-white border-2 border-sage rounded-full flex items-center justify-center z-10 shadow-sm">
                <div className="w-2 h-2 bg-sage rounded-full" />
              </div>
              <div className="bg-white p-6 rounded-[32px] card-shadow border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">{new Date(note.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    {note.is_parent_communication && (
                      <span className="px-2 py-1 bg-terracotta/10 text-terracotta text-[10px] font-black rounded-md flex items-center gap-1">
                        <MessageSquare className="w-2.5 h-2.5" /> {note.parent_communication_type}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyText(note.content)}
                      className="p-1.5 text-slate-300 hover:text-slate-800 transition-all"
                      title="Copy Note"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEmailText(note.content)}
                      className="p-1.5 text-slate-300 hover:text-blue-500 transition-all"
                      title="Email Parent"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditing(note)}
                      className="p-1.5 text-slate-300 hover:text-sage transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => softDeleteNote(note)}
                      className="p-1.5 text-slate-300 hover:text-terracotta transition-all"
                      title="Delete Note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editingNoteId === note.id ? (
                  <div className="space-y-4 pt-2">
                    <div className="relative">
                      <label htmlFor="edit_student_name" className="sr-only">Edit Student Name</label>
                      <input
                        id="edit_student_name"
                        name="edit_student_name"
                        type="text"
                        list="detail-edit-student-names"
                        value={editStudentName}
                        onChange={(e) => setEditStudentName(e.target.value)}
                        placeholder="Student Name"
                        autoComplete="off"
                        data-1p-ignore
                        data-lpignore="true"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage"
                      />
                      <datalist id="detail-edit-student-names">
                        {students.map(s => (
                          <option key={s.id} value={s.name} />
                        ))}
                      </datalist>
                    </div>
                    <label htmlFor="edit_note_content" className="sr-only">Edit Note Content</label>
                    <textarea
                      id="edit_note_content"
                      name="edit_note_content"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage min-h-[100px]"
                    />
                    <div className="flex flex-wrap gap-2">
                      {indicators.map(ind => (
                        <button
                          key={ind.label}
                          onClick={() => toggleEditTag(ind.label)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border",
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
                      {DEFAULT_COMM_BUTTONS.map(comm => (
                        <button
                          key={comm.label}
                          onClick={() => toggleEditComm(comm.label)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border",
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
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={isUpdating}
                        className="flex-1 py-3 bg-sage text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-sage-dark transition-all flex items-center justify-center gap-2"
                      >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">{note.content}</p>
                    {note.image_url && (
                      <img src={note.image_url} alt="Observation" className="w-full h-48 object-cover rounded-2xl border border-slate-100" referrerPolicy="no-referrer" />
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {note.tags.map(t => {
                        const indicator = indicators.find(i => i.label === t);
                        const isComm = note.is_parent_communication && note.parent_communication_type?.includes(t);

                        let colorClass = "bg-slate-50 text-slate-400 border-slate-100";
                        if (indicator?.type === 'positive') colorClass = "bg-sage/10 text-sage border-sage/20";
                        if (indicator?.type === 'growth') colorClass = "bg-terracotta/10 text-terracotta border-terracotta/20";
                        if (indicator?.type === 'neutral') colorClass = "bg-amber-100 text-amber-600 border-amber-200";
                        if (isComm) colorClass = "bg-blue-50 text-blue-500 border-blue-100";

                        return (
                          <span key={t} className={cn("px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border", colorClass)}>
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
          {notes.length === 0 && (
            <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-slate-200">
              <p className="text-sm text-slate-400 font-medium">No observations logged for this student.</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100" />

      <div id="ai-report" ref={aiReportRef} className="space-y-6 pt-4 scroll-mt-header">
        <div className="bg-cream/30 p-8 rounded-[40px] border border-sage/10 space-y-6">
          <div className="space-y-4">
            {/* Primary action — always visible */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || notes.length === 0}
              className="w-full py-5 bg-linear-to-r from-orange-400 to-orange-500 text-white rounded-full font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-orange-200/50 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Generate Report</>}
            </button>
            {notes.length === 0 && <p className="text-[10px] text-center text-slate-400 italic">No notes available to generate a report.</p>}

            {/* Customize options — hidden by default */}
            <button
              type="button"
              onClick={() => setShowReportOptions(v => !v)}
              className="flex items-center gap-1.5 mx-auto text-slate-400 hover:text-slate-600 transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <Settings2 className="w-3 h-3" />
              Customize ({timeRange}, {reportLength})
              <ChevronDown className={cn('w-3 h-3 transition-transform', showReportOptions && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showReportOptions && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-6 overflow-hidden">
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Timeframe</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {['Today', 'Last 7 Days', '15 Days', 'Last 30 Days', '60 Days', 'Whole Year', 'Custom Range'].map(range => (
                        <button key={range} onClick={() => setTimeRange(range)} className={cn("py-2.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all border-2", timeRange === range ? "bg-sage/15 border-sage text-sage-dark shadow-md" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50")}>
                          {range}
                        </button>
                      ))}
                    </div>
                    {timeRange === 'Custom Range' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <label htmlFor="custom_start_date" className="text-[8px] font-bold uppercase tracking-widest text-slate-400 ml-1">Start Date</label>
                          <input id="custom_start_date" name="custom_start_date" type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} autoComplete="off" data-1p-ignore data-lpignore="true" className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-[10px] focus:outline-none focus:ring-2 focus:ring-sage/20" />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="custom_end_date" className="text-[8px] font-bold uppercase tracking-widest text-slate-400 ml-1">End Date</label>
                          <input id="custom_end_date" name="custom_end_date" type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} autoComplete="off" data-1p-ignore data-lpignore="true" className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-[10px] focus:outline-none focus:ring-2 focus:ring-sage/20" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Report Type</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Quick Pulse', 'Standard', 'Detailed'] as const).map(len => (
                        <button key={len} onClick={() => setReportLength(len)} className={cn("py-3 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all border-2", reportLength === len ? "bg-sage/15 border-sage text-sage-dark shadow-md" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50")}>
                          {len}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {currentReport && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 rounded-[32px] border border-sage/10 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-sage">New Summary ({timeRange})</span>
                <button onClick={() => setCurrentReport(null)} className="text-slate-300 hover:text-terracotta"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-slate-500 italic leading-relaxed">{currentReport.opening}</p>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1.5">Glow</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{currentReport.glow}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1.5">Grow</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{currentReport.grow}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1.5">Goal</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{currentReport.goal}</p>
                </div>
                <p className="text-sm text-slate-500 italic leading-relaxed">{currentReport.closing}</p>
              </div>

              {/* Refinement Section */}
              <div className="space-y-3 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <label htmlFor="refine_report_input" className="sr-only">Refine Report Instructions</label>
                    <input
                      id="refine_report_input"
                      name="refine_report_input"
                      type="text"
                      value={refineInstructions}
                      onChange={(e) => setRefineInstructions(e.target.value)}
                      placeholder="Ask the AI to refine this report... (e.g., 'Make it more formal')"
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none focus:border-sage pr-10"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && refineInstructions.trim() && !isRefining) {
                          handleRefine();
                        }
                      }}
                    />
                    <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  </div>
                  <button
                    type="button"
                    onClick={handleRefine}
                    disabled={isRefining || !refineInstructions.trim()}
                    className="px-6 py-2 bg-sage text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-sage-dark transition-all disabled:opacity-50 flex items-center gap-2 min-w-[100px] justify-center shadow-md shadow-sage/10"
                  >
                    {isRefining ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Thinking...</span>
                      </>
                    ) : (
                      'Refine'
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button
                  type="button"
                  onClick={handleEmailReport}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all"
                >
                  <Mail className="w-3.5 h-3.5" /> Email Parent
                </button>
                <button
                  type="button"
                  onClick={handleTextReport}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-green-600 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Text
                </button>
                <button
                  type="button"
                  onClick={handleCopyParentSquare}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  <ClipboardList className="w-3.5 h-3.5" /> Copy for ParentSquare
                </button>
                <div className="w-full grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={archiveAndKeepNotes}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all"
                  >
                    <Archive className="w-3.5 h-3.5" /> Archive & Keep Notes
                  </button>
                  <button
                    type="button"
                    onClick={archiveAndClearNotes}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Archive & Clear Notes
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <div id="history" ref={historyRef} className="space-y-4 pt-6 mt-6 border-t border-slate-100 scroll-mt-header">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-sage-dark flex items-center gap-2">
                  <Archive className="w-4 h-4 text-sage" /> Report History & Export Station
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  {student.archivedSummaries?.length || 0} Saved {(student.archivedSummaries?.length || 0) === 1 ? 'Record' : 'Records'}
                </p>
              </div>

              {student.archivedSummaries && student.archivedSummaries.length > 0 && (
                <button
                  onClick={handleSelectAllArchives}
                  className="px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-colors"
                >
                  {selectedArchiveIds.length === student.archivedSummaries.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            <AnimatePresence>
              {selectedArchiveIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 overflow-hidden"
                >
                  <button
                    onClick={handleCopySelected}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Selected
                  </button>
                  <button
                    onClick={handleEmailSelected}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-sm shadow-blue-500/20"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email Parent
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-terracotta text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-terracotta-dark transition-all shadow-sm shadow-terracotta/20"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-3 pt-2">
              {!student.archivedSummaries || student.archivedSummaries.length === 0 ? (
                <div className="text-center py-10 bg-slate-50/50 rounded-[32px] border border-dashed border-slate-200 px-6 space-y-1.5">
                  <p className="text-xs font-black text-slate-400">No archived reports yet.</p>
                  <p className="text-xs text-slate-400 leading-relaxed">Generate a report above, then tap <span className="font-bold">Archive</span> to save a snapshot of this student's progress. Archived reports can be emailed, copied, or downloaded as a PDF.</p>
                </div>
              ) : (
                student.archivedSummaries.filter((s: any) => !pendingDeleteArchiveIds.has(s.id)).map((s: any) => {
                  const isExpanded = expandedArchiveIds.includes(s.id);
                  const isSelected = selectedArchiveIds.includes(s.id);

                  return (
                    <div
                      key={s.id}
                      onClick={(e) => handleToggleArchiveExpand(s.id, e)}
                      className={cn(
                        "group cursor-pointer p-4 rounded-2xl border transition-all duration-200",
                        isSelected ? "bg-indigo-50/50 border-indigo-200 shadow-sm" : "bg-white border-slate-100 hover:border-sage/30 hover:shadow-sm card-shadow"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <button
                            onClick={(e) => handleToggleArchiveSelect(s.id, e)}
                            className={cn(
                              "w-5 h-5 rounded-md flex items-center justify-center border transition-all",
                              isSelected ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white border-slate-300 text-transparent hover:border-indigo-400 hover:bg-indigo-50"
                            )}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{new Date(s.date).toLocaleDateString()}</span>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCopyText(s.content); }}
                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Copy Archive"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEmailText(s.content); }}
                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Email Parent"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); softDeleteArchive(s.id); }}
                                className="p-1.5 text-slate-400 hover:text-terracotta hover:bg-terracotta/10 rounded-lg transition-colors"
                                title="Delete Archive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="relative">
                            <div className={cn(
                              "text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap transition-all overflow-hidden",
                              !isExpanded && "line-clamp-2"
                            )}>
                              {s.content}
                            </div>
                            {!isExpanded && s.content.length > 80 && (
                              <div className="absolute bottom-0 right-0 top-0 w-16 bg-gradient-to-l from-white group-hover:from-transparent to-transparent pointer-events-none" />
                            )}
                          </div>
                        </div>

                        <div className="pt-1">
                          {isExpanded ? <ChevronLeft className="w-4 h-4 text-slate-400 -rotate-90" /> : <ChevronLeft className="w-4 h-4 text-slate-400 rotate-180" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Note to Parent */}
          <div id="quick-note" ref={quickNoteRef} className="space-y-4 pt-6 mt-6 border-t border-slate-100 scroll-mt-header">
            <div>
              <h3 className="text-sm font-bold text-terracotta flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Quick Note to Parent
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                Based on today's observations only
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateQuickNote}
              disabled={isGeneratingQuickNote}
              className="w-full py-5 bg-terracotta text-white rounded-full font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-terracotta/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isGeneratingQuickNote
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Writing note...</>
                : <><MessageSquare className="w-4 h-4" /> Generate Quick Note</>
              }
            </button>

            <AnimatePresence>
              {quickNote && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-6 rounded-[28px] border border-terracotta/10 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-terracotta">Today's Note</span>
                    <button onClick={() => setQuickNote(null)} className="text-slate-300 hover:text-terracotta"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{quickNote}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(quickNote); toast.success('Copied!'); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerEmail(quickNote, `Note about ${student.name}`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all"
                    >
                      <Mail className="w-3.5 h-3.5" /> Email Parent
                    </button>
                    <button
                      type="button"
                      onClick={() => { window.location.href = `sms:${parentPhone}?body=${encodeURIComponent(quickNote)}`; }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-green-600 transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Text
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Undo delete toast */}
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
              onClick={() => { undoToast.onUndo(); setUndoToast(null); if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }}
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
