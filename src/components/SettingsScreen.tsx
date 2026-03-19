import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import imageCompression from 'browser-image-compression';
import {
  User, MessageCircle, Shield, Sparkles, Users2, Folder, TrendingUp, Calendar,
  School, FileInput, MessageSquare, Trash2, Plus, X, Loader2, CheckCircle2,
  GripVertical, CalendarX, Edit2, ChevronDown, Upload, ArrowRight, Coffee
} from 'lucide-react';
import { toast } from 'sonner';
import { Note, Student, CalendarEvent } from '../types';
import { Abbreviation } from '../utils/expandAbbreviations';
import {
  performSmartScan, extractRotationMapping, suggestAbbreviations
} from '../lib/gemini';
import { migrateFromLocalStorage } from '../utils/migrateFromLocalStorage';
import { supabase } from '../lib/supabase';
import ImportScreen from './ImportScreen';
import { cn } from '../utils/cn';


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
  const { Smile, Meh, Frown, Activity, TrendingUp: TU, AlertCircle, Users, Users2: U2, Clock, FileInput: FI, MessageSquare: MsgSq, Mail, Phone, Sparkles: Sp, CheckCircle2: CC2 } = require('lucide-react');
  switch (name) {
    case 'Sparkles': return <Sp className="w-4 h-4" />;
    case 'CheckCircle2': return <CC2 className="w-4 h-4" />;
    case 'TrendingUp': return <TU className="w-4 h-4" />;
    case 'AlertCircle': return <AlertCircle className="w-4 h-4" />;
    case 'Users2': return <U2 className="w-4 h-4" />;
    case 'Clock': return <Clock className="w-4 h-4" />;
    case 'FileInput': return <FI className="w-4 h-4" />;
    case 'Activity': return <Activity className="w-4 h-4" />;
    case 'Smile': return <Smile className="w-4 h-4 text-emerald-600" />;
    case 'Meh': return <Meh className="w-4 h-4 text-amber-500" />;
    case 'Frown': return <Frown className="w-4 h-4 text-red-500" />;
    case 'ParentSquare': return <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-blue-500 text-white text-[9px] font-black leading-none">PS</span>;
    case 'Users': return <Users className="w-4 h-4 text-blue-500" />;
    case 'MessageSquare': return <MsgSq className="w-4 h-4 text-blue-500" />;
    case 'Mail': return <Mail className="w-4 h-4 text-blue-500" />;
    case 'Phone': return <Phone className="w-4 h-4 text-blue-500" />;
    default:
      if (type === 'positive') return <Smile className="w-4 h-4 text-emerald-600" />;
      if (type === 'growth') return <Frown className="w-4 h-4 text-red-500" />;
      if (type === 'neutral') return <Meh className="w-4 h-4 text-amber-500" />;
      return <MsgSq className="w-4 h-4 text-blue-500" />;
  }
};

