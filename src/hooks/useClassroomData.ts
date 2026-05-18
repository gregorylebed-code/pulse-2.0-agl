import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Note, Student, CalendarEvent, Report, DeliveredLesson, StudentGoal, GoalCategory, GoalStatus, Shoutout, ParentCommunication, Accommodation, AttendanceRecord } from '../types';
import { Abbreviation } from '../utils/expandAbbreviations';
import { SpecialsMode } from '../utils/rotationHelpers';
import { NotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from '../utils/notifications';
import { enqueueNote } from '../lib/offlineQueue';
import { trackEvent } from '../lib/analytics';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
  color?: string;
}

interface Indicator {
  id?: string;
  label: string;
  type: 'positive' | 'growth' | 'neutral';
  icon_name?: string;
  category?: string;
  icon?: any;
}

export interface Profile {
  userName: string;
  schoolName: string;
  teacherTitle: 'Mr.' | 'Mrs.' | 'Ms.' | 'Miss' | 'Dr.';
  teacherFirstName: string;
  teacherLastName: string;
}

const DEFAULT_PROFILE: Profile = {
  userName: 'Teacher',
  schoolName: 'My School',
  teacherTitle: 'Mr.',
  teacherFirstName: '',
  teacherLastName: '',
};

const DEFAULT_COMM_TYPES: Indicator[] = [
  { label: 'ParentSquare', type: 'neutral', icon_name: 'ParentSquare' },
  { label: 'Email', type: 'neutral', icon_name: 'Mail' },
  { label: 'Phone', type: 'neutral', icon_name: 'Phone' },
  { label: 'Meeting', type: 'neutral', icon_name: 'Users' },
];

const DEFAULT_INDICATORS: Indicator[] = [
  // Positive
  { label: 'Kindness', type: 'positive', icon_name: 'Smile' },
  { label: 'Participation', type: 'positive', icon_name: 'Smile' },
  { label: 'Persistence', type: 'positive', icon_name: 'Smile' },
  { label: 'Independent Work', type: 'positive', icon_name: 'Smile' },
  { label: 'Team Work', type: 'positive', icon_name: 'Smile' },
  { label: 'Leadership', type: 'positive', icon_name: 'Smile' },
  { label: 'Growth Mindset', type: 'positive', icon_name: 'Smile' },
  { label: 'On Task', type: 'positive', icon_name: 'Smile' },
  { label: 'Star Work', type: 'positive', icon_name: 'Smile' },
  { label: 'Self-Regulation', type: 'positive', icon_name: 'Smile' },
  // Neutral
  { label: 'Check-In', type: 'neutral', icon_name: 'Meh' },
  { label: 'Modified Work', type: 'neutral', icon_name: 'Meh' },
  { label: 'Nurse/Office', type: 'neutral', icon_name: 'Meh' },
  { label: 'Parent Contact', type: 'neutral', icon_name: 'Meh' },
  { label: 'Speech', type: 'neutral', icon_name: 'Meh' },
  { label: 'OT', type: 'neutral', icon_name: 'Meh' },
  { label: 'PT', type: 'neutral', icon_name: 'Meh' },
  // Growth Areas
  { label: 'Disruption', type: 'growth', icon_name: 'Frown' },
  { label: 'Disrespect', type: 'growth', icon_name: 'Frown' },
  { label: 'Off Task', type: 'growth', icon_name: 'Frown' },
  { label: 'Emotional Regulation', type: 'growth', icon_name: 'Frown' },
  { label: 'Peer Conflict', type: 'growth', icon_name: 'Frown' },
  { label: 'Social Difficulty', type: 'growth', icon_name: 'Frown' },
  { label: 'Unprepared', type: 'growth', icon_name: 'Frown' },
  { label: 'Redirected', type: 'growth', icon_name: 'Frown' },
  { label: 'Tech Misuse', type: 'growth', icon_name: 'Frown' },
];

const DEFAULT_SPECIALS: Record<string, string> = {
  'A': 'Art',
  'B': 'PE',
  'C': 'Music',
  'D': 'Library',
  'E': 'STEM',
};

interface Stats {
  notes_created: number;
  reports_generated: number;
}

interface ClassroomDataState {
  notes: Note[];
  students: Student[];
  goals: StudentGoal[];
  accommodations: Accommodation[];
  shoutouts: Shoutout[];
  parentCommunications: ParentCommunication[];
  attendanceRecords: AttendanceRecord[];
  indicators: Indicator[];
  commTypes: Indicator[];
  classes: string[];
  calendarEvents: CalendarEvent[];
  tasks: Task[];
  reports: Report[];
  profile: Profile;
  rotationMapping: Record<string, string>;
  specialsNames: Record<string, string>;
  specialsMode: SpecialsMode;
  dayOfWeekSpecials: Record<string, string>;
  rollingStartDate: string;
  rollingLetterCount: number;
  todayOverride: { date: string; letter: string } | null;
  abbreviations: Abbreviation[];
  stats: Stats;
  lessonHistory: DeliveredLesson[];
  seatingChart: Record<string, { x: number; y: number }>;
  notificationPrefs: NotificationPrefs;
  onboardingComplete: boolean | null;
  loading: boolean;
  error: string | null;
}

