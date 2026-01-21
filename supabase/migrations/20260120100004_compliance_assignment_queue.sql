-- =====================================================
-- SMART ASSIGNMENT ENGINE - ASSIGNMENT QUEUE
-- =====================================================

CREATE TABLE IF NOT EXISTS compliance_assignment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES compliance_requirements(id),
  playlist_id UUID REFERENCES albums(id),  -- The locked playlist to assign

  -- Trigger info
  triggered_by TEXT NOT NULL CHECK (triggered_by IN (
    'onboarding',      -- New hire
    'transfer',        -- Location change
    'promotion',       -- Role change
    'expiration',      -- Cert expiring
    'manual'           -- Admin assigned
  )),
  trigger_source_id UUID,  -- Reference to event (can be user_id, transfer record, etc.)
  trigger_details JSONB,   -- Extra context

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',         -- Awaiting action
    'assigned',        -- Playlist assigned to user
    'suppressed',      -- Skipped due to existing cert
    'completed',       -- User completed training
    'expired',         -- User didn't complete in time
    'cancelled'        -- Admin cancelled
  )),

  -- Suppression
  suppression_reason TEXT CHECK (suppression_reason IN (
    'valid_external_cert',
    'valid_trike_cert',
    'valid_imported_cert',
    'manual_override',
    'duplicate_assignment'
  )),
  suppressed_by UUID REFERENCES auth.users(id),
  suppressed_at TIMESTAMPTZ,

  -- Assignment tracking
  assigned_at TIMESTAMPTZ,
  due_date DATE,
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique constraint to prevent duplicate pending/assigned assignments
CREATE UNIQUE INDEX idx_assignment_queue_unique_pending
  ON compliance_assignment_queue(organization_id, employee_id, requirement_id)
  WHERE status IN ('pending', 'assigned');

CREATE INDEX idx_assignment_queue_org ON compliance_assignment_queue(organization_id);
CREATE INDEX idx_assignment_queue_employee ON compliance_assignment_queue(employee_id);
CREATE INDEX idx_assignment_queue_requirement ON compliance_assignment_queue(requirement_id);
CREATE INDEX idx_assignment_queue_status ON compliance_assignment_queue(status);
CREATE INDEX idx_assignment_queue_pending ON compliance_assignment_queue(organization_id, status)
  WHERE status = 'pending';

-- RLS
ALTER TABLE compliance_assignment_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignments in their org" ON compliance_assignment_queue FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Employees can view their own assignments" ON compliance_assignment_queue FOR SELECT
  USING (employee_id IN (
    SELECT id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage assignments in their org" ON compliance_assignment_queue FOR ALL
  USING (organization_id IN (
    SELECT u.organization_id FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid()
    AND r.name IN ('Admin', 'Trike Super Admin')
  ));

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_assignment_queue_updated_at ON compliance_assignment_queue;
CREATE TRIGGER update_assignment_queue_updated_at
  BEFORE UPDATE ON compliance_assignment_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
