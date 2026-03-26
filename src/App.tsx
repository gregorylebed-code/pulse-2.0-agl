import React, { useState, useEffect, useRef, useCallback } from 'react';

import { useClassroomData } from './hooks/useClassroomData';
import { useAuth, signOut } from './lib/auth';
import AuthScreen from './components/AuthScreen';
import { migrateLocalDataToUser } from './utils/migrateLocalData';
import PulseScreen from './components/PulseScreen';
import SummaryView from './components/SummaryView';
import InsightsScreen from './components/InsightsScreen';
import FeedbackModal from './components/FeedbackModal';
import StudentsScreen from './components/StudentsScreen';
import TaskDrawer from './components/TaskDrawer';
import SettingsScreen from './components/SettingsScreen';
import Header from './components/Header';
import Navigation from './components/Navigation';
import { cn } from './utils/cn';
import { isFullMode } from './lib/mode';
import { getRotationForDate, SpecialsConfig } from './utils/rotationHelpers';
import { scheduleDailyReminder, scheduleCalendarReminder } from './utils/notifications';
import WelcomeModal from './components/WelcomeModal';
import Confetti, { ConfettiHandle } from './components/Confetti';

import { Sparkles, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';

const tabVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0, transition: { duration: 0.16, ease: [0.55, 0, 1, 0.45] } }),
};

const QUOTES = [
  "Progress, not perfection.",
  "You are the best part of some student's day.",
  "Every child is one caring adult away from being a success story."
];

