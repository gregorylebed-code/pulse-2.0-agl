import React, { useState, useEffect, useRef } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import imageCompression from 'browser-image-compression';
import {
  User, MessageCircle, Shield, Sparkles, Users2, Folder, TrendingUp, Calendar, PenLine,
  School, FileInput, MessageSquare, Trash2, Plus, X, Loader2, CheckCircle2,
  GripVertical, CalendarX, Edit2, ChevronDown, Upload, ArrowRight, Coffee,
  Smile, Meh, Frown, Activity, AlertCircle, Users, Clock, Mail, Phone, ChevronRight,
  LogOut, Lock, Ban, UserCheck, Bot, Database
} from 'lucide-react';
import { toast } from 'sonner';
import { Note, Student, CalendarEvent } from '../types';
import { Abbreviation } from '../utils/expandAbbreviations';
import {
  performSmartScan, extractRotationMapping, suggestAbbreviations
} from '../lib/gemini';
import { SpecialsMode } from '../utils/rotationHelpers';
import { migrateFromLocalStorage } from '../utils/migrateFromLocalStorage';
import { requestNotificationPermission, notificationsSupported } from '../utils/notifications';
import { supabase } from '../lib/supabase';
import ImportScreen from './ImportScreen';
import StatsCard from './StatsCard';
import { cn } from '../utils/cn';
import { isFullMode } from '../lib/mode';


const DEFAULT_BEHAVIOR_BUTTONS = [
  { label: 'Participation', type: 'positive' as const, icon_name: 'Smile' },
  { label: 'Kindness', type: 'positive' as const, icon_name: 'Smile' },
  { label: 'Persistence', type: 'positive' as const, icon_name: 'Smile' },
  { label: 'Disruption', type: 'growth' as const, icon_name: 'Frown' },
  { label: 'Peer Conflict', type: 'growth' as const, icon_name: 'Frown' },
  { label: 'Distracted', type: 'growth' as const, icon_name: 'Frown' },
  { label: 'Missing HW', type: 'growth' as const, icon_name: 'Frown' },
  { label: 'Unprepared', type: 'growth' as const, icon_name: 'Frown' },
  { label: 'Observation', type: 'neutral' as const, icon_name: 'Meh' },
  { label: 'Independent Work', type: 'neutral' as const, icon_name: 'Meh' },
  { label: 'Group Work', type: 'neutral' as const, icon_name: 'Meh' },
];

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
    case 'TrendingUp': return <TrendingUp className="w-4 h-4" />;
    case 'AlertCircle': return <AlertCircle className="w-4 h-4" />;
    case 'Users2': return <Users2 className="w-4 h-4" />;
    case 'Clock': return <Clock className="w-4 h-4" />;
    case 'FileInput': return <FileInput className="w-4 h-4" />;
    case 'Activity': return <Activity className="w-4 h-4" />;
    case 'Smile': return <Smile className="w-4 h-4 text-emerald-600" />;
    case 'Meh': return <Meh className="w-4 h-4 text-amber-500" />;
    case 'Frown': return <Frown className="w-4 h-4 text-red-500" />;
    case 'ParentSquare': return <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-blue-500 text-white text-[11px] font-black leading-none">PS</span>;
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