function SettingsItem({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  const { ChevronRight } = require('lucide-react');
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-slate-50 rounded-2xl transition-all group"
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
  calendarEvents: CalendarEvent[];
  setCalendarEvents: (val: CalendarEvent[]) => void;
  rotationMapping: Record<string, string>;
  setRotationMapping: (val: Record<string, string>) => void;
  specialsNames: Record<string, string>;
  setSpecialsNames: (val: Record<string, string>) => void;
  students: Student[];
  addStudent: (student: Omit<Student, 'id'>) => Promise<Student | null>;
  deleteStudent: (id: string) => Promise<void>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  theme: 'light' | 'dark';
  setTheme: (val: 'light' | 'dark') => void;
  abbreviations: Abbreviation[];
  saveAbbreviations: (val: Abbreviation[]) => Promise<void>;
  notes: Note[];
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
  calendarEvents,
  setCalendarEvents,
  rotationMapping,
  setRotationMapping,
  specialsNames,
  setSpecialsNames,
  students,
  addStudent,
  deleteStudent,
  updateStudent,
  theme,
  setTheme,
  abbreviations,
  saveAbbreviations,
  notes,
}: SettingsScreenProps) {
  const [view, setView] = useState<'main' | 'indicators' | 'profile' | 'notifications' | 'privacy' | 'quick-grader' | 'data-management' | 'roster' | 'classes' | 'calendar' | 'rotation' | 'abbreviations'>('main');
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
  const [draftEvents, setDraftEvents] = useState<(CalendarEvent & { selected: boolean })[] | null>(null);
  const [newComm, setNewComm] = useState('');
  const [isScanningRotation, setIsScanningRotation] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);

  const handleUpdateSpecial = (letter: string, special: string) => {
    setSpecialsNames({ ...specialsNames, [letter]: special });
  };

  const handleScanRotation = async (file: File) => {
    setIsScanningRotation(true);
    const loadingToast = toast.loading('AI is extracting rotation mappings...');
    try {
      const processFileData = async (processFile: File | Blob, isPdf = false) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          const base64Data = dataUrl.split(',')[1];
          const mimeType = isPdf ? 'application/pdf' : dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));

          const mapping = await extractRotationMapping(base64Data, mimeType);

          if (mapping && Object.keys(mapping).length > 0) {
            setRotationMapping(mapping);
            toast.success(`Succesfully extracted ${Object.keys(mapping).length} date mappings!`, { id: loadingToast });
          } else {
            toast.error('AI could not find a rotation schedule in this file.', { id: loadingToast });
          }
          setIsScanningRotation(false);
        };
        reader.readAsDataURL(processFile);
      };

      if (file.type === 'application/pdf') {
        if (file.size > 4 * 1024 * 1024) {
          toast.error('PDF must be smaller than 4MB', { id: loadingToast });
          setIsScanningRotation(false);
          return;
        }
        await processFileData(file, true);
      } else if (file.type.startsWith('image/')) {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 1.9,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        });
        await processFileData(compressedFile);
      } else {
        toast.error('Please upload an image or PDF', { id: loadingToast });
        setIsScanningRotation(false);
      }
    } catch (err) {
      console.error('Rotation scan error:', err);
      toast.error('Failed to scan rotation schedule.', { id: loadingToast });
      setIsScanningRotation(false);
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

  // Notifications state
  const [appAlerts, setAppAlerts] = useState(true);

  // Roster Management state
  const [rosterStudents, setRosterStudents] = useState<Student[]>([]);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentSection, setNewStudentSection] = useState<string>(classes[0] || 'AM');
  const [isAddingStudent, setIsAddingStudent] = useState(false);

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
        user_id: 'local',
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
      await updateStudent(id, { class_id: section, class_period: section });
      toast.success('Student section updated');
      fetchRoster();
      onImportComplete();
    } catch (err: any) {
      console.error('Update section error:', err);
      toast.error('Failed to update section');
    }
  };

  const handleSaveProfile = () => {
    setUserName(userName);
    setSchoolName(schoolName);
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
      user_id: 'local',
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
      user_id: 'local',
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
            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <h3 className="text-[13px] font-black text-slate-400 ml-1">Account</h3>
              <div className="space-y-1">
                <SettingsItem icon={<User />} label="Profile Settings" onClick={() => setView('profile')} />
                <SettingsItem icon={<MessageCircle />} label="Notifications" onClick={() => setView('notifications')} />
                <SettingsItem icon={<Shield />} label="Privacy & Security" onClick={() => setView('privacy')} />
                <SettingsItem icon={<Sparkles />} label="Classroom Indicators" onClick={() => setView('indicators')} />
              </div>
            </div>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6">
              <h3 className="text-[13px] font-black text-slate-400 ml-1">Teacher Tools</h3>
              <div className="space-y-1">
                <SettingsItem icon={<Users2 />} label="Roster Management" onClick={() => setView('roster')} />
                <SettingsItem icon={<Folder />} label="Class Management" onClick={() => setView('classes')} />
                <SettingsItem icon={<TrendingUp />} label="Quick Grade Table" onClick={() => setView('quick-grader')} />
                <SettingsItem icon={<Calendar />} label="School Calendar" onClick={() => setView('calendar')} />
                <SettingsItem icon={<School />} label="Rotation & Specials" onClick={() => setView('rotation')} />
                <SettingsItem icon={<FileInput />} label="Data Management" onClick={() => setView('data-management')} />
                <SettingsItem icon={<MessageSquare />} label="Abbreviations" onClick={() => setView('abbreviations')} />
              </div>
            </div>

            <a
              href="https://buymeacoffee.com/YOUR_USERNAME"
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
                  Core features are free to use. If Classroom Pulse is already saving you time, contributions help cover AI and hosting costs while the app continues to grow.
                </p>
                <span className="inline-flex items-center gap-1.5 mt-2.5 text-[11px] font-black text-amber-500 group-hover:text-amber-600 transition-colors">
                  Buy me a coffee <Coffee className="w-3 h-3" />
                </span>
              </div>
            </a>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-6 mt-6">
              <h3 className="text-[13px] font-black text-terracotta ml-1">Danger Zone</h3>

              <button
                onClick={async () => {
                  if (window.confirm('Are you sure you want to clear ALL notes for EVERY student? This cannot be undone.')) {
                    await supabase.from('notes').delete().not('id', 'is', null);
                    toast.success('All class notes cleared.');
                    onNoteAdded();
                  }
                }}
                className="w-full py-2 bg-terracotta/10 border-2 border-terracotta/20 text-terracotta rounded-full font-black text-sm hover:bg-terracotta hover:text-white transition-all shadow-sm flex items-center justify-center gap-3"
              >
                <Trash2 className="w-4 h-4" /> Class Reset
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
                className="w-full py-2 bg-white border-2 border-terracotta/20 text-terracotta rounded-full font-black text-sm hover:bg-terracotta hover:text-white transition-all shadow-sm flex items-center justify-center gap-3"
              >
                <Trash2 className="w-4 h-4" /> Complete Factory Wipe
              </button>
            </div>

            <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-4 pb-4">Classroom Pulse v2.0.0</p>
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
              <h3 className="text-[13px] font-black text-slate-400 ml-1">Roster Management</h3>

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
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
                        <option key={c} value={c}>Class Period {c}</option>
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
                  {rosterStudents.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-white rounded-[32px] border border-slate-100 card-shadow">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{s.name}</span>
                        <div className="flex gap-2 mt-1 overflow-x-auto no-scrollbar max-w-[200px]">
                          {classes.map(c => (
                            <button
                              key={c}
                              onClick={() => handleUpdateSection(s.id, c)}
                              className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap",
                                (typeof s.class_id === 'object' ? (s.class_id as any)?.label || (s.class_id as any)?.value : s.class_id) === c ? "bg-sage text-white border-sage" : "bg-white text-slate-400 border-slate-100 hover:border-sage/30"
                              )}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveStudent(s.id, s.name)}
                        className="p-2 text-slate-300 hover:text-terracotta transition-colors"
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
              <h3 className="text-[13px] font-black text-slate-400 ml-1">Class Management</h3>

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
                  {classes.length === 0 && <p className="text-center py-10 text-xs text-slate-400 italic">No classes created.</p>}
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
              <h3 className="text-[13px] font-black text-slate-400 ml-1">Manage Indicators</h3>

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
                <h3 className="text-[11px] font-bold text-slate-400 ml-1">Communication Types</h3>
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Automatic Grade Calculation</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Total Number of Questions</label>
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
                  <div className="grid grid-cols-3 px-6 py-3 bg-slate-50 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400">
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
              <h3 className="text-[11px] font-bold text-slate-400 ml-1">Profile Settings</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">School Name</label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sage/20 focus:border-sage transition-all"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  className="w-full py-4 bg-sage text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-sage-dark transition-all shadow-lg shadow-sage/20"
                >
                  Save Changes
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100">
              <h3 className="text-[11px] font-bold text-slate-400 ml-1 mb-6">Appearance</h3>
              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Dark Mode</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Switch between light and dark theme</p>
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
              <h3 className="text-[11px] font-bold text-slate-400 ml-1">Notifications</h3>

              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">App Alerts</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Receive push notifications for student updates</p>
                </div>
                <button
                  onClick={() => setAppAlerts(!appAlerts)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    appAlerts ? "bg-sage" : "bg-slate-300"
                  )}
                >
                  <motion.div
                    animate={{ x: appAlerts ? 24 : 4 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>
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
              <h3 className="text-[11px] font-bold text-slate-400 ml-1">Privacy & Security</h3>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  Your data is saved locally in this browser using LocalStorage. It never leaves your device and is not sent to any cloud service. To back up your data, use the Data Management section.
                </p>
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
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">School Calendar</h3>
                {calendarEvents.length > 0 && (
                  <button
                    onClick={handleClearAllEvents}
                    className="flex items-center gap-1.5 text-terracotta hover:bg-terracotta/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <CalendarX className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Clear All</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <p className="text-sm text-slate-500">Upload your school calendar (PDF or Image) to view it quickly from the Pulse screen.</p>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const loadingToast = toast.loading('Processing calendar with AI...');
                    try {
                      let dataToStore = '';
                      if (file.type.startsWith('image/')) {
                        const compressedFile = await imageCompression(file, {
                          maxSizeMB: 1.9,
                          maxWidthOrHeight: 1920,
                          useWebWorker: true
                        });
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          dataToStore = reader.result as string;
                          const base64Data = dataToStore.split(',')[1];
                          const actualMimeType = dataToStore.substring(dataToStore.indexOf(':') + 1, dataToStore.indexOf(';'));
                          try {
                            try {
                              localStorage.setItem('school_calendar', dataToStore);
                            } catch (e) {
                              console.warn("Could not save calendar image to localStorage due to quota limits.");
                            }

                            // Call Gemini 3.1 Flash for Smart Scan
                            const extractedEvents = await performSmartScan(base64Data, actualMimeType);

                            if (Array.isArray(extractedEvents) && extractedEvents.length > 0) {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);

                              const futureEvents = extractedEvents.filter((event: any) => {
                                if (!event.date) return false;
                                const eventDate = new Date(event.date);
                                return !isNaN(eventDate.getTime()) && eventDate >= today;
                              });

                              futureEvents.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                              const eventsWithIds = futureEvents.map((event: any) => ({
                                ...event,
                                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                                user_id: 'local',
                                created_at: new Date().toISOString(),
                                selected: false
                              }));
                              setDraftEvents(eventsWithIds);
                              toast.success(`AI found ${futureEvents.length} upcoming draft events. Please review.`);
                            } else {
                              toast.warning('AI could not find any valid upcoming events in this file.');
                            }

                            toast.dismiss(loadingToast);
                            toast.success('Calendar saved successfully');
                            onNoteAdded();
                            setView('main');
                            setTimeout(() => setView('calendar'), 10);
                          } catch (err: any) {
                            console.error(err);
                            toast.dismiss(loadingToast);
                            toast.error(err.message || 'Error processing calendar data.');
                          }
                        };
                        reader.readAsDataURL(compressedFile);
                      } else if (file.type === 'application/pdf') {
                        if (file.size > 4 * 1024 * 1024) {
                          toast.dismiss(loadingToast);
                          toast.error('PDF must be smaller than 4MB');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          dataToStore = reader.result as string;
                          const base64Data = dataToStore.split(',')[1];
                          const actualMimeType = dataToStore.substring(dataToStore.indexOf(':') + 1, dataToStore.indexOf(';'));
                          try {
                            try {
                              localStorage.setItem('school_calendar', dataToStore);
                            } catch (e) {
                              console.warn("Could not save calendar PDF to localStorage due to quota limits.");
                            }

                            // Call Gemini 3.1 Flash for Smart Scan
                            const extractedEvents = await performSmartScan(base64Data, actualMimeType);

                            if (Array.isArray(extractedEvents) && extractedEvents.length > 0) {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);

                              const futureEvents = extractedEvents.filter((event: any) => {
                                if (!event.date) return false;
                                const eventDate = new Date(event.date);
                                return !isNaN(eventDate.getTime()) && eventDate >= today;
                              });

                              futureEvents.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

                              const eventsWithIds = futureEvents.map((event: any) => ({
                                ...event,
                                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                                user_id: 'local',
                                created_at: new Date().toISOString(),
                                selected: false
                              }));
                              setDraftEvents(eventsWithIds);
                              toast.success(`AI found ${futureEvents.length} upcoming draft events. Please review.`);
                            } else {
                              toast.warning('AI could not find any valid upcoming events in this file.');
                            }

                            toast.dismiss(loadingToast);
                            toast.success('Calendar saved successfully');
                            onNoteAdded();
                            setView('main');
                            setTimeout(() => setView('calendar'), 10);
                          } catch (err: any) {
                            console.error(err);
                            toast.dismiss(loadingToast);
                            toast.error(err.message || 'Error processing calendar data.');
                          }
                        };
                        reader.readAsDataURL(file);
                      } else {
                        toast.dismiss(loadingToast);
                        toast.error('Please upload an image or PDF');
                      }
                    } catch (err) {
                      console.error(err);
                      toast.dismiss(loadingToast);
                      toast.error('Error processing file');
                    }
                  }}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sage/10 file:text-sage hover:file:bg-sage/20 transition-all"
                />

                {localStorage.getItem('school_calendar') && (
                  <button
                    onClick={() => {
                      localStorage.removeItem('school_calendar');
                      toast.success('Calendar removed');
                      setView('main');
                      setTimeout(() => setView('calendar'), 10);
                    }}
                    className="w-full py-3 bg-terracotta/10 text-terracotta rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-terracotta/20 transition-colors"
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
                          className="px-3 py-1.5 bg-sage/10 text-sage hover:bg-sage/20 rounded-lg text-[10px] font-bold transition-colors flex-1"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setDraftEvents(draftEvents.map(e => ({ ...e, selected: false })))}
                          className="px-3 py-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg text-[10px] font-bold transition-colors flex-1"
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
                                <span className={cn("text-[10px] font-medium", event.selected ? "text-terracotta" : "text-slate-400")}>{event.date}</span>
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
                        className="flex-1 py-3 bg-terracotta text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-terracotta-dark shadow-md shadow-terracotta/20 transition-all"
                      >
                        Save Selected Dates
                      </button>
                      <button
                        onClick={() => setDraftEvents(null)}
                        className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {calendarEvents.length > 0 && !draftEvents && (
                  <div className="pt-6 space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Your Calendar Events</h4>
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
                                      className="flex-1 py-2 bg-sage text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-sage-dark transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingEventId(null)}
                                      className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
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
                                            <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-full text-[10px] font-bold shadow-sm">
                                              {event.type}
                                            </span>
                                            <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-full text-[10px] font-bold shadow-sm">
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
                  <p className="text-[11px] font-bold text-slate-400">Configure your daily rotation</p>
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <div className="bg-slate-50 rounded-[24px] p-6 border border-slate-100 space-y-4">
                  <h4 className="text-[11px] font-bold text-slate-400">Specials Mapping</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['A', 'B', 'C', 'D', 'E'].map(letter => (
                      <div key={letter} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                        <div className="w-8 h-8 bg-sage/10 text-sage rounded-lg flex items-center justify-center font-bold text-xs">
                          {letter}
                        </div>
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

                <div className="bg-sage/5 rounded-[24px] p-8 border border-dashed border-sage/20 space-y-4 text-center">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mx-auto border border-sage/10">
                    <Sparkles className="w-6 h-6 text-sage" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">AI Rotation Scan</h4>
                    <p className="text-xs text-slate-500 mt-1">Upload your calendar to map dates to letter days for the whole year.</p>
                  </div>

                  <div className="relative inline-block">
                    <input
                      type="file"
                      id="rotation-upload"
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleScanRotation(file);
                      }}
                      disabled={isScanningRotation}
                    />
                    <label
                      htmlFor="rotation-upload"
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 bg-linear-to-r from-orange-400 to-orange-500 text-white rounded-full font-bold text-xs hover:brightness-110 transition-all shadow-lg shadow-orange-200/50 cursor-pointer",
                        isScanningRotation && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isScanningRotation ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Scan Calendar
                        </>
                      )}
                    </label>
                  </div>

                  {Object.keys(rotationMapping).length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] font-bold text-sage flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {Object.keys(rotationMapping).length} mappings active
                      </p>
                    </div>
                  )}
                </div>
              </div>
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

            <ImportScreen onImportComplete={() => { onImportComplete(); setView('main'); }} classes={classes} students={students} addStudent={addStudent} updateStudent={updateStudent} />

            <div className="bg-white rounded-[32px] p-8 card-shadow border border-slate-100 space-y-4">
              <div>
                <h3 className="text-[13px] font-black text-slate-400 ml-1">Migrate to Supabase</h3>
                <p className="text-xs text-slate-400 mt-2 ml-1 leading-relaxed">
                  One-time migration. Copies all your students, notes, tasks, and settings from this browser into the cloud database. Your local data stays untouched as a backup.
                </p>
              </div>

              {migrationDone && (
                <div className="flex items-center gap-2 px-4 py-3 bg-sage/10 border border-sage/20 rounded-2xl">
                  <CheckCircle2 className="w-4 h-4 text-sage flex-shrink-0" />
                  <span className="text-xs font-bold text-sage">Migration complete! Check Supabase Table Editor to verify your data.</span>
                </div>
              )}

              <button
                disabled={isMigrating || migrationDone}
                onClick={async () => {
                  if (!window.confirm('This will copy all your localStorage data into Supabase. Run this once. Continue?')) return;
                  setIsMigrating(true);
                  const loadingToast = toast.loading('Migrating your data to Supabase...');
                  try {
                    const result = await migrateFromLocalStorage();
                    toast.dismiss(loadingToast);
                    if (result.errors.length > 0) {
                      toast.error(`Migration had ${result.errors.length} error(s). Check console for details.`, { duration: 8000 });
                    } else {
                      toast.success(`Migrated: ${result.students} students, ${result.notes} notes, ${result.tasks} tasks.`, { duration: 6000 });
                      setMigrationDone(true);
                    }
                  } catch (err) {
                    toast.dismiss(loadingToast);
                    toast.error('Migration failed. Check console for details.');
                    console.error('Migration error:', err);
                  } finally {
                    setIsMigrating(false);
                  }
                }}
                className="w-full py-3 bg-sage text-white rounded-full font-black text-sm hover:bg-sage-dark transition-all shadow-md shadow-sage/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMigrating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Migrating...</>
                ) : migrationDone ? (
                  <><CheckCircle2 className="w-4 h-4" /> Migration Complete</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Migrate localStorage → Supabase</>
                )}
              </button>
            </div>
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
                <p className="text-center text-sm text-slate-400 font-medium py-4">No abbreviations yet. Add one above or let AI suggest some.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wide">Active ({abbreviations.length})</p>
                  {abbreviations.map(abbr => (
                    <div key={abbr.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl group">
                      <span className="text-sm font-black text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200 min-w-[48px] text-center">{abbr.abbreviation}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      <span className="flex-1 text-sm text-slate-600 font-medium">{abbr.expansion}</span>
                      {abbr.caseSensitive && <span className="text-[10px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Aa</span>}
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
