-- Add recurring/repeating assignment support to form_assignments
-- Idempotent: safe to re-run

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_assignments' AND column_name = 'recurrence_rule'
  ) THEN
    ALTER TABLE form_assignments ADD COLUMN recurrence_rule TEXT DEFAULT 'once';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_assignments' AND column_name = 'next_due_at'
  ) THEN
    ALTER TABLE form_assignments ADD COLUMN next_due_at TIMESTAMPTZ;
  END IF;
END $$;
