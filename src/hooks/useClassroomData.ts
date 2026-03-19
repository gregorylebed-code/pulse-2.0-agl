import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Note, Student, CalendarEvent, Report } from '../types';
import { Abbreviation } from '../utils/expandAbbreviations';

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

interface Profile {
  userName: string;
  schoolName: string;
}

const DEFAULT_PROFILE: Profile = {
  userName: 'Teacher',
  schoolName: 'Classroom Pulse Elementary',
};

const DEFAULT_COMM_TYPES: Indicator[] = [
  { label: 'ParentSquare', type: 'neutral', icon_name: 'ParentSquare' },
  { label: 'Email', type: 'neutral', icon_name: 'Mail' },
  { label: 'Phone', type: 'neutral', icon_name: 'Phone' },
  { label: 'Meeting', type: 'neutral', icon_name: 'Users' },
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
  indicators: Indicator[];
  commTypes: Indicator[];
  classes: string[];
  calendarEvents: CalendarEvent[];
  tasks: Task[];
  reports: Report[];
  profile: Profile;
  rotationMapping: Record<string, string>;
  specialsNames: Record<string, string>;
  abbreviations: Abbreviation[];
  stats: Stats;
  loading: boolean;
  error: string | null;
}

interface ClassroomDataActions {
  addNote: (note: Omit<Note, 'id' | 'created_at' | 'user_id'>) => Promise<Note | null>;
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
  saveAbbreviations: (abbreviations: Abbreviation[]) => Promise<void>;
  updateIndicators: (indicators: Indicator[]) => Promise<void>;
  updateCommTypes: (commTypes: Indicator[]) => Promise<void>;
  updateClasses: (classes: string[]) => Promise<void>;
  updateCalendarEvents: (events: CalendarEvent[]) => Promise<void>;
  refreshData: () => Promise<void>;
}

export function useClassroomData(userId: string): ClassroomDataState & ClassroomDataActions {
  const [state, setState] = useState<ClassroomDataState>({
    notes: [],
    students: [],
    indicators: [],
    commTypes: [],
    classes: ['AM', 'PM'],
    calendarEvents: [],
    tasks: [],
    reports: [],
    profile: DEFAULT_PROFILE,
    rotationMapping: {},
    specialsNames: DEFAULT_SPECIALS,
    abbreviations: [],
    stats: { notes_created: 0, reports_generated: 0 },
    loading: true,
    error: null,
  });

  const subscriptionsRef = useRef<any[]>([]);

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
      ] = await Promise.all([
        supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('students').select('*').eq('user_id', userId),
        supabase.from('indicators').select('*').eq('user_id', userId),
        supabase.from('comm_types').select('*').eq('user_id', userId),
        supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('classes').select('*').eq('user_id', userId),
        supabase.from('calendar_events').select('*').eq('user_id', userId),
        supabase.from('reports').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('settings').select('*').eq('user_id', userId),
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

      const profile = settingsMap['profile']
        ?? (localStorage.getItem('cp_profile') ? JSON.parse(localStorage.getItem('cp_profile')!) : DEFAULT_PROFILE);
      const rotationMapping = settingsMap['rotation_mapping']
        ?? (localStorage.getItem('rotationMapping') ? JSON.parse(localStorage.getItem('rotationMapping')!) : {});
      const specialsNames = settingsMap['specials_names']
        ?? (localStorage.getItem('specialsNames') ? JSON.parse(localStorage.getItem('specialsNames')!) : DEFAULT_SPECIALS);
      const abbreviations: Abbreviation[] = settingsMap['abbreviations'] ?? [];
      const stats: Stats = settingsMap['stats'] ?? { notes_created: 0, reports_generated: 0 };

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
        // Use DB indicators directly; fall back to previous state if DB is empty
        indicators: (indicatorsData && indicatorsData.length > 0)
          ? (indicatorsData as Indicator[])
          : prev.indicators,
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
        abbreviations,
        stats,
        loading: false,
      }));

      setupSubscriptions();
    } catch (error) {
      console.error('Error loading data:', error);
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
      await supabase.from('settings').upsert(
        { user_id: userId, key: 'stats', value: updatedStats },
        { onConflict: 'user_id,key' }
      );
    }
  }, [userId]);

  // ─── Notes ─────────────────────────────────────────────────────────────────

  const addNote = useCallback(async (note: Omit<Note, 'id' | 'created_at' | 'user_id'>) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert([{ ...note, user_id: userId, created_at: new Date().toISOString() }])
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
      console.error('Error adding note:', error);
      return null;
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
    }
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== id) }));
    } catch (error) {
      console.error('Error deleting note:', error);
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
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
    } catch (error) {
      console.error('Error deleting task:', error);
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
      await supabase.from('settings').upsert(
        { user_id: userId, key: 'profile', value: profile },
        { onConflict: 'user_id,key' }
      );
      setState(prev => ({ ...prev, profile }));
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  }, [userId]);

  const saveRotationMapping = useCallback(async (mapping: Record<string, string>) => {
    try {
      await supabase.from('settings').upsert(
        { user_id: userId, key: 'rotation_mapping', value: mapping },
        { onConflict: 'user_id,key' }
      );
      setState(prev => ({ ...prev, rotationMapping: mapping }));
    } catch (error) {
      console.error('Error saving rotation mapping:', error);
    }
  }, [userId]);

  const saveSpecialsNames = useCallback(async (names: Record<string, string>) => {
    try {
      await supabase.from('settings').upsert(
        { user_id: userId, key: 'specials_names', value: names },
        { onConflict: 'user_id,key' }
      );
      setState(prev => ({ ...prev, specialsNames: names }));
    } catch (error) {
      console.error('Error saving specials names:', error);
    }
  }, [userId]);

  const saveAbbreviations = useCallback(async (abbreviations: Abbreviation[]) => {
    try {
      await supabase.from('settings').upsert(
        { user_id: userId, key: 'abbreviations', value: abbreviations },
        { onConflict: 'user_id,key' }
      );
      setState(prev => ({ ...prev, abbreviations }));
    } catch (error) {
      console.error('Error saving abbreviations:', error);
    }
  }, [userId]);

  // ─── Bulk Updates (delete-all + re-insert) ──────────────────────────────────

  const updateIndicators = useCallback(async (newIndicators: Indicator[]) => {
    try {
      const toSave = newIndicators.map(({ icon, ...rest }) => ({
        label: rest.label,
        type: rest.type || 'neutral',
        user_id: userId,
      }));
      await supabase.from('indicators').delete().eq('user_id', userId);
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
      await supabase.from('comm_types').delete().eq('user_id', userId);
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
      await supabase.from('classes').delete().eq('user_id', userId);
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
      await supabase.from('calendar_events').delete().eq('user_id', userId);
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
    saveAbbreviations,
    updateIndicators,
    updateCommTypes,
    updateClasses,
    updateCalendarEvents,
    refreshData,
  };
}
