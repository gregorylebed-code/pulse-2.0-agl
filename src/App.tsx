import React, { useState, useEffect, useRef } from 'react';

import { categorizeNote, summarizeNotes, refineReport, magicImport, draftParentSquareMessage, parseVoiceLog, performSmartScan, extractRotationMapping, suggestAbbreviations } from './lib/gemini';
import { expandAbbreviations, Abbreviation } from './utils/expandAbbreviations';
import { Note, Student, Report, ContactEntry, CalendarEvent } from './types';
import { migrateFromLocalStorage } from './utils/migrateFromLocalStorage';
import { useClassroomData } from './hooks/useClassroomData';
import { supabase } from './lib/supabase';
import PulseScreen from './components/PulseScreen';
import FeedbackModal from './components/FeedbackModal';
import ClassroomPulseLogo from './components/ClassroomPulseLogo';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
  color?: string;
}

const DEFAULT_SPECIALS = {
  'A': 'Art',
  'B': 'PE',
  'C': 'Music',
  'D': 'Library',
  'E': 'STEM'
};

import imageCompression from 'browser-image-compression';
import Papa from 'papaparse';
import {
  Activity, Users, FileInput, Settings,
  Plus, Mic, Image as ImageIcon, Sparkles, Send,
  ChevronRight, ChevronLeft, Folder, Trash2, Pin, Edit2, Copy,
  Phone, Mail, MessageSquare, Users2, Clock, X,
  CheckCircle2, AlertCircle, Loader2, LogOut, User,
  Search, Filter, Calendar, MessageCircle, TrendingUp, Archive,
  Shield, GripVertical, CalendarX, Eye, Upload, ArrowRight, School,
  FileText, ClipboardList, ChevronDown, Palette, Beaker, Download,
  Smile, Meh, Frown, Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Toaster, toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ParentSquareIcon = () => (
  <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-blue-500 text-white text-[9px] font-black leading-none">PS</span>
);

const getIconForName = (name: string, type: string) => {
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
    case 'ParentSquare': return <ParentSquareIcon />;
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

const DEFAULT_BEHAVIOR_BUTTONS = [
  { label: 'Participation', type: 'positive' as const, icon_name: 'Smile', icon: <Smile className="w-5 h-5 text-emerald-600" /> },
  { label: 'Kindness', type: 'positive' as const, icon_name: 'Smile', icon: <Smile className="w-5 h-5 text-emerald-600" /> },
  { label: 'Persistence', type: 'positive' as const, icon_name: 'Smile', icon: <Smile className="w-5 h-5 text-emerald-600" /> },
  { label: 'Disruption', type: 'growth' as const, icon_name: 'Frown', icon: <Frown className="w-5 h-5 text-red-500" /> },
  { label: 'Peer Conflict', type: 'growth' as const, icon_name: 'Frown', icon: <Frown className="w-5 h-5 text-red-500" /> },
  { label: 'Distracted', type: 'growth' as const, icon_name: 'Frown', icon: <Frown className="w-5 h-5 text-red-500" /> },
  { label: 'Missing HW', type: 'growth' as const, icon_name: 'Frown', icon: <Frown className="w-5 h-5 text-red-500" /> },
  { label: 'Unprepared', type: 'growth' as const, icon_name: 'Frown', icon: <Frown className="w-5 h-5 text-red-500" /> },
  { label: 'Observation', type: 'neutral' as const, icon_name: 'Meh', icon: <Meh className="w-5 h-5 text-amber-500" /> },
  { label: 'Independent Work', type: 'neutral' as const, icon_name: 'Meh', icon: <Meh className="w-5 h-5 text-amber-500" /> },
  { label: 'Group Work', type: 'neutral' as const, icon_name: 'Meh', icon: <Meh className="w-5 h-5 text-amber-500" /> },
];

const DEFAULT_COMM_BUTTONS = [
  { label: 'ParentSquare', icon_name: 'ParentSquare', icon: <ParentSquareIcon /> },
  { label: 'Email', icon_name: 'Mail', icon: <Mail className="w-5 h-5 text-blue-500" /> },
  { label: 'Phone', icon_name: 'Phone', icon: <Phone className="w-5 h-5 text-blue-500" /> },
  { label: 'Meeting', icon_name: 'Users', icon: <Users className="w-5 h-5 text-blue-500" /> },
];

const QUOTES = [
  "Progress, not perfection.",
  "You are the best part of some student's day.",
  "Every child is one caring adult away from being a success story."
];

const getGreeting = (name: string) => {
  const hour = new Date().getHours();
  const isFriday = new Date().getDay() === 5;
  let base = "";

  if (hour < 12) base = `Good morning, ${name}! Let’s make a difference today.`;
  else base = `Good afternoon, ${name}! You’re doing great—finish strong.`;

  if (isFriday) base += " Happy Friday! You've earned the weekend.";
  return base;
};

const TASK_COLORS: Record<string, any> = {
  default: { label: 'Default', bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-900', dot: 'bg-slate-400' },
  urgent: { label: 'Urgent', bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-slate-900', dot: 'bg-rose-500' },
  soon: { label: 'Soon', bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-slate-900', dot: 'bg-orange-500' },
  norush: { label: 'No Rush', bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-slate-900', dot: 'bg-yellow-500' },
  personal: { label: 'Personal', bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-slate-900', dot: 'bg-emerald-500' },
  misc: { label: 'Misc', bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-slate-900', dot: 'bg-blue-500' },
};

export default function App() {
  // Use Supabase-backed data hook
  const {
    notes,
    students,
    indicators,
    commTypes,
    classes,
    calendarEvents,
    tasks,
    reports,
    profile,
    rotationMapping,
    specialsNames,
    loading,
    addNote,
    updateNote,
    deleteNote,
    addStudent,
    updateStudent,
    deleteStudent,
    addTask,
    updateTask,
    deleteTask,
    addReport,
    deleteReport,
    saveProfile,
    saveRotationMapping,
    saveSpecialsNames,
    saveAbbreviations,
    abbreviations,
    updateIndicators,
    updateCommTypes,
    updateClasses,
    updateCalendarEvents,
    refreshData,
  } = useClassroomData();

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('cp_theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('cp_theme', theme);
  }, [theme]);

  const [activeTab, setActiveTab] = useState<'pulse' | 'students' | 'settings'>('pulse');
  const [taskUndoToast, setTaskUndoToast] = useState<{ label: string; onUndo: () => void } | null>(null);
  const taskUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTasks, setShowTasks] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [tempName, setTempName] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState('');
  const [activeColorMenuId, setActiveColorMenuId] = useState<string | null>(null);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [isUsingBackup, setIsUsingBackup] = useState(false);
  const [showRotationForecast, setShowRotationForecast] = useState(false);

  // Derive userName and schoolName from profile
  const userName = profile.userName;
  const schoolName = profile.schoolName;

  useEffect(() => {
    const handleFallback = () => {
      setIsUsingBackup(true);
      setTimeout(() => setIsUsingBackup(false), 8000); // Hide after 8 seconds
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (activeColorMenuId && !target.closest('.priority-menu-trigger') && !target.closest('.priority-menu')) {
        setActiveColorMenuId(null);
      }
    };

    window.addEventListener('gemini-fallback-triggered', handleFallback);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('gemini-fallback-triggered', handleFallback);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeColorMenuId]);

  // Handle name changes
  const saveName = () => {
    if (!tempName.trim()) return;
    const newName = tempName.trim();
    saveProfile({ ...profile, userName: newName });
    setTempName('');
    toast.success(`Welcome, ${newName}!`);
  };

  const resetUserName = () => {
    saveProfile({ ...profile, userName: 'Teacher' });
    toast.info('Name reset. What should I call you?');
  };

  // Handle task management
  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    await addTask({
      text: newTaskText.trim(),
      completed: false,
      color: 'default'
    });
    setNewTaskText('');
  };

  const handleSetTaskColor = async (id: string, color: string) => {
    await updateTask(id, { color });
    setActiveColorMenuId(null);
  };

  const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      await updateTask(id, { completed: !task.completed });
    }
  };

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id);
  };

  const handleClearCompleted = async () => {
    const completedTasks = tasks.filter(t => t.completed).map(t => t.id);
    for (const taskId of completedTasks) {
      await deleteTask(taskId);
    }
  };

  const handleStartEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskText(task.text);
  };

  const handleUpdateTaskText = async () => {
    if (!editingTaskId) return;
    await updateTask(editingTaskId, { text: editTaskText.trim() || tasks.find(t => t.id === editingTaskId)?.text });
    setEditingTaskId(null);
    setEditTaskText('');
  };

  const handleCopyTasks = () => {
    const text = tasks.map(t => `${t.completed ? '✓' : '○'} ${t.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => toast.success('Tasks copied to clipboard!'));
  };

  const handleExportTasksPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    doc.setFontSize(16);
    doc.text('Daily Tasks', 20, 20);
    doc.setFontSize(10);
    doc.text(date, 20, 30);
    let y = 45;
    tasks.forEach(task => {
      const line = `${task.completed ? '✓' : '○'}  ${task.text}`;
      const lines = doc.splitTextToSize(line, 170);
      lines.forEach((l: string) => {
        doc.text(l, 20, y);
        y += 8;
        if (y > 270) { doc.addPage(); y = 20; }
      });
    });
    doc.save('tasks.pdf');
  };

  const handleOnDragEnd = async (result: any) => {
    if (!result.destination) return;
    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    // Note: This reorders in state, but Supabase doesn't support custom ordering yet
    // This will reset on refresh. Consider adding an "order" field to tasks table if needed.
  };

  const getRotationForDate = (date: Date) => {
    const key = date.toISOString().split('T')[0];
    const letter = rotationMapping[key];
    if (!letter) return null;
    return {
      letter,
      special: specialsNames[letter] || 'No Special'
    };
  };

  const todayRotation = getRotationForDate(new Date());

  const getForecast = () => {
    const forecast = [];
    let current = new Date();
    current.setHours(0, 0, 0, 0);

    let count = 0;
    let daysChecked = 0;
    while (count < 6 && daysChecked < 30) {
      current.setDate(current.getDate() + 1);
      daysChecked++;

      const day = current.getDay();
      if (day === 0 || day === 6) continue;

      const rotation = getRotationForDate(current);
      if (rotation) {
        forecast.push({
          date: new Date(current),
          ...rotation
        });
        count++;
      }
    }
    return forecast;
  };

  return (
    <div className="min-h-screen bg-cream font-sans text-slate-900 selection:bg-sage/20">
      <header className="px-6 pt-10 pb-6 no-print">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            {userName === 'Teacher' && !localStorage.getItem('cp_profile')?.includes('userName') ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-bold text-sage">Welcome! What should I call you?</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && saveName()}
                    placeholder="e.g., Mr. Smith"
                    className="px-3 py-1.5 bg-white border border-slate-100 rounded-lg text-xs focus:outline-none focus:border-sage shadow-sm w-48"
                  />
                  <button onClick={saveName} className="p-1.5 bg-sage text-white rounded-lg hover:bg-sage-dark transition-all">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="group relative">
                <div className="flex items-center gap-2 pr-8">
                  <h1 className="text-lg font-bold text-sage-dark leading-tight">
                    {getGreeting(userName)}
                  </h1>
                  <button
                    onClick={resetUserName}
                    className="p-1 text-slate-300 hover:text-sage opacity-0 group-hover:opacity-100 transition-all"
                    title="Change Name"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Sparkles className="w-3 h-3 text-terracotta animate-pulse" />
                  <p className="text-[10px] font-medium text-slate-400 italic">
                    "{quote}"
                  </p>
                </div>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-sage/10 text-sage text-[9px] font-bold rounded-full">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} View
              </span>
              <div className="flex items-center gap-1.5">
                <ClassroomPulseLogo size={22} />
                <span className="text-[9px] font-semibold text-slate-300">
                  Pulse v2.0
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {/* Rotation Dashboard Badge */}
            <div className="relative">
              <button
                onClick={() => setShowRotationForecast(!showRotationForecast)}
                className={cn(
                  "px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 transition-all hover:border-sage/30 group",
                  showRotationForecast && "ring-2 ring-sage/20 border-sage/40"
                )}
              >
                <div className="p-1.5 bg-sage/10 text-sage rounded-lg group-hover:bg-sage/20 transition-colors">
                  <School className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-slate-400 leading-none">Rotation</p>
                  <p className="text-xs font-bold text-sage-dark">
                    {todayRotation ? `Day ${todayRotation.letter}: ${todayRotation.special}` : 'No School'}
                  </p>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-slate-300 transition-transform", showRotationForecast && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showRotationForecast && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowRotationForecast(false)}
                      className="fixed inset-0 z-[80]"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-64 bg-white rounded-[24px] shadow-2xl border border-slate-100 p-5 z-[90] overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[11px] font-bold text-slate-400">6-Day Forecast</h4>
                        <Beaker className="w-3.5 h-3.5 text-sage/40" />
                      </div>
                      <div className="space-y-3">
                        {getForecast().map((day, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100/50">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-400">
                                {day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                              <span className="text-xs font-bold text-slate-700">{day.special}</span>
                            </div>
                            <div className="px-2 py-1 bg-sage/10 text-sage rounded-lg text-[10px] font-black underline decoration-2 underline-offset-2">
                              Day {day.letter}
                            </div>
                          </div>
                        ))}
                        {getForecast().length === 0 && (
                          <div className="text-center py-4 text-[10px] font-medium text-slate-400 italic">
                            No rotation data found. Scan your calendar in Settings.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={() => setShowTasks(true)}
              className="p-2.5 bg-white text-slate-400 rounded-xl hover:text-sage transition-all shadow-sm border border-slate-100 flex items-center justify-center relative no-print"
              title="Daily Tasks"
            >
              <ClipboardList className="w-5 h-5" />
              {tasks.filter(t => !t.completed).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-terracotta text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {tasks.filter(t => !t.completed).length}
                </span>
              )}
            </button>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
              <Activity className="text-sage w-5 h-5" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 pb-24 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'pulse' && (
            <motion.div key="pulse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PulseScreen
                notes={notes}
                students={students}
                indicators={indicators}
                commTypes={commTypes}
                calendarEvents={calendarEvents}
                classes={classes}
                onNoteAdded={refreshData}
                addNote={addNote}
                updateNote={updateNote}
                deleteNote={deleteNote}
                abbreviations={abbreviations}
              />
            </motion.div>
          )}
          {activeTab === 'students' && (
            <motion.div key="students" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StudentsScreen students={students} notes={notes} reports={reports} indicators={indicators} commTypes={commTypes} calendarEvents={calendarEvents} classes={classes} onUpdate={refreshData} deleteStudent={deleteStudent} deleteNote={deleteNote} addNote={addNote} updateNote={updateNote} updateStudent={updateStudent} addReport={addReport} deleteReport={deleteReport} abbreviations={abbreviations} />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SettingsScreen
                indicators={indicators}
                setIndicators={updateIndicators}
                commTypes={commTypes}
                setCommTypes={updateCommTypes}
                classes={classes}
                setClasses={updateClasses}
                onImportComplete={refreshData}
                onNoteAdded={refreshData}
                userName={userName}
                setUserName={(name: string) => saveProfile({ ...profile, userName: name })}
                schoolName={schoolName}
                setSchoolName={(name: string) => saveProfile({ ...profile, schoolName: name })}
                calendarEvents={calendarEvents}
                setCalendarEvents={updateCalendarEvents}
                rotationMapping={rotationMapping}
                setRotationMapping={saveRotationMapping}
                specialsNames={specialsNames}
                setSpecialsNames={saveSpecialsNames}
                students={students}
                addStudent={addStudent}
                deleteStudent={deleteStudent}
                updateStudent={updateStudent}
                theme={theme}
                setTheme={setTheme}
                abbreviations={abbreviations}
                saveAbbreviations={saveAbbreviations}
                notes={notes}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Daily Tasks Drawer */}
      <AnimatePresence>
        {showTasks && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTasks(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] no-print"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-cream-light z-[70] shadow-2xl p-6 flex flex-col no-print"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sage/10 rounded-xl">
                    <ClipboardList className="w-5 h-5 text-sage" />
                  </div>
                  <h2 className="text-lg font-bold text-sage-dark">Daily Tasks</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleCopyTasks} title="Copy to clipboard" className="p-2 text-slate-400 hover:text-sage rounded-full transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={handleExportTasksPDF} title="Export as PDF" className="p-2 text-slate-400 hover:text-sage rounded-full transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowTasks(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                  placeholder="What needs doing?"
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-100 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-sage/20 shadow-inner"
                />
                <button
                  onClick={handleAddTask}
                  className="p-2.5 bg-sage text-white rounded-full hover:bg-sage-dark transition-all shadow-md shadow-sage/10"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {tasks.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <p className="text-xs font-medium text-slate-400">All caught up!</p>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={handleOnDragEnd}>
                    <Droppable droppableId="tasks-list">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                          {tasks.map((task, index) => (
                            <Draggable key={task.id} {...({ draggableId: task.id, index } as any)}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn(
                                    "group flex items-start gap-3 p-4 rounded-[32px] border-2 transition-all relative",
                                    task.completed ? "bg-slate-50/50 border-slate-100 shadow-none hover:shadow-none" : (TASK_COLORS[task.color || 'default'].bg + " " + TASK_COLORS[task.color || 'default'].border),
                                    !task.completed && "hover:shadow-md",
                                    snapshot.isDragging && "shadow-xl border-sage/40 ring-2 ring-sage/10 scale-[1.02] z-[100] cursor-grabbing"
                                  )}
                                >
                                  <div {...provided.dragHandleProps} className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing transition-colors">
                                    <GripVertical className="w-4 h-4" />
                                  </div>

                                  <div className="flex-1 flex items-start gap-4 min-w-0">
                                    <div className="flex flex-col items-center gap-2 mt-0.5 shrink-0">
                                      <button
                                        onClick={() => handleToggleTask(task.id)}
                                        className={cn(
                                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                          task.completed ? "bg-sage border-sage text-white" : "bg-white border-slate-200"
                                        )}
                                      >
                                        {task.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                                      </button>

                                      {!task.completed && (
                                        <div className="relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveColorMenuId(activeColorMenuId === task.id ? null : task.id);
                                            }}
                                            className={cn(
                                              "p-1 transition-all rounded-lg priority-menu-trigger",
                                              activeColorMenuId === task.id ? "text-sage bg-sage/10" : "text-slate-300 hover:text-sage"
                                            )}
                                          >
                                            <Palette className="w-3.5 h-3.5" />
                                          </button>

                                          {activeColorMenuId === task.id && (
                                            <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl flex gap-1.5 p-2 transition-all z-[110] animate-in fade-in slide-in-from-top-1 duration-200 priority-menu">
                                              {(Object.keys(TASK_COLORS)).map(c => (
                                                <button
                                                  key={c}
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleSetTaskColor(task.id, c);
                                                  }}
                                                  className={cn(
                                                    "w-5 h-5 rounded-full border-2 transition-transform hover:scale-125",
                                                    TASK_COLORS[c].dot,
                                                    task.color === c || (!task.color && c === 'default')
                                                      ? "border-sage shadow-md scale-110"
                                                      : "border-white"
                                                  )}
                                                  title={TASK_COLORS[c].label}
                                                />
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0" onClick={() => !task.completed && handleStartEditingTask(task)}>
                                      {editingTaskId === task.id ? (
                                        <textarea
                                          autoFocus
                                          value={editTaskText}
                                          onChange={(e) => setEditTaskText(e.target.value)}
                                          onBlur={handleUpdateTaskText}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                              e.preventDefault();
                                              handleUpdateTaskText();
                                            }
                                          }}
                                          className="w-full px-2 py-1 bg-white border border-sage rounded-lg text-xs font-medium focus:outline-none min-h-[60px] resize-none"
                                        />
                                      ) : (
                                        <div className="flex flex-col gap-1">
                                          <p className={cn(
                                            "text-xs font-medium cursor-pointer transition-all break-words leading-relaxed",
                                            task.completed ? "text-slate-400 line-through" : "text-slate-900"
                                          )}>
                                            {task.text}
                                          </p>
                                          {!task.completed && (
                                            <span className="text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const snapshot = { ...task };
                                      if (taskUndoTimerRef.current) clearTimeout(taskUndoTimerRef.current);
                                      setTaskUndoToast({ label: 'Task deleted', onUndo: () => {} });
                                      const timer = setTimeout(() => { deleteTask(snapshot.id); setTaskUndoToast(null); }, 5000);
                                      taskUndoTimerRef.current = timer;
                                      setTaskUndoToast({ label: 'Task deleted', onUndo: () => { clearTimeout(timer); setTaskUndoToast(null); } });
                                    }}
                                    className="mt-0.5 p-1 text-slate-300 hover:text-terracotta transition-colors"
                                  >
                                    <X className="w-4 h-4" />
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
                )}
              </div>

              {tasks.some(t => t.completed) && (
                <button
                  onClick={handleClearCompleted}
                  className="mt-6 w-full py-3 text-[11px] font-bold text-slate-400 hover:text-terracotta transition-colors border border-dashed border-slate-200 rounded-xl"
                >
                  Clear Completed
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toaster position="top-center" richColors theme={theme} />

      <AnimatePresence>
        {taskUndoToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-full flex items-center gap-4 shadow-xl z-50"
          >
            <span className="text-sm font-medium">{taskUndoToast.label}</span>
            <button
              onClick={() => { taskUndoToast.onUndo(); setTaskUndoToast(null); }}
              className="text-teal-400 font-bold text-sm hover:text-teal-300 transition-colors"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <FeedbackModal currentView={
        activeTab === 'pulse' ? 'Pulse Screen' :
        activeTab === 'students' ? 'Students Screen' :
        'Settings'
      } />

      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white shadow-[0_-2px_15px_rgba(0,0,0,0.05)] flex items-center justify-around px-8 z-50 no-print border-t border-slate-100">
        <NavButton active={activeTab === 'pulse'} onClick={() => setActiveTab('pulse')} icon={<Activity />} label="Pulse" />
        <NavButton active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<Users />} label="Students" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Settings" />
      </nav>

      {isUsingBackup && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800 text-white rounded-full text-[10px] font-bold shadow-lg flex items-center gap-2 z-50 pointer-events-none"
        >
          <Sparkles className="w-3 h-3 text-sage" />
          Gemini limit reached. Using Llama backup.
        </motion.div>
      )}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300 relative",
        active ? "text-[#4169E1]" : "text-slate-400 hover:text-slate-500"
      )}
    >
      {React.cloneElement(icon as React.ReactElement, {
        className: "w-7 h-7",
        strokeWidth: 2.5
      })}
      <span className={cn(
        "text-sm font-black",
        !active && "text-slate-500"
      )}>{label}</span>
      {active && (
        <motion.div
          layoutId="nav-dot"
          className="absolute -bottom-2.5 w-2 h-2 bg-[#4169E1] rounded-full"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
      )}
    </button>
  );
}

function StudentsScreen({ students, notes, reports, indicators, commTypes, calendarEvents, classes, onUpdate, deleteStudent, deleteNote, addNote, updateNote, updateStudent, addReport, deleteReport, abbreviations }: { students: Student[], notes: Note[], reports: Report[], indicators: any[], commTypes: any[], calendarEvents: CalendarEvent[], classes: string[], onUpdate: () => void, deleteStudent: (id: string) => Promise<void>, deleteNote: (id: string) => Promise<void>, addNote: (note: any) => Promise<any>, updateNote: (id: string, updates: any) => Promise<void>, updateStudent: (id: string, updates: any) => Promise<void>, addReport: (r: Omit<Report, 'id' | 'created_at'>) => Promise<Report | null>, deleteReport: (id: string) => Promise<void>, abbreviations: Abbreviation[] }) {
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupedStudents[section].map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  className="bg-white p-6 rounded-[32px] card-shadow border border-slate-100 flex flex-col items-center justify-center gap-3 group cursor-pointer hover:border-sage/30 hover:-translate-y-1 transition-all text-center"
                >
                  <div className={cn("w-16 h-16 rounded-full flex items-center justify-center font-black text-xl border", getAvatarColor(s.name))}>
                    {s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <h4 className="font-bold text-slate-900 line-clamp-2 leading-tight">{s.name}</h4>
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

function StudentDetailView({
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
}: {
  student: Student,
  students: Student[],
  notes: Note[],
  reports: Report[],
  indicators: any[],
  commTypes: any[],
  calendarEvents: CalendarEvent[],
  onBack: () => void,
  onGenerateReport: (length: 'Quick Pulse' | 'Standard' | 'Detailed', filteredNotes: Note[]) => Promise<string | undefined>,
  onNoteUpdate: () => void,
  addNote: (note: any) => Promise<any>,
  updateNote: (id: string, updates: any) => Promise<void>,
  updateStudent: (id: string, updates: any) => Promise<void>,
  deleteNote: (id: string) => Promise<void>,
  deleteReport: (id: string) => Promise<void>,
  abbreviations: Abbreviation[],
}) {
  const [reportLength, setReportLength] = useState<'Quick Pulse' | 'Standard' | 'Detailed'>('Standard');
  const [timeRange, setTimeRange] = useState('Last 7 Days');
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingContact, setIsUpdatingContact] = useState(false);
  const [currentReport, setCurrentReport] = useState<string | null>(null);
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
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const [selectedArchiveIds, setSelectedArchiveIds] = useState<string[]>([]);
  const [expandedArchiveIds, setExpandedArchiveIds] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<'timeline' | 'ai-report' | 'history'>('timeline');
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
        user_id: 'local',
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
          visibleSection = entry.target.id as 'timeline' | 'ai-report' | 'history';
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

    return () => observer.disconnect();
  }, [activeSection]);

  const scrollToSection = (sectionId: 'timeline' | 'ai-report' | 'history') => {
    const refs = {
      'timeline': timelineRef,
      'ai-report': aiReportRef,
      'history': historyRef
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
        const archived = { id: Date.now().toString(), content: currentReport, date: new Date().toISOString() };
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
      const archived = { id: Date.now().toString(), content: currentReport, date: new Date().toISOString() };
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
    triggerEmail(currentReport);
  };

  const handleCopyReport = () => {
    if (!currentReport) return;
    navigator.clipboard.writeText(currentReport);
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
    const body = currentReport;
    window.location.href = `sms:${parentPhone}?body=${encodeURIComponent(body)}`;
  };

  const handleCopyParentSquare = () => {
    if (!currentReport) return;
    navigator.clipboard.writeText(currentReport);
    alert('Report copied for ParentSquare!');
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
              Class Period {typeof student.class_id === 'object' ? (student.class_id as any)?.label || (student.class_id as any)?.value : student.class_id}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] card-shadow border border-slate-100 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-black text-slate-400 ml-1">Parent Contact Info</h3>
          <button
            type="button"
            onClick={handleSaveContact}
            disabled={isUpdatingContact}
            className="text-sm font-black text-sage hover:text-sage-dark disabled:opacity-50"
          >
            {isUpdatingContact ? 'Saving...' : 'Save Info'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label htmlFor="parent_name" className="text-[13px] font-black text-slate-400 ml-1">Parent Name</label>
            <input
              id="parent_name"
              name="parent_name"
              type="text"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Name..."
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-base font-medium focus:outline-none focus:border-sage"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="parent_email" className="text-[13px] font-black text-slate-400 ml-1">Email</label>
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
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-base font-medium focus:outline-none focus:border-sage"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="parent_phone" className="text-[13px] font-black text-slate-400 ml-1">Phone</label>
              <button
                type="button"
                onClick={() => {
                  const textToCopy = currentReport || (student.archivedSummaries && student.archivedSummaries.length > 0
                    ? student.archivedSummaries[student.archivedSummaries.length - 1].content
                    : null);

                  if (textToCopy) {
                    navigator.clipboard.writeText(textToCopy);
                    const isArchive = !currentReport;
                    toast.success(isArchive ? 'Latest archived summary copied!' : 'AI Report copied!');
                  } else {
                    toast.error('No report to copy!');
                  }
                }}
                className="text-[11px] font-black text-sage hover:text-sage-dark flex items-center gap-1"
              >
                <Copy className="w-2.5 h-2.5" /> Copy for Text
              </button>
            </div>
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
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-base font-medium focus:outline-none focus:border-sage"
            />
          </div>
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

        <div className="space-y-4 pt-2">
          <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar px-1">
            {indicators.map(b => (
              <button
                key={b.label}
                onClick={() => toggleTag(b.label)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 border-2 rounded-full text-base font-black flex items-center gap-2 transition-all shadow-sm",
                  selectedTags.includes(b.label)
                    ? b.type === 'positive' ? "bg-sage/15 border-sage text-sage-dark shadow-md" : b.type === 'neutral' ? "bg-amber-500/15 border-amber-500 text-amber-700 shadow-md" : "bg-terracotta/15 border-terracotta text-terracotta-dark shadow-md"
                    : "bg-white border-slate-100 text-slate-500 hover:border-slate-300"
                )}
              >
                <span>{b.icon ?? getIconForName(b.icon_name, b.type)}</span> {b.label}
              </button>
            ))}
          </div>

          <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar px-1">
            {commTypes.map(c => (
              <button
                key={c.label}
                onClick={() => toggleComm(c.label)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 border-2 rounded-full text-base font-black flex items-center gap-2 transition-all shadow-sm",
                  selectedComm.includes(c.label)
                    ? "bg-blue-500/15 border-blue-500 text-blue-700 shadow-md"
                    : "bg-white border-slate-100 text-slate-500 hover:border-slate-300"
                )}
              >
                <span>{c.icon ?? getIconForName(c.icon_name, 'neutral')}</span> {c.label}
              </button>
            ))}
          </div>
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
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">1. Select Timeframe</h3>
              <div className="grid grid-cols-3 gap-2">
                {['Today', 'Last 7 Days', '15 Days', 'Last 30 Days', '60 Days', 'Whole Year', 'Custom Range'].map(range => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      "py-2.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all border-2",
                      timeRange === range ? "bg-sage/15 border-sage text-sage-dark shadow-md" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>

              {timeRange === 'Custom Range' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label htmlFor="custom_start_date" className="text-[8px] font-bold uppercase tracking-widest text-slate-400 ml-1">Start Date</label>
                    <input
                      id="custom_start_date"
                      name="custom_start_date"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-[10px] focus:outline-none focus:ring-2 focus:ring-sage/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="custom_end_date" className="text-[8px] font-bold uppercase tracking-widest text-slate-400 ml-1">End Date</label>
                    <input
                      id="custom_end_date"
                      name="custom_end_date"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-[10px] focus:outline-none focus:ring-2 focus:ring-sage/20"
                    />
                  </div>
                </motion.div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">2. Select Report Type</h3>
              <div className="grid grid-cols-3 gap-2">
                {(['Quick Pulse', 'Standard', 'Detailed'] as const).map(len => (
                  <button
                    key={len}
                    onClick={() => setReportLength(len)}
                    className={cn(
                      "py-3 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all border-2",
                      reportLength === len ? "bg-sage/15 border-sage text-sage-dark shadow-md" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                    )}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || notes.length === 0}
              className="w-full py-5 bg-linear-to-r from-orange-400 to-orange-500 text-white rounded-full font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-orange-200/50 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Generate Report</>}
            </button>
            {notes.length === 0 && <p className="text-[10px] text-center text-slate-400 italic">No notes available to generate a report.</p>}
          </div>

          {currentReport && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 rounded-[32px] border border-sage/10 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-sage">New Summary ({timeRange})</span>
                <button onClick={() => setCurrentReport(null)} className="text-slate-300 hover:text-terracotta"><X className="w-4 h-4" /></button>
              </div>
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">{currentReport}</div>

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
                <div className="text-center py-10 bg-slate-50/50 rounded-[32px] border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400 font-medium">No history or archived summaries yet.</p>
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
                          {isExpanded ? <ChevronLeft className="w-4 h-4 text-slate-400 -rotate-90" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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

function ImportScreen({ onImportComplete, classes, students, addStudent, updateStudent }: { onImportComplete: () => void, classes: string[], students: Student[], addStudent: (s: Omit<Student, 'id'>) => Promise<Student | null>, updateStudent: (id: string, updates: Partial<Student>) => Promise<void> }) {
  const [rosterText, setRosterText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [matches, setMatches] = useState<{ imported: any, existing: any }[]>([]);
  const [newStudents, setNewStudents] = useState<any[]>([]);
  const [step, setStep] = useState<'input' | 'preview' | 'success'>('input');
  const [importSummary, setImportSummary] = useState<{ updated: number, added: number } | null>(null);
  const [defaultClassPeriod, setDefaultClassPeriod] = useState(classes[0] || 'Class 1');

  // Simple fallback: reads one student name per line, extracts email/phone if present.
  // Works with lists like: "John Smith" or "Maria G - maria@email.com - 555-1234"
  const parseRosterManually = (text: string): any[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Strip leading numbers/bullets
        const cleaned = line.replace(/^[\d]+[.)]\s*/, '').replace(/^[-*•]\s*/, '');
        const parts = cleaned.split(/\s*[-–|]\s*|\s*[,]\s*/);
        const name = parts[0].trim();
        if (!name) return null;
        const emailMatch = line.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
        const phoneMatch = line.match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
        return {
          name,
          parent_emails: emailMatch ? [emailMatch[0]] : [],
          parent_phones: phoneMatch ? [phoneMatch[0]] : [],
          parent_guardian_names: []
        };
      })
      .filter(Boolean);
  };

  const handleProcess = async () => {
    if (!rosterText.trim()) return;
    setIsProcessing(true);
    let data: any[] = [];
    try {
      data = await magicImport(rosterText);
      if (!data || data.length === 0) throw new Error('AI returned empty');
    } catch (aiError) {
      console.warn('AI import unavailable, using line parser:', aiError);
      data = parseRosterManually(rosterText);
      if (data.length === 0) {
        toast.error('No names found. Put each student on a separate line.');
        setIsProcessing(false);
        return;
      }
      toast.info(`Simple import: ${data.length} students found.`, { duration: 3000 });
    }
    try {
      const existingStudents: Student[] = students;

      const foundMatches: { imported: any, existing: any }[] = [];
      const foundNew: any[] = [];

      data.forEach((importedStudent: any) => {
        const importedName = importedStudent.name.trim();
        const match = existingStudents.find(s => {
          const sName = s.name.trim().toLowerCase();
          const iName = importedName.toLowerCase();
          if (sName === iName) return true;
          const sParts = sName.split(' ');
          const iParts = iName.split(' ');
          const sFirstName = sParts[0];
          const iFirstName = iParts[0];
          if (sFirstName !== iFirstName) return false;
          const sLastName = sParts.slice(1).join(' ');
          const iLastName = iParts.slice(1).join(' ');
          if (!sLastName || !iLastName) return true;
          if (sLastName[0] === iLastName[0]) return true;
          return false;
        });
        if (match) {
          foundMatches.push({ imported: importedStudent, existing: match });
        } else {
          foundNew.push(importedStudent);
        }
      });

      setMatches(foundMatches);
      setNewStudents(foundNew);
      setStep('preview');
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to parse text.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      let updatedCount = 0;
      let addedCount = 0;

      const extractString = (val: any) => {
        if (!val) return val;
        if (typeof val === 'object') return val.value || val.label || '';
        return String(val);
      };

      // Update existing matched students
      for (const match of matches) {
        const { imported, existing } = match;
        const updatedEmails = [...(existing.parent_emails || [])];
        if (imported.parent_emails) {
          imported.parent_emails.forEach((e: any) => {
            if (!updatedEmails.some(ex => (typeof ex === 'object' ? ex.value : ex) === (typeof e === 'object' ? e.value : e))) {
              updatedEmails.push(e);
            }
          });
        }
        const updatedPhones = [...(existing.parent_phones || [])];
        if (imported.parent_phones) {
          imported.parent_phones.forEach((p: any) => {
            if (!updatedPhones.some(ex => (typeof ex === 'object' ? ex.value : ex) === (typeof p === 'object' ? p.value : p))) {
              updatedPhones.push(p);
            }
          });
        }
        await updateStudent(existing.id, {
          parent_emails: updatedEmails,
          parent_phones: updatedPhones,
          class_id: defaultClassPeriod,
          class_period: defaultClassPeriod,
        });
        updatedCount++;
      }

      // Add brand-new students
      for (const s of newStudents) {
        await addStudent({
          name: extractString(s.name),
          class_id: defaultClassPeriod,
          class_period: defaultClassPeriod,
          parent_guardian_names: Array.isArray(s.parent_guardian_names) ? s.parent_guardian_names.map(extractString) : [],
          parent_emails: Array.isArray(s.parent_emails) ? s.parent_emails : [],
          parent_phones: Array.isArray(s.parent_phones) ? s.parent_phones : [],
          user_id: 'local',
          created_at: new Date().toISOString(),
        } as Omit<Student, 'id'>);
        addedCount++;
      }

      setImportSummary({ updated: updatedCount, added: addedCount });
      setStep('success');
      toast.success('Import completed successfully!');
    } catch (error) {
      console.error('Import error:', error);
      toast.error('An error occurred during import.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div className="bg-white rounded-[32px] p-8 card-shadow border border-sage/5 space-y-6">
        {step === 'input' && (
          <>
            <div>
              <h2 className="text-xl font-bold text-sage-dark">Batch Import Roster</h2>
              <p className="text-xs text-slate-500 mt-1">Paste names, emails, and phone numbers below. Our AI will extract the details for you.</p>
            </div>

            <textarea
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              placeholder="e.g. John Smith - jsmith@email.com&#10;Brianna S. (brianna.s@web.com)..."
              className="w-full min-h-[240px] p-6 bg-slate-50 border border-slate-100 rounded-3xl focus:outline-none focus:ring-4 focus:ring-sage/5 focus:border-sage transition-all text-sm resize-none leading-relaxed"
            />

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Assign to Class Period:</label>
                <select
                  value={defaultClassPeriod}
                  onChange={(e) => setDefaultClassPeriod(e.target.value)}
                  className="flex-1 sm:w-40 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-600 focus:outline-none"
                >
                  {classes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleProcess}
                disabled={isProcessing || !rosterText.trim()}
                className="w-full sm:w-auto px-8 py-3.5 bg-slate-400 text-white rounded-[24px] font-bold text-sm uppercase tracking-widest hover:bg-slate-500 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Process with AI</>}
              </button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-sage-dark">Review Matches</h2>
              <button onClick={() => setStep('input')} className="text-xs text-terracotta font-bold hover:underline">
                Cancel
              </button>
            </div>

            {matches.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Matches Found ({matches.length})</h3>
                <p className="text-xs text-slate-500">These imported students match existing roster entries. Their profiles will be updated.</p>
                {matches.map((m, i) => (
                  <div key={i} className="bg-sage/5 p-4 rounded-2xl border border-sage/20 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sage-dark text-sm">{m.imported.name} <span className="text-slate-400 font-normal text-xs ml-2">(Existing: {m.existing.name})</span></h4>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {m.imported.parent_emails && m.imported.parent_emails.map((email: any, idx: number) => {
                          const emailStr = typeof email === 'object' ? email.value : email;
                          return emailStr ? <span key={`email-${idx}`} className="text-[9px] text-slate-500 flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {emailStr}</span> : null;
                        })}
                        {m.imported.parent_phones && m.imported.parent_phones.map((phone: any, idx: number) => {
                          const phoneStr = typeof phone === 'object' ? phone.value : phone;
                          return phoneStr ? <span key={`phone-${idx}`} className="text-[9px] text-slate-500 flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {phoneStr}</span> : null;
                        })}
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-sage/20 text-sage-dark text-[8px] font-bold uppercase tracking-widest rounded-md">
                      Update
                    </span>
                  </div>
                ))}
              </div>
            )}

            {newStudents.length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="text-sm font-bold text-slate-700">New Students ({newStudents.length})</h3>
                <p className="text-xs text-slate-500">These students will be added as new entries.</p>
                {newStudents.map((s, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{s.name}</h4>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {s.parent_emails && s.parent_emails.map((email: any, idx: number) => {
                          const emailStr = typeof email === 'object' ? email.value : email;
                          return emailStr ? <span key={`email-${idx}`} className="text-[9px] text-slate-400 flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {emailStr}</span> : null;
                        })}
                        {s.parent_phones && s.parent_phones.map((phone: any, idx: number) => {
                          const phoneStr = typeof phone === 'object' ? phone.value : phone;
                          return phoneStr ? <span key={`phone-${idx}`} className="text-[9px] text-slate-400 flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {phoneStr}</span> : null;
                        })}
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-slate-200 text-slate-600 text-[8px] font-bold uppercase tracking-widest rounded-md">
                      New
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="w-full py-5 bg-sage text-white rounded-[24px] font-bold text-sm uppercase tracking-widest hover:bg-sage-dark transition-all shadow-xl shadow-sage/20 flex items-center justify-center gap-3 disabled:opacity-50 mt-6"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Confirm All</>}
            </button>
          </div>
        )}

        {step === 'success' && importSummary && (
          <div className="space-y-6">
            <div className="p-6 bg-sage/10 border border-sage/20 rounded-3xl flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-sage/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-sage" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-sage-dark">Import Complete</h4>
                <p className="text-sm text-sage mt-2">
                  Updated {importSummary.updated} existing students.<br />
                  Added {importSummary.added} new students.
                </p>
              </div>
            </div>
            <button
              onClick={onImportComplete}
              className="w-full py-5 bg-sage text-white rounded-[24px] font-bold text-sm uppercase tracking-widest hover:bg-sage-dark transition-all shadow-xl shadow-sage/20 flex items-center justify-center gap-3"
            >
              Go to Roster <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}


function SettingsScreen({
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
}: {
  indicators: any[];
  setIndicators: (val: any[]) => void,
  commTypes: any[],
  setCommTypes: (val: any[]) => void,
  classes: string[],
  setClasses: (val: string[]) => void,
  onImportComplete: () => void,
  onNoteAdded: () => void,
  userName: string,
  setUserName: (val: string) => void,
  schoolName: string,
  setSchoolName: (val: string) => void,
  calendarEvents: CalendarEvent[],
  setCalendarEvents: (val: CalendarEvent[]) => void,
  rotationMapping: Record<string, string>,
  setRotationMapping: (val: Record<string, string>) => void,
  specialsNames: Record<string, string>,
  setSpecialsNames: (val: Record<string, string>) => void,
  students: Student[],
  addStudent: (student: Omit<Student, 'id'>) => Promise<Student | null>,
  deleteStudent: (id: string) => Promise<void>,
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>,
  theme: 'light' | 'dark',
  setTheme: (val: 'light' | 'dark') => void,
  abbreviations: Abbreviation[],
  saveAbbreviations: (val: Abbreviation[]) => Promise<void>,
  notes: Note[],
}) {
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
                  <Activity className="w-4 h-4" /> Reset to Factory Settings
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

function SettingsItem({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
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
