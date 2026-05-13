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
import { FullModeProvider, useFullMode } from './context/FullModeContext';
import { getRotationForDate, SpecialsConfig } from './utils/rotationHelpers';
import { scheduleDailyReminder, scheduleCalendarReminder } from './utils/notifications';
import { trackEvent } from './lib/analytics';
import WelcomeModal from './components/WelcomeModal';
import ParentCommsScreen from './components/ParentCommsScreen';
import Confetti, { ConfettiHandle } from './components/Confetti';
import CarouselMaker from './components/social-lab/CarouselMaker';
import StudioPanel, { AccentTheme, BgTheme } from './components/StudioPanel';

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
    seedSandbox, wipeSandbox,
    loading,
  } = useClassroomData(userId);

  const isFullMode = useFullMode();

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('cp_theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('cp_theme', theme);
  }, [theme]);

  const [studioOpen, setStudioOpen] = useState(false);
  const [studioTheme, setStudioTheme] = useState<AccentTheme>('default');
  const [studioBg, setStudioBg] = useState<BgTheme>('cream');
  const [studioShuffle, setStudioShuffle] = useState(0);
  const [studioClassLabel, setStudioClassLabel] = useState<string | null>(null);

  useEffect(() => {
    const el = document.documentElement;
    const palettes: Record<string, [string, string, string]> = {
      default: ['#34d399', '#a7f3d0', '#10b981'],
      amber:   ['#f59e0b', '#fde68a', '#d97706'],
      rose:    ['#f43f5e', '#fecdd3', '#e11d48'],
      violet:  ['#8b5cf6', '#ddd6fe', '#7c3aed'],
      cyan:    ['#06b6d4', '#a5f3fc', '#0891b2'],
    };
    const [main, light, dark] = palettes[studioTheme] ?? palettes.default;
    el.style.setProperty('--color-sage', main);
    el.style.setProperty('--color-sage-light', light);
    el.style.setProperty('--color-sage-dark', dark);
  }, [studioTheme]);

  useEffect(() => {
    const bgs: Record<BgTheme, [string, string]> = {
      cream:    ['#FFF9E5', 'rgba(255,249,229,1)'],
      sky:      ['#e8f4fd', 'rgba(232,244,253,1)'],
      lavender: ['#f0eeff', 'rgba(240,238,255,1)'],
      slate:    ['#f0f4f8', 'rgba(240,244,248,1)'],
      sage:     ['#e8faf3', 'rgba(232,250,243,1)'],
    };
    const [bg, nav] = bgs[studioBg];
    document.documentElement.style.setProperty('--color-cream', bg);
    document.documentElement.style.setProperty('--studio-nav-bg', nav);
  }, [studioBg]);

  // Heartbeat — update last_seen whenever the app loads
  useEffect(() => {
    supabase.from('user_presence')
      .upsert({ user_id: userId, last_seen: new Date().toISOString() }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.error('user_presence upsert failed:', error); });
  }, [userId]);

  const [activeTab, setActiveTab] = useState<'pulse' | 'students' | 'parents' | 'insights' | 'shoutouts' | 'settings'>('pulse');
  const tabOrder = { pulse: 0, students: 1, parents: 2, insights: 3, shoutouts: 4, settings: 5 } as const;
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
  const [demoModalLatched, setDemoModalLatched] = useState(false);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);
  const [showDemoNudge, setShowDemoNudge] = useState(false);
  const [demoNudgeDismissed, setDemoNudgeDismissed] = useState(false);
  const [openGettingStarted, setOpenGettingStarted] = useState(false);

  const DEMO_NAMES = ['Falcon', 'Blueberry', 'Math-Wiz', 'Rocket', 'Zigzag', 'Panda', 'Thunderbolt', 'Comet'];
  // isInDemoMode = anonymous demo account (info@getshorthandapp.com) with demo-named students but no is_demo flag
  // sandbox users (real accounts) have is_demo:true on their students — they are NOT demo mode
  const hasSandboxStudents = students.some(s => s.is_demo === true);
  const isInDemoMode = !hasSandboxStudents && students.length > 0 && students.every(s => DEMO_NAMES.includes(s.name));

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

      // Seed notes spread over ~4 weeks + this week (Mon-Fri)
      // Day offsets: Mon=5, Tue=4, Wed=3, Thu=2, Fri=1 (relative to today)
      const mkNote = (student_name: string, content: string, tags: string[]): Omit<Note, 'id' | 'created_at' | 'user_id'> => ({
        student_name, student_id: sid(student_name), content, tags,
        deadline: null, image_url: null, is_pinned: false, is_checklist: false,
        checklist_data: [], is_parent_communication: false, parent_communication_type: '', class_name: null,
      });

      const demoNotes: Array<{ note: Omit<Note, 'id' | 'created_at' | 'user_id'>; daysAgoN: number }> = [
        // --- older notes (keep existing ones, spread 8–30 days ago) ---
        { note: mkNote('Rocket',      'Helped a classmate without being asked. Great moment.',                                          ['Kindness', 'Leadership']),           daysAgoN: 28 },
        { note: mkNote('Panda',       'Struggled to stay on task during independent work. Kept getting up.',                            ['Off Task', 'Disruption']),           daysAgoN: 27 },
        { note: mkNote('Falcon',      'Excellent participation in group discussion. Asked good questions.',                              ['Participation', 'On Task']),         daysAgoN: 26 },
        { note: mkNote('Blueberry',   'Hard morning — came in upset and needed about 10 min to settle.',                               ['Emotional Regulation', 'Check-In']), daysAgoN: 25 },
        { note: mkNote('Thunderbolt', 'Finished math early and helped two other kids. Positive all day.',                               ['Kindness', 'On Task']),              daysAgoN: 24 },
        { note: mkNote('Math-Wiz',    'Refused to participate in reading. Sat with arms crossed the whole period.',                     ['Disruption', 'Redirected']),         daysAgoN: 23 },
        { note: mkNote('Zigzag',      'Made a mean comment toward Blueberry at lunch. Addressed it privately — apologized.',            ['Peer Conflict', 'Disruption']),      daysAgoN: 22 },
        { note: mkNote('Comet',       'Reading fluency is improving. Finished the chapter book independently.',                         ['Persistence', 'Independent Work']),  daysAgoN: 21 },
        { note: mkNote('Rocket',      'Off task most of the afternoon. Seems tired — asked if everything is okay at home.',             ['Off Task', 'Check-In']),             daysAgoN: 20 },
        { note: mkNote('Panda',       'Much better focus today. Completed all tasks without prompting.',                                ['On Task', 'Persistence']),           daysAgoN: 19 },
        { note: mkNote('Falcon',      'Forgot homework — third time this month. Need to follow up with mom.',                           ['Unprepared', 'Parent Contact']),     daysAgoN: 18 },
        { note: mkNote('Blueberry',   'Big improvement. Stayed regulated all morning, contributed to discussion.',                      ['Self-Regulation', 'Participation']), daysAgoN: 17 },
        { note: mkNote('Thunderbolt', 'Scored 94% on the math assessment. Consistently one of the strongest.',                         ['Star Work', 'Independent Work']),    daysAgoN: 16 },
        { note: mkNote('Math-Wiz',    'Showed real effort during writing. Completed two paragraphs without being asked.',               ['Persistence', 'Growth Mindset']),    daysAgoN: 15 },
        { note: mkNote('Comet',       'Seemed withdrawn. Not really engaging with anyone. Will keep an eye on this.',                   ['Social Difficulty', 'Check-In']),    daysAgoN: 14 },
        { note: mkNote('Zigzag',      'Left the room twice without asking. Had to be redirected both times.',                           ['Disruption', 'Redirected']),         daysAgoN: 13 },
        { note: mkNote('Rocket',      'Kept tapping on desk and humming during quiet work. Redirected three times.',                    ['Off Task', 'Redirected']),           daysAgoN: 12 },
        { note: mkNote('Panda',       'OT pull-out today. Came back focused and settled for the rest of the morning.',                  ['OT', 'On Task']),                    daysAgoN: 11 },
        { note: mkNote('Falcon',      'Speech session. Therapist noted good progress on articulation goals.',                           ['Speech']),                           daysAgoN: 10 },
        { note: mkNote('Blueberry',   'Pushed through a tough math problem without giving up. Really proud of this.',                   ['Persistence', 'Growth Mindset']),    daysAgoN: 9  },
        { note: mkNote('Thunderbolt', 'OT check-in. Working on pencil grip — making steady progress.',                                  ['OT']),                               daysAgoN: 8  },
        { note: mkNote('Math-Wiz',    'Called out multiple times during a lesson. Reminded about hand raising — better after lunch.',   ['Disruption', 'Redirected']),         daysAgoN: 7  },
        { note: mkNote('Comet',       'Shared supplies and helped a new student find materials. Really kind.',                          ['Kindness', 'Team Work']),            daysAgoN: 6  },
        { note: mkNote('Zigzag',      'Speech pull-out. Returned calm and ready — good transition back.',                               ['Speech', 'Self-Regulation']),        daysAgoN: 6  },

        // --- THIS WEEK: Monday (5 days ago) ---
        { note: mkNote('Rocket',      'Mom texted this morning — said he didn\'t sleep well. Keeping an eye on him.',                   ['Check-In']),                         daysAgoN: 5 },
        { note: mkNote('Panda',       'Full meltdown during math. Threw pencil, had to step into hallway for about 8 minutes.',         ['Emotional Regulation', 'Disruption']), daysAgoN: 5 },
        { note: mkNote('Falcon',      'No homework again. That\'s four times now. Reached out to mom.',                                 ['Unprepared', 'Parent Contact']),     daysAgoN: 5 },
        { note: mkNote('Blueberry',   'Really strong Monday. Settled quickly, volunteered twice in discussion.',                        ['Participation', 'On Task']),         daysAgoN: 5 },
        { note: mkNote('Thunderbolt', 'Finished the week 9 packet before lunch. Helped Comet with long division.',                     ['Star Work', 'Kindness']),            daysAgoN: 5 },
        { note: mkNote('Math-Wiz',    'Talked all through the read-aloud. Redirected four times. Moved seat.',                          ['Disruption', 'Redirected']),         daysAgoN: 5 },
        { note: mkNote('Zigzag',      'Pushed a kid at recess. Said the other kid started it. Looking into it.',                        ['Peer Conflict', 'Disruption']),      daysAgoN: 5 },
        { note: mkNote('Comet',       'Barely spoke all day. Ate lunch alone. Sending an email home tonight.',                          ['Social Difficulty', 'Check-In']),    daysAgoN: 5 },

        // --- THIS WEEK: Tuesday (4 days ago) ---
        { note: mkNote('Rocket',      'Tired again but pushed through. Mom added lunch money — no issues at school.',                   ['Check-In']),                         daysAgoN: 4 },
        { note: mkNote('Panda',       'Much calmer today. No incidents. Stayed in seat for all of writing.',                            ['On Task', 'Self-Regulation']),       daysAgoN: 4 },
        { note: mkNote('Falcon',      'Brought homework! First time in two weeks. Made a point to praise this.',                        ['Prepared', 'On Task']),              daysAgoN: 4 },
        { note: mkNote('Blueberry',   'Had a hard time in PE — got frustrated and sat out for a bit. Back to normal after.',            ['Emotional Regulation', 'Check-In']), daysAgoN: 4 },
        { note: mkNote('Thunderbolt', 'Led the morning meeting without being asked. Class loved it.',                                   ['Leadership', 'Participation']),      daysAgoN: 4 },
        { note: mkNote('Math-Wiz',    'Better today — only two call-outs. Positive reinforcement seemed to help.',                      ['Participation', 'On Task']),         daysAgoN: 4 },
        { note: mkNote('Zigzag',      'Quiet all morning. Hard to tell if processing the recess thing or just tired.',                  ['Check-In']),                         daysAgoN: 4 },
        { note: mkNote('Comet',       'Sat with Thunderbolt at lunch today. Small win.',                                                ['Social Difficulty', 'Participation']), daysAgoN: 4 },

        // --- THIS WEEK: Wednesday (3 days ago) ---
        { note: mkNote('Rocket',      'Mom emailed — Rocket didn\'t understand ELA homework last night. Will check in with him today.', ['Check-In', 'Parent Contact']),       daysAgoN: 3 },
        { note: mkNote('Panda',       'Rough afternoon. Got into a disagreement with Math-Wiz over a game. Redirected.',                ['Peer Conflict', 'Disruption']),      daysAgoN: 3 },
        { note: mkNote('Falcon',      'Speech session. Decent day overall — engaged during science.',                                   ['Speech', 'Participation']),          daysAgoN: 3 },
        { note: mkNote('Blueberry',   'Great writing workshop today. Wrote three paragraphs and asked to share with the class.',        ['Star Work', 'Participation']),       daysAgoN: 3 },
        { note: mkNote('Thunderbolt', 'Scored 100% on the spelling test. Fourth week in a row.',                                       ['Star Work']),                        daysAgoN: 3 },
        { note: mkNote('Math-Wiz',    'Got into it with Panda at indoor recess. Both calmed down quickly. Talked to each separately.',  ['Peer Conflict', 'Disruption']),      daysAgoN: 3 },
        { note: mkNote('Zigzag',      'Had a good morning then fell apart after lunch — yelled at a classmate. Sent a note home.',      ['Disruption', 'Emotional Regulation']), daysAgoN: 3 },
        { note: mkNote('Comet',       'Opened up a little in small group. Asked a question without being prompted.',                    ['Participation', 'On Task']),         daysAgoN: 3 },

        // --- THIS WEEK: Thursday (2 days ago) ---
        { note: mkNote('Rocket',      'Checked in on the ELA stuff — he understood it fine, just got anxious. We talked through it.',   ['Check-In', 'Self-Regulation']),      daysAgoN: 2 },
        { note: mkNote('Panda',       'OT pull-out. Came back and had a really solid rest of the day.',                                 ['OT', 'On Task']),                    daysAgoN: 2 },
        { note: mkNote('Falcon',      'No homework again. We\'re back to square one.',                                                  ['Unprepared']),                       daysAgoN: 2 },
        { note: mkNote('Blueberry',   'Good day. No regulation issues. Helped Comet find a book at the library.',                      ['Kindness', 'On Task']),              daysAgoN: 2 },
        { note: mkNote('Thunderbolt', 'Presented the science report — clear, confident, well-prepared.',                               ['Star Work', 'Participation']),       daysAgoN: 2 },
        { note: mkNote('Math-Wiz',    'Talked through entire math lesson. Moved to individual desk. Worked better.',                    ['Disruption', 'Redirected']),         daysAgoN: 2 },
        { note: mkNote('Zigzag',      'No response from mom about Wednesday. Going to try calling today.',                              ['Parent Contact', 'Check-In']),       daysAgoN: 2 },
        { note: mkNote('Comet',       'Laughed at something Thunderbolt said at lunch. First time I\'ve seen a real smile this week.',  ['Social Difficulty', 'Check-In']),    daysAgoN: 2 },

        // --- THIS WEEK: Friday (1 day ago) ---
        { note: mkNote('Rocket',      'Mom emailed again — asked how the week went. Good energy today, seemed rested.',                 ['Check-In']),                         daysAgoN: 1 },
        { note: mkNote('Panda',       'Best day of the week. Completed everything, no incidents. Told him I noticed.',                  ['On Task', 'Self-Regulation']),       daysAgoN: 1 },
        { note: mkNote('Falcon',      'Left phone on desk during a test. Reminded once — put it away without attitude.',                ['Redirected']),                       daysAgoN: 1 },
        { note: mkNote('Blueberry',   'Strong finish to the week. Volunteered to read aloud — huge for this kid.',                     ['Participation', 'Growth Mindset']),  daysAgoN: 1 },
        { note: mkNote('Thunderbolt', 'Helped me clean up after the science experiment. Just did it without being asked.',              ['Kindness', 'Leadership']),           daysAgoN: 1 },
        { note: mkNote('Math-Wiz',    'Quieter Friday. Only one redirect. Ended the week on a decent note.',                           ['On Task']),                          daysAgoN: 1 },
        { note: mkNote('Zigzag',      'Called mom — left voicemail. Still no callback. Will escalate next week.',                      ['Parent Contact', 'Disruption']),     daysAgoN: 1 },
        { note: mkNote('Comet',       'Asked to work with a partner today instead of alone. Progress.',                                ['Social Difficulty', 'Participation']), daysAgoN: 1 },
      ];

      for (const { note, daysAgoN } of demoNotes) {
        try {
          const result = await addNote(note, daysAgo(daysAgoN));
          if (!result) console.warn('addNote returned null for', note.student_name);
        } catch (e) {
          console.error('addNote failed for', note.student_name, e);
        }
      }

      // Seed parent communications
      // Rocket's mom: contacts nearly every day — the helicopter parent
      const rocketIdComm = sid('Rocket');
      if (rocketIdComm) {
        await addParentCommunication({ student_id: rocketIdComm, student_name: 'Rocket', comm_type: 'Email', direction: 'inbound', subject: 'He didn\'t sleep well', notes: 'Mom: "Just wanted to give you a heads up — Rocket had a really rough night. He was up until almost midnight. Just keep an eye on him today."', parent_name: 'Mom (Linda)', comm_date: daysAgo(5).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: rocketIdComm, student_name: 'Rocket', comm_type: 'Email', direction: 'outbound', subject: 'Re: He didn\'t sleep well', notes: 'Thanks for the heads up, Linda. I\'ll keep an eye on him and check in this morning. He\'s in good hands.', parent_name: 'Mom (Linda)', comm_date: daysAgo(5).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: rocketIdComm, student_name: 'Rocket', comm_type: 'Email', direction: 'inbound', subject: 'Lunch money', notes: 'Mom: "Hi! I just added $20 to his lunch account. Also he left his water bottle at home today, hope that\'s okay."', parent_name: 'Mom (Linda)', comm_date: daysAgo(4).slice(0, 10), follow_up_date: null, follow_up_done: false, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: rocketIdComm, student_name: 'Rocket', comm_type: 'Email', direction: 'inbound', subject: 'ELA homework', notes: 'Mom: "Rocket was really struggling with the ELA homework last night. We tried our best but he got really frustrated. Just wanted you to know we didn\'t give up on it."', parent_name: 'Mom (Linda)', comm_date: daysAgo(3).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: rocketIdComm, student_name: 'Rocket', comm_type: 'Email', direction: 'outbound', subject: 'Re: ELA homework', notes: 'No worries at all — I\'ll check in with him today and walk through it together. The fact that he tried is what matters.', parent_name: 'Mom (Linda)', comm_date: daysAgo(3).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: rocketIdComm, student_name: 'Rocket', comm_type: 'Email', direction: 'inbound', subject: 'How was his week?', notes: 'Mom: "Just checking in — how did the rest of the week go? He seemed in a better mood today when I picked him up."', parent_name: 'Mom (Linda)', comm_date: daysAgo(1).slice(0, 10), follow_up_date: null, follow_up_done: false, is_iep_related: false, is_urgent: false });
      }

      // Panda: teacher reached out after the meltdown — no reply
      const pandaId = sid('Panda');
      if (pandaId) {
        await addParentCommunication({ student_id: pandaId, student_name: 'Panda', comm_type: 'ParentSquare', direction: 'outbound', subject: 'Checking in after a hard day', notes: 'Panda had a really difficult morning — she got very upset during math and needed some time to cool down in the hallway. She recovered well and finished the day strong. Just wanted to keep you in the loop. Happy to chat if you have questions.', parent_name: null, comm_date: daysAgo(5).slice(0, 10), follow_up_date: daysAgo(2).slice(0, 10), follow_up_done: false, is_iep_related: false, is_urgent: false });
      }

      // Falcon: homework issues — mix of voicemail and email, mostly one-sided
      const falconId = sid('Falcon');
      if (falconId) {
        await addParentCommunication({ student_id: falconId, student_name: 'Falcon', comm_type: 'Phone', direction: 'outbound', subject: 'Missing homework — checking in', notes: 'Left voicemail for mom. This is the fourth missing assignment this month. Mentioned that Falcon is capable and I want to help figure out what\'s getting in the way.', parent_name: 'Mom', comm_date: daysAgo(5).slice(0, 10), follow_up_date: daysAgo(3).slice(0, 10), follow_up_done: false, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: falconId, student_name: 'Falcon', comm_type: 'Email', direction: 'inbound', subject: 'Re: homework', notes: 'Mom: "Sorry I missed your call. We\'ve been dealing with a lot at home. I\'ll talk to him tonight."', parent_name: 'Mom', comm_date: daysAgo(4).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: falconId, student_name: 'Falcon', comm_type: 'Phone', direction: 'outbound', subject: 'Still missing work', notes: 'Called again — no answer. Left another voicemail. Asked if a meeting would help.', parent_name: 'Mom', comm_date: daysAgo(2).slice(0, 10), follow_up_date: null, follow_up_done: false, is_iep_related: false, is_urgent: false });
      }

      // Blueberry: supportive dad, good two-way communication via email
      const blueberryId = sid('Blueberry');
      if (blueberryId) {
        await addParentCommunication({ student_id: blueberryId, student_name: 'Blueberry', comm_type: 'Email', direction: 'outbound', subject: 'Check-in on morning routines', notes: 'Emailed dad to share that Blueberry has been having a hard time settling in the mornings. Asked if anything has changed at home.', parent_name: 'Dad (Marcus)', comm_date: daysAgo(9).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: blueberryId, student_name: 'Blueberry', comm_type: 'Email', direction: 'inbound', subject: 'Re: Check-in on morning routines', notes: 'Dad: "Thanks for letting us know. We\'ve had some changes at home — her grandma has been staying with us and the schedule is off. We\'re working on it. Really appreciate you reaching out."', parent_name: 'Dad (Marcus)', comm_date: daysAgo(8).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: blueberryId, student_name: 'Blueberry', comm_type: 'Email', direction: 'outbound', subject: 'Great week!', notes: 'Just wanted to share — Blueberry had a really strong week. She volunteered to read aloud on Friday and knocked it out of the park. You should be proud.', parent_name: 'Dad (Marcus)', comm_date: daysAgo(1).slice(0, 10), follow_up_date: null, follow_up_done: false, is_iep_related: false, is_urgent: false });
      }

      // Zigzag: escalating behavior, teacher reaching out — no response
      const zigzagId = sid('Zigzag');
      if (zigzagId) {
        await addParentCommunication({ student_id: zigzagId, student_name: 'Zigzag', comm_type: 'ParentSquare', direction: 'outbound', subject: 'Incident at recess', notes: 'Zigzag pushed another student at recess today. I separated them and we talked about it — he was calm afterward. Wanted to keep you in the loop. Please let me know if you have questions.', parent_name: null, comm_date: daysAgo(5).slice(0, 10), follow_up_date: daysAgo(3).slice(0, 10), follow_up_done: false, is_iep_related: false, is_urgent: true });
        await addParentCommunication({ student_id: zigzagId, student_name: 'Zigzag', comm_type: 'ParentSquare', direction: 'outbound', subject: 'Following up', notes: 'Hi — just following up on Monday\'s message. Zigzag had another rough afternoon on Wednesday and I want to connect before next week. Is there a good time to talk?', parent_name: null, comm_date: daysAgo(3).slice(0, 10), follow_up_date: null, follow_up_done: false, is_iep_related: false, is_urgent: true });
        await addParentCommunication({ student_id: zigzagId, student_name: 'Zigzag', comm_type: 'Phone', direction: 'outbound', subject: 'Tried calling', notes: 'Called the number on file — went to voicemail. Left a message asking for a callback. Will try again Monday if I don\'t hear back.', parent_name: null, comm_date: daysAgo(1).slice(0, 10), follow_up_date: null, follow_up_done: false, is_iep_related: false, is_urgent: true });
      }

      // Comet: withdrawn kid, teacher reached out proactively, got a helpful reply
      const cometId = sid('Comet');
      if (cometId) {
        await addParentCommunication({ student_id: cometId, student_name: 'Comet', comm_type: 'Email', direction: 'outbound', subject: 'Checking in on Comet', notes: 'I\'ve noticed Comet has been a bit quieter than usual this week — eating alone, not engaging much in class. Nothing alarming, just wanted to check in and see if there\'s anything going on at home I should be aware of.', parent_name: null, comm_date: daysAgo(5).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: cometId, student_name: 'Comet', comm_type: 'Email', direction: 'inbound', subject: 'Re: Checking in on Comet', notes: 'Mom: "Thank you so much for reaching out. Honestly yes — her best friend moved to a different school last month and she\'s been really down about it. We\'re talking to her at home but haven\'t known how to help. Any suggestions would be amazing."', parent_name: 'Mom', comm_date: daysAgo(4).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: cometId, student_name: 'Comet', comm_type: 'Email', direction: 'outbound', subject: 'Re: Re: Checking in on Comet', notes: 'That context is really helpful, thank you. I\'ll be intentional about pairing her with some kids I think she\'d connect with. I also noticed she sat with a classmate at lunch today — small step but a good one. I\'ll keep you posted.', parent_name: 'Mom', comm_date: daysAgo(4).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
      }

      // Thunderbolt: mom only emails for logistics — one note
      const thunderboltId = sid('Thunderbolt');
      if (thunderboltId) {
        await addParentCommunication({ student_id: thunderboltId, student_name: 'Thunderbolt', comm_type: 'Email', direction: 'inbound', subject: 'Early pickup Thursday', notes: 'Mom: "Hi! Quick note — I\'ll be picking Thunderbolt up at 1:30 on Thursday for a dentist appointment. Just wanted to give you advance notice."', parent_name: 'Mom', comm_date: daysAgo(6).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
      }

      // Math-Wiz: mom uses ParentSquare, responded to the behavior note but not consistently
      const mathWizId = sid('Math-Wiz');
      if (mathWizId) {
        await addParentCommunication({ student_id: mathWizId, student_name: 'Math-Wiz', comm_type: 'ParentSquare', direction: 'outbound', subject: 'Classroom behavior this week', notes: 'I wanted to share that we\'ve been having some challenges with Math-Wiz calling out during lessons and talking over other students. He\'s clearly engaged and smart — I just want to channel that energy in the right direction. Would love to connect and share some strategies that might help at home too.', parent_name: null, comm_date: daysAgo(7).slice(0, 10), follow_up_date: daysAgo(4).slice(0, 10), follow_up_done: true, is_iep_related: false, is_urgent: false });
        await addParentCommunication({ student_id: mathWizId, student_name: 'Math-Wiz', comm_type: 'ParentSquare', direction: 'inbound', subject: 'Re: Classroom behavior', notes: 'Mom: "Thanks for letting me know. I had a talk with him last night. He said he gets bored sometimes and starts talking. I told him he needs to respect the classroom. I\'ll keep reminding him."', parent_name: 'Mom', comm_date: daysAgo(6).slice(0, 10), follow_up_date: null, follow_up_done: true, is_iep_related: false, is_urgent: false });
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

  // Latch the demo modal open once conditions are first met — prevents
  // re-renders during seeding from toggling show on/off and causing flashes
  useEffect(() => {
    if (!demoModalLatched && !loading && isInDemoMode && students.length === DEMO_NAMES.length) {
      setDemoModalLatched(true);
    }
  }, [loading, isInDemoMode, students.length, demoModalLatched]);

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
  const tabs = (['pulse', 'students', 'parents', isFullMode ? 'insights' : null, isFullMode ? 'shoutouts' : null, 'settings'] as const).filter(Boolean) as ('pulse' | 'students' | 'parents' | 'insights' | 'shoutouts' | 'settings')[];
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
        onAdjustSchedule={(letter) => {
          if (specialsConfig.mode === 'rolling') {
            // Recalculate rollingStartDate so today maps to the chosen letter.
            // Walk back `letterIndex` weekdays from today to get the new Day A.
            const LETTERS = 'ABCDEFGHIJ';
            const letterIndex = LETTERS.indexOf(letter);
            const letterCount = specialsConfig.rollingLetterCount || 5;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let weekdaysBack = letterIndex;
            const newStart = new Date(today);
            while (weekdaysBack > 0) {
              newStart.setDate(newStart.getDate() - 1);
              const d = newStart.getDay();
              if (d !== 0 && d !== 6) weekdaysBack--;
            }
            const y = newStart.getFullYear();
            const m = String(newStart.getMonth() + 1).padStart(2, '0');
            const dd = String(newStart.getDate()).padStart(2, '0');
            saveRollingConfig(`${y}-${m}-${dd}`, letterCount);
            saveTodayOverride(null);
          } else if (specialsConfig.mode === 'letter-day') {
            // Determine what letter today actually has in the mapping (ignoring
            // any override), then shift every date from today onward so the
            // sequence stays intact but starts at the chosen letter.
            const letterSet = Object.values(specialsConfig.rotationMapping)
              .filter(Boolean)
              .map(l => l.toUpperCase());
            const usedLetters = [...new Set(letterSet)].sort();
            const cycleLen = usedLetters.length || 5;
            const chosenPos = usedLetters.indexOf(letter);

            // Find today's raw mapped letter (no override). If today isn't in
            // the mapping at all, look at the next mapped date to anchor the shift.
            const todayMs = new Date(todayKey + 'T00:00:00').getTime();
            const rawTodayLetter = specialsConfig.rotationMapping[todayKey];
            let anchorPos = rawTodayLetter ? usedLetters.indexOf(rawTodayLetter) : -1;

            if (anchorPos === -1) {
              // Today has no entry; find the nearest future mapped date and work back
              const futureDates = Object.keys(specialsConfig.rotationMapping)
                .filter(d => new Date(d + 'T00:00:00').getTime() > todayMs)
                .sort();
              if (futureDates.length > 0) {
                const nearestLetter = specialsConfig.rotationMapping[futureDates[0]];
                const nearestPos = usedLetters.indexOf(nearestLetter);
                // How many weekdays from today to that date?
                const nearestMs = new Date(futureDates[0] + 'T00:00:00').getTime();
                let weekdayGap = 0;
                const cur = new Date(todayMs);
                while (cur.getTime() < nearestMs) {
                  cur.setDate(cur.getDate() + 1);
                  const d = cur.getDay();
                  if (d !== 0 && d !== 6 && cur.getTime() <= nearestMs) weekdayGap++;
                }
                anchorPos = ((nearestPos - weekdayGap) % cycleLen + cycleLen) % cycleLen;
              }
            }

            // If we still can't determine the anchor, nothing to shift
            if (anchorPos === -1) {
              saveRotationMapping({ ...specialsConfig.rotationMapping, [todayKey]: letter });
              saveTodayOverride(null);
              return;
            }

            const shift = ((chosenPos - anchorPos) + cycleLen) % cycleLen;
            const updated: Record<string, string> = {};
            for (const [dateStr, ltr] of Object.entries(specialsConfig.rotationMapping)) {
              const dateMs = new Date(dateStr + 'T00:00:00').getTime();
              if (dateMs < todayMs) {
                updated[dateStr] = ltr;
              } else {
                const pos = usedLetters.indexOf(ltr);
                updated[dateStr] = pos === -1 ? ltr : usedLetters[(pos + shift) % cycleLen];
              }
            }
            // Ensure today is explicitly written even if it wasn't in the mapping
            updated[todayKey] = letter;
            saveRotationMapping(updated);
            saveTodayOverride(null);
          }
        }}
        tasks={tasks}
        setShowTasks={setShowTasks}
        onOpenStudio={() => setStudioOpen(true)}
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
                  showDemoBanner={isInDemoMode && showDemoNudge && !demoNudgeDismissed}
                  isSandboxMode={hasSandboxStudents}
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
                deleteTask={deleteTask}
                tasks={tasks}
                seatingChart={seatingChart}
                saveSeatingChart={saveSeatingChart}
                studioShuffle={studioShuffle}
                studioClassLabel={studioClassLabel}
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
          {activeTab === 'parents' && (
            <motion.div key="parents" custom={tabDirection} variants={tabVariants} initial="enter" animate="center" exit="exit">
              <ErrorBoundary label="Parent Comms">
              <ParentCommsScreen
                students={students}
                communications={parentCommunications}
                onAdd={addParentCommunication}
                onUpdate={updateParentCommunication}
                onDelete={deleteParentCommunication}
                addTask={addTask}
                tasks={tasks}
                onStudentClick={(studentId) => { setSelectedStudentId(studentId); setActiveTab('students'); }}
                isSandboxMode={hasSandboxStudents}
                teacherName={`${teacherTitle} ${teacherLastName}`.trim() || userName}
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
          trackEvent('tab_switched', { tab });
        }
      }} />

      <WelcomeModal
        show={!welcomeHidden && (demoModalLatched || (!isInDemoMode && !loading && onboardingComplete !== true && students.length === 0 && notes.length === 0))}
        teacherName={teacherFirstName || userName}
        isDemo={isInDemoMode}
        onGoToProfile={() => { setWelcomeHidden(true); setDemoModalLatched(false); setActiveTab('settings'); setSettingsView('profile'); }}
        onGoToRoster={() => { setWelcomeHidden(true); setDemoModalLatched(false); setActiveTab('settings'); setSettingsView('data-management'); }}
        onGoToPulse={() => { setWelcomeHidden(true); setDemoModalLatched(false); setActiveTab('pulse'); }}
        onGoToCalendar={() => { setWelcomeHidden(true); setDemoModalLatched(false); setActiveTab('settings'); setSettingsView('calendar'); }}
        onDismiss={() => { setWelcomeHidden(true); setDemoModalLatched(false); }}
        onGoToStudents={() => { setWelcomeHidden(true); setDemoModalLatched(false); setActiveTab('students'); }}
        onSwitchFromDemo={handleSwitchFromDemo}
        onAddStudents={async (names: string[], isDemo?: boolean) => {
          if (isDemo) {
            await seedSandbox();
          } else {
            await Promise.all(names.map(name => addStudent({ name, class_id: null })));
            trackEvent('first_student_added');
          }
          markOnboardingComplete();
        }}
      />

      {/* Sandbox banner — shown when demo students exist in a real account */}
      {hasSandboxStudents && (
        <div className="fixed top-0 left-0 right-0 z-[150] flex items-center justify-between gap-3 px-4 py-2.5 bg-violet-600 text-white text-sm font-semibold shadow-lg">
          <span>🧪 Demo students loaded — exploring ShortHand</span>
          <button
            type="button"
            onClick={async () => {
              await wipeSandbox();
              setWelcomeHidden(false);
            }}
            className="text-xs font-black uppercase tracking-widest bg-white text-violet-700 px-3 py-1 rounded-full hover:bg-violet-50 transition-colors flex-shrink-0"
          >
            Add my real class →
          </button>
        </div>
      )}

      <Confetti ref={confettiRef} />

      <StudioPanel
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        onShuffle={() => { setSelectedStudentId(null); setStudioShuffle(s => s + 1); }}
        theme={studioTheme}
        onThemeChange={setStudioTheme}
        bgTheme={studioBg}
        onBgThemeChange={setStudioBg}
        classLabel={studioClassLabel}
        onClassLabel={setStudioClassLabel}
      />

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
      else { localStorage.setItem('cp_seed_demo', 'true'); trackEvent('demo_started'); }
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
    <FullModeProvider userId={user.id}>
      <AliasModeProvider>
        <AuthenticatedApp userId={user.id} userEmail={user.email ?? ''} />
      </AliasModeProvider>
    </FullModeProvider>
  );
}