interface ClassroomDataActions {
  addNote: (note: Omit<Note, 'id' | 'created_at' | 'user_id'>, createdAt?: string) => Promise<Note | null>;
  addGoal: (goal: Omit<StudentGoal, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<StudentGoal | null>;
  updateGoal: (id: string, updates: Partial<Pick<StudentGoal, 'goal_text' | 'status' | 'teacher_note' | 'category'>>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addAccommodation: (acc: Omit<Accommodation, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<Accommodation | null>;
  updateAccommodation: (id: string, updates: Partial<Omit<Accommodation, 'id' | 'user_id' | 'student_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  deleteAccommodation: (id: string) => Promise<void>;
  addParentCommunication: (comm: Omit<ParentCommunication, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<ParentCommunication | null>;
  updateParentCommunication: (id: string, updates: Partial<Omit<ParentCommunication, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  deleteParentCommunication: (id: string) => Promise<void>;
  addShoutout: (shoutout: Omit<Shoutout, 'id' | 'created_at' | 'user_id'>) => Promise<Shoutout | null>;
  deleteShoutout: (id: string) => Promise<void>;
  addAttendanceRecords: (records: { student_id: string; date: string; status: 'absent' | 'tardy' }[]) => Promise<void>;
  deleteAttendanceRecord: (id: string) => Promise<void>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addStudent: (student: Omit<Student, 'id' | 'created_at' | 'user_id'>) => Promise<Student | null>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'created_at' | 'user_id'>) => Promise<Task | null>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addReport: (report: Omit<Report, 'id' | 'created_at' | 'user_id'>) => Promise<Report | null>;
  deleteReport: (id: string) => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  saveRotationMapping: (mapping: Record<string, string>) => Promise<void>;
  saveSpecialsNames: (names: Record<string, string>) => Promise<void>;
  saveSpecialsMode: (mode: SpecialsMode) => Promise<void>;
  saveDayOfWeekSpecials: (specials: Record<string, string>) => Promise<void>;
  saveRollingConfig: (startDate: string, letterCount: number) => Promise<void>;
  saveTodayOverride: (override: { date: string; letter: string } | null) => Promise<void>;
  saveAbbreviations: (abbreviations: Abbreviation[]) => Promise<void>;
  updateIndicators: (indicators: Indicator[]) => Promise<void>;
  updateCommTypes: (commTypes: Indicator[]) => Promise<void>;
  updateClasses: (classes: string[]) => Promise<void>;
  updateCalendarEvents: (events: CalendarEvent[]) => Promise<void>;
  saveLessonHistory: (history: DeliveredLesson[]) => Promise<void>;
  saveSeatingChart: (chart: Record<string, { x: number; y: number }>) => Promise<void>;
  saveNotificationPrefs: (prefs: NotificationPrefs) => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
  refreshData: () => Promise<void>;
  seedSandbox: () => Promise<void>;
  wipeSandbox: () => Promise<void>;
}

export function useClassroomData(userId: string): ClassroomDataState & ClassroomDataActions {
  const [state, setState] = useState<ClassroomDataState>({
    notes: [],
    students: [],
    goals: [],
    accommodations: [],
    shoutouts: [],
    parentCommunications: [],
    attendanceRecords: [],
    indicators: [],
    commTypes: [],
    classes: ['AM', 'PM'],
    calendarEvents: [],
    tasks: [],
    reports: [],
    profile: DEFAULT_PROFILE,
    rotationMapping: {},
    specialsNames: DEFAULT_SPECIALS,
    specialsMode: 'letter-day',
    dayOfWeekSpecials: { '1': 'Art', '2': 'PE', '3': 'Music', '4': 'Library', '5': 'STEM' },
    rollingStartDate: '',
    rollingLetterCount: 5,
    todayOverride: null,
    abbreviations: [],
    stats: { notes_created: 0, reports_generated: 0 },
    lessonHistory: [],
    seatingChart: {},
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    onboardingComplete: null,
    loading: true,
    error: null,
  });

  const subscriptionsRef = useRef<any[]>([]);

  const updateSetting = useCallback(async (key: string, value: any) => {
    const { error } = await supabase.from('settings').upsert(
      { user_id: userId, key, value },
      { onConflict: 'user_id,key' }
    );
    if (error) throw error;
  }, [userId]);

  const loadAllData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const [
        { data: notesData, error: notesError },
        { data: studentsData, error: studentsError },
        { data: indicatorsData, error: indicatorsError },
        { data: commTypesData },
        { data: tasksData, error: tasksError },
        { data: classesData, error: classesError },
        { data: calendarData, error: calendarError },
        { data: reportsData },
        { data: settingsData },
        { data: goalsData },
        { data: shoutoutsData },
        { data: parentCommsData },
        { data: accommodationsData },
        { data: attendanceData },
      ] = await Promise.all([
        supabase.from('notes').select('*').order('created_at', { ascending: false }),
        supabase.from('students').select('*'),
        supabase.from('indicators').select('*'),
        supabase.from('comm_types').select('*'),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('classes').select('*'),
        supabase.from('calendar_events').select('*'),
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*'),
        supabase.from('student_goals').select('*').order('created_at', { ascending: true }),
        supabase.from('shoutouts').select('*').order('created_at', { ascending: false }),
        supabase.from('parent_communications').select('*').order('comm_date', { ascending: false }),
        supabase.from('student_accommodations').select('*').order('created_at', { ascending: true }),
        supabase.from('attendance_records').select('*').order('date', { ascending: false }),
      ]);

      if (notesError) throw new Error(`Notes: ${notesError.message}`);
      if (studentsError) throw new Error(`Students: ${studentsError.message}`);
      if (indicatorsError) throw new Error(`Indicators: ${indicatorsError.message}`);
      if (tasksError) throw new Error(`Tasks: ${tasksError.message}`);
      if (classesError) throw new Error(`Classes: ${classesError.message}`);
      if (calendarError) throw new Error(`Calendar: ${calendarError.message}`);

      // Build settings map from Supabase, fall back to localStorage for migration period
      const settingsMap: Record<string, any> = {};
      (settingsData || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

      const tryParseLocal = (key: string, fallback: any) => {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
      };
      const profile = settingsMap['profile'] ?? tryParseLocal('cp_profile', DEFAULT_PROFILE);
      const rotationMapping = settingsMap['rotation_mapping'] ?? tryParseLocal('rotationMapping', {});
      const specialsNames = settingsMap['specials_names'] ?? tryParseLocal('specialsNames', DEFAULT_SPECIALS);
      const abbreviations: Abbreviation[] = settingsMap['abbreviations'] ?? [];
      const stats: Stats = settingsMap['stats'] ?? { notes_created: 0, reports_generated: 0 };
      const lessonHistory: DeliveredLesson[] = settingsMap['lesson_history'] ?? [];
      const notificationPrefs: NotificationPrefs = settingsMap['notification_prefs'] ?? DEFAULT_NOTIFICATION_PREFS;
      const onboardingComplete: boolean = settingsMap['onboarding_complete'] ?? false;
      const specialsMode: SpecialsMode = settingsMap['specials_mode'] ?? 'letter-day';
      const dayOfWeekSpecials = settingsMap['day_of_week_specials'] ?? { '1': 'Art', '2': 'PE', '3': 'Music', '4': 'Library', '5': 'STEM' };
      const rollingStartDate: string = settingsMap['rolling_start_date'] ?? '';
      const rollingLetterCount: number = settingsMap['rolling_letter_count'] ?? 5;
      const todayOverride = settingsMap['today_override'] ?? null;
      const seatingChart: Record<string, { x: number; y: number }> = settingsMap['seating_chart'] ?? {};

      // Map student IDs to names for note display
      const studentMap = new Map((studentsData || []).map((s: any) => [s.id, s.name]));

      const notesWithNames = (notesData || []).map((note: any) => ({
        ...note,
        student_name: studentMap.get(note.student_id) || 'Unknown',
        user_id: note.user_id ?? userId,
        is_checklist: note.is_checklist ?? false,
        checklist_data: note.checklist_data ?? [],
        deadline: note.deadline ?? null,
      }));

      const classes = (classesData || []).map((c: any) => c.name);

      // Map snake_case DB fields to camelCase expected by the app
      const studentsWithCamel = (studentsData || []).map((s: any) => ({
        ...s,
        archivedSummaries: s.archived_summaries ?? [],
      }));

      setState(prev => ({
        ...prev,
        notes: notesWithNames as Note[],
        students: studentsWithCamel as Student[],
        goals: (goalsData || []) as StudentGoal[],
        accommodations: (accommodationsData || []) as Accommodation[],
        shoutouts: (shoutoutsData || []) as Shoutout[],
        parentCommunications: (parentCommsData || []) as ParentCommunication[],
        attendanceRecords: (attendanceData || []) as AttendanceRecord[],
        // Use DB indicators directly; seed defaults for new accounts
        indicators: (indicatorsData && indicatorsData.length > 0)
          ? (indicatorsData as Indicator[])
          : prev.indicators.length > 0 ? prev.indicators : DEFAULT_INDICATORS,
        commTypes: (commTypesData && commTypesData.length > 0)
          ? (commTypesData as Indicator[])
          : DEFAULT_COMM_TYPES,
        classes: classes.length > 0 ? classes : prev.classes,
        calendarEvents: (calendarData || []) as CalendarEvent[],
        tasks: (tasksData || []) as Task[],
        reports: (reportsData || []) as Report[],
        profile,
        rotationMapping,
        specialsNames,
        specialsMode,
        dayOfWeekSpecials,
        rollingStartDate,
        rollingLetterCount,
        todayOverride,
        abbreviations,
        stats,
        lessonHistory,
        seatingChart,
        notificationPrefs,
        onboardingComplete,
        loading: false,
      }));

      // Seed default indicators into Supabase for brand-new accounts
      if (!indicatorsData || indicatorsData.length === 0) {
        const toSeed = DEFAULT_INDICATORS.map(ind => ({
          label: ind.label,
          type: ind.type,
          icon_name: ind.icon_name || 'Smile',
          user_id: userId,
        }));
        supabase.from('indicators').insert(toSeed).then(({ error }) => {
          if (error) console.error('Error seeding default indicators:', error);
        });
      }

      setupSubscriptions();
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error(`Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [userId]);

  const setupSubscriptions = useCallback(() => {
    subscriptionsRef.current.forEach(sub => sub?.unsubscribe?.());
    subscriptionsRef.current = [];

    const tables = ['notes', 'students', 'tasks'];
    tables.forEach(table => {
      const sub = supabase
        .channel(`${table}-changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          loadAllData();
        })
        .subscribe();
      subscriptionsRef.current.push(sub);
    });
  }, [loadAllData]);

  useEffect(() => {
    loadAllData();
    return () => {
      subscriptionsRef.current.forEach(sub => sub?.unsubscribe?.());
    };
  }, [loadAllData]);

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const incrementStat = useCallback(async (field: keyof Stats) => {
    let updatedStats: Stats | null = null;
    let previousStats: Stats | null = null;
    setState(prev => {
      previousStats = prev.stats;
      const updated = { ...prev.stats, [field]: (prev.stats[field] ?? 0) + 1 };
      updatedStats = updated;
      return { ...prev, stats: updated };
    });
    if (updatedStats) {
      try {
        await updateSetting('stats', updatedStats);
      } catch {
        // Roll back the optimistic update so state stays in sync with the DB
        if (previousStats) setState(prev => ({ ...prev, stats: previousStats! }));
      }
    }
  }, [updateSetting]);

  // ─── Notes ─────────────────────────────────────────────────────────────────

  const addNote = useCallback(async (note: Omit<Note, 'id' | 'created_at' | 'user_id'>, createdAt?: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { student_name, is_checklist, checklist_data, deadline, ...dbNote } = note as any;
      const { data, error } = await supabase
        .from('notes')
        .insert([{ ...dbNote, user_id: userId, created_at: createdAt ?? new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;

      setState(prev => {
        const student = prev.students.find(s => s.id === data.student_id);
        const noteWithName: Note = {
          ...data,
          student_name: student?.name || 'Unknown',
          user_id: userId,
          is_checklist: false,
          checklist_data: [],
          deadline: null,
        };
        return { ...prev, notes: [noteWithName, ...prev.notes] };
      });
      await incrementStat('notes_created');
      trackEvent('note_logged', { indicator: (note as any).indicator_id ?? null });
      return data;
    } catch (error) {
      // Enqueue if offline OR if the error looks like a network failure (Lie-Fi:
      // navigator.onLine can be true even when the connection has no internet).
      const isNetworkError = !navigator.onLine ||
        (error instanceof Error && (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Load failed')
        ));
      if (isNetworkError) {
        await enqueueNote({
          id: crypto.randomUUID(),
          note: note as any,
          createdAt: createdAt,
          userId,
          queuedAt: new Date().toISOString(),
        });
        return null;
      }
      // Online error — re-throw so the caller can show the right error UI
      console.error('Error adding note:', error);
      throw error;
    }
  }, [userId, incrementStat]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    try {
      const { error } = await supabase.from('notes').update(updates).eq('id', id);
      if (error) throw error;
      setState(prev => ({
        ...prev,
        notes: prev.notes.map(n => n.id === id ? { ...n, ...updates } : n),
      }));
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note — please try again');
    }
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== id) }));
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note — please try again');
    }
  }, []);

  // ─── Students ───────────────────────────────────────────────────────────────

  const addStudent = useCallback(async (student: Omit<Student, 'id' | 'created_at' | 'user_id'>) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .insert([{ ...student, user_id: userId, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      setState(prev => ({ ...prev, students: [...prev.students, data] }));
      trackEvent('student_added');
      return data;
    } catch (error) {
      console.error('Error adding student:', error);
      return null;
    }
  }, [userId]);

  const updateStudent = useCallback(async (id: string, updates: Partial<Student>) => {
    try {
      // Map camelCase fields to snake_case DB columns
      const { archivedSummaries, ...rest } = updates as any;
      const dbUpdates = {
        ...rest,
        ...(archivedSummaries !== undefined ? { archived_summaries: archivedSummaries } : {}),
      };
      const { error } = await supabase.from('students').update(dbUpdates).eq('id', id);
      if (error) throw error;
      setState(prev => ({
        ...prev,
        students: prev.students.map(s => s.id === id ? { ...s, ...updates } : s),
      }));
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error('Failed to update student — please try again');
    }
  }, []);

  const deleteStudent = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({
        ...prev,
        students: prev.students.filter(s => s.id !== id),
        notes: prev.notes.filter(n => {
          const student = prev.students.find(s => s.id === id);
          return !student || n.student_name !== student.name;
        }),
      }));
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Failed to remove student — please try again');
    }
  }, []);

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  const addTask = useCallback(async (task: Omit<Task, 'id' | 'created_at' | 'user_id'>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...task, user_id: userId, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      setState(prev => ({ ...prev, tasks: [data, ...prev.tasks] }));
      return data;
    } catch (error) {
      console.error('Error adding task:', error);
      return null;
    }
  }, [userId]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
      }));
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task — please try again');
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task — please try again');
    }
  }, []);

  // ─── Reports ────────────────────────────────────────────────────────────────

  const deleteReport = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, reports: prev.reports.filter(r => r.id !== id) }));
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report — please try again');
    }
  }, []);

  const addReport = useCallback(async (report: Omit<Report, 'id' | 'created_at' | 'user_id'>) => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .insert([{ ...report, user_id: userId, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      setState(prev => ({ ...prev, reports: [data, ...prev.reports] }));
      await incrementStat('reports_generated');
      return data;
    } catch (error) {
      console.error('Error adding report:', error);
      return null;
    }
  }, [userId, incrementStat]);

  // ─── Settings ───────────────────────────────────────────────────────────────

  const saveProfile = useCallback(async (profile: Profile) => {
    try {
      await updateSetting('profile', profile);
      setState(prev => ({ ...prev, profile }));
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  }, [updateSetting]);

  const saveRotationMapping = useCallback(async (mapping: Record<string, string>) => {
    try {
      await updateSetting('rotation_mapping', mapping);
      setState(prev => ({ ...prev, rotationMapping: mapping }));
    } catch (error) {
      console.error('Error saving rotation mapping:', error);
    }
  }, [updateSetting]);

  const saveSpecialsNames = useCallback(async (names: Record<string, string>) => {
    try {
      await updateSetting('specials_names', names);
      setState(prev => ({ ...prev, specialsNames: names }));
    } catch (error) {
      console.error('Error saving specials names:', error);
    }
  }, [updateSetting]);

  const saveSpecialsMode = useCallback(async (mode: SpecialsMode) => {
    try {
      await updateSetting('specials_mode', mode);
      setState(prev => ({ ...prev, specialsMode: mode }));
    } catch (error) {
      console.error('Error saving specials mode:', error);
    }
  }, [updateSetting]);

  const saveDayOfWeekSpecials = useCallback(async (specials: Record<string, string>) => {
    try {
      await updateSetting('day_of_week_specials', specials);
      setState(prev => ({ ...prev, dayOfWeekSpecials: specials }));
    } catch (error) {
      console.error('Error saving day-of-week specials:', error);
    }
  }, [updateSetting]);

  const saveRollingConfig = useCallback(async (startDate: string, letterCount: number) => {
    try {
      await Promise.all([
        updateSetting('rolling_start_date', startDate),
        updateSetting('rolling_letter_count', letterCount),
      ]);
      setState(prev => ({ ...prev, rollingStartDate: startDate, rollingLetterCount: letterCount }));
    } catch (error) {
      console.error('Error saving rolling config:', error);
    }
  }, [updateSetting]);

  const saveTodayOverride = useCallback(async (override: { date: string; letter: string } | null) => {
    try {
      await updateSetting('today_override', override);
      setState(prev => ({ ...prev, todayOverride: override }));
    } catch (error) {
      console.error('Error saving today override:', error);
    }
  }, [updateSetting]);

  const saveAbbreviations = useCallback(async (abbreviations: Abbreviation[]) => {
    try {
      await updateSetting('abbreviations', abbreviations);
      setState(prev => ({ ...prev, abbreviations }));
    } catch (error) {
      console.error('Error saving abbreviations:', error);
    }
  }, [updateSetting]);

  const saveLessonHistory = useCallback(async (history: DeliveredLesson[]) => {
    try {
      await updateSetting('lesson_history', history);
      setState(prev => ({ ...prev, lessonHistory: history }));
    } catch (error) {
      console.error('Error saving lesson history:', error);
      toast.error('Failed to save lesson history');
    }
  }, [updateSetting]);

  const saveSeatingChart = useCallback(async (chart: Record<string, { x: number; y: number }>) => {
    try {
      await updateSetting('seating_chart', chart);
      setState(prev => ({ ...prev, seatingChart: chart }));
    } catch (error) {
      console.error('Error saving seating chart:', error);
      toast.error('Failed to save seating chart');
    }
  }, [updateSetting]);

  const markOnboardingComplete = useCallback(async () => {
    try {
      await updateSetting('onboarding_complete', true);
      setState(prev => ({ ...prev, onboardingComplete: true }));
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
  }, [updateSetting]);

  const saveNotificationPrefs = useCallback(async (prefs: NotificationPrefs) => {
    try {
      await updateSetting('notification_prefs', prefs);
      setState(prev => ({ ...prev, notificationPrefs: prefs }));
    } catch (error) {
      console.error('Error saving notification prefs:', error);
    }
  }, [updateSetting]);

  // ─── Bulk Updates (delete-all + re-insert) ──────────────────────────────────

  const updateIndicators = useCallback(async (newIndicators: Indicator[]) => {
    try {
      const toSave = newIndicators.map(({ icon, ...rest }) => ({
        label: rest.label,
        type: rest.type || 'neutral',
        user_id: userId,
      }));
      await supabase.from('indicators').delete();
      if (toSave.length > 0) {
        await supabase.from('indicators').insert(toSave);
      }
      setState(prev => ({ ...prev, indicators: newIndicators }));
    } catch (error) {
      console.error('Error updating indicators:', error);
    }
  }, [userId]);

  const updateCommTypes = useCallback(async (newCommTypes: Indicator[]) => {
    try {
      const toSave = newCommTypes.map(({ icon, ...rest }) => ({
        label: rest.label,
        user_id: userId,
      }));
      await supabase.from('comm_types').delete();
      if (toSave.length > 0) {
        await supabase.from('comm_types').insert(toSave);
      }
      setState(prev => ({ ...prev, commTypes: newCommTypes }));
    } catch (error) {
      console.error('Error updating comm types:', error);
    }
  }, [userId]);

  const updateClasses = useCallback(async (newClasses: string[]) => {
    try {
      await supabase.from('classes').delete();
      if (newClasses.length > 0) {
        await supabase.from('classes').insert(newClasses.map(name => ({ name, user_id: userId })));
      }
      setState(prev => ({ ...prev, classes: newClasses }));
    } catch (error) {
      console.error('Error updating classes:', error);
    }
  }, [userId]);

  const updateCalendarEvents = useCallback(async (newEvents: CalendarEvent[]) => {
    try {
      await supabase.from('calendar_events').delete();
      if (newEvents.length > 0) {
        const toSave = newEvents.map(({ id: _id, user_id: _uid, ...rest }) => ({ ...rest, user_id: userId }));
        await supabase.from('calendar_events').insert(toSave);
      }
      setState(prev => ({ ...prev, calendarEvents: newEvents }));
    } catch (error) {
      console.error('Error updating calendar events:', error);
    }
  }, [userId]);

  const refreshData = useCallback(async () => {
    await loadAllData();
  }, [loadAllData]);

  // ─── Goals ──────────────────────────────────────────────────────────────────

  const addGoal = useCallback(async (goal: Omit<StudentGoal, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('student_goals')
        .insert([{ ...goal, user_id: userId, created_at: now, updated_at: now }])
        .select()
        .single();
      if (error) throw error;
      setState(prev => ({ ...prev, goals: [...prev.goals, data as StudentGoal] }));
      return data as StudentGoal;
    } catch (error) {
      console.error('Error adding goal:', error);
      return null;
    }
  }, [userId]);

  const updateGoal = useCallback(async (id: string, updates: Partial<Pick<StudentGoal, 'goal_text' | 'status' | 'teacher_note' | 'category'>>) => {
    try {
      const { error } = await supabase
        .from('student_goals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setState(prev => ({
        ...prev,
        goals: prev.goals.map(g => g.id === id ? { ...g, ...updates } : g),
      }));
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('student_goals').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }));
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  }, []);

  // ─── Accommodations ────────────────────────────────────────────────────────

  const addAccommodation = useCallback(async (acc: Omit<Accommodation, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('student_accommodations')
        .insert([{ ...acc, user_id: userId, created_at: now, updated_at: now }])
        .select()
        .single();
      if (error) throw error;
      setState(prev => ({ ...prev, accommodations: [...prev.accommodations, data as Accommodation] }));
      return data as Accommodation;
    } catch (error) {
      console.error('Error adding accommodation:', error);
      return null;
    }
  }, [userId]);

  const updateAccommodation = useCallback(async (id: string, updates: Partial<Omit<Accommodation, 'id' | 'user_id' | 'student_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { error } = await supabase
        .from('student_accommodations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setState(prev => ({
        ...prev,
        accommodations: prev.accommodations.map(a => a.id === id ? { ...a, ...updates } : a),
      }));
    } catch (error) {
      console.error('Error updating accommodation:', error);
    }
  }, []);

  const deleteAccommodation = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('student_accommodations').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, accommodations: prev.accommodations.filter(a => a.id !== id) }));
    } catch (error) {
      console.error('Error deleting accommodation:', error);
    }
  }, []);

  // ─── Parent Communications ──────────────────────────────────────────────────

  const addParentCommunication = useCallback(async (comm: Omit<ParentCommunication, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('parent_communications')
        .insert([{ ...comm, user_id: userId, created_at: now, updated_at: now }])
        .select()
        .single();
      if (error) throw error;
      setState(prev => ({ ...prev, parentCommunications: [data as ParentCommunication, ...prev.parentCommunications] }));
      return data as ParentCommunication;
    } catch (error) {
      console.error('Error adding parent communication:', error);
      return null;
    }
  }, [userId]);

  const updateParentCommunication = useCallback(async (id: string, updates: Partial<Omit<ParentCommunication, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { error } = await supabase
        .from('parent_communications')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setState(prev => ({
        ...prev,
        parentCommunications: prev.parentCommunications.map(c => c.id === id ? { ...c, ...updates } : c),
      }));
    } catch (error) {
      console.error('Error updating parent communication:', error);
    }
  }, []);

  const deleteParentCommunication = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('parent_communications').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, parentCommunications: prev.parentCommunications.filter(c => c.id !== id) }));
    } catch (error) {
      console.error('Error deleting parent communication:', error);
    }
  }, []);

  // ─── Attendance ─────────────────────────────────────────────────────────────

  const addAttendanceRecords = useCallback(async (records: { student_id: string; date: string; status: 'absent' | 'tardy' }[]) => {
    if (records.length === 0) return;
    try {
      const rows = records.map(r => ({ ...r, user_id: userId, created_at: new Date().toISOString() }));
      const { data, error } = await supabase
        .from('attendance_records')
        .upsert(rows, { onConflict: 'user_id,student_id,date' })
        .select();
      if (error) throw error;
      setState(prev => {
        const newIds = new Set((data as AttendanceRecord[]).map(r => r.id));
        const filtered = prev.attendanceRecords.filter(r => !newIds.has(r.id));
        return { ...prev, attendanceRecords: [...(data as AttendanceRecord[]), ...filtered] };
      });
    } catch (error) {
      console.error('Error adding attendance records:', error);
    }
  }, [userId]);

  const deleteAttendanceRecord = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('attendance_records').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, attendanceRecords: prev.attendanceRecords.filter(r => r.id !== id) }));
    } catch (error) {
      console.error('Error deleting attendance record:', error);
    }
  }, []);

  // ─── Shoutouts ──────────────────────────────────────────────────────────────

  const addShoutout = useCallback(async (shoutout: Omit<Shoutout, 'id' | 'created_at' | 'user_id'>) => {
    try {
      const { data, error } = await supabase
        .from('shoutouts')
        .insert([{ ...shoutout, user_id: userId, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      setState(prev => ({ ...prev, shoutouts: [data as Shoutout, ...prev.shoutouts] }));
      return data as Shoutout;
    } catch (error) {
      console.error('Error adding shoutout:', error);
      return null;
    }
  }, [userId]);

  const deleteShoutout = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('shoutouts').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, shoutouts: prev.shoutouts.filter(s => s.id !== id) }));
    } catch (error) {
      console.error('Error deleting shoutout:', error);
    }
  }, []);

  // ─── Sandbox seed / wipe ────────────────────────────────────────────────────

  const seedSandbox = useCallback(async () => {
    try {
      // Guard: query the DB directly — state.students is a stale closure here
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .eq('is_demo', true)
        .limit(1);
      if (existing && existing.length > 0) return;

      const daysAgo = (d: number) =>
        new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

      // Insert 8 demo students (Comet gets parent contact info)
      const studentRows = SANDBOX_STUDENT_NAMES.map(name => ({
        name,
        user_id: userId,
        class_id: null,
        is_demo: true,
        created_at: new Date().toISOString(),
        ...(name === 'Comet' ? {
          parent_guardian_names: 'Maria Torres',
          parent_emails: 'maria.torres@email.com',
          parent_phones: '(609) 555-0147',
        } : {}),
      }));

      const { data: insertedStudents, error: studentError } = await supabase
        .from('students')
        .insert(studentRows)
        .select();
      if (studentError) throw studentError;

      const studentMap = Object.fromEntries(
        (insertedStudents as any[]).map(s => [s.name, s])
      );

      // Insert rich notes per student
      const notesToInsert = (insertedStudents as any[]).flatMap(student => {
        const noteSet = SANDBOX_NOTES[student.name] ?? [];
        return noteSet.map(n => ({
          student_id: student.id,
          content: n.content,
          tags: n.tags,
          user_id: userId,
          is_demo: true,
          is_pinned: n.is_pinned ?? false,
          image_url: null,
          is_parent_communication: n.is_parent_communication ?? false,
          parent_communication_type: n.parent_communication_type ?? '',
          created_at: daysAgo(n.daysAgo),
        }));
      });

      const { error: noteError } = await supabase.from('notes').insert(notesToInsert);
      if (noteError) throw noteError;

      // Insert parent comm threads
      const commsToInsert = [
        // Rocket — helicopter mom Linda
        { student: 'Rocket', parent_name: 'Linda', comm_type: 'Email', direction: 'inbound', subject: 'Sleep schedule concern', notes: 'Linda emailed asking if Rocket seemed tired, says he\'s been up late. Asked me to watch for yawning.', comm_date: daysAgo(10), is_urgent: false },
        { student: 'Rocket', parent_name: 'Linda', comm_type: 'Email', direction: 'outbound', subject: 'Re: Sleep schedule concern', notes: 'Replied that Rocket has been engaged but did rest his head once. Suggested a consistent bedtime routine.', comm_date: daysAgo(10), is_urgent: false },
        { student: 'Rocket', parent_name: 'Linda', comm_type: 'Email', direction: 'inbound', subject: 'Lunch money + ELA homework', notes: 'Linda emailed again, can we confirm lunch balance and also asked if ELA homework is graded. Third email this week.', comm_date: daysAgo(5), is_urgent: false },
        { student: 'Rocket', parent_name: 'Linda', comm_type: 'Email', direction: 'inbound', subject: 'End of week check-in', notes: 'How did Rocket do this week overall? She wants a full update. Did not reply yet.', comm_date: daysAgo(1), is_urgent: false },

        // Zigzag — escalating behavior, zero parent response
        { student: 'Zigzag', parent_name: '', comm_type: 'ParentSquare', direction: 'outbound', subject: 'Behavior concern', notes: 'Sent ParentSquare message about Zigzag\'s escalating outbursts during transitions. No reply received.', comm_date: daysAgo(14), is_urgent: true },
        { student: 'Zigzag', parent_name: '', comm_type: 'ParentSquare', direction: 'outbound', subject: 'Follow-up: urgent', notes: 'Second message sent. Zigzag had a major incident today, threw materials, had to leave the room. Still no parent response.', comm_date: daysAgo(7), is_urgent: true },
        { student: 'Zigzag', parent_name: '', comm_type: 'Phone', direction: 'outbound', subject: 'Phone call attempt', notes: 'Called listed number, went to voicemail. Left message asking for a callback ASAP. This is the third attempt to reach family.', comm_date: daysAgo(3), is_urgent: true },

        // Blueberry — supportive dad Marcus
        { student: 'Blueberry', parent_name: 'Marcus', comm_type: 'Email', direction: 'outbound', subject: 'Reading progress update', notes: 'Emailed Marcus to share that Blueberry moved up a reading level. Wanted to celebrate the win with family.', comm_date: daysAgo(9), is_urgent: false },
        { student: 'Blueberry', parent_name: 'Marcus', comm_type: 'Email', direction: 'inbound', subject: 'Re: Reading progress update', notes: 'Marcus replied right away, so proud, says they\'ve been doing nightly reading together. Asked how to keep the momentum going.', comm_date: daysAgo(8), is_urgent: false },
        { student: 'Blueberry', parent_name: 'Marcus', comm_type: 'Email', direction: 'outbound', subject: 'Great Friday', notes: 'Sent a Friday good news note. Blueberry led a group activity and every student stayed on task. Marcus is a great partner.', comm_date: daysAgo(2), is_urgent: false },

        // Comet — fully built out
        { student: 'Comet', parent_name: 'Maria Torres', comm_type: 'Email', direction: 'outbound', subject: 'Checking in on Comet', notes: 'Comet has been very quiet lately, not disruptive, just withdrawn. Reached out to ask if anything is going on at home.', comm_date: daysAgo(11), is_urgent: false, is_iep_related: false },
        { student: 'Comet', parent_name: 'Maria Torres', comm_type: 'Email', direction: 'inbound', subject: 'Re: Checking in on Comet', notes: 'Maria replied. Comet\'s best friend moved schools last month. She\'s been struggling but doesn\'t want to talk about it. Really helpful context.', comm_date: daysAgo(10), is_urgent: false, is_iep_related: false },
        { student: 'Comet', parent_name: 'Maria Torres', comm_type: 'Email', direction: 'outbound', subject: 'Plan to support Comet', notes: 'Replied with a plan: will pair Comet with a new partner during group work and give her a helper role to rebuild confidence. Maria was grateful.', comm_date: daysAgo(9), is_urgent: false, is_iep_related: false },
        { student: 'Comet', parent_name: 'Maria Torres', comm_type: 'Meeting', direction: 'outbound', subject: 'Spring IEP conference', notes: 'Spring conference with Maria. Reviewed both IEP goals: impulse control (social-emotional, in progress) and math accuracy (academic, in progress). Discussed classroom support plan and extended time accommodations. Maria asked about summer services.', comm_date: daysAgo(5), is_urgent: false, is_iep_related: true, follow_up_date: daysAgo(-14) },
        { student: 'Comet', parent_name: 'Maria Torres', comm_type: 'Phone', direction: 'outbound', subject: 'Science test result', notes: 'Called Maria to discuss science test. Comet scored 62%, below her IEP benchmark of 75%. Explained re-take option with extended time in a separate room. Maria agreed to help review at home.', comm_date: daysAgo(4), is_urgent: false, is_iep_related: true },
        { student: 'Comet', parent_name: 'Maria Torres', comm_type: 'ParentSquare', direction: 'inbound', subject: 'Absence Thursday', notes: 'Maria messaged through ParentSquare. Comet will be absent Thursday for a family appointment. Asked for any missed work.', comm_date: daysAgo(2), is_urgent: false, is_iep_related: false },
        { student: 'Comet', parent_name: 'Maria Torres', comm_type: 'Email', direction: 'outbound', subject: 'Makeup work plan', notes: 'Sent Maria the makeup work plan after Thursday absence. Two worksheets and a reading response due Monday.', comm_date: daysAgo(1), is_urgent: false, is_iep_related: false },
        { student: 'Comet', parent_name: 'Maria Torres', comm_type: 'Phone', direction: 'outbound', subject: 'Playground injury', notes: 'Comet scraped her knee on the playground. Iced it, cleaned the wound, she returned to class. Called Maria to notify. No further action needed.', comm_date: daysAgo(1), is_urgent: false, is_iep_related: false },

        // Falcon — two voicemails, vague reply
        { student: 'Falcon', parent_name: '', comm_type: 'Phone', direction: 'outbound', subject: 'Voicemail: behavior concern', notes: 'Left voicemail about Falcon\'s pattern of disrupting others during independent work. Asked for a call back.', comm_date: daysAgo(12), is_urgent: false },
        { student: 'Falcon', parent_name: 'Mom', comm_type: 'Email', direction: 'inbound', subject: 'Re: Phone message', notes: 'Mom replied by email instead of calling. Said "we\'re dealing with a lot right now" and thanked me for reaching out. No specifics.', comm_date: daysAgo(11), is_urgent: false },
        { student: 'Falcon', parent_name: '', comm_type: 'Phone', direction: 'outbound', subject: 'Second voicemail', notes: 'Called again after Falcon had a difficult week. Left second voicemail. No response yet.', comm_date: daysAgo(4), is_urgent: false },

        // Math-Wiz — ParentSquare thread
        { student: 'Math-Wiz', parent_name: '', comm_type: 'ParentSquare', direction: 'outbound', subject: 'Math mastery + next steps', notes: 'Sent a ParentSquare note sharing that Math-Wiz has mastered all grade-level standards and is ready for enrichment.', comm_date: daysAgo(6), is_urgent: false },
        { student: 'Math-Wiz', parent_name: 'Mom', comm_type: 'ParentSquare', direction: 'inbound', subject: 'Re: Math mastery', notes: 'Mom replied: "That\'s great, he does a lot of math at home too." Not much to work with but at least she saw it.', comm_date: daysAgo(5), is_urgent: false },

        // Thunderbolt — logistics only
        { student: 'Thunderbolt', parent_name: 'Mom', comm_type: 'Email', direction: 'inbound', subject: 'Early pickup Friday', notes: 'Mom emailed to let me know Thunderbolt will be picked up at 1:30 on Friday for a dentist appointment. Noted.', comm_date: daysAgo(3), is_urgent: false },

        // Panda — meltdown, no reply
        { student: 'Panda', parent_name: '', comm_type: 'ParentSquare', direction: 'outbound', subject: 'Difficult day: wanted to loop you in', notes: 'Panda had a full meltdown during math, crying, could not regulate for about 20 minutes. Sent a calm factual message to keep family informed. No reply received.', comm_date: daysAgo(5), is_urgent: false },
      ].map(c => {
        const student = studentMap[c.student];
        if (!student) return null;
        const { student: _name, ...rest } = c;
        return {
          ...rest,
          student_id: student.id,
          student_name: student.name,
          user_id: userId,
          is_demo: true,
          follow_up_done: false,
          is_iep_related: (rest as any).is_iep_related ?? false,
        };
      }).filter(Boolean);

      const { error: commError } = await supabase.from('parent_communications').insert(commsToInsert);
      if (commError) throw commError;

      // Comet — IEP goals
      const cometId = studentMap['Comet']?.id;
      if (cometId) {
        const { error: goalError } = await supabase.from('student_goals').insert([
          {
            student_id: cometId,
            user_id: userId,
            goal_text: 'Comet will reduce calling-out behavior to 2 or fewer instances per 30-minute period by the end of Q4, measured by teacher tally.',
            category: 'social-emotional',
            status: 'in-progress',
            created_at: daysAgo(60),
          },
          {
            student_id: cometId,
            user_id: userId,
            goal_text: 'Comet will demonstrate 75% or higher accuracy on grade-level math assessments by end of year, with extended time accommodations in place.',
            category: 'academic',
            status: 'in-progress',
            created_at: daysAgo(60),
          },
        ]);
        if (goalError) console.error('Comet goals error:', goalError);

        const { error: accomError } = await supabase.from('student_accommodations').insert([
          {
            student_id: cometId,
            user_id: userId,
            accommodation_text: 'Extended time (1.5x) on all tests and quizzes, administered in a separate room.',
            category: 'IEP',
            plan_type: 'IEP',
            is_active: true,
            created_at: daysAgo(60),
          },
          {
            student_id: cometId,
            user_id: userId,
            accommodation_text: 'Preferential seating near the front of the room, away from high-traffic areas.',
            category: 'IEP',
            plan_type: 'IEP',
            is_active: true,
            created_at: daysAgo(60),
          },
        ]);
        if (accomError) console.error('Comet accommodations error:', accomError);

        const { error: shoutoutError } = await supabase.from('shoutouts').insert([
          {
            student_id: cometId,
            student_name: 'Comet',
            user_id: userId,
            content: 'Helped a classmate with the science diagram completely unprompted. That\'s the Comet I know.',
            created_at: daysAgo(3),
          },
        ]);
        if (shoutoutError) console.error('Comet shoutout error:', shoutoutError);
      }

      trackEvent('sandbox_started');
      await refreshData();
    } catch (err) {
      console.error('Error seeding sandbox:', err);
      toast.error('Could not load demo students — please try again.');
    }
  }, [userId, refreshData]);

  const wipeSandbox = useCallback(async () => {
    try {
      await supabase.from('parent_communications').delete().eq('user_id', userId);
      await supabase.from('notes').delete().eq('user_id', userId);
      await supabase.from('students').delete().eq('user_id', userId).eq('is_demo', true);
      trackEvent('sandbox_wiped');
      await refreshData();
    } catch (err) {
      console.error('Error wiping sandbox:', err);
      toast.error('Could not remove demo students — please try again.');
    }
  }, [userId, refreshData]);

  return {
    ...state,
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
    saveSpecialsMode,
    saveDayOfWeekSpecials,
    saveRollingConfig,
    saveTodayOverride,
    saveAbbreviations,
    updateIndicators,
    updateCommTypes,
    updateClasses,
    updateCalendarEvents,
    saveLessonHistory,
    saveSeatingChart,
    saveNotificationPrefs,
    markOnboardingComplete,
    refreshData,
    addGoal,
    updateGoal,
    deleteGoal,
    addAccommodation,
    updateAccommodation,
    deleteAccommodation,
    addParentCommunication,
    updateParentCommunication,
    deleteParentCommunication,
    addShoutout,
    deleteShoutout,
    addAttendanceRecords,
    deleteAttendanceRecord,
    seedSandbox,
    wipeSandbox,
  };
}

