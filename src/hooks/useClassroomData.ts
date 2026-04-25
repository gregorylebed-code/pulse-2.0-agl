import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Note, Student, CalendarEvent, Report, DeliveredLesson, StudentGoal, GoalCategory, GoalStatus, Shoutout, ParentCommunication, Accommodation, AttendanceRecord } from '../types';
import { Abbreviation } from '../utils/expandAbbreviations';
import { SpecialsMode } from '../utils/rotationHelpers';
import { NotificationPrefs, DEFAULT_NOTIFICATION_PREFS } from '../utils/notifications';
import { enqueueNote } from '../lib/offlineQueue';

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
    setState(prev => {
      const updated = { ...prev.stats, [field]: (prev.stats[field] ?? 0) + 1 };
      updatedStats = updated;
      return { ...prev, stats: updated };
    });
    if (updatedStats) {
      await updateSetting('stats', updatedStats);
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
      return data;
    } catch (error) {
      // If offline, queue the note for later sync and return null gracefully
      if (!navigator.onLine) {
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
  };
}
