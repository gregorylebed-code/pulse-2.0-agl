-- Attendance records for tracking student absences and tardies
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('absent', 'tardy')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate records for same student+date
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_student_date_unique
  ON attendance_records (user_id, student_id, date);

-- Fast lookup by user+date (for daily roll call)
CREATE INDEX IF NOT EXISTS attendance_records_user_date_idx
  ON attendance_records (user_id, date);

-- RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own attendance records"
  ON attendance_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