// ─── Sandbox helpers (defined outside hook for clarity) ──────────────────────

const SANDBOX_STUDENT_NAMES = [
  'Falcon', 'Blueberry', 'Math-Wiz', 'Rocket', 'Zigzag', 'Panda', 'Thunderbolt', 'Comet',
];

// Full per-student note sets for the rich demo account
const SANDBOX_NOTES: Record<string, Array<{ content: string; tags: string[]; daysAgo: number; is_pinned?: boolean; is_parent_communication?: boolean; parent_communication_type?: string }>> = {
  Falcon: [
    { content: 'Disrupting others during independent work — talking across the table, making sound effects.', tags: ['disruption'], daysAgo: 30 },
    { content: 'Redirected twice during math. Settled after moving seat.', tags: ['redirected', 'off-task'], daysAgo: 26 },
    { content: 'Great morning — stayed on task the whole literacy block.', tags: ['on-task'], daysAgo: 22 },
    { content: 'Left voicemail for parent about ongoing disruption pattern.', tags: ['parent-contact'], daysAgo: 12, is_parent_communication: true, parent_communication_type: 'Phone' },
    { content: 'Parent replied by email — said "dealing with a lot right now." No details given.', tags: ['parent-contact'], daysAgo: 11, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Difficult week — disrupted reading groups twice. Left second voicemail, no response.', tags: ['disruption', 'parent-contact'], daysAgo: 4, is_parent_communication: true, parent_communication_type: 'Phone' },
    { content: 'Helped clean up after art without being asked. Small win.', tags: ['kind'], daysAgo: 2 },
    { content: 'Off task during morning meeting but redirected quickly.', tags: ['off-task', 'redirected'], daysAgo: 1 },
  ],
  Blueberry: [
    { content: 'Moved up a reading level. Really proud of this kid.', tags: ['academic-win'], daysAgo: 28, is_pinned: true },
    { content: 'Led group activity during science — every student engaged.', tags: ['leadership', 'on-task'], daysAgo: 20 },
    { content: 'Emailed dad Marcus about reading level progress.', tags: ['parent-contact'], daysAgo: 9, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Marcus replied right away, so proud, nightly reading at home.', tags: ['parent-contact'], daysAgo: 8, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Finished independent work 10 min early and helped a classmate.', tags: ['on-task', 'kind'], daysAgo: 6 },
    { content: 'Sent Friday good news note to Marcus. Blueberry had a great week.', tags: ['parent-contact'], daysAgo: 2, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Strong participation during class discussion — raised hand every round.', tags: ['participation'], daysAgo: 1 },
  ],
  'Math-Wiz': [
    { content: 'Mastered all grade-level math standards. Ready for enrichment.', tags: ['academic-win'], daysAgo: 25, is_pinned: true },
    { content: 'Finished the math assessment in half the time, all correct.', tags: ['academic-win'], daysAgo: 20 },
    { content: 'Sent ParentSquare note about math mastery and enrichment readiness.', tags: ['parent-contact'], daysAgo: 6, is_parent_communication: true, parent_communication_type: 'ParentSquare' },
    { content: 'Mom replied on ParentSquare: "He does a lot of math at home too."', tags: ['parent-contact'], daysAgo: 5, is_parent_communication: true, parent_communication_type: 'ParentSquare' },
    { content: 'Started enrichment packet. Flew through it. Need harder material.', tags: ['academic-win', 'on-task'], daysAgo: 3 },
    { content: 'Got a little bored during whole-group instruction — started drawing. Not disruptive.', tags: ['off-task'], daysAgo: 1 },
  ],
  Rocket: [
    { content: 'Rested head on desk during morning meeting. Seems tired.', tags: ['mood'], daysAgo: 22 },
    { content: 'Linda (mom) emailed about sleep schedule — asked me to watch for yawning.', tags: ['parent-contact'], daysAgo: 10, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Replied to Linda — Rocket engaged today but did rest his head. Suggested bedtime routine.', tags: ['parent-contact'], daysAgo: 10, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Linda emailed again about lunch balance and ELA homework. Third email this week.', tags: ['parent-contact'], daysAgo: 5, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Good energy today — participated in read-aloud, stayed seated all morning.', tags: ['on-task', 'participation'], daysAgo: 4 },
    { content: 'Linda sent end-of-week check-in asking for a full update. Have not replied yet.', tags: ['parent-contact'], daysAgo: 1, is_parent_communication: true, parent_communication_type: 'Email' },
  ],
  Zigzag: [
    { content: 'Outburst during transition from math to reading — yelling, knocked chair over.', tags: ['behavior', 'disruption'], daysAgo: 28 },
    { content: 'Sent ParentSquare message about escalating outbursts during transitions. No reply.', tags: ['parent-contact'], daysAgo: 14, is_parent_communication: true, parent_communication_type: 'ParentSquare' },
    { content: 'Major incident — threw materials, had to leave the room. Sent second ParentSquare message. Still no reply.', tags: ['behavior', 'parent-contact'], daysAgo: 7, is_parent_communication: true, parent_communication_type: 'ParentSquare', is_pinned: true },
    { content: 'Calmer morning. Redirected once but stayed in the room.', tags: ['redirected'], daysAgo: 5 },
    { content: 'Called listed number — voicemail. Left message asking for callback ASAP. Third attempt.', tags: ['parent-contact'], daysAgo: 3, is_parent_communication: true, parent_communication_type: 'Phone' },
    { content: 'Rough afternoon. Refusing to transition again. Will need a plan.', tags: ['behavior', 'transitions'], daysAgo: 1 },
  ],
  Panda: [
    { content: 'Full meltdown during math — crying, could not regulate for about 20 minutes.', tags: ['behavior', 'mood'], daysAgo: 18, is_pinned: true },
    { content: 'Sent calm ParentSquare message after meltdown to keep family informed. No reply.', tags: ['parent-contact'], daysAgo: 5, is_parent_communication: true, parent_communication_type: 'ParentSquare' },
    { content: 'Better day today. Completed most of math before needing a break.', tags: ['on-task'], daysAgo: 3 },
    { content: 'Got dysregulated during a loud transition but recovered faster than usual.', tags: ['behavior', 'transitions'], daysAgo: 1 },
  ],
  Thunderbolt: [
    { content: 'Enormous energy today — bouncing between tasks but getting things done.', tags: ['on-task'], daysAgo: 15 },
    { content: 'Mom emailed about early pickup Friday for dentist. Noted.', tags: ['parent-contact'], daysAgo: 3, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Great focus during partner reading — stayed on topic the whole time.', tags: ['on-task', 'participation'], daysAgo: 2 },
    { content: 'Needed two reminders during writing workshop. Otherwise solid.', tags: ['redirected'], daysAgo: 1 },
  ],
  Comet: [
    { content: 'Very quiet today. Not disruptive, just withdrawn. Not typical for her.', tags: ['mood'], daysAgo: 45 },
    { content: 'Sat alone at lunch again. Asked if she was okay — said "fine" and looked away.', tags: ['mood'], daysAgo: 42 },
    { content: 'Reached out to mom by email — asked if anything is going on at home.', tags: ['parent-contact'], daysAgo: 11, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Mom replied: best friend moved schools last month. Comet struggling but won\'t talk about it.', tags: ['parent-contact'], daysAgo: 10, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Replied to mom with support plan: new partner, helper role during group work.', tags: ['parent-contact'], daysAgo: 9, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Paired Comet with new partner for science. She smiled once. Small but real.', tags: ['mood'], daysAgo: 8 },
    { content: 'Calling out during science — needs redirection 3x. Different from her withdrawn phase.', tags: ['disruption', 'redirected'], daysAgo: 7 },
    { content: 'Calling out again during math. Redirected and she apologized unprompted.', tags: ['disruption', 'redirected'], daysAgo: 6 },
    { content: 'Had a great partner activity — helped her group stay on track.', tags: ['on-task', 'leadership'], daysAgo: 5 },
    { content: 'Spring conference with Maria Torres. Reviewed IEP goals, discussed impulse control plan.', tags: ['parent-contact', 'iep'], daysAgo: 5, is_parent_communication: true, parent_communication_type: 'Meeting' },
    { content: 'Called Maria to discuss science test result. She scored 62%, below IEP benchmark.', tags: ['parent-contact', 'iep', 'academic'], daysAgo: 4, is_parent_communication: true, parent_communication_type: 'Phone' },
    { content: 'Comet helped classmate with science diagram unprompted. Gave her a shoutout.', tags: ['kind'], daysAgo: 3, is_pinned: true },
    { content: 'ParentSquare message from Maria about absence on Thursday — family appointment.', tags: ['parent-contact', 'attendance'], daysAgo: 2, is_parent_communication: true, parent_communication_type: 'ParentSquare' },
    { content: 'Sent makeup work plan to Maria after absence.', tags: ['parent-contact'], daysAgo: 1, is_parent_communication: true, parent_communication_type: 'Email' },
    { content: 'Playground injury report — scraped knee, iced and returned to class. Maria notified.', tags: ['parent-contact'], daysAgo: 1, is_parent_communication: true, parent_communication_type: 'Phone' },
    { content: 'Calling out 4x during morning meeting. Reminded her of our signal.', tags: ['disruption', 'redirected'], daysAgo: 1 },
    { content: 'Completed all independent work today without prompting. Real progress.', tags: ['on-task', 'independent'], daysAgo: 0 },
    { content: 'Mood seems lighter this week overall. Back to smiling in the hallway.', tags: ['mood'], daysAgo: 0 },
  ],
};