function AuthenticatedApp({ userId, userEmail }: { userId: string; userEmail: string }) {
  const {
    notes, students, indicators, commTypes, classes, calendarEvents,
    tasks, reports, profile, rotationMapping, specialsNames,
    specialsMode, dayOfWeekSpecials, rollingStartDate, rollingLetterCount, todayOverride,
    addNote, updateNote, deleteNote,
    addStudent, updateStudent, deleteStudent,
    addTask, updateTask, deleteTask,
    addReport, deleteReport,
    goals, addGoal, updateGoal, deleteGoal,
    saveProfile, saveRotationMapping, saveSpecialsNames, saveAbbreviations,
    saveSpecialsMode, saveDayOfWeekSpecials, saveRollingConfig, saveTodayOverride,
    abbreviations, updateIndicators, updateCommTypes, updateClasses,
    updateCalendarEvents, refreshData, stats, lessonHistory, saveLessonHistory,
    notificationPrefs, saveNotificationPrefs,
    onboardingComplete, markOnboardingComplete,
    loading,
  } = useClassroomData(userId);

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('cp_theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('cp_theme', theme);
  }, [theme]);

  const [activeTab, setActiveTab] = useState<'pulse' | 'students' | 'insights' | 'settings'>('pulse');
  const tabOrder = { pulse: 0, students: 1, insights: 2, settings: 3 } as const;
  const prevTabRef = useRef<typeof activeTab>('pulse');
  const tabDirection = tabOrder[activeTab] >= tabOrder[prevTabRef.current] ? 1 : -1;
  const [classSummaries, setClassSummaries] = useState<Record<string, string>>({});
  const [pulseView, setPulseView] = useState<'log' | 'summary'>('log');
  const [pulseResetKey, setPulseResetKey] = useState(0);
  const [settingsView, setSettingsView] = useState<'main' | 'indicators' | 'profile' | 'notifications' | 'privacy' | 'quick-grader' | 'data-management' | 'roster' | 'classes' | 'calendar' | 'rotation' | 'abbreviations'>('main');
  const [showTasks, setShowTasks] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [isUsingBackup, setIsUsingBackup] = useState(false);
  const [showRotationForecast, setShowRotationForecast] = useState(false);
  const [welcomeHidden, setWelcomeHidden] = useState(false);

  // Re-show welcome when user navigates back to the pulse tab
  useEffect(() => {
    if (!onboardingComplete && activeTab === 'pulse') {
      setWelcomeHidden(false);
    }
  }, [activeTab, onboardingComplete]);

  const userName = profile.userName;
  const schoolName = profile.schoolName;
  const teacherTitle = profile.teacherTitle ?? 'Mr.';
  const teacherFirstName = profile.teacherFirstName ?? '';
  const teacherLastName = profile.teacherLastName ?? '';

  // Auto-clear todayOverride if it's from a previous day
  const todayKey = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();
  const effectiveTodayOverride = todayOverride?.date === todayKey ? todayOverride : null;

  const specialsConfig: SpecialsConfig = {
    mode: specialsMode,
    specialsNames,
    rotationMapping,
    dayOfWeekSpecials,
    rollingStartDate,
    rollingLetterCount,
    todayOverride: effectiveTodayOverride,
  };

  useEffect(() => {
    migrateLocalDataToUser(userId).then(() => refreshData());
  }, [userId]);

  // Register service worker for notification support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Schedule notifications whenever prefs, notes, or calendar events change
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const cleanups: (() => void)[] = [];

    if (notificationPrefs.dailyReminderEnabled) {
      const today = new Date().toISOString().split('T')[0];
      const hasNotesToday = notes.some(n => n.created_at.startsWith(today));
      cleanups.push(scheduleDailyReminder(notificationPrefs.dailyReminderTime, hasNotesToday));
    }

    if (notificationPrefs.calendarEventReminderEnabled) {
      const today = new Date().toISOString().split('T')[0];
      const todayEvents = calendarEvents.filter(e => e.date === today);
      cleanups.push(scheduleCalendarReminder(todayEvents));
    }

    return () => cleanups.forEach(fn => fn());
  }, [notificationPrefs, notes, calendarEvents]);

  useEffect(() => {
    const handleFallback = () => {
      setIsUsingBackup(true);
      setTimeout(() => setIsUsingBackup(false), 8000);
    };
    window.addEventListener('ai-fallback-triggered', handleFallback);
    return () => window.removeEventListener('ai-fallback-triggered', handleFallback);
  }, []);

  // Keep refs so the popstate handler never has stale closure values
  const activeTabRef = useRef(activeTab);
  const pulseViewRef = useRef(pulseView);
  const selectedStudentIdRef = useRef(selectedStudentId);
  const settingsViewRef = useRef(settingsView);
  useEffect(() => {
    prevTabRef.current = activeTabRef.current;
    activeTabRef.current = activeTab;
  }, [activeTab]);
  useEffect(() => { pulseViewRef.current = pulseView; }, [pulseView]);
  useEffect(() => { selectedStudentIdRef.current = selectedStudentId; }, [selectedStudentId]);
  useEffect(() => { settingsViewRef.current = settingsView; }, [settingsView]);

  // Android back button — navigate one level deeper → shallower instead of closing the app
  const exitPromptRef = useRef(false);
  const exitToastRef = useRef<string | number | null>(null);
  useEffect(() => {
    let pushCount = 0;
    const pushEntry = () => history.pushState({ id: ++pushCount }, '');
    // Push enough entries to cover max navigation depth (sub-menu → settings → pulse → exit warning)
    // Android PWA ignores pushState during popstate, so we pre-load the back stack at startup.
    for (let i = 0; i < 6; i++) pushEntry();

    const handlePopState = () => {
      if (selectedStudentIdRef.current) {
        selectedStudentIdRef.current = null;
        setSelectedStudentId(null);
      } else if (pulseViewRef.current === 'summary') {
        pulseViewRef.current = 'log';
        setPulseView('log');
      } else if (activeTabRef.current === 'settings' && settingsViewRef.current !== 'main') {
        settingsViewRef.current = 'main';
        setSettingsView('main');
      } else if (activeTabRef.current !== 'pulse') {
        activeTabRef.current = 'pulse';
        setActiveTab('pulse');
      } else {
        // Already at home — require a second back press to exit
        if (exitPromptRef.current) {
          return; // let Android close the app
        }
        exitPromptRef.current = true;
        if (exitToastRef.current) toast.dismiss(exitToastRef.current);
        exitToastRef.current = toast('Press back again to exit', { duration: 2000 });
        setTimeout(() => { exitPromptRef.current = false; }, 2000);
      }
      // Re-push an entry so the next back press also fires popstate.
      // Use setTimeout so it runs outside the popstate event (Android ignores
      // pushState called synchronously during popstate).
      setTimeout(pushEntry, 50);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

  const todayRotation = getRotationForDate(new Date(), specialsConfig);

  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab, settingsView]);

  // Swipe to change tabs
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const tabs = (['pulse', 'students', isFullMode ? 'insights' : null, 'settings'] as const).filter(Boolean) as ('pulse' | 'students' | 'insights' | 'settings')[];
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;
    // Only trigger if mostly horizontal and at least 60px
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // Don't swipe when in a sub-menu
    if (settingsViewRef.current !== 'main') return;
    if (selectedStudentIdRef.current) return;
    if (pulseViewRef.current === 'summary') return;
    const currentIndex = tabs.indexOf(activeTab);
    if (dx < 0 && currentIndex < tabs.length - 1) {
      prevTabRef.current = activeTab;
      setActiveTab(tabs[currentIndex + 1]);
    } else if (dx > 0 && currentIndex > 0) {
      prevTabRef.current = activeTab;
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  const confettiRef = useRef<ConfettiHandle>(null);
  const prevStatsRef = useRef<{ notes_created: number; reports_generated: number } | null>(null);
  useEffect(() => {
    // Don't seed or fire until the initial DB load is complete
    if (loading) return;
    if (prevStatsRef.current === null) {
      // First time after load — seed with real DB values, no confetti
      prevStatsRef.current = { notes_created: stats.notes_created, reports_generated: stats.reports_generated };
      return;
    }
    const prev = prevStatsRef.current;
    if (prev.notes_created === 0 && stats.notes_created === 1) {
      confettiRef.current?.fire();
      toast.success('🎉 First note saved! You\'re on your way.');
    }
    if (prev.reports_generated === 0 && stats.reports_generated === 1) {
      setTimeout(() => confettiRef.current?.fire(), 300);
      toast.success('🎉 First report generated!');
    }
    prevStatsRef.current = { notes_created: stats.notes_created, reports_generated: stats.reports_generated };
  }, [loading, stats.notes_created, stats.reports_generated]);

  return (
    <div className="min-h-screen bg-cream font-sans text-slate-900 selection:bg-sage/20 overflow-x-hidden">
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
        specialsConfig={specialsConfig}
        onSetTodayOverride={(letter) => saveTodayOverride(letter ? { date: todayKey, letter } : null)}
        tasks={tasks}
        setShowTasks={setShowTasks}
      />

      <main ref={mainRef} className="flex-1 px-6 pb-24 overflow-y-auto" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <AnimatePresence mode="wait" custom={tabDirection}>
          {activeTab === 'pulse' && (
            <motion.div key="pulse" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit" className="space-y-4">
              {pulseView === 'summary' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Class Summary</span>
                  <button
                    onClick={() => setPulseView('log')}
                    className="text-xs font-black text-sage hover:text-sage-dark transition-colors"
                  >
                    ← Back to Notes
                  </button>
                </div>
              )}

              {pulseView === 'log' && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setPulseView('summary')}
                    className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 hover:text-sage transition-colors uppercase tracking-widest"
                  >
                    <BarChart2 className="w-3.5 h-3.5" /> Class Summary
                  </button>
                </div>
              )}

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
                  resetKey={pulseResetKey}
                />
              ) : (
                <SummaryView notes={notes} students={students} classes={classes} lessonHistory={lessonHistory} saveLessonHistory={saveLessonHistory} summaries={classSummaries} setSummaries={setClassSummaries} />
              )}
            </motion.div>
          )}
          {activeTab === 'students' && (
            <motion.div key="students" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit">
              <StudentsScreen
                students={students} notes={notes} reports={reports}
                goals={goals}
                indicators={indicators} commTypes={commTypes}
                calendarEvents={calendarEvents} classes={classes}
                onUpdate={refreshData} deleteStudent={deleteStudent}
                deleteNote={deleteNote} addNote={addNote} updateNote={updateNote}
                updateStudent={updateStudent} addReport={addReport}
                deleteReport={deleteReport}
                addGoal={addGoal} updateGoal={updateGoal} deleteGoal={deleteGoal}
                abbreviations={abbreviations}
                selectedStudentId={selectedStudentId}
                setSelectedStudentId={setSelectedStudentId}
                teacherTitle={teacherTitle}
                teacherLastName={teacherLastName}
              />
            </motion.div>
          )}
          {activeTab === 'insights' && (
            <motion.div key="insights" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit">
              <InsightsScreen
                notes={notes}
                students={students}
                indicators={indicators}
                onStudentClick={(studentId) => {
                  setSelectedStudentId(studentId);
                  setActiveTab('students');
                }}
              />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit">
              <SettingsScreen
                indicators={indicators} setIndicators={updateIndicators}
                commTypes={commTypes} setCommTypes={updateCommTypes}
                classes={classes} setClasses={updateClasses}
                onImportComplete={refreshData} onNoteAdded={refreshData}
                userName={userName}
                setUserName={(name: string) => saveProfile({ ...profile, userName: name })}
                schoolName={schoolName}
                setSchoolName={(name: string) => saveProfile({ ...profile, schoolName: name })}
                teacherTitle={teacherTitle}
                setTeacherTitle={(val: string) => saveProfile({ ...profile, teacherTitle: val as any })}
                teacherFirstName={teacherFirstName}
                setTeacherFirstName={(val: string) => saveProfile({ ...profile, teacherFirstName: val })}
                teacherLastName={teacherLastName}
                setTeacherLastName={(val: string) => saveProfile({ ...profile, teacherLastName: val })}
                saveProfile={saveProfile}
                profile={profile}
                onboardingComplete={onboardingComplete}
                markOnboardingComplete={markOnboardingComplete}
                onGoToProfile={() => { setSettingsView('profile'); }}
                onGoToRoster={() => { setSettingsView('data-management'); }}
                onGoToPulse={() => { setActiveTab('pulse'); }}
                onGoToCalendar={() => { setSettingsView('calendar'); }}
                onGoToReport={() => {
                  const studentWithNotes = students.find(s => notes.some(n => n.student_id === s.id));
                  if (studentWithNotes) {
                    setSelectedStudentId(studentWithNotes.id);
                    setActiveTab('students');
                  } else {
                    setActiveTab('pulse');
                    toast('Write a note about a student first, then come back to compose a report.');
                  }
                }}
                calendarEvents={calendarEvents} setCalendarEvents={updateCalendarEvents}
                rotationMapping={rotationMapping} setRotationMapping={saveRotationMapping}
                specialsNames={specialsNames} setSpecialsNames={saveSpecialsNames}
                specialsMode={specialsMode} setSpecialsMode={saveSpecialsMode}
                dayOfWeekSpecials={dayOfWeekSpecials} setDayOfWeekSpecials={saveDayOfWeekSpecials}
                rollingStartDate={rollingStartDate} rollingLetterCount={rollingLetterCount}
                saveRollingConfig={saveRollingConfig}
                todayOverride={todayOverride} saveTodayOverride={saveTodayOverride}
                students={students} addStudent={addStudent}
                deleteStudent={deleteStudent} updateStudent={updateStudent}
                theme={theme} setTheme={setTheme}
                abbreviations={abbreviations} saveAbbreviations={saveAbbreviations}
                notes={notes}
                reportsCount={reports.length}
                stats={stats}
                userId={userId}
                userEmail={userEmail}
                onSignOut={signOut as () => Promise<any>}
                view={settingsView}
                setView={setSettingsView}
                notificationPrefs={notificationPrefs}
                saveNotificationPrefs={saveNotificationPrefs}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating task button — fixed above nav bar */}
      <button
        onClick={() => setShowTasks(true)}
        className="fixed bottom-24 right-4 w-12 h-12 bg-white text-slate-400 rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center hover:text-sage transition-all z-40 no-print"
        title="Daily Tasks"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        </svg>
        {tasks.filter(t => !t.completed).length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-terracotta text-white text-[8px] font-bold rounded-full flex items-center justify-center">
            {tasks.filter(t => !t.completed).length}
          </span>
        )}
      </button>

      <TaskDrawer
        showTasks={showTasks} setShowTasks={setShowTasks}
        tasks={tasks} addTask={addTask} updateTask={updateTask} deleteTask={deleteTask}
      />

      <Toaster position="top-center" richColors theme={theme} />

      <FeedbackModal currentView={
        activeTab === 'pulse' ? 'Pulse Screen' :
        activeTab === 'students' ? 'Students Screen' : 'Settings'
      } />

      <Navigation activeTab={activeTab} setActiveTab={(tab) => {
        if (tab === activeTab) {
          // Tapping the current tab resets its sub-view
          if (tab === 'pulse') { setPulseView('log'); setPulseResetKey(k => k + 1); }
          if (tab === 'settings') setSettingsView('main');
          if (tab === 'students') setSelectedStudentId(null);
        } else {
          if (activeTab === 'students') setSelectedStudentId(null);
          if (activeTab === 'settings') setSettingsView('main');
          setActiveTab(tab);
        }
      }} />

      <WelcomeModal
        show={!onboardingComplete && !welcomeHidden && !loading && students.length === 0 && notes.length === 0}
        teacherName={teacherFirstName || userName}
        onGoToProfile={() => { setWelcomeHidden(true); setActiveTab('settings'); setSettingsView('profile'); }}
        onGoToRoster={() => { setWelcomeHidden(true); setActiveTab('settings'); setSettingsView('data-management'); }}
        onGoToPulse={() => { setWelcomeHidden(true); setActiveTab('pulse'); }}
        onGoToCalendar={() => { setWelcomeHidden(true); setActiveTab('settings'); setSettingsView('calendar'); }}
        onDismiss={markOnboardingComplete}
      />

      <Confetti ref={confettiRef} />

      {isUsingBackup && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800 text-white rounded-full text-[11px] font-bold shadow-lg flex items-center gap-2 z-50 pointer-events-none"
        >
          <Sparkles className="w-3 h-3 text-sage" />
          Groq limit reached. Using Cerebras backup.
        </motion.div>
      )}
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-sage border-t-transparent animate-spin" />
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading</span>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  return <AuthenticatedApp userId={user.id} userEmail={user.email ?? ''} />;
}
