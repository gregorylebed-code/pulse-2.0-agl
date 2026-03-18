import { supabase } from '../lib/supabase';

interface MigrationResults {
  classes: number;
  students: number;
  notes: number;
  indicators: number;
  commTypes: number;
  tasks: number;
  calendarEvents: number;
  reports: number;
  orphanedNotes: number;
  errors: string[];
}

export async function migrateFromLocalStorage(): Promise<MigrationResults> {
  const results: MigrationResults = {
    classes: 0,
    students: 0,
    notes: 0,
    indicators: 0,
    commTypes: 0,
    tasks: 0,
    calendarEvents: 0,
    reports: 0,
    orphanedNotes: 0,
    errors: [],
  };

  try {
    // ─── 1. Classes ────────────────────────────────────────────────────────────
    const rawClasses: string[] = JSON.parse(
      localStorage.getItem('cp_classes') || '["AM","PM"]'
    );
    const classInserts = rawClasses.map((name) => ({ name }));
    const { data: insertedClasses, error: classError } = await supabase
      .from('classes')
      .insert(classInserts)
      .select();

    if (classError) {
      results.errors.push(`Classes: ${classError.message}`);
    }

    const classMap: Record<string, string> = {}; // class name → new UUID
    insertedClasses?.forEach((c) => (classMap[c.name] = c.id));
    results.classes = insertedClasses?.length ?? 0;

    // ─── 2. Students ───────────────────────────────────────────────────────────
    const rawStudents: any[] = JSON.parse(
      localStorage.getItem('cp_students') || '[]'
    );

    if (rawStudents.length > 0) {
      const studentInserts = rawStudents.map((s) => ({
        name: s.name,
        class_period: s.class_period ?? null,
        class_id: s.class_period ? (classMap[s.class_period] ?? null) : null,
        parent_guardian_names: s.parent_guardian_names ?? [],
        parent_emails: s.parent_emails ?? [],
        parent_phones: s.parent_phones ?? [],
        archived_summaries: s.archivedSummaries ?? [],
      }));

      const { data: insertedStudents, error: studentError } = await supabase
        .from('students')
        .insert(studentInserts)
        .select();

      if (studentError) {
        results.errors.push(`Students: ${studentError.message}`);
      }

      const studentMap: Record<string, string> = {}; // old name → new UUID
      insertedStudents?.forEach((s) => (studentMap[s.name] = s.id));
      results.students = insertedStudents?.length ?? 0;

      // ─── 3. Notes ──────────────────────────────────────────────────────────
      const rawNotes: any[] = JSON.parse(
        localStorage.getItem('cp_notes') || '[]'
      );

      if (rawNotes.length > 0) {
        const noteInserts = rawNotes
          .map((n) => {
            const studentId = studentMap[n.student_name] ?? null;
            if (!studentId) results.orphanedNotes++;
            return {
              student_id: studentId,
              content: n.content,
              tags: n.tags ?? [],
              image_url: n.image_url ?? null,
              is_parent_communication: n.is_parent_communication ?? false,
              parent_communication_type: n.parent_communication_type ?? null,
              is_pinned: n.is_pinned ?? false,
              created_at: n.created_at,
            };
          })
          .filter((n) => n.student_id !== null);

        // Insert in batches of 50 to avoid request size limits
        for (let i = 0; i < noteInserts.length; i += 50) {
          const batch = noteInserts.slice(i, i + 50);
          const { data: insertedNotes, error: noteError } = await supabase
            .from('notes')
            .insert(batch)
            .select('id');

          if (noteError) {
            results.errors.push(`Notes batch ${i / 50 + 1}: ${noteError.message}`);
          } else {
            results.notes += insertedNotes?.length ?? 0;
          }
        }
      }

      // ─── 4. Reports ────────────────────────────────────────────────────────
      const rawReports: any[] = JSON.parse(
        localStorage.getItem('classroom_pulse_reports') || '[]'
      );

      if (rawReports.length > 0) {
        const reportInserts = rawReports
          .map((r) => ({
            student_id: studentMap[r.student_name] ?? null,
            content: r.content,
            length: r.length ?? 'Standard',
            created_at: r.created_at,
          }))
          .filter((r) => r.student_id !== null);

        if (reportInserts.length > 0) {
          const { data: insertedReports, error: reportError } = await supabase
            .from('reports')
            .insert(reportInserts)
            .select('id');

          if (reportError) {
            results.errors.push(`Reports: ${reportError.message}`);
          }
          results.reports = insertedReports?.length ?? 0;
        }
      }
    }

    // ─── 5. Indicators ─────────────────────────────────────────────────────────
    const rawIndicators: any[] = JSON.parse(
      localStorage.getItem('cp_indicators') || '[]'
    );

    if (rawIndicators.length > 0) {
      const indicatorInserts = rawIndicators.map((i) => ({
        label: i.label,
        type: ['positive', 'neutral', 'growth'].includes(i.type) ? i.type : 'neutral',
      }));

      const { data: insertedIndicators, error: indicatorError } = await supabase
        .from('indicators')
        .insert(indicatorInserts)
        .select('id');

      if (indicatorError) {
        results.errors.push(`Indicators: ${indicatorError.message}`);
      }
      results.indicators = insertedIndicators?.length ?? 0;
    }

    // ─── 6. Comm Types ─────────────────────────────────────────────────────────
    // commTypes may be stored under cp_comm_types or embedded in indicators
    const rawCommTypes: any[] = JSON.parse(
      localStorage.getItem('cp_comm_types') || '[]'
    );

    if (rawCommTypes.length > 0) {
      const commInserts = rawCommTypes.map((c) => ({ label: c.label }));
      const { data: insertedComm, error: commError } = await supabase
        .from('comm_types')
        .insert(commInserts)
        .select('id');

      if (commError) {
        results.errors.push(`Comm types: ${commError.message}`);
      }
      results.commTypes = insertedComm?.length ?? 0;
    }

    // ─── 7. Tasks ──────────────────────────────────────────────────────────────
    const rawTasks: any[] = JSON.parse(
      localStorage.getItem('cp_tasks') || '[]'
    );

    if (rawTasks.length > 0) {
      const taskInserts = rawTasks.map((t) => ({
        text: t.text,
        completed: t.completed ?? false,
        color: t.color ?? null,
        created_at: t.created_at,
      }));

      const { data: insertedTasks, error: taskError } = await supabase
        .from('tasks')
        .insert(taskInserts)
        .select('id');

      if (taskError) {
        results.errors.push(`Tasks: ${taskError.message}`);
      }
      results.tasks = insertedTasks?.length ?? 0;
    }

    // ─── 8. Calendar Events ────────────────────────────────────────────────────
    const rawEvents: any[] = JSON.parse(
      localStorage.getItem('cp_calendar_events') || '[]'
    );

    if (rawEvents.length > 0) {
      const eventInserts = rawEvents.map((e) => ({
        date: e.date,
        type: e.type ?? null,
        title: e.title,
      }));

      const { data: insertedEvents, error: eventError } = await supabase
        .from('calendar_events')
        .insert(eventInserts)
        .select('id');

      if (eventError) {
        results.errors.push(`Calendar events: ${eventError.message}`);
      }
      results.calendarEvents = insertedEvents?.length ?? 0;
    }

    // ─── 9. Settings (rotation, specials, profile) ─────────────────────────────
    const settingsToMigrate = [
      { key: 'rotation_mapping', localKey: 'rotationMapping' },
      { key: 'specials_names', localKey: 'specialsNames' },
      { key: 'profile', localKey: 'cp_profile' },
    ];

    for (const { key, localKey } of settingsToMigrate) {
      const raw = localStorage.getItem(localKey);
      if (raw) {
        try {
          const value = JSON.parse(raw);
          const { error } = await supabase
            .from('settings')
            .upsert({ key, value });
          if (error) results.errors.push(`Settings(${key}): ${error.message}`);
        } catch {
          results.errors.push(`Settings(${key}): failed to parse JSON`);
        }
      }
    }
  } catch (err: any) {
    results.errors.push(`Unexpected error: ${err?.message ?? String(err)}`);
  }

  console.log('Migration complete:', results);
  return results;
}
