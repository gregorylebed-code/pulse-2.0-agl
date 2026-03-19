import React, { useState, useEffect } from 'react';

import { useClassroomData } from './hooks/useClassroomData';
import PulseScreen from './components/PulseScreen';
import SummaryView from './components/SummaryView';
import FeedbackModal from './components/FeedbackModal';
import ClassroomPulseLogo from './components/ClassroomPulseLogo';
import StudentsScreen from './components/StudentsScreen';
import TaskDrawer from './components/TaskDrawer';
import SettingsScreen from './components/SettingsScreen';

import {
  Activity, Users, Settings,
  Plus, Sparkles, Edit2,
  School, ChevronDown,
  ClipboardList, Beaker,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const QUOTES = [
  "Progress, not perfection.",
  "You are the best part of some student's day.",
  "Every child is one caring adult away from being a success story."
];

const getGreeting = (name: string) => {
  const hour = new Date().getHours();
  const isFriday = new Date().getDay() === 5;
  let base = "";

  if (hour < 12) base = `Good morning, ${name}!`;
  else base = `Good afternoon, ${name}!`;

  if (isFriday) base += " Happy Friday! 🎉";
  return base;
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
  const [pulseView, setPulseView] = useState<'log' | 'summary'>('log');
  const [showTasks, setShowTasks] = useState(false);
  const [tempName, setTempName] = useState('');
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

    window.addEventListener('gemini-fallback-triggered', handleFallback);
    return () => {
      window.removeEventListener('gemini-fallback-triggered', handleFallback);
    };
  }, []);

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
      <header className="px-4 pt-3 pb-1 no-print">
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
                  <h1 className="text-sm font-bold text-sage-dark leading-tight">
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
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Sparkles className="w-2.5 h-2.5 text-terracotta" />
                  <p className="text-[9px] font-medium text-slate-400 italic truncate max-w-[180px]">"{quote}"</p>
                  <ClassroomPulseLogo size={14} />
                  <span className="text-[8px] font-semibold text-slate-300">v2.0</span>
                </div>
              </div>
            )}
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
            <motion.div key="pulse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Sub-tab toggle */}
              <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl">
                <button
                  onClick={() => setPulseView('log')}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                    pulseView === 'log' ? 'bg-white text-sage shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  Log Note
                </button>
                <button
                  onClick={() => setPulseView('summary')}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                    pulseView === 'summary' ? 'bg-white text-sage shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  Summary
                </button>
              </div>

              {pulseView === 'log' ? (
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
              ) : (
                <SummaryView
                  notes={notes}
                  students={students}
                  classes={classes}
                />
              )}
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
      <TaskDrawer
        showTasks={showTasks}
        setShowTasks={setShowTasks}
        tasks={tasks}
        addTask={addTask}
        updateTask={updateTask}
        deleteTask={deleteTask}
      />

      <Toaster position="top-center" richColors theme={theme} />

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
