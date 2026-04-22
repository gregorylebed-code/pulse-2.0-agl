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
  birth_month?: number | null;
  birth_day?: number | null;
  photo_url?: string | null;
  pronouns?: string | null;
  alias?: string | null;
}

export interface Note {
  id: string;
  content: string;
  student_id?: string | null;
  student_name: string;
  class_name?: string | null;
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
  length: 'Quick Note' | 'Standard' | 'Detailed';
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

export type GoalCategory = 'academic' | 'social-emotional' | 'executive-functioning' | 'other';
export type GoalStatus = 0 | 1 | 2 | 3;

export interface StudentGoal {
  id: string;
  student_id: string;
  user_id: string;
  category: GoalCategory;
  goal_text: string;
  status: GoalStatus;
  teacher_note?: string | null;
  created_at: string;
  updated_at: string;
}

export type AccommodationPlanType = 'IEP' | '504' | 'RTI' | 'Other';
export type AccommodationCategory = 'extended_time' | 'seating' | 'testing' | 'materials' | 'behavioral' | 'presentation' | 'response' | 'other';

export interface Accommodation {
  id: string;
  student_id: string;
  user_id: string;
  plan_type: AccommodationPlanType;
  category: AccommodationCategory;
  accommodation_text: string | null;
  is_active: boolean;
  review_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SELTopic {
  title: string;
  theme: string;
  rationale: string;
}

export interface SELLesson {
  materials: string[];
  opener: string;
  activity: string;
  exitTicket: string;
}

export interface Shoutout {
  id: string;
  student_id: string | null;
  student_name: string;
  content: string;
  category: string | null;
  user_id: string;
  created_at: string;
}

export interface DeliveredLesson {
  className: string;
  title: string;
  date: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  student_id: string;
  date: string; // 'YYYY-MM-DD'
  status: 'absent' | 'tardy';
  created_at: string;
}

export interface ParentCommunication {
  id: string;
  user_id: string;
  student_id: string;
  student_name: string;
  comm_type: string;          // 'Email' | 'Phone' | 'Meeting' | 'ParentSquare' | custom
  direction: 'outbound' | 'inbound';
  subject?: string | null;
  notes: string;
  parent_name?: string | null;
  comm_date: string;
  follow_up_date?: string | null;
  follow_up_done: boolean;
  is_iep_related: boolean;
  is_urgent: boolean;
  created_at: string;
  updated_at: string;
}
