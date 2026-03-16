export interface ContactEntry {
  value: string;
  label: string;
}

export interface Class {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface Indicator {
  id: string;
  label: string;
  type: 'positive' | 'neutral' | 'growth';
  user_id: string;
  created_at: string;
}

export interface CommType {
  id: string;
  label: string;
  user_id: string;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  class_id: string | null;
  class_period?: string | null;
  user_id: string;
  created_at: string;
  parent_guardian_names?: string[];
  parent_emails?: ContactEntry[];
  parent_phones?: ContactEntry[];
  archivedSummaries?: { id: string; content: string; date: string }[];
}

export interface Note {
  id: string;
  content: string;
  student_name: string;
  user_id: string;
  tags: string[];
  deadline: string | null;
  image_url: string | null;
  is_pinned: boolean;
  is_checklist: boolean;
  checklist_data: number[];
  is_parent_communication: boolean;
  parent_communication_type: string; // Stored as comma-separated string for multi-select
  created_at: string;
}

export interface Report {
  id: string;
  student_name: string;
  user_id: string;
  content: string;
  length: 'Quick Pulse' | 'Standard' | 'Detailed';
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  user_id: string;
  created_at: string;
}
