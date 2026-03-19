import React, { useState, useEffect } from 'react';

import { useClassroomData } from './hooks/useClassroomData';
import PulseScreen from './components/PulseScreen';
import SummaryView from './components/SummaryView';
import FeedbackModal from './components/FeedbackModal';
import StudentsScreen from './components/StudentsScreen';
import TaskDrawer from './components/TaskDrawer';
import SettingsScreen from './components/SettingsScreen';
import Header from './components/Header';
import Navigation from './components/Navigation';
import { cn } from './utils/cn';
import { getRotationForDate } from './utils/rotationHelpers';

import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';

const QUOTES = [
  "Progress, not perfection.",
  "You are the best part of some student's day.",
  "Every child is one caring adult away from being a success story."
];

export default function App() {
  const {
    notes, students, indicators, commTypes, classes, calendarEvents,
    tasks, reports, profile, rotationMapping, specialsNames,
    addNote, updateNote, deleteNote,
    addStudent, updateStudent, deleteStudent,
    addTask, updateTask, deleteTask,
    addReport, deleteReport,
    saveProfile, saveRotationMapping, saveSpecialsNames, saveAbbreviations,
    abbreviations, updateIndicators, updateCommTypes, updateClasses,
    updateCalendarEvents, refreshData,
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

  const userName = profile.userName;
  const schoolName = profile.schoolName;

  useEffect(() => {
    const handleFallback = () => {
      setIsUsingBackup(true);
      setTimeout(() => setIsUsingBackup(false), 8000);
    };
    window.addEventListener('gemini-fallback-triggered', handleFallback);
    return () => window.removeEventListener('gemini-fallback-triggered', handleFallback);
  }, []);

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

  const todayRotation = getRotationForDate(new Date(), rotationMapping, specialsNames);

  return (
    <div className="min-h-screen bg-cream font-sans text-slate-900 selection:bg-sage/20">
      <Header
        userName={userName}
        quote={quote}
        tempName={tempName}
        setTempName={setTempName}
        saveName={saveName}
        resetUserName={resetUserName}
        todayRotation={todayRotation}
        showRotationForecast={showRotationForecast}
        setShowRotationForecast={setShowRotationForecast}
        rotationMapping={rotationMapping}
        specialsNames={specialsNames}
        tasks={tasks}
        setShowTasks={setShowTasks}
      />

      <main className="flex-1 px-6 pb-24 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'pulse' && (
            <motion.div key="pulse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
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
                <SummaryView notes={notes} students={students} classes={classes} />
              )}
            </motion.div>
          )}
          {activeTab === 'students' && (
            <motion.div key="students" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StudentsScreen
                students={students} notes={notes} reports={reports}
                indicators={indicators} commTypes={commTypes}
                calendarEvents={calendarEvents} classes={classes}
                onUpdate={refreshData} deleteStudent={deleteStudent}
                deleteNote={deleteNote} addNote={addNote} updateNote={updateNote}
                updateStudent={updateStudent} addReport={addReport}
                deleteReport={deleteReport} abbreviations={abbreviations}
              />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SettingsScreen
                indicators={indicators} setIndicators={updateIndicators}
                commTypes={commTypes} setCommTypes={updateCommTypes}
                classes={classes} setClasses={updateClasses}
                onImportComplete={refreshData} onNoteAdded={refreshData}
                userName={userName}
                setUserName={(name: string) => saveProfile({ ...profile, userName: name })}
                schoolName={schoolName}
                setSchoolName={(name: string) => saveProfile({ ...profile, schoolName: name })}
                calendarEvents={calendarEvents} setCalendarEvents={updateCalendarEvents}
                rotationMapping={rotationMapping} setRotationMapping={saveRotationMapping}
                specialsNames={specialsNames} setSpecialsNames={saveSpecialsNames}
                students={students} addStudent={addStudent}
                deleteStudent={deleteStudent} updateStudent={updateStudent}
                theme={theme} setTheme={setTheme}
                abbreviations={abbreviations} saveAbbreviations={saveAbbreviations}
                notes={notes}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <TaskDrawer
        showTasks={showTasks} setShowTasks={setShowTasks}
        tasks={tasks} addTask={addTask} updateTask={updateTask} deleteTask={deleteTask}
      />

      <Toaster position="top-center" richColors theme={theme} />

      <FeedbackModal currentView={
        activeTab === 'pulse' ? 'Pulse Screen' :
        activeTab === 'students' ? 'Students Screen' : 'Settings'
      } />

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

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
