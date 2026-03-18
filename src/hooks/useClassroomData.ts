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
  loading: boolean;
  error: string | null;
}

interface ClassroomDataActions {
  addNote: (note: any) => Promise<Note | null>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addStudent: (student: Omit<Student, 'id'>) => Promise<Student | null>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'created_at'>) => Promise<Task | null>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addReport: (report: Omit<Report, 'id' | 'created_at'>) => Promise<Report | null>;
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

export function useClassroomData(): ClassroomDataState & ClassroomDataActions {
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
        supabase.from('notes').select('*').order('created_at', { ascending: false }),
        supabase.from('students').select('*'),
        supabase.from('indicators').select('*'),
        supabase.from('comm_types').select('*'),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('classes').select('*'),
        supabase.from('calendar_events').select('*'),
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*'),
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

      // Map student IDs to names for note display
      const studentMap = new Map((studentsData || []).map((s: any) => [s.id, s.name]));

      const notesWithNames = (notesData || []).map((note: any) => ({
        ...note,
        student_name: studentMap.get(note.student_id) || 'Unknown',
        user_id: note.user_id ?? 'local',
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
  }, []);

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

  // ─── Notes ─────────────────────────────────────────────────────────────────

  const addNote = useCallback(async (note: any) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert([{ ...note, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;

      setState(prev => {
        const student = prev.students.find(s => s.id === data.student_id);
        const noteWithName: Note = {
          ...data,
          student_name: student?.name || 'Unknown',
          user_id: 'local',
          is_checklist: false,
          checklist_data: [],
          deadline: null,
        };
        return { ...prev, notes: [noteWithName, ...prev.notes] };
      });
      return data;
    } catch (error) {
      console.error('Error adding note:', error);
      return null;
    }
  }, []);

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

  const addStudent = useCallback(async (student: Omit<Student, 'id'>) => {
    try {
      const { data, error } = await supabase.from('students').insert([student]).select().single();
      if (error) throw error;
      setState(prev => ({ ...prev, students: [...prev.students, data] }));
      return data;
    } catch (error) {
      console.error('Error adding student:', error);
      return null;
    }
  }, []);

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

  const addTask = useCallback(async (task: Omit<Task, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...task, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      setState(prev => ({ ...prev, tasks: [data, ...prev.tasks] }));
      return data;
    } catch (error) {
      console.error('Error adding task:', error);
      return null;
    }
  }, []);

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

  const addReport = useCallback(async (report: Omit<Report, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .insert([{ ...report, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      setState(prev => ({ ...prev, reports: [data, ...prev.reports] }));
      return data;
    } catch (error) {
      console.error('Error adding report:', error);
      return null;
    }
  }, []);

  // ─── Settings ───────────────────────────────────────────────────────────────

  const saveProfile = useCallback(async (profile: Profile) => {
    try {
      await supabase.from('settings').upsert({ key: 'profile', value: profile });
      setState(prev => ({ ...prev, profile }));
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  }, []);

  const saveRotationMapping = useCallback(async (mapping: Record<string, string>) => {
    try {
      await supabase.from('settings').upsert({ key: 'rotation_mapping', value: mapping });
      setState(prev => ({ ...prev, rotationMapping: mapping }));
    } catch (error) {
      console.error('Error saving rotation mapping:', error);
    }
  }, []);

  const saveSpecialsNames = useCallback(async (names: Record<string, string>) => {
    try {
      await supabase.from('settings').upsert({ key: 'specials_names', value: names });
      setState(prev => ({ ...prev, specialsNames: names }));
    } catch (error) {
      console.error('Error saving specials names:', error);
    }
  }, []);

  const saveAbbreviations = useCallback(async (abbreviations: Abbreviation[]) => {
    try {
      await supabase.from('settings').upsert({ key: 'abbreviations', value: abbreviations });
      setState(prev => ({ ...prev, abbreviations }));
    } catch (error) {
      console.error('Error saving abbreviations:', error);
    }
  }, []);

  // ─── Bulk Updates (delete-all + re-insert) ──────────────────────────────────

  const updateIndicators = useCallback(async (newIndicators: Indicator[]) => {
    try {
      const toSave = newIndicators.map(({ icon, ...rest }) => ({
        label: rest.label,
        type: rest.type || 'neutral',
      }));
      await supabase.from('indicators').delete().not('id', 'is', null);
      if (toSave.length > 0) {
        await supabase.from('indicators').insert(toSave);
      }
      setState(prev => ({ ...prev, indicators: newIndicators }));
    } catch (error) {
      console.error('Error updating indicators:', error);
    }
  }, []);

  const updateCommTypes = useCallback(async (newCommTypes: Indicator[]) => {
    try {
      const toSave = newCommTypes.map(({ icon, ...rest }) => ({
        label: rest.label,
      }));
      await supabase.from('comm_types').delete().not('id', 'is', null);
      if (toSave.length > 0) {
        await supabase.from('comm_types').insert(toSave);
      }
      setState(prev => ({ ...prev, commTypes: newCommTypes }));
    } catch (error) {
      console.error('Error updating comm types:', error);
    }
  }, []);

  const updateClasses = useCallback(async (newClasses: string[]) => {
    try {
      await supabase.from('classes').delete().not('id', 'is', null);
      if (newClasses.length > 0) {
        await supabase.from('classes').insert(newClasses.map(name => ({ name })));
      }
      setState(prev => ({ ...prev, classes: newClasses }));
    } catch (error) {
      console.error('Error updating classes:', error);
    }
  }, []);

  const updateCalendarEvents = useCallback(async (newEvents: CalendarEvent[]) => {
    try {
      await supabase.from('calendar_events').delete().not('id', 'is', null);
      if (newEvents.length > 0) {
        const toSave = newEvents.map(({ id: _id, user_id: _uid, ...rest }) => rest);
        await supabase.from('calendar_events').insert(toSave);
      }
      setState(prev => ({ ...prev, calendarEvents: newEvents }));
    } catch (error) {
      console.error('Error updating calendar events:', error);
    }
  }, []);

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
