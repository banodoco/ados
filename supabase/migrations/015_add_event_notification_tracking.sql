-- Add event_notification_sent_at column to track when event notifications were sent
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS event_notification_sent_at TIMESTAMP WITH TIME ZONE;

-- Add index for querying attendees by notification status
CREATE INDEX IF NOT EXISTS idx_attendance_event_notification_sent ON attendance(event_notification_sent_at) WHERE status = 'approved';

-- Add comment explaining the new column
COMMENT ON COLUMN attendance.event_notification_sent_at IS 'Timestamp when the event notification (reminder/update) was sent to the user via Discord';







