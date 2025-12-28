-- Add event_reminder_sent_at column to track when event reminders were sent
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS event_reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Add index for querying attendees by reminder status
CREATE INDEX IF NOT EXISTS idx_attendance_event_reminder_sent ON attendance(event_reminder_sent_at) WHERE status = 'approved';

-- Add comment explaining the new column
COMMENT ON COLUMN attendance.event_reminder_sent_at IS 'Timestamp when the event reminder (final details) was sent to the user via Discord';




