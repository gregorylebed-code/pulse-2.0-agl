import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AliasModeProvider } from './context/AliasModeContext';

import { useClassroomData } from './hooks/useClassroomData';
import { useAuth, signOut, signInAnonymously } from './lib/auth';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import { migrateLocalDataToUser } from './utils/migrateLocalData';
import PulseScreen from './components/PulseScreen';
import SummaryView from './components/SummaryView';
import InsightsScreen from './components/InsightsScreen';
import FeedbackModal from './components/FeedbackModal';
import StudentsScreen from './components/StudentsScreen';
import TaskDrawer from './components/TaskDrawer';
import SettingsScreen from './components/SettingsScreen';
import ShoutoutsScreen from './components/ShoutoutsScreen';
import Header from './components/Header';
import Navigation from './components/Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import InstallBanner from './components/InstallBanner';
import { useOfflineSync } from './hooks/useOfflineSync';
import { cn } from './utils/cn';
import { isFullMode } from './lib/mode';
import { getRotationForDate, SpecialsConfig } from './utils/rotationHelpers';
import { scheduleDailyReminder, scheduleCalendarReminder } from './utils/notifications';
import { trackEvent } from './lib/analytics';
import WelcomeModal from './components/WelcomeModal';
import Confetti, { ConfettiHandle } from './components/Confetti';
import CarouselMaker from './components/social-lab/CarouselMaker';