function SettingsItem({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-2xl transition-all group"
    >
      <div className="flex items-center gap-4">
        <div className="text-slate-400 group-hover:text-sage transition-colors">
          {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
        </div>
        <span className="text-base font-black text-slate-600 group-hover:text-slate-900 transition-colors">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
    </button>
  );
}

type SettingsView = 'main' | 'indicators' | 'profile' | 'notifications' | 'privacy' | 'quick-grader' | 'data-management' | 'roster' | 'classes' | 'calendar' | 'rotation' | 'abbreviations';

interface SettingsScreenProps {
  indicators: any[];
  setIndicators: (val: any[]) => void;
  commTypes: any[];
  setCommTypes: (val: any[]) => void;
  classes: string[];
  setClasses: (val: string[]) => void;
  onImportComplete: () => void;
  onNoteAdded: () => void;
  userName: string;
  setUserName: (val: string) => void;
  schoolName: string;
  setSchoolName: (val: string) => void;
  teacherTitle: string;
  setTeacherTitle: (val: string) => void;
  teacherFirstName: string;
  setTeacherFirstName: (val: string) => void;
  teacherLastName: string;
  setTeacherLastName: (val: string) => void;
  calendarEvents: CalendarEvent[];
  setCalendarEvents: (val: CalendarEvent[]) => void;
  rotationMapping: Record<string, string>;
  setRotationMapping: (val: Record<string, string>) => void;
  specialsNames: Record<string, string>;
  setSpecialsNames: (val: Record<string, string>) => void;
  specialsMode: SpecialsMode;
  setSpecialsMode: (val: SpecialsMode) => Promise<void>;
  dayOfWeekSpecials: Record<string, string>;
  setDayOfWeekSpecials: (val: Record<string, string>) => Promise<void>;
  rollingStartDate: string;
  rollingLetterCount: number;
  saveRollingConfig: (startDate: string, letterCount: number) => Promise<void>;
  todayOverride: { date: string; letter: string } | null;
  saveTodayOverride: (override: { date: string; letter: string } | null) => Promise<void>;
  students: Student[];
  addStudent: (student: Omit<Student, 'id'>) => Promise<Student | null>;
  deleteStudent: (id: string) => Promise<void>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  theme: 'light' | 'dark';
  setTheme: (val: 'light' | 'dark') => void;
  abbreviations: Abbreviation[];
  saveAbbreviations: (val: Abbreviation[]) => Promise<void>;
  notes: Note[];
  reportsCount: number;
  stats: { notes_created: number; reports_generated: number };
  userId: string;
  userEmail: string;
  onSignOut: () => Promise<any>;
  view: SettingsView;
  setView: (v: SettingsView) => void;
  notificationPrefs: import('../utils/notifications').NotificationPrefs;
  saveNotificationPrefs: (prefs: import('../utils/notifications').NotificationPrefs) => Promise<void>;
  saveProfile: (profile: import('../hooks/useClassroomData').Profile) => Promise<void>;
  profile: import('../hooks/useClassroomData').Profile;
  onboardingComplete: boolean;
  markOnboardingComplete: () => Promise<void>;
  onGoToProfile: () => void;
  onGoToRoster: () => void;
  onGoToPulse: () => void;
  onGoToCalendar: () => void;
  onGoToReport: () => void;
}

export default function SettingsScreen({
  indicators,
  setIndicators,
  commTypes,
  setCommTypes,
  classes,
  setClasses,
  onImportComplete,
  onNoteAdded,
  userName,
  setUserName,
  schoolName,
  setSchoolName,
  teacherTitle,
  setTeacherTitle,
  teacherFirstName,
  setTeacherFirstName,
  teacherLastName,
  setTeacherLastName,
  calendarEvents,
  setCalendarEvents,
  rotationMapping,
  setRotationMapping,
  specialsNames,
  setSpecialsNames,
  specialsMode,
  setSpecialsMode,
  dayOfWeekSpecials,
  setDayOfWeekSpecials,
  rollingStartDate,
  rollingLetterCount,
  saveRollingConfig,
  todayOverride,
  saveTodayOverride,
  students,
  addStudent,
  deleteStudent,
  updateStudent,
  theme,
  setTheme,
  abbreviations,
  saveAbbreviations,
  notes,
  reportsCount,
  stats,
  userId,
  userEmail,
  onSignOut,
  view,
  setView,
  notificationPrefs,
  saveNotificationPrefs,
  saveProfile,
  profile,
  onboardingComplete,
  markOnboardingComplete,
  onGoToProfile,
  onGoToRoster,
  onGoToPulse,
  onGoToCalendar,
  onGoToReport,
}: SettingsScreenProps) {
  const { canInstallAndroid, showIosInstructions, triggerInstall } = useInstallPrompt();
  const [gettingStartedOpen, setGettingStartedOpen] = useState(!onboardingComplete);
  const [newIndicator, setNewIndicator] = useState('');
  const [newIndicatorType, setNewIndicatorType] = useState<'positive' | 'growth' | 'neutral'>('positive');
  // Abbreviations state
  const [newAbbr, setNewAbbr] = useState('');
  const [newExpansion, setNewExpansion] = useState('');
  const [newCaseSensitive, setNewCaseSensitive] = useState(false);
  const [isSuggestingAbbr, setIsSuggestingAbbr] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<string[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventTitle, setEditEventTitle] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventType, setNewEventType] = useState('Other');
  const [draftEvents, setDraftEvents] = useState<(CalendarEvent & { selected: boolean })[] | null>(null);
  const [newComm, setNewComm] = useState('');
  const [isScanningRotation, setIsScanningRotation] = useState(false);
  const [isScanningCalendar, setIsScanningCalendar] = useState(false);
  const [showRotationMappingView, setShowRotationMappingView] = useState(false);
  const calendarAbortRef = useRef<AbortController | null>(null);
  const rotationAbortRef = useRef<AbortController | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);

  // Local profile state — buffered until "Save Changes" is clicked
  const [localUserName, setLocalUserName] = useState(userName);
  const [localSchoolName, setLocalSchoolName] = useState(schoolName);
  const [localTeacherTitle, setLocalTeacherTitle] = useState(teacherTitle);
  const [localTeacherFirstName, setLocalTeacherFirstName] = useState(teacherFirstName);
  const [localTeacherLastName, setLocalTeacherLastName] = useState(teacherLastName);

  const handleUpdateSpecial = (letter: string, special: string) => {
    setSpecialsNames({ ...specialsNames, [letter]: special });
  };

  const handleScanRotation = async (file: File) => {
    const controller = new AbortController();
    rotationAbortRef.current = controller;
    setIsScanningRotation(true);
    const loadingToast = toast.loading('AI is extracting rotation mappings...');

    const readAsDataURL = (f: Blob): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(f);
    });

    try {
      let dataUrl: string;
      let mimeType: string;

      if (file.type === 'application/pdf') {
        if (file.size > 4 * 1024 * 1024) {
          toast.error('PDF must be smaller than 4MB', { id: loadingToast });
          return;
        }
        dataUrl = await readAsDataURL(file);
        mimeType = 'application/pdf';
      } else if (file.type.startsWith('image/')) {
        const compressed = await imageCompression(file, { maxSizeMB: 1.9, maxWidthOrHeight: 1920, useWebWorker: true });
        dataUrl = await readAsDataURL(compressed);
        mimeType = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
      } else {
        toast.error('Please upload an image or PDF', { id: loadingToast });
        return;
      }

      const base64Data = dataUrl.split(',')[1];
      const mapping = await extractRotationMapping(base64Data, mimeType, controller.signal);

      if (mapping && Object.keys(mapping).length > 0) {
        setRotationMapping(mapping);
        toast.success(`Successfully extracted ${Object.keys(mapping).length} date mappings!`, { id: loadingToast });
      } else {
        toast.error('AI could not find a rotation schedule in this file.', { id: loadingToast });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        toast.dismiss(loadingToast);
        toast('Rotation scan cancelled');
      } else {
        console.error('Rotation scan error:', err);
        toast.error(err?.message || 'Failed to scan rotation schedule.', { id: loadingToast });
      }
    } finally {
      setIsScanningRotation(false);
      rotationAbortRef.current = null;
    }
  };

  const handleDeleteEvent = (id: string) => {
    setCalendarEvents(calendarEvents.filter(e => e.id !== id));
    toast.success('Event deleted');
    onNoteAdded();
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setEditEventTitle(event.title);
    setEditEventDate(event.date);
  };

  const handleUpdateEvent = () => {
    if (!editingEventId) return;
    const updated = calendarEvents.map(e =>
      e.id === editingEventId ? { ...e, title: editEventTitle, date: editEventDate } : e
    );
    updated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setCalendarEvents(updated);
    setEditingEventId(null);
    toast.success('Event updated');
    onNoteAdded();
  };

  const toggleEventExpand = (id: string) => {
    setExpandedEvents(prev =>
      prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
    );
  };

  const handleClearAllEvents = () => {
    if (!confirm('Are you sure you want to clear all school events?')) return;
    setCalendarEvents([]);
    toast.success('All events cleared');
    onNoteAdded();
  };

  const saveDraftEvents = () => {
    if (!draftEvents) return;
    const selectedEvents = draftEvents
      .filter(e => e.selected)
      .map(({ selected, ...rest }) => rest);

    if (selectedEvents.length === 0) {
      toast.error("No events selected to save.");
      return;
    }

    const newCalendarEvents = [...calendarEvents, ...selectedEvents];
    newCalendarEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setCalendarEvents(newCalendarEvents);
    setDraftEvents(null);
    toast.success(`Saved ${selectedEvents.length} events to your School Calendar.`);
    onNoteAdded();
  };

  // Quick Grader state
  const [totalQuestions, setTotalQuestions] = useState<number | ''>('');

  // Notifications — managed via notificationPrefs prop (stored in Supabase)

  // Roster Management state
  const [rosterStudents, setRosterStudents] = useState<Student[]>([]);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentSection, setNewStudentSection] = useState<string>(classes[0] || 'AM');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [rosterFilter, setRosterFilter] = useState<string>('all');
  const [editingStudentNameId, setEditingStudentNameId] = useState<string | null>(null);
  const [editingStudentNameVal, setEditingStudentNameVal] = useState('');

  // Class Management state
  const [newClassName, setNewClassName] = useState('');
  const [isAddingClass, setIsAddingClass] = useState(false);

  useEffect(() => {
    if (view === 'roster') setRosterStudents([...students].sort((a, b) => a.name.localeCompare(b.name)));
  }, [view, students]);

  const fetchRoster = () => {
    setRosterStudents([...students].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleAddStudent = async () => {
    if (!newStudentName.trim()) return;
    setIsAddingStudent(true);
    try {
      const result = await addStudent({
        name: newStudentName.trim(),
        class_id: newStudentSection,
        class_period: newStudentSection,
        user_id: userId,
        created_at: new Date().toISOString(),
        parent_guardian_names: [],
        parent_emails: [],
        parent_phones: [],
      } as Omit<Student, 'id'>);
      if (!result) throw new Error('Failed to add student');
      setNewStudentName('');
      toast.success('Student added to roster');
      fetchRoster();
      onImportComplete();
    } catch (err: any) {
      console.error('Add student error:', err);
      toast.error('Failed to add student');
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleRemoveStudent = async (id: string, name: string) => {
    toast.custom(
      (toastId) => (
        <div className="flex flex-col gap-3 bg-white p-4 rounded-xl shadow-lg border border-slate-100 w-[300px]">
          <p className="text-sm font-medium text-slate-800">
            Are you sure you want to remove <strong>{name}</strong>?<br />
            <span className="text-xs text-slate-500 font-normal">This will also delete all their notes.</span>
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(toastId)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                toast.dismiss(toastId);
                executeRemoveStudent(id, name);
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-terracotta rounded-md hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, id: `confirm-${id}` }
    );
  };

  const executeRemoveStudent = async (id: string, name: string) => {
    const loadingToast = toast.loading(`Removing ${name}...`);
    try {
      await deleteStudent(id); // notes cascade-delete in DB
      toast.dismiss(loadingToast);
      toast.success(`${name} and all associated records have been deleted.`, { duration: 5000 });
      fetchRoster();
      onImportComplete();
    } catch (err: any) {
      console.error('Full removal error:', err);
      toast.dismiss(loadingToast);
      toast.error(`Error Deleting Student:\n${err.message || 'Unknown error'}`, { duration: 8000 });
    }
  };

  const handleUpdateSection = async (id: string, section: string) => {
    try {
      await updateStudent(id, { class_period: section } as any);
      toast.success('Student section updated');
      fetchRoster();
      onImportComplete();
    } catch (err: any) {
      console.error('Update section error:', err);
      toast.error('Failed to update section');
    }
  };

  const handleSaveProfile = () => {
    saveProfile({
      ...profile,
      userName: localUserName,
      schoolName: localSchoolName,
      teacherTitle: localTeacherTitle as import('../hooks/useClassroomData').Profile['teacherTitle'],
      teacherFirstName: localTeacherFirstName,
      teacherLastName: localTeacherLastName,
    });
    toast.success('Profile updated successfully');
  };

  const addIndicator = () => {
    if (!newIndicator.trim()) return;
    if (indicators.some(i => i.label.toLowerCase() === newIndicator.trim().toLowerCase())) {
      toast.error('An indicator with this name already exists.');
      return;
    }
    const iconName = newIndicatorType === 'positive' ? 'Smile' :
      newIndicatorType === 'growth' ? 'Frown' : 'Meh';
    const newInd = {
      id: Date.now().toString(36),
      label: newIndicator.trim(),
      type: newIndicatorType,
      icon_name: iconName,
      category: 'behavior',
      user_id: userId,
      created_at: new Date().toISOString()
    };
    const updatedIndicators = [...indicators, { ...newInd, icon: getIconForName(iconName, newIndicatorType) }];
    setIndicators(updatedIndicators);
    setNewIndicator('');
    toast.success('Indicator added');
  };

  const removeIndicator = (label: string) => {
    setIndicators(indicators.filter(i => i.label !== label));
    toast.success('Indicator removed');
  };

  const addComm = () => {
    if (!newComm.trim()) return;
    if (commTypes.some(c => c.label.toLowerCase() === newComm.trim().toLowerCase())) {
      toast.error('A communication type with this name already exists.');
      return;
    }
    const newC = {
      id: Date.now().toString(36),
      label: newComm.trim(),
      icon_name: 'MessageSquare',
      category: 'communication',
      type: 'neutral',
      user_id: userId,
      created_at: new Date().toISOString()
    };
    setCommTypes([...commTypes, { ...newC, icon: <MessageSquare className="w-4 h-4" /> }]);
    setNewComm('');
    toast.success('Communication type added');
  };

  const removeComm = (label: string) => {
    setCommTypes(commTypes.filter(c => c.label !== label));
    toast.success('Communication type removed');
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    setIsAddingClass(true);
    try {
      setClasses([...classes, newClassName.trim()]);
      setNewClassName('');
      toast.success(`Class "${newClassName}" added`);
      onImportComplete();
    } catch (err: any) {
      console.error('Add class error:', err);
      toast.error(`Failed to add class`);
    } finally {
      setIsAddingClass(false);
    }
  };

  const handleRemoveClass = async (name: string) => {
    toast.custom(
      (toastId) => (
        <div className="flex flex-col gap-3 bg-white p-4 rounded-xl shadow-lg border border-slate-100 w-[300px]">
          <p className="text-sm font-medium text-slate-800">
            Are you sure you want to remove the class <strong>{name}</strong>?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(toastId)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                toast.dismiss(toastId);
                executeRemoveClass(name);
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-terracotta rounded-md hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, id: `confirm-class-${name}` }
    );
  };

  const executeRemoveClass = (name: string) => {
    const loadingToast = toast.loading(`Removing class ${name}...`);
    try {
      setClasses(classes.filter(c => c !== name));
      toast.dismiss(loadingToast);
      toast.success(`Class ${name} removed`);
      onImportComplete();
    } catch (err: any) {
      console.error('Remove class error:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to remove class');
    }
  };

  const resetToDefaults = async () => {
    toast.custom(
      (toastId) => (
        <div className="flex flex-col gap-3 bg-white p-4 rounded-xl shadow-lg border border-slate-100 w-[300px]">
          <p className="text-sm font-medium text-slate-800">
            Reset all indicators to factory settings?
            <br /><span className="text-xs text-slate-500 font-normal">This will clear your custom indicators.</span>
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(toastId)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                toast.dismiss(toastId);
                executeResetToDefaults();
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-terracotta rounded-md hover:bg-red-600"
            >
              Reset
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, id: 'confirm-reset' }
    );
  };

  const executeResetToDefaults = () => {
    const loadingToast = toast.loading('Resetting to factory defaults...');
    try {
      setIndicators(DEFAULT_BEHAVIOR_BUTTONS);
      setCommTypes(DEFAULT_COMM_BUTTONS);
      onNoteAdded();
      toast.dismiss(loadingToast);
      toast.success('Success: All indicators have been restored to Factory Settings.', { duration: 5000 });
    } catch (err: any) {
      console.error('Full reset error:', err);
      toast.dismiss(loadingToast);
      toast.error(`Error Resetting Settings: ${err.message || 'Unknown error'}`, { duration: 8000 });
    }
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(indicators);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setIndicators(items);
  };

  return (
    <div className="pb-10">
      <AnimatePresence mode="wait">
        {view === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8 max-w-3xl mx-auto"
          >
            {/* Getting Started accordion */}
            <div className="bg-white rounded-[32px] card-shadow border border-sage/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setGettingStartedOpen(o => !o)}
                className="w-full flex items-center justify-between px-6 py-5 hover:bg-sage/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sage/10 text-sage border border-sage/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-[13px] font-black text-sage uppercase tracking-widest">Getting Started</span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", gettingStartedOpen && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {gettingStartedOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2 border-t border-slate-100">
                      {[
                        { icon: <User className="w-4 h-4" />, title: 'Set up your profile', desc: 'Add your name and school so reports sign off correctly.', action: onGoToProfile, badge: 'Start here' },
                        { icon: <Users className="w-4 h-4" />, title: 'Add your students', desc: 'Paste your whole class list and AI sorts it all out.', action: onGoToRoster, badge: null },
                        { icon: <PenLine className="w-4 h-4" />, title: 'Add your first note', desc: 'Tap a student, tap an indicator, done in 5 seconds.', action: onGoToPulse, badge: null },
                        { icon: <FileInput className="w-4 h-4" />, title: 'Compose your first report', desc: 'Turn your notes into a polished parent report with one tap of AI.', action: onGoToReport, badge: null },
                        { icon: <Calendar className="w-4 h-4" />, title: 'Upload your school calendar', desc: 'Get specials rotation and event reminders automatically.', action: onGoToCalendar, badge: 'Optional' },
                      ].map((step) => (
                        <button
                          key={step.title}
                          type="button"
                          onClick={step.action}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left group mt-2"
                        >
                          <div className="w-8 h-8 rounded-xl bg-sage/10 text-sage border border-sage/20 flex items-center justify-center flex-shrink-0">
                            {step.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-800">{step.title}</span>
                              {step.badge && (
                                <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${step.badge === 'Start here' ? 'bg-sage/10 text-sage' : 'bg-slate-100 text-slate-400'}`}>
                                  {step.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{step.desc}</p>
                          </div>
                          <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-4">
              <h3 className="text-[15px] font-black text-blue-600 uppercase tracking-widest">Account</h3>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                <p className="text-sm font-bold text-slate-700">{userEmail}</p>
              </div>
              <button
                onClick={async () => { await onSignOut(); }}
                className="flex items-center gap-2 text-sm font-black text-red-400 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
              {canInstallAndroid && (
                <button
                  onClick={triggerInstall}
                  className="flex items-center gap-2 text-sm font-black text-sage hover:text-sage-dark transition-colors"
                >
                  📲 Install App to Home Screen
                </button>
              )}
              {showIosInstructions && (
                <div className="text-xs text-slate-500 leading-relaxed">
                  <span className="font-black text-slate-600">Add to Home Screen:</span> tap the Share button <span>⬆️</span> in Safari, then tap <span className="font-black">Add to Home Screen</span>.
                </div>
              )}
            </div>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <h3 className="text-[15px] font-black text-blue-600 ml-1">Preferences</h3>
              <div className="space-y-1">
                <SettingsItem icon={<User />} label="Profile Settings" onClick={() => setView('profile')} />
                <SettingsItem icon={<MessageCircle />} label="Notifications" onClick={() => setView('notifications')} />
                <SettingsItem icon={<Sparkles />} label="Classroom Indicators" onClick={() => setView('indicators')} />
              </div>
            </div>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <h3 className="text-[15px] font-black text-blue-600 ml-1">Teacher Tools</h3>
              <div className="space-y-1">
                <SettingsItem icon={<Users2 />} label="Roster Management" onClick={() => setView('roster')} />
                <SettingsItem icon={<Folder />} label="Class Management" onClick={() => setView('classes')} />
                {isFullMode && <SettingsItem icon={<TrendingUp />} label="Quick Grade Table" onClick={() => setView('quick-grader')} />}
                {isFullMode && <SettingsItem icon={<Calendar />} label="School Calendar" onClick={() => setView('calendar')} />}
                {isFullMode && <SettingsItem icon={<School />} label="Rotation & Specials" onClick={() => setView('rotation')} />}
                <SettingsItem icon={<FileInput />} label="Data Management" onClick={() => setView('data-management')} />
                <SettingsItem icon={<MessageSquare />} label="Abbreviations" onClick={() => setView('abbreviations')} />
              </div>
            </div>

            {!isFullMode && (
              <div className="bg-linear-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-[32px] p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <p className="text-sm font-black text-violet-700">More tools are on the way</p>
                </div>
                <p className="text-[11px] text-violet-500 font-medium leading-relaxed">
                  As you build your documentation habit, advanced features unlock — including AI-generated reports, student goal tracking, behavior insights, and a full analytics dashboard.
                </p>
                <p className="text-[11px] text-violet-400 font-bold uppercase tracking-wide">Keep logging. Great things are coming.</p>
              </div>
            )}

            <StatsCard
              notesCreated={notes.length}
              reportsGenerated={reportsCount}
            />

            <a
              href="https://buymeacoffee.com/gregorylebh"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-start gap-4 p-6 bg-white rounded-[32px] card-shadow border border-slate-100 hover:border-amber-200 hover:shadow-amber-100/50 transition-all group no-print"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                <Coffee className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-700 group-hover:text-slate-900 transition-colors">Support the Project</p>
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-1">
                  Core features are free to use. If ShortHand is already saving you time, contributions help cover AI and hosting costs while the app continues to grow.
                </p>
                <span className="inline-flex items-center gap-1.5 mt-2.5 text-[11px] font-black text-amber-500 group-hover:text-amber-600 transition-colors">
                  Buy me a coffee <Coffee className="w-3 h-3" />
                </span>
              </div>
            </a>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-2 mt-6">
              <SettingsItem icon={<Shield />} label="Privacy & Security" onClick={() => setView('privacy')} />
            </div>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-4 mt-6">
              <h3 className="text-[15px] font-black text-slate-700 ml-1">Your Data</h3>
              <p className="text-[11px] text-slate-400 ml-1">Download a copy of everything ShortHand has stored for you.</p>
              <button
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) { toast.error('Not signed in.'); return; }
                  const userId = session.user.id;
                  const loadingToast = toast.loading('Gathering your data...');
                  try {
                    const [notes, students, classes, indicators, commTypes, calendarEvents, reports, settings, tasks, studentGoals] = await Promise.all([
                      supabase.from('notes').select('*').eq('user_id', userId),
                      supabase.from('students').select('*').eq('user_id', userId),
                      supabase.from('classes').select('*').eq('user_id', userId),
                      supabase.from('indicators').select('*').eq('user_id', userId),
                      supabase.from('comm_types').select('*').eq('user_id', userId),
                      supabase.from('calendar_events').select('*').eq('user_id', userId),
                      supabase.from('reports').select('*').eq('user_id', userId),
                      supabase.from('settings').select('*').eq('user_id', userId),
                      supabase.from('tasks').select('*').eq('user_id', userId),
                      supabase.from('student_goals').select('*').eq('user_id', userId),
                    ]);
                    const exportData = {
                      exported_at: new Date().toISOString(),
                      user_id: userId,
                      email: session.user.email,
                      data: {
                        classes: classes.data ?? [],
                        students: students.data ?? [],
                        notes: notes.data ?? [],
                        indicators: indicators.data ?? [],
                        comm_types: commTypes.data ?? [],
                        calendar_events: calendarEvents.data ?? [],
                        reports: reports.data ?? [],
                        settings: settings.data ?? [],
                        tasks: tasks.data ?? [],
                        student_goals: studentGoals.data ?? [],
                      },
                    };
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `shorthand-data-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.dismiss(loadingToast);
                    toast.success('Data exported!');
                  } catch (err: any) {
                    toast.dismiss(loadingToast);
                    toast.error(`Export failed: ${err.message}`);
                  }
                }}
                className="flex items-center gap-2 text-[11px] font-bold text-sage hover:text-sage-dark transition-colors px-3 py-1.5 rounded-xl hover:bg-sage/10"
              >
                <Database className="w-3.5 h-3.5" /> Export My Data
              </button>
            </div>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-4 mt-6">
              <h3 className="text-[15px] font-black text-terracotta ml-1">Danger Zone</h3>
              <p className="text-[11px] text-slate-400 ml-1">These actions are permanent and cannot be undone.</p>

              <div className="flex flex-col items-start gap-3 pt-2">
                <button
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to clear ALL notes for EVERY student? This cannot be undone.')) {
                      await supabase.from('notes').delete().not('id', 'is', null);
                      toast.success('All class notes cleared.');
                      onNoteAdded();
                    }
                  }}
                  className="flex items-center gap-2 text-[11px] font-bold text-terracotta/70 hover:text-terracotta transition-colors px-3 py-1.5 rounded-xl hover:bg-terracotta/10"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Class Reset
                </button>

                <button
                  onClick={async () => {
                    if (window.confirm('⚠️ This will erase ALL your student data, notes, and settings. Are you sure?')) {
                      await Promise.all([
                        supabase.from('notes').delete().not('id', 'is', null),
                        supabase.from('students').delete().not('id', 'is', null),
                        supabase.from('indicators').delete().not('id', 'is', null),
                        supabase.from('comm_types').delete().not('id', 'is', null),
                        supabase.from('classes').delete().not('id', 'is', null),
                        supabase.from('calendar_events').delete().not('id', 'is', null),
                        supabase.from('reports').delete().not('id', 'is', null),
                        supabase.from('settings').delete().not('key', 'is', null),
                      ]);
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="flex items-center gap-2 text-[11px] font-bold text-terracotta/70 hover:text-terracotta transition-colors px-3 py-1.5 rounded-xl hover:bg-terracotta/10"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Complete Factory Wipe
                </button>

                <button
                  onClick={async () => {
                    const confirmed = window.confirm('⚠️ PERMANENT: This will delete your account and ALL your data forever. You cannot undo this. Continue?');
                    if (!confirmed) return;
                    const doubleConfirmed = window.confirm('Last chance — are you absolutely sure you want to delete your account?');
                    if (!doubleConfirmed) return;
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) { toast.error('Not signed in.'); return; }
                    const loadingToast = toast.loading('Deleting your account...');
                    try {
                      const res = await fetch('https://muywwvbmpjotcffocyjb.supabase.co/functions/v1/delete-account', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      const json = await res.json();
                      toast.dismiss(loadingToast);
                      if (!res.ok) { toast.error(`Error: ${json.error}`); return; }
                      localStorage.clear();
                      toast.success('Account deleted. Goodbye!');
                      setTimeout(() => window.location.reload(), 1500);
                    } catch (err: any) {
                      toast.dismiss(loadingToast);
                      toast.error(`Error: ${err.message}`);
                    }
                  }}
                  className="flex items-center gap-2 text-[11px] font-bold text-red-500/70 hover:text-red-600 transition-colors px-3 py-1.5 rounded-xl hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete My Account
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 mt-4 pb-4">
              <img src="/icon-192.png" alt="ShortHand" className="w-12 h-12 rounded-2xl shadow-sm" />
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">ShortHand v2.0.0</p>
              <a
                href="https://www.getshorthand.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-sage/60 hover:text-sage transition-colors"
              >
                What can ShortHand do? →
              </a>
            </div>
          </motion.div>
        )}

        {view === 'roster' && (
          <motion.div
            key="roster"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <h3 className="text-[15px] font-black text-blue-600 ml-1">Roster Management</h3>

              <div className="space-y-4">
                {/* Filter by class */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1 mb-1 block">Filter by Class</label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setRosterFilter('all')}
                      className={cn("px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all", rosterFilter === 'all' ? "bg-sage/15 border-sage text-sage-dark" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100")}
                    >All</button>
                    {classes.map(c => (
                      <button
                        key={c}
                        onClick={() => setRosterFilter(c)}
                        className={cn("px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all", rosterFilter === c ? "bg-sage/15 border-sage text-sage-dark" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100")}
                      >{c}</button>
                    ))}
                  </div>
                </div>

                {/* Add new student */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1">Add Student</label>
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="New student name..."
                    className="w-full px-4 py-3 bg-white border border-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all shadow-inner"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newStudentSection}
                      onChange={(e) => setNewStudentSection(e.target.value)}
                      className="flex-1 px-4 py-3 bg-white border border-slate-100 rounded-full text-xs font-bold uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-2 focus:ring-sage/20 shadow-sm"
                    >
                      {classes.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddStudent}
                      disabled={isAddingStudent}
                      className="px-6 bg-sage text-white rounded-full shadow-md shadow-sage/20 hover:bg-sage-dark transition-all flex items-center justify-center disabled:opacity-50"
                    >
                      {isAddingStudent ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {rosterStudents.filter(s => rosterFilter === 'all' || s.class_period === rosterFilter).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-white rounded-[32px] border border-slate-100 card-shadow">
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0 mr-3">
                        {editingStudentNameId === s.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={editingStudentNameVal}
                            onChange={e => setEditingStudentNameVal(e.target.value)}
                            onBlur={async () => {
                              const trimmed = editingStudentNameVal.trim();
                              if (trimmed && trimmed !== s.name) await updateStudent(s.id, { name: trimmed });
                              setEditingStudentNameId(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') setEditingStudentNameId(null);
                            }}
                            className="w-full px-2 py-1 text-sm font-bold border border-sage rounded-lg focus:outline-none focus:ring-2 focus:ring-sage/30"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingStudentNameId(s.id); setEditingStudentNameVal(s.name); }}
                            className="text-sm font-bold text-slate-900 text-left hover:text-sage transition-colors"
                            title="Click to rename"
                          >
                            {s.name}
                          </button>
                        )}
                        <select
                          value={s.class_period || classes[0]}
                          onChange={(e) => handleUpdateSection(s.id, e.target.value)}
                          className="w-full px-3 py-1.5 bg-sage/8 border border-sage/20 rounded-xl text-xs font-bold text-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all cursor-pointer"
                        >
                          {classes.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => handleRemoveStudent(s.id, s.name)}
                        className="p-2 text-slate-300 hover:text-terracotta transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {rosterStudents.length === 0 && <p className="text-center py-10 text-xs text-slate-400 italic">No students in roster.</p>}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'classes' && (
          <motion.div
            key="classes"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <h3 className="text-[15px] font-black text-blue-600 ml-1">Class Management</h3>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. Homeroom, Science Block B..."
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-sage transition-all"
                  />
                  <button
                    onClick={handleAddClass}
                    disabled={isAddingClass}
                    className="px-6 bg-sage text-white rounded-xl shadow-md shadow-sage/20 hover:bg-sage-dark transition-all flex items-center justify-center disabled:opacity-50"
                  >
                    {isAddingClass ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>

                <div className="space-y-2">
                  {classes.map(c => (
                    <div key={c} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-sage/10 text-sage rounded-lg">
                          <Folder className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{c}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveClass(c)}
                        className="p-2 text-slate-300 hover:text-terracotta transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {classes.length === 0 && (
                    <div className="text-center py-8 space-y-1">
                      <p className="text-xs font-black text-slate-400">No classes yet.</p>
                      <p className="text-xs text-slate-400 leading-relaxed px-2">Add class periods above (e.g. <span className="font-bold">Homeroom</span>, <span className="font-bold">Period 1</span>, <span className="font-bold">AM</span>). Classes help organize notes and unlock the Class Summary view.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'indicators' && (
          <motion.div
            key="indicators"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <h3 className="text-[15px] font-black text-blue-600 ml-1">Manage Indicators</h3>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIndicator}
                    onChange={(e) => setNewIndicator(e.target.value)}
                    placeholder="New indicator label..."
                    className="flex-1 px-4 py-3 bg-white border border-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all shadow-inner"
                  />
                  <select
                    value={newIndicatorType}
                    onChange={(e) => setNewIndicatorType(e.target.value as any)}
                    className="px-4 py-3 bg-white border border-slate-100 rounded-full text-xs font-bold uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-2 focus:ring-sage/20 shadow-sm"
                  >
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="growth">Growth</option>
                  </select>
                  <button
                    onClick={addIndicator}
                    className="p-3 bg-sage text-white rounded-full shadow-md shadow-sage/20 hover:bg-sage-dark transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="indicators">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {indicators.map((i, index) => (
                          <Draggable key={i.label} {...({ draggableId: i.label, index } as any)}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="flex items-center justify-between p-4 bg-white rounded-[32px] border border-slate-100 group card-shadow"
                              >
                                <div className="flex items-center gap-3">
                                  <div {...provided.dragHandleProps} className="text-slate-300 hover:text-slate-400 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <div className={cn(
                                    "p-2 rounded-lg",
                                    i.type === 'positive' ? "bg-sage/10 text-sage" :
                                      i.type === 'neutral' ? "bg-amber-100 text-amber-600" :
                                        "bg-terracotta/10 text-terracotta"
                                  )}>
                                    {i.icon ?? getIconForName(i.icon_name, i.type)}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-700">{i.label}</span>
                                </div>
                                <button
                                  onClick={() => removeIndicator(i.label)}
                                  className="p-2 text-slate-300 hover:text-terracotta transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-100">
                <h3 className="text-[11px] font-bold text-blue-600 ml-1">Communication Types</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComm}
                    onChange={(e) => setNewComm(e.target.value)}
                    placeholder="New communication type..."
                    className="flex-1 px-4 py-3 bg-white border border-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all shadow-inner"
                  />
                  <button
                    onClick={addComm}
                    className="p-3 bg-blue-500 text-white rounded-full shadow-md shadow-blue-500/20 hover:bg-blue-600 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {commTypes.map(c => (
                    <div key={c.label} className="flex items-center justify-between p-4 bg-white rounded-[32px] border border-slate-100 card-shadow">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
                          {c.icon ?? getIconForName(c.icon_name, 'neutral')}
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{c.label}</span>
                      </div>
                      <button
                        onClick={() => removeComm(c.label)}
                        className="p-2 text-slate-300 hover:text-terracotta transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <button
                  onClick={resetToDefaults}
                  className="w-full py-4 bg-slate-100 text-slate-500 rounded-full font-bold text-[11px] hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <span className="w-4 h-4 text-current">&#x21BA;</span> Reset to Factory Settings
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'quick-grader' && (
          <motion.div
            key="quick-grader"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-sage/10 text-sage rounded-2xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Quick Grader</h3>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Automatic Grade Calculation</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1">Total Number of Questions</label>
                <input
                  type="number"
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="e.g. 25"
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-sage/5 focus:border-sage transition-all text-sm font-bold"
                />
              </div>

              {totalQuestions !== '' && totalQuestions > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 px-6 py-3 bg-slate-50 rounded-xl text-[11px] font-bold uppercase tracking-widest text-blue-600">
                    <span>Wrong</span>
                    <span className="text-center">Score</span>
                    <span className="text-right">Correct</span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto no-scrollbar space-y-2 pr-1">
                    {Array.from({ length: totalQuestions + 1 }).map((_, i) => {
                      const wrong = i;
                      const correct = totalQuestions - wrong;
                      const score = Math.round((correct / totalQuestions) * 100);

                      return (
                        <div key={wrong} className="grid grid-cols-3 px-6 py-4 bg-white border border-slate-50 rounded-2xl items-center hover:border-sage/20 transition-all">
                          <span className="text-sm font-bold text-slate-400">{wrong}</span>
                          <div className="flex justify-center">
                            <span className={cn(
                              "px-3 py-1 rounded-lg text-xs font-bold",
                              score >= 90 ? "bg-sage/10 text-sage" :
                                score >= 70 ? "bg-amber-100 text-amber-600" :
                                  "bg-terracotta/10 text-terracotta"
                            )}>
                              {score}%
                            </span>
                          </div>
                          <span className="text-sm font-bold text-slate-900 text-right">{correct}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <h3 className="text-[11px] font-bold text-blue-600 ml-1">Profile Settings</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1">Title</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setLocalTeacherTitle(t)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all",
                          localTeacherTitle === t
                            ? "bg-sage/15 border-sage text-sage-dark shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1">First Name</label>
                    <input
                      type="text"
                      value={localTeacherFirstName}
                      onChange={(e) => setLocalTeacherFirstName(e.target.value)}
                      placeholder="e.g. John"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1">Last Name</label>
                    <input
                      type="text"
                      value={localTeacherLastName}
                      onChange={(e) => setLocalTeacherLastName(e.target.value)}
                      placeholder="e.g. Smith"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1">Display Name (used in app header)</label>
                  <input
                    type="text"
                    value={localUserName}
                    onChange={(e) => setLocalUserName(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1">School Name</label>
                  <input
                    type="text"
                    value={localSchoolName}
                    onChange={(e) => setLocalSchoolName(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage transition-all"
                  />
                </div>
                {(localTeacherTitle || localTeacherLastName) && (
                  <p className="text-[11px] text-slate-400 ml-1">
                    Quick notes will be signed: <span className="font-bold text-slate-600">{localTeacherTitle} {localTeacherLastName || '___'}</span>
                  </p>
                )}
                <button
                  onClick={handleSaveProfile}
                  className="w-full py-4 bg-sage text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-sage-dark transition-all shadow-lg shadow-sage/20"
                >
                  Save Changes
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100">
              <h3 className="text-[11px] font-bold text-blue-600 ml-1 mb-6">Appearance</h3>
              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Dark Mode</h4>
                  <p className="text-[11px] text-slate-400 font-medium">Switch between light and dark theme</p>
                </div>
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    theme === 'dark' ? "bg-sage" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: theme === 'dark' ? 24 : 4 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <h3 className="text-[11px] font-bold text-blue-600 ml-1">Notifications</h3>

              {!notificationsSupported() && (
                <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  Notifications are not supported in this browser. Try opening the app in Chrome or Safari and adding it to your home screen.
                </p>
              )}

              {notificationsSupported() && (
                <div className="space-y-4">
                  {/* Daily Reminder */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Daily Logging Reminder</h4>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          Reminds you to log notes — skips if you already have
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const next = !notificationPrefs.dailyReminderEnabled;
                          if (next) {
                            const granted = await requestNotificationPermission();
                            if (!granted) {
                              toast.error('Please enable notifications in your browser or device settings first.');
                              return;
                            }
                          }
                          await saveNotificationPrefs({ ...notificationPrefs, dailyReminderEnabled: next });
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative flex-shrink-0",
                          notificationPrefs.dailyReminderEnabled ? "bg-sage" : "bg-slate-300"
                        )}
                      >
                        <motion.div
                          animate={{ x: notificationPrefs.dailyReminderEnabled ? 24 : 4 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>

                    {notificationPrefs.dailyReminderEnabled && (
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-500">Remind me at</label>
                        <input
                          type="time"
                          value={notificationPrefs.dailyReminderTime}
                          onChange={e => saveNotificationPrefs({ ...notificationPrefs, dailyReminderTime: e.target.value })}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-sage"
                        />
                      </div>
                    )}
                  </div>

                  {/* Calendar Event Reminder */}
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">School Event Reminder</h4>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Morning alert on days with events from your calendar
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const next = !notificationPrefs.calendarEventReminderEnabled;
                        if (next) {
                          const granted = await requestNotificationPermission();
                          if (!granted) {
                            toast.error('Please enable notifications in your browser or device settings first.');
                            return;
                          }
                        }
                        await saveNotificationPrefs({ ...notificationPrefs, calendarEventReminderEnabled: next });
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative flex-shrink-0",
                        notificationPrefs.calendarEventReminderEnabled ? "bg-sage" : "bg-slate-300"
                      )}
                    >
                      <motion.div
                        animate={{ x: notificationPrefs.calendarEventReminderEnabled ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>

                  {(notificationPrefs.dailyReminderEnabled || notificationPrefs.calendarEventReminderEnabled) && (
                    <p className="text-[11px] text-slate-400 font-medium px-1">
                      Notifications fire when the app is open or running in the background. For the most reliable delivery, add ShortHand to your home screen.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'privacy' && (
          <motion.div
            key="privacy"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <div>
                <h3 className="text-[11px] font-bold text-blue-600 ml-1 mb-1">Privacy & Security</h3>
                <p className="text-xs text-slate-400 ml-1">You're trusting this app with notes about real kids. Here's exactly how that data is protected.</p>
              </div>

              <div className="space-y-3">

                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 mb-0.5">Bank-Level Encryption</p>
                    <p className="text-xs text-slate-500 leading-relaxed">Every note is encrypted in transit using SSL/TLS — the same technology banks use. Data is stored securely in Supabase, not on your device. If anyone tried to intercept it, they'd see gibberish.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Ban className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 mb-0.5">No Data Selling. Ever.</p>
                    <p className="text-xs text-slate-500 leading-relaxed">This app is made by a teacher, not a data broker. Your notes and student information are never sold, shared, or used for advertising. Period.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 mb-0.5">The "First Name" Rule</p>
                    <p className="text-xs text-slate-500 leading-relaxed">The app doesn't require full legal names or student IDs. You can use initials or nicknames to keep your records even more private.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Database className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 mb-0.5">You Own the Data</p>
                    <p className="text-xs text-slate-500 leading-relaxed">If you decide to stop using the app, you can delete your account and every single note instantly from the Data Management section. We don't keep a copy.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 mb-0.5">AI with Boundaries</p>
                    <p className="text-xs text-slate-500 leading-relaxed">The AI only sees your notes when you explicitly ask it to write a report or answer a question. It doesn't watch you while you work.</p>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}

        {view === 'calendar' && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1">School Calendar</h3>
                {calendarEvents.length > 0 && (
                  <button
                    onClick={handleClearAllEvents}
                    className="flex items-center gap-1.5 text-terracotta hover:bg-terracotta/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <CalendarX className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Clear All</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <p className="text-sm text-slate-500">Upload your school calendar (PDF or Image) to view it quickly from the Notes screen.</p>

                {isScanningCalendar ? (
                  <div className="flex items-center gap-3 p-4 bg-sage/5 border border-dashed border-sage/20 rounded-2xl">
                    <Loader2 className="w-4 h-4 text-sage animate-spin flex-shrink-0" />
                    <span className="text-sm text-slate-500 flex-1">AI is scanning your calendar…</span>
                    <button
                      onClick={() => { calendarAbortRef.current?.abort(); }}
                      className="text-xs font-bold text-terracotta hover:text-red-600 transition-colors px-3 py-1.5 bg-red-50 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const controller = new AbortController();
                      calendarAbortRef.current = controller;
                      setIsScanningCalendar(true);
                      const loadingToast = toast.loading('Processing calendar with AI...');

                      const finishScan = (events: any[], signal: AbortSignal) => {
                        if (signal.aborted) return;
                        if (Array.isArray(events) && events.length > 0) {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const futureEvents = events.filter((event: any) => {
                            if (!event.date) return false;
                            const eventDate = new Date(event.date);
                            return !isNaN(eventDate.getTime()) && eventDate >= today;
                          });
                          futureEvents.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                          const eventsWithIds = futureEvents.map((event: any) => ({
                            ...event,
                            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                            user_id: userId,
                            created_at: new Date().toISOString(),
                            selected: false
                          }));
                          setDraftEvents(eventsWithIds);
                          toast.dismiss(loadingToast);
                          toast.success(`AI found ${futureEvents.length} upcoming draft events. Please review.`);
                          onNoteAdded();
                          setView('main');
                          setTimeout(() => setView('calendar'), 10);
                        } else {
                          toast.dismiss(loadingToast);
                          toast.warning('AI could not find any valid upcoming events in this file.');
                        }
                        setIsScanningCalendar(false);
                        calendarAbortRef.current = null;
                      };

                      try {
                        if (file.type.startsWith('image/')) {
                          const compressedFile = await imageCompression(file, { maxSizeMB: 1.9, maxWidthOrHeight: 1920, useWebWorker: true });
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const dataToStore = reader.result as string;
                            try { localStorage.setItem('school_calendar', dataToStore); } catch {}
                            const base64Data = dataToStore.split(',')[1];
                            const actualMimeType = dataToStore.substring(dataToStore.indexOf(':') + 1, dataToStore.indexOf(';'));
                            try {
                              const extractedEvents = await performSmartScan(base64Data, actualMimeType, controller.signal);
                              finishScan(extractedEvents, controller.signal);
                            } catch (err: any) {
                              if (err?.name === 'AbortError') { toast.dismiss(loadingToast); toast('Calendar scan cancelled'); }
                              else { toast.dismiss(loadingToast); toast.error(err.message || 'Error processing calendar data.'); }
                              setIsScanningCalendar(false);
                              calendarAbortRef.current = null;
                            }
                          };
                          reader.readAsDataURL(compressedFile);
                        } else if (file.type === 'application/pdf') {
                          if (file.size > 4 * 1024 * 1024) { toast.dismiss(loadingToast); toast.error('PDF must be smaller than 4MB'); setIsScanningCalendar(false); return; }
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const dataToStore = reader.result as string;
                            try { localStorage.setItem('school_calendar', dataToStore); } catch {}
                            const base64Data = dataToStore.split(',')[1];
                            const actualMimeType = dataToStore.substring(dataToStore.indexOf(':') + 1, dataToStore.indexOf(';'));
                            try {
                              const extractedEvents = await performSmartScan(base64Data, actualMimeType, controller.signal);
                              finishScan(extractedEvents, controller.signal);
                            } catch (err: any) {
                              if (err?.name === 'AbortError') { toast.dismiss(loadingToast); toast('Calendar scan cancelled'); }
                              else { toast.dismiss(loadingToast); toast.error(err.message || 'Error processing calendar data.'); }
                              setIsScanningCalendar(false);
                              calendarAbortRef.current = null;
                            }
                          };
                          reader.readAsDataURL(file);
                        } else {
                          toast.dismiss(loadingToast); toast.error('Please upload an image or PDF'); setIsScanningCalendar(false);
                        }
                      } catch (err) {
                        toast.dismiss(loadingToast); toast.error('Error processing file'); setIsScanningCalendar(false);
                      }
                    }}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sage/10 file:text-sage hover:file:bg-sage/20 transition-all"
                  />
                )}

                {localStorage.getItem('school_calendar') && (
                  <button
                    onClick={() => {
                      localStorage.removeItem('school_calendar');
                      toast.success('Calendar removed');
                      setView('main');
                      setTimeout(() => setView('calendar'), 10);
                    }}
                    className="w-full py-3 bg-terracotta/10 text-terracotta rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:bg-terracotta/20 transition-colors"
                  >
                    Remove Current Calendar
                  </button>
                )}

                {draftEvents && draftEvents.length > 0 && (
                  <div className="pt-6 space-y-4 border-t border-slate-100">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold text-terracotta ml-1 border-l-2 border-terracotta pl-2">Draft List (Review Required)</h4>
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{draftEvents.filter(e => e.selected).length} selected</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDraftEvents(draftEvents.map(e => ({ ...e, selected: true })))}
                          className="px-3 py-1.5 bg-sage/10 text-sage hover:bg-sage/20 rounded-lg text-[11px] font-bold transition-colors flex-1"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setDraftEvents(draftEvents.map(e => ({ ...e, selected: false })))}
                          className="px-3 py-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg text-[11px] font-bold transition-colors flex-1"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                      {draftEvents.map(event => (
                        <div key={event.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-terracotta/20 shadow-sm group">
                          <label className="flex items-center gap-3 cursor-pointer w-full">
                            <input
                              type="checkbox"
                              checked={event.selected}
                              onChange={() => {
                                setDraftEvents(draftEvents.map(e =>
                                  e.id === event.id ? { ...e, selected: !e.selected } : e
                                ));
                              }}
                              className="w-4 h-4 text-terracotta border-slate-300 rounded focus:ring-terracotta cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-bold truncate transition-colors", event.selected ? "text-slate-800" : "text-slate-400")}>{event.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn("text-[11px] font-medium", event.selected ? "text-terracotta" : "text-slate-400")}>{event.date}</span>
                                <span className="text-[8px] uppercase tracking-tighter bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">{event.type}</span>
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={saveDraftEvents}
                        className="flex-1 py-3 bg-terracotta text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-terracotta-dark shadow-md shadow-terracotta/20 transition-all"
                      >
                        Save Selected Dates
                      </button>
                      <button
                        onClick={() => setDraftEvents(null)}
                        className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual Add Event */}
                <div className="pt-2">
                  {!showAddEvent ? (
                    <button
                      onClick={() => setShowAddEvent(true)}
                      className="w-full py-3 border-2 border-dashed border-sage/30 text-sage hover:border-sage/60 hover:bg-sage/5 rounded-2xl font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <span className="text-base leading-none">+</span> Add Event Manually
                    </button>
                  ) : (
                    <div className="bg-sage/5 rounded-2xl p-4 space-y-3 border border-sage/20">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-sage">New Event</p>
                      <input
                        type="text"
                        value={newEventTitle}
                        onChange={e => setNewEventTitle(e.target.value)}
                        placeholder="Event name (e.g. Picture Day)"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-sage"
                      />
                      <input
                        type="date"
                        value={newEventDate}
                        onChange={e => setNewEventDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
                      />
                      <select
                        value={newEventType}
                        onChange={e => setNewEventType(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
                      >
                        {['Holiday', 'Early Dismissal', 'Conference', 'Other'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!newEventTitle.trim() || !newEventDate) {
                              toast.error('Please enter a title and date.');
                              return;
                            }
                            const newEvent: CalendarEvent = {
                              id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                              title: newEventTitle.trim(),
                              date: newEventDate,
                              type: newEventType,
                              user_id: userId,
                              created_at: new Date().toISOString(),
                            };
                            const updated = [...calendarEvents, newEvent].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                            setCalendarEvents(updated);
                            setNewEventTitle('');
                            setNewEventDate('');
                            setNewEventType('Other');
                            setShowAddEvent(false);
                            toast.success('Event added!');
                          }}
                          className="flex-1 py-2 bg-sage text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-sage-dark transition-colors"
                        >
                          Save Event
                        </button>
                        <button
                          onClick={() => { setShowAddEvent(false); setNewEventTitle(''); setNewEventDate(''); setNewEventType('Other'); }}
                          className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {calendarEvents.length === 0 && !draftEvents && (
                  <div className="pt-4 text-center space-y-1">
                    <p className="text-xs font-black text-slate-400">No school events added yet.</p>
                    <p className="text-xs text-slate-400 leading-relaxed">Upload a calendar image or PDF above to automatically import events, or add them manually. Upcoming events will show as a reminder on your home screen.</p>
                  </div>
                )}

                {calendarEvents.length > 0 && !draftEvents && (
                  <div className="pt-6 space-y-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-blue-600 ml-1">Your Calendar Events</h4>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                      {[...calendarEvents]
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map(event => {
                          const isEditing = editingEventId === event.id;
                          const isExpanded = expandedEvents.includes(event.id);

                          return (
                            <div key={event.id} className="flex flex-col bg-white rounded-[32px] border border-slate-100 shadow-sm hover:border-sage/30 transition-all overflow-hidden">
                              {isEditing ? (
                                <div className="p-4 space-y-3 bg-sage/5">
                                  <input
                                    type="text"
                                    value={editEventTitle}
                                    onChange={(e) => setEditEventTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-sage"
                                    placeholder="Event Title"
                                  />
                                  <input
                                    type="date"
                                    value={editEventDate}
                                    onChange={(e) => setEditEventDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-sage"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={handleUpdateEvent}
                                      className="flex-1 py-2 bg-sage text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-sage-dark transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingEventId(null)}
                                      className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div
                                    onClick={() => toggleEventExpand(event.id)}
                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                      <div className="w-10 h-10 bg-sage/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Calendar className="w-5 h-5 text-sage" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{event.title}</p>
                                        <p className="text-[11px] text-slate-400 font-medium">
                                          {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric'
                                          })}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                                        className="p-2 text-slate-300 hover:text-sage hover:bg-sage/10 rounded-lg transition-all"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                                        className="p-2 text-slate-300 hover:text-terracotta hover:bg-terracotta/10 rounded-lg transition-all"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                      <div className={cn("ml-1 transition-transform duration-200", isExpanded ? "rotate-180" : "")}>
                                        <ChevronDown className="w-4 h-4 text-slate-300" />
                                      </div>
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden bg-slate-50/50 border-t border-slate-50"
                                      >
                                        <div className="p-4 pt-2 pb-6 space-y-3">
                                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            AI Classification
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-full text-[11px] font-bold shadow-sm">
                                              {event.type}
                                            </span>
                                            <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-full text-[11px] font-bold shadow-sm">
                                              Priority: High
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                            This event was extracted from your school calendar and classified as <strong>{event.type}</strong>. You will see reminders for this date in your upcoming activity.
                                          </p>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {view === 'rotation' && (
          <motion.div
            key="rotation"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-sage/10 text-sage rounded-2xl">
                  <School className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Rotation & Specials</h3>
                  <p className="text-[11px] font-bold text-slate-400">Choose how your school tracks specials</p>
                </div>
              </div>

              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'off', label: 'Off', desc: 'Hide rotation' },
                  { id: 'letter-day', label: 'Letter Day', desc: 'A/B/C… from calendar' },
                  { id: 'day-of-week', label: 'Day of Week', desc: 'Mon=Art, Tue=PE…' },
                  { id: 'rolling', label: 'Rolling Days', desc: 'Cycles A→B→C→…' },
                ] as { id: SpecialsMode; label: string; desc: string }[]).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSpecialsMode(m.id)}
                    className={cn(
                      'p-4 rounded-2xl border-2 text-left transition-all',
                      specialsMode === m.id
                        ? 'border-sage bg-sage/5'
                        : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                    )}
                  >
                    <p className={cn('text-xs font-bold', specialsMode === m.id ? 'text-sage-dark' : 'text-slate-700')}>{m.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>

              {/* Off mode */}
              {specialsMode === 'off' && (
                <div className="bg-slate-50 rounded-[24px] p-6 border border-slate-100 text-center">
                  <p className="text-sm text-slate-400 font-medium">Rotation is disabled. The badge in the header will be hidden.</p>
                </div>
              )}

              {/* Letter Day mode */}
              {specialsMode === 'letter-day' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-[24px] p-6 border border-slate-100 space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-400">Specials by Letter</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {['A', 'B', 'C', 'D', 'E'].map(letter => (
                        <div key={letter} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <div className="w-8 h-8 bg-sage/10 text-sage rounded-lg flex items-center justify-center font-bold text-xs">{letter}</div>
                          <input
                            type="text"
                            value={specialsNames[letter] || ''}
                            onChange={(e) => handleUpdateSpecial(letter, e.target.value)}
                            placeholder="e.g. Art"
                            className="flex-1 text-sm font-medium focus:outline-none bg-transparent"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-sage/5 rounded-[24px] p-6 border border-dashed border-sage/20 space-y-4 text-center">
                    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm mx-auto border border-sage/10">
                      <Sparkles className="w-5 h-5 text-sage" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">AI Rotation Scan</h4>
                      <p className="text-xs text-slate-500 mt-1">Upload your school calendar to map dates to letter days automatically.</p>
                    </div>
                    {isScanningRotation ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-6 py-3 bg-orange-100 text-orange-500 rounded-full font-bold text-xs">
                          <Loader2 className="w-4 h-4 animate-spin" /> Scanning...
                        </div>
                        <button
                          onClick={() => { rotationAbortRef.current?.abort(); }}
                          className="text-xs font-bold text-terracotta hover:text-red-600 transition-colors px-4 py-3 bg-red-50 rounded-full"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="relative inline-block">
                        <input
                          type="file"
                          id="rotation-upload"
                          className="hidden"
                          accept="image/*,application/pdf"
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleScanRotation(file); }}
                        />
                        <label
                          htmlFor="rotation-upload"
                          className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-orange-400 to-orange-500 text-white rounded-full font-bold text-xs hover:brightness-110 transition-all shadow-lg shadow-orange-200/50 cursor-pointer"
                        >
                          <Upload className="w-4 h-4" /> Scan Calendar
                        </label>
                      </div>
                    )}
                    {Object.keys(rotationMapping).length > 0 && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setShowRotationMappingView(v => !v)}
                          className="text-[11px] font-bold text-sage flex items-center justify-center gap-1.5 hover:text-sage-dark transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {Object.keys(rotationMapping).length} date mappings active
                          <ChevronDown className={cn('w-3 h-3 transition-transform', showRotationMappingView && 'rotate-180')} />
                        </button>
                        <AnimatePresence>
                          {showRotationMappingView && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="max-h-64 overflow-y-auto space-y-1 pt-2 text-left">
                                {Object.entries(rotationMapping)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([date, letter]) => {
                                    const [y, m, d] = date.split('-').map(Number);
                                    const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                                    return (
                                      <div key={date} className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-slate-100 text-xs">
                                        <span className="text-slate-500">{label}</span>
                                        <span className="font-black text-orange-500 w-6 text-center">{letter}</span>
                                      </div>
                                    );
                                  })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Day of Week mode */}
              {specialsMode === 'day-of-week' && (
                <div className="bg-slate-50 rounded-[24px] p-6 border border-slate-100 space-y-4">
                  <h4 className="text-[11px] font-bold text-slate-400">Assign a Special to Each Day</h4>
                  <div className="space-y-3">
                    {[
                      { key: '1', label: 'Monday' },
                      { key: '2', label: 'Tuesday' },
                      { key: '3', label: 'Wednesday' },
                      { key: '4', label: 'Thursday' },
                      { key: '5', label: 'Friday' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                        <div className="w-20 text-xs font-bold text-slate-500 shrink-0">{label}</div>
                        <input
                          type="text"
                          value={dayOfWeekSpecials[key] || ''}
                          onChange={(e) => setDayOfWeekSpecials({ ...dayOfWeekSpecials, [key]: e.target.value })}
                          placeholder="e.g. Art"
                          className="flex-1 text-sm font-medium focus:outline-none bg-transparent"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rolling School Days mode */}
              {specialsMode === 'rolling' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-[24px] p-6 border border-slate-100 space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-400">Rolling Cycle Setup</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Start Date (Day A)</label>
                        <input
                          type="date"
                          value={rollingStartDate}
                          onChange={(e) => saveRollingConfig(e.target.value, rollingLetterCount)}
                          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-sage w-full"
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5">Pick the first day of your school year, or any day you know was Day A.</p>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Number of Days in Cycle</label>
                        <div className="flex gap-2 flex-wrap">
                          {[4, 5, 6, 7, 8].map(n => (
                            <button
                              key={n}
                              onClick={() => saveRollingConfig(rollingStartDate, n)}
                              className={cn(
                                'px-4 py-2 rounded-xl text-xs font-bold transition-all',
                                rollingLetterCount === n ? 'bg-sage text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-sage/40'
                              )}
                            >
                              {n} days ({Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)).join('-')})
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-[24px] p-6 border border-slate-100 space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-400">Specials by Letter</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Array.from({ length: rollingLetterCount }, (_, i) => String.fromCharCode(65 + i)).map(letter => (
                        <div key={letter} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <div className="w-8 h-8 bg-sage/10 text-sage rounded-lg flex items-center justify-center font-bold text-xs">{letter}</div>
                          <input
                            type="text"
                            value={specialsNames[letter] || ''}
                            onChange={(e) => handleUpdateSpecial(letter, e.target.value)}
                            placeholder="e.g. Art"
                            className="flex-1 text-sm font-medium focus:outline-none bg-transparent"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400">Snow day? Use the "Override Today" option in the header to correct the cycle for the day.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'data-management' && (
          <motion.div
            key="data-management"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
              <span className="text-amber-400 text-lg flex-shrink-0">💡</span>
              <div>
                <p className="text-xs font-black text-amber-700">Started with initials or nicknames?</p>
                <p className="text-xs text-amber-600 mt-0.5 leading-snug">You can update any student's name anytime. Go to <button type="button" onClick={() => setView('roster')} className="font-black underline">Roster Management</button> and tap a name to edit it.</p>
              </div>
            </div>

            <ImportScreen onImportComplete={() => { onImportComplete(); setView('main'); }} classes={classes} students={students} addStudent={addStudent} updateStudent={updateStudent} userId={userId} />

          </motion.div>
        )}
        {view === 'abbreviations' && (
          <motion.div
            key="abbreviations"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <button onClick={() => setView('main')} className="flex items-center gap-2 text-slate-400 hover:text-sage transition-colors mb-2">
              <X className="w-4 h-4" />
              <span className="text-[11px] font-bold">Back to Settings</span>
            </button>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Abbreviations</h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Shortcuts auto-expand when you save a note</p>
                </div>
              </div>

              {/* Add new abbreviation */}
              <div className="space-y-3 bg-slate-50 rounded-2xl p-4">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wide">Add New</p>
                <div className="flex flex-col gap-2">
                  <input
                    value={newAbbr}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAbbr(e.target.value)}
                    placeholder="Shortcut (e.g. ss)"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <input
                    value={newExpansion}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewExpansion(e.target.value)}
                    placeholder="Expands to (e.g. Social Studies)"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-500 font-medium cursor-pointer select-none">
                    <div
                      onClick={() => setNewCaseSensitive((v: boolean) => !v)}
                      className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${newCaseSensitive ? 'bg-teal-500' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${newCaseSensitive ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    Case-sensitive
                  </label>
                  <button
                    onClick={() => {
                      if (!newAbbr.trim() || !newExpansion.trim()) return;
                      const updated = [...abbreviations, { id: Date.now().toString(36), abbreviation: newAbbr.trim(), expansion: newExpansion.trim(), caseSensitive: newCaseSensitive }];
                      saveAbbreviations(updated);
                      setNewAbbr('');
                      setNewExpansion('');
                      setNewCaseSensitive(false);
                      toast.success('Abbreviation saved');
                    }}
                    className="px-4 py-1.5 bg-teal-500 text-white text-sm font-black rounded-full hover:bg-teal-600 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* AI Suggest */}
              <button
                onClick={async () => {
                  if (notes.length === 0) { toast.error('No notes yet to analyze'); return; }
                  setIsSuggestingAbbr(true);
                  try {
                    const suggestions = await suggestAbbreviations(notes.map(n => n.content));
                    if (suggestions.length === 0) { toast.info('No new abbreviations found in your notes'); return; }
                    const existing = new Set(abbreviations.map(a => a.abbreviation.toLowerCase()));
                    const newOnes = suggestions.filter(s => !existing.has(s.abbreviation.toLowerCase()));
                    if (newOnes.length === 0) { toast.info('All suggestions already added'); return; }
                    const added = newOnes.map(s => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2), abbreviation: s.abbreviation, expansion: s.expansion, caseSensitive: false }));
                    saveAbbreviations([...abbreviations, ...added]);
                    toast.success(`Added ${added.length} AI suggestion${added.length > 1 ? 's' : ''} — review and delete any that don't apply`);
                  } catch {
                    toast.error('AI suggestion failed');
                  } finally {
                    setIsSuggestingAbbr(false);
                  }
                }}
                disabled={isSuggestingAbbr}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-teal-200 rounded-2xl text-teal-600 text-sm font-black hover:bg-teal-50 transition-colors disabled:opacity-50"
              >
                {isSuggestingAbbr ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isSuggestingAbbr ? 'Analyzing your notes…' : 'Suggest from My Notes (AI)'}
              </button>

              {/* Existing abbreviations */}
              {abbreviations.length === 0 ? (
                <div className="text-center py-5 space-y-1">
                  <p className="text-sm font-black text-slate-400">No shortcuts yet.</p>
                  <p className="text-xs text-slate-400 leading-relaxed">Create quick expansions to speed up note-taking — e.g. <span className="font-bold">hwk</span> → <span className="font-bold">didn't complete homework</span>. Or tap <span className="font-bold text-orange-400">Suggest from My Notes</span> to let AI find common ones automatically.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wide">Active ({abbreviations.length})</p>
                  {abbreviations.map(abbr => (
                    <div key={abbr.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl group">
                      <span className="text-sm font-black text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200 min-w-[48px] text-center">{abbr.abbreviation}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      <span className="flex-1 text-sm text-slate-600 font-medium">{abbr.expansion}</span>
                      {abbr.caseSensitive && <span className="text-[11px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Aa</span>}
                      <button
                        onClick={() => { saveAbbreviations(abbreviations.filter(a => a.id !== abbr.id)); toast.success('Removed'); }}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