import type { Note } from './types';
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
    accommodations, addAccommodation, updateAccommodation, deleteAccommodation,
    parentCommunications, addParentCommunication, updateParentCommunication, deleteParentCommunication,
    attendanceRecords, addAttendanceRecords, deleteAttendanceRecord,
    shoutouts, addShoutout, deleteShoutout,
    saveProfile, saveRotationMapping, saveSpecialsNames, saveAbbreviations,
    saveSpecialsMode, saveDayOfWeekSpecials, saveRollingConfig, saveTodayOverride,
    abbreviations, updateIndicators, updateCommTypes, updateClasses,
    updateCalendarEvents, refreshData, stats, lessonHistory, saveLessonHistory,
    seatingChart, saveSeatingChart,
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

  // Heartbeat — update last_seen whenever the app loads
  useEffect(() => {
    supabase.from('user_presence')
      .upsert({ user_id: userId, last_seen: new Date().toISOString() }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.error('user_presence upsert failed:', error); });
  }, [userId]);

  const [activeTab, setActiveTab] = useState<'pulse' | 'students' | 'insights' | 'shoutouts' | 'settings'>('pulse');
  const tabOrder = { pulse: 0, students: 1, insights: 2, shoutouts: 3, settings: 4 } as const;
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
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);
  const [showDemoNudge, setShowDemoNudge] = useState(false);
  const [demoNudgeDismissed, setDemoNudgeDismissed] = useState(false);
  const [openGettingStarted, setOpenGettingStarted] = useState(false);

  const DEMO_NAMES = ['Falcon', 'Blueberry', 'Math-Wiz', 'Rocket', 'Zigzag', 'Panda', 'Thunderbolt', 'Comet'];
  const isInDemoMode = students.length > 0 && students.every(s => DEMO_NAMES.includes(s.name));

  // Show signup nudge after 5 minutes in demo mode
  useEffect(() => {
    if (!isInDemoMode || demoNudgeDismissed) return;
    const timer = setTimeout(() => {
      setShowDemoNudge(true);
      trackEvent('demo_nudge_shown');
    }, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [isInDemoMode, demoNudgeDismissed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitchFromDemo = async () => {
    for (const s of students) await deleteStudent(s.id);
    setDemoBannerDismissed(false);
    setWelcomeHidden(false);
    setActiveTab('pulse');
  };
  const [showGreetingBanner, setShowGreetingBanner] = useState(() => {
    const count = parseInt(localStorage.getItem('cp_login_count') || '0', 10) + 1;
    localStorage.setItem('cp_login_count', String(count));
    return count <= 3;
  });

  // Auto-launch demo mode when ?demo=true is in the URL
  useEffect(() => {
    if (loading || students.length > 0) return;
    const params = new URLSearchParams(window.location.search);
    const fromSeed = localStorage.getItem('cp_seed_demo') === 'true';
    if (params.get('demo') !== 'true' && !fromSeed) return;
    localStorage.removeItem('cp_seed_demo');
    (async () => {
      // Add demo students and collect their IDs
      const added: { name: string; id: string }[] = [];
      for (const name of DEMO_NAMES) {
        const s = await addStudent({ name, class_id: null });
        if (s) added.push({ name, id: s.id });
      }

      // Helper: date string N days ago
      const daysAgo = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return d.toISOString();
      };

      const sid = (name: string) => added.find(s => s.name === name)?.id ?? null;

      // Seed notes spread over ~4 weeks
      const demoNotes: Omit<Note, 'id' | 'created_at' | 'user_id'>[] = [
        { student_name: 'Rocket',      student_id: sid('Rocket'),      content: 'Helped a classmate without being asked. Great moment of leadership.', tags: ['Kindness', 'Leadership'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Panda',       student_id: sid('Panda'),       content: 'Struggled to stay on task during independent work. Kept getting up frequently.', tags: ['Off Task', 'Disruption'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Falcon',      student_id: sid('Falcon'),      content: 'Excellent participation in group discussion. Asked insightful questions.', tags: ['Participation', 'On Task'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Blueberry',   student_id: sid('Blueberry'),   content: 'Had a hard morning — came in upset and needed 10 min to settle before joining group.', tags: ['Emotional Regulation', 'Check-In'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Thunderbolt', student_id: sid('Thunderbolt'), content: 'Finished math early and helped others. Super positive energy all day.', tags: ['Kindness', 'On Task'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Math-Wiz',    student_id: sid('Math-Wiz'),    content: 'Refused to participate in reading. Sat with arms crossed for most of the period.', tags: ['Disruption', 'Redirected'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Zigzag',      student_id: sid('Zigzag'),      content: 'Made a mean comment toward Blueberry at lunch. Addressed it privately — apologized.', tags: ['Peer Conflict', 'Disruption'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Comet',       student_id: sid('Comet'),       content: 'Reading fluency is improving noticeably. Finished the chapter book independently.', tags: ['Persistence', 'Independent Work'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Rocket',      student_id: sid('Rocket'),      content: 'Off task most of the afternoon. Seems tired — asked if everything is okay at home.', tags: ['Off Task', 'Check-In'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Panda',       student_id: sid('Panda'),       content: 'Much better focus today compared to last week. Completed all tasks independently.', tags: ['On Task', 'Persistence'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Falcon',      student_id: sid('Falcon'),      content: 'Forgot homework again — third time this month. Need to follow up with parent.', tags: ['Unprepared/Incomplete', 'Parent Contact'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Blueberry',   student_id: sid('Blueberry'),   content: 'Big improvement today. Stayed regulated all morning, contributed to class discussion.', tags: ['Self-Regulation', 'Participation'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Thunderbolt', student_id: sid('Thunderbolt'), content: 'Scored 94% on the math assessment. Consistently one of the strongest in the group.', tags: ['Star Work', 'Independent Work'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Math-Wiz',    student_id: sid('Math-Wiz'),    content: 'Showed real effort during writing today. Completed two full paragraphs unprompted.', tags: ['Persistence', 'Growth Mindset'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Comet',       student_id: sid('Comet'),       content: 'Seemed withdrawn today. Not engaging with peers. Will keep an eye on this.', tags: ['Social Difficulty', 'Check-In'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Zigzag',      student_id: sid('Zigzag'),      content: 'Left the room twice without asking. Had to be redirected both times.', tags: ['Disruption', 'Redirected'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Rocket',      student_id: sid('Rocket'),      content: 'Kept tapping on desk and humming during quiet work. Redirected three times.', tags: ['Off Task', 'Redirected'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Panda',       student_id: sid('Panda'),       content: 'Pulled out for OT today. Came back focused and settled for the rest of the morning.', tags: ['OT', 'On Task'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Falcon',      student_id: sid('Falcon'),      content: 'Speech session today. Therapist noted good progress on articulation goals.', tags: ['Speech'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Blueberry',   student_id: sid('Blueberry'),   content: 'Pushed through a really tough math problem without giving up. Proud of this one.', tags: ['Persistence', 'Growth Mindset'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Thunderbolt', student_id: sid('Thunderbolt'), content: 'OT check-in today. Working on pencil grip — making steady progress.', tags: ['OT'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Math-Wiz',    student_id: sid('Math-Wiz'),    content: 'Called out multiple times during a lesson. Reminded about raising hand — improved after lunch.', tags: ['Disruption', 'Redirected'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Comet',       student_id: sid('Comet'),       content: 'Shared supplies and helped a new student find materials. Really kind gesture.', tags: ['Kindness', 'Team Work'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
        { student_name: 'Zigzag',      student_id: sid('Zigzag'),      content: 'Speech pull-out today. Returned calm and ready — good transition back to class.', tags: ['Speech', 'Self-Regulation'], deadline: null, image_url: null, is_pinned: false, is_checklist: false, checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null },
      ];

      const noteDates = [2, 3, 5, 5, 6, 7, 9, 10, 12, 14, 16, 18, 20, 22, 25, 26, 27, 28, 28, 29, 29, 30, 30, 30];
      for (let i = 0; i < demoNotes.length; i++) {
        try {
          const result = await addNote(demoNotes[i], daysAgo(noteDates[i]));
          if (!result) console.warn('addNote returned null for', demoNotes[i].student_name);
        } catch (e) {
          console.error('addNote failed for', demoNotes[i].student_name, e);
        }
      }

      // Seed parent communications
      const falconId = sid('Falcon');
      const blueberryId = sid('Blueberry');
      if (falconId) {
        await addParentCommunication({ student_id: falconId, student_name: 'Falcon', comm_type: 'Phone', direction: 'outbound', subject: 'Missing homework', notes: 'Left voicemail for mom about the three missing assignments. Waiting to hear back.', parent_name: null, comm_date: daysAgo(11).slice(0, 10), follow_up_date: null, follow_up_done: false, is_iep_related: false, is_urgent: false });
      }
      if (blueberryId) {
        await addParentCommunication({ student_id: blueberryId, student_name: 'Blueberry', comm_type: 'Email', direction: 'outbound', subject: 'Check-in on morning routines', notes: 'Emailed dad to share that Blueberry has been having a hard time settling in the mornings. Asked if anything has changed at home. Dad replied — mentioned some family stress. Will keep an eye on it.', parent_name: null, comm_date: daysAgo(8).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
      }

      // Seed a shoutout
      const rocketId = sid('Rocket');
      if (rocketId) {
        await addShoutout({ student_id: rocketId, student_name: 'Rocket', content: 'Went out of their way to include a new student at lunch. Just a genuinely kind kid.', category: 'Kindness' });
      }

      markOnboardingComplete();
      window.history.replaceState({}, '', window.location.pathname);
    })();
  }, [loading, students.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-show welcome when user navigates back to the pulse tab
  useEffect(() => {
    if (onboardingComplete === false && activeTab === 'pulse') {
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

  useOfflineSync(userId, refreshData);

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
  useEffect(() => {
    // Push a history entry when opening a student so browser back closes the detail view
    if (selectedStudentId && !selectedStudentIdRef.current) {
      history.pushState({ studentDetail: true }, '');
    }
    selectedStudentIdRef.current = selectedStudentId;
  }, [selectedStudentId]);
  useEffect(() => { settingsViewRef.current = settingsView; }, [settingsView]);

  // Android back button — navigate one level deeper → shallower instead of closing the app
  const exitPromptRef = useRef(false);
  const exitToastRef = useRef<string | number | null>(null);
  useEffect(() => {
    let pushCount = 0;
    const pushEntry = () => history.pushState({ id: ++pushCount }, '');
    // Pre-load back stack only for Android PWA — iOS Safari (browser) treats these as real
    // history entries and the user ends up pressing back 6 times to leave, which is confusing.
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isStandalone || isAndroid) {
      for (let i = 0; i < 6; i++) pushEntry();
    }

    const handlePopState = () => {
      // Let InsightsScreen's own handler close fullscreen cards first
      if ((window as any).__insightsCardOpen) {
        (window as any).__insightsCardOpen = false;
        setTimeout(pushEntry, 50);
        return;
      }
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
  const tabs = (['pulse', 'students', isFullMode ? 'insights' : null, isFullMode ? 'shoutouts' : null, 'settings'] as const).filter(Boolean) as ('pulse' | 'students' | 'insights' | 'shoutouts' | 'settings')[];
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.no-swipe')) return;
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
    if (!isInDemoMode) {
      if (prev.notes_created === 0 && stats.notes_created === 1) {
        confettiRef.current?.fire();
        toast.success('🎉 First note saved! You\'re on your way.');
      }
      if (prev.reports_generated === 0 && stats.reports_generated === 1) {
        setTimeout(() => confettiRef.current?.fire(), 300);
        toast.success('🎉 First report generated!');
      }
    }
    prevStatsRef.current = { notes_created: stats.notes_created, reports_generated: stats.reports_generated };
  }, [loading, stats.notes_created, stats.reports_generated]);

  if (window.location.pathname === '/lab') {
    return <CarouselMaker />;
  }

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
        specialsConfig={specialsConfig}
        onSetTodayOverride={(letter) => saveTodayOverride(letter ? { date: todayKey, letter } : null)}
        tasks={tasks}
        setShowTasks={setShowTasks}
      />

      <AnimatePresence>
        {showGreetingBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-4 mb-2 px-4 py-2.5 bg-white border border-blue-200 rounded-2xl flex items-center justify-between gap-3 no-print shadow-sm"
          >
            <p className="text-[11px] font-medium text-slate-600 leading-snug">
              Hey! I'm Greg, a 3rd-grade teacher who built this because I kept forgetting to follow up with parents.{' '}
              <a
                href="https://www.tiktok.com/@shorthandapp"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-blue-600 underline underline-offset-2"
              >
                Follow along on TikTok 👉
              </a>
            </p>
            <button
              onClick={() => setShowGreetingBanner(false)}
              className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0 text-base leading-none"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <InstallBanner />

      <main ref={mainRef} className="flex-1 px-6 overflow-y-auto" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <AnimatePresence mode="wait" custom={tabDirection}>
          {activeTab === 'pulse' && (
            <motion.div key="pulse" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit" className="space-y-4">
              {isFullMode && pulseView === 'summary' && (
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

              {isFullMode && pulseView === 'log' && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setPulseView('summary')}
                    className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 hover:text-sage transition-colors uppercase tracking-widest"
                  >
                    <BarChart2 className="w-3.5 h-3.5" /> Class Summary
                  </button>
                </div>
              )}

              {(pulseView === 'log' || !isFullMode) ? (
                <ErrorBoundary label="Log Notes">
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
                  onStudentClick={(studentId) => { setSelectedStudentId(studentId); setActiveTab('students'); }}
                  onboardingComplete={onboardingComplete}
                  onGoToSettings={() => { setActiveTab('settings'); setSettingsView('main'); }}
                  onSwitchToRealClass={students.length > 0 ? handleSwitchFromDemo : undefined}
                />
                </ErrorBoundary>
              ) : (
                <SummaryView notes={notes} students={students} classes={classes} lessonHistory={lessonHistory} saveLessonHistory={saveLessonHistory} summaries={classSummaries} setSummaries={setClassSummaries} />
              )}
            </motion.div>
          )}
          {activeTab === 'students' && isInDemoMode && !demoBannerDismissed && (
            <motion.div
              key="demo-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-16 left-0 right-0 z-40 mx-4 mt-2"
            >
              <div className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-lg">🧪</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-violet-800">You're in demo mode</p>
                  <p className="text-[11px] text-violet-500 font-medium">Ready to add your real class?</p>
                </div>
                <button
                  onClick={handleSwitchFromDemo}
                  className="text-[11px] font-black text-white bg-violet-500 hover:bg-violet-600 transition-colors px-3 py-1.5 rounded-xl flex-shrink-0"
                >
                  Switch →
                </button>
                <button onClick={() => setDemoBannerDismissed(true)} className="text-violet-300 hover:text-violet-500 transition-colors flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </motion.div>
          )}

          {isInDemoMode && showDemoNudge && !demoNudgeDismissed && (
            <motion.div
              key="demo-nudge"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="fixed bottom-20 left-0 right-0 z-50 mx-4"
            >
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-lg flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <span className="text-xl">✨</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800">Enjoying the demo?</p>
                    <p className="text-xs text-slate-500 mt-0.5">Create a free account to track your real class — your notes, your students, your data.</p>
                  </div>
                  <button
                    onClick={() => {
                      setDemoNudgeDismissed(true);
                      setShowDemoNudge(false);
                      trackEvent('demo_nudge_dismissed');
                    }}
                    className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0 mt-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <button
                  onClick={() => {
                    trackEvent('demo_nudge_cta_clicked');
                    handleSwitchFromDemo();
                  }}
                  className="w-full text-sm font-black text-white bg-sage hover:opacity-90 transition-opacity px-4 py-2.5 rounded-xl"
                >
                  Create free account →
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'students' && (
            <motion.div key="students" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit">
              <ErrorBoundary label="Students">
              <StudentsScreen
                students={students} notes={notes} reports={reports}
                goals={goals}
                indicators={indicators} commTypes={commTypes}
                calendarEvents={calendarEvents} classes={classes}
                parentCommunications={parentCommunications}
                onUpdate={refreshData} deleteStudent={deleteStudent}
                deleteNote={deleteNote} addNote={addNote} updateNote={updateNote}
                updateStudent={updateStudent} addReport={addReport}
                deleteReport={deleteReport}
                addGoal={addGoal} updateGoal={updateGoal} deleteGoal={deleteGoal}
                accommodations={accommodations}
                addAccommodation={addAccommodation} updateAccommodation={updateAccommodation} deleteAccommodation={deleteAccommodation}
                addParentCommunication={addParentCommunication}
                updateParentCommunication={updateParentCommunication}
                deleteParentCommunication={deleteParentCommunication}
                attendanceRecords={attendanceRecords}
                addAttendanceRecords={addAttendanceRecords}
                deleteAttendanceRecord={deleteAttendanceRecord}
                abbreviations={abbreviations}
                selectedStudentId={selectedStudentId}
                setSelectedStudentId={setSelectedStudentId}
                teacherTitle={teacherTitle}
                teacherLastName={teacherLastName}
                shoutouts={shoutouts}
                addTask={addTask}
                seatingChart={seatingChart}
                saveSeatingChart={saveSeatingChart}
              />
              </ErrorBoundary>
            </motion.div>
          )}
          {activeTab === 'insights' && (
            <motion.div key="insights" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit">
              <ErrorBoundary label="Insights">
              <InsightsScreen
                notes={notes}
                students={students}
                indicators={indicators}
                onStudentClick={(studentId) => {
                  setSelectedStudentId(studentId);
                  setActiveTab('students');
                }}
              />
              </ErrorBoundary>
            </motion.div>
          )}
          {activeTab === 'shoutouts' && (
            <motion.div key="shoutouts" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit">
              <ErrorBoundary label="Shoutouts">
              <ShoutoutsScreen
                shoutouts={shoutouts}
                students={students}
                addShoutout={addShoutout}
                deleteShoutout={deleteShoutout}
                onCelebrate={() => confettiRef.current?.fire()}
              />
              </ErrorBoundary>
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
                forceOpenGettingStarted={openGettingStarted}
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
        className="fixed bottom-24 right-4 w-12 h-14 bg-white text-slate-400 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center justify-center gap-0 hover:text-sage transition-all z-40 no-print"
        title="Daily Tasks"
      >
        <span className="text-[7px] font-black uppercase tracking-wide leading-none mb-0.5">To Do</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        </svg>
        <span className="text-[7px] font-black uppercase tracking-wide leading-none mt-0.5">List</span>
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
      } onSwitchToRealClass={students.length > 0 ? handleSwitchFromDemo : undefined} onNavigate={(action) => {
        if (action === 'pulse') { setActiveTab('pulse'); }
        else if (action === 'students') { setActiveTab('students'); }
        else if (action === 'settings-import') { setActiveTab('settings'); setSettingsView('data-management'); }
        else if (action === 'settings-getting-started') {
          setActiveTab('settings');
          setSettingsView('main');
          setOpenGettingStarted(true);
          setTimeout(() => setOpenGettingStarted(false), 500);
        }
      }} />

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
        show={!welcomeHidden && !loading && students.length === 0 && notes.length === 0}
        teacherName={teacherFirstName || userName}
        onGoToProfile={() => { setWelcomeHidden(true); setActiveTab('settings'); setSettingsView('profile'); }}
        onGoToRoster={() => { setWelcomeHidden(true); setActiveTab('settings'); setSettingsView('data-management'); }}
        onGoToPulse={() => { setWelcomeHidden(true); setActiveTab('pulse'); }}
        onGoToCalendar={() => { setWelcomeHidden(true); setActiveTab('settings'); setSettingsView('calendar'); }}
        onDismiss={() => setWelcomeHidden(true)}
        onAddStudents={async (names: string[]) => {
          for (const name of names) {
            await addStudent({ name, class_id: null });
          }
          markOnboardingComplete();
        }}
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
  const [signingInAnon, setSigningInAnon] = useState(false);

  const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true'
    || localStorage.getItem('cp_launch_demo') === 'true';

  useEffect(() => {
    if (!isDemo || loading || user || signingInAnon) return;
    setSigningInAnon(true);
    localStorage.removeItem('cp_launch_demo');
    window.history.replaceState({}, '', window.location.pathname);
    const timeout = setTimeout(() => setSigningInAnon(false), 8000);
    signInAnonymously().then(({ error: e }) => {
      if (e) { console.error('Anonymous sign-in failed', e); setSigningInAnon(false); clearTimeout(timeout); }
      else { localStorage.setItem('cp_seed_demo', 'true'); }
    });
    return () => clearTimeout(timeout);
  }, [isDemo, loading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear signingInAnon once auth resolves
  useEffect(() => {
    if (user && signingInAnon) setSigningInAnon(false);
  }, [user, signingInAnon]);

  if (loading || signingInAnon) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-sage border-t-transparent animate-spin" />
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{signingInAnon ? 'Loading demo…' : 'Loading'}</span>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  return (
    <AliasModeProvider>
      <AuthenticatedApp userId={user.id} userEmail={user.email ?? ''} />
    </AliasModeProvider>
  );
}
