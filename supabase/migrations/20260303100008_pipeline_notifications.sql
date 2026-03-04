-- =====================================================
-- PIPELINE NOTIFICATIONS
-- =====================================================
-- In-app notification system for pipeline events.
-- Auto-generates notifications when key deal events
-- occur (stage changes, won/lost, stale deals).
-- Designed to support future email/Slack delivery.
-- =====================================================

-- =====================================================
-- 1. NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS pipeline_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who should see this notification
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- What deal/org is this about
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

    -- Notification content
    type TEXT NOT NULL CHECK (type IN (
        'deal_won',
        'deal_lost',
        'deal_stage_change',
        'deal_value_change',
        'deal_stale',
        'deal_assigned',
        'proposal_sent',
        'proposal_viewed',
        'proposal_accepted',
        'demo_provisioned',
        'demo_expiring',
        'system'
    )),
    title TEXT NOT NULL,
    message TEXT,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    -- Read/action state
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    is_actioned BOOLEAN DEFAULT FALSE,
    actioned_at TIMESTAMPTZ,

    -- For future email/Slack delivery
    delivery_channels TEXT[] DEFAULT ARRAY['in_app'],
    delivered_via TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Metadata for linking, icons, actions
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pn_user_unread
    ON pipeline_notifications(user_id, is_read)
    WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_pn_user_created
    ON pipeline_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pn_deal
    ON pipeline_notifications(deal_id);

CREATE INDEX IF NOT EXISTS idx_pn_type
    ON pipeline_notifications(type);

-- =====================================================
-- 2. RLS POLICIES
-- =====================================================

ALTER TABLE pipeline_notifications ENABLE ROW LEVEL SECURITY;

-- Trike Super Admins can see all notifications
CREATE POLICY "Trike admins can manage all notifications"
    ON pipeline_notifications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    );

-- Users can read/update their own notifications
CREATE POLICY "Users can read own notifications"
    ON pipeline_notifications FOR SELECT
    USING (
        user_id IN (
            SELECT id FROM users
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own notifications"
    ON pipeline_notifications FOR UPDATE
    USING (
        user_id IN (
            SELECT id FROM users
            WHERE auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id IN (
            SELECT id FROM users
            WHERE auth_user_id = auth.uid()
        )
    );

-- Demo mode: anon access
CREATE POLICY "Demo mode: anon access to notifications"
    ON pipeline_notifications FOR ALL
    USING (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    )
    WITH CHECK (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    );

-- =====================================================
-- 3. AUTO-GENERATE NOTIFICATIONS FROM DEAL CHANGES
-- =====================================================
-- This trigger fires on deal updates and creates
-- notifications for the deal owner + all Trike admins.

CREATE OR REPLACE FUNCTION generate_deal_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_deal_name TEXT;
    v_org_name TEXT;
    v_notification_type TEXT;
    v_title TEXT;
    v_message TEXT;
    v_priority TEXT;
    v_admin_id UUID;
BEGIN
    -- Get deal and org names for notification text
    v_deal_name := NEW.name;
    SELECT name INTO v_org_name FROM organizations WHERE id = NEW.organization_id;

    -- Determine what changed and build notification
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        -- Stage change notifications
        IF NEW.stage = 'won' THEN
            v_notification_type := 'deal_won';
            v_title := 'Deal Won: ' || v_deal_name;
            v_message := COALESCE(v_org_name, 'Unknown org') ||
                ' — $' || COALESCE(NEW.value::TEXT, '0') || ' closed!';
            v_priority := 'high';

        ELSIF NEW.stage = 'lost' THEN
            v_notification_type := 'deal_lost';
            v_title := 'Deal Lost: ' || v_deal_name;
            v_message := COALESCE(v_org_name, 'Unknown org') ||
                COALESCE(' — Reason: ' || NEW.lost_reason, '');
            v_priority := 'high';

        ELSIF NEW.stage = 'closing' THEN
            v_notification_type := 'deal_stage_change';
            v_title := v_deal_name || ' moved to Closing';
            v_message := COALESCE(v_org_name, 'Unknown org') ||
                ' — $' || COALESCE(NEW.value::TEXT, '0') || ' deal entering close phase';
            v_priority := 'high';

        ELSE
            v_notification_type := 'deal_stage_change';
            v_title := v_deal_name || ' → ' ||
                UPPER(LEFT(NEW.stage, 1)) || SUBSTRING(NEW.stage FROM 2);
            v_message := 'Stage changed from ' ||
                COALESCE(OLD.stage, 'none') || ' to ' || NEW.stage;
            v_priority := 'normal';
        END IF;

    ELSIF OLD.owner_id IS DISTINCT FROM NEW.owner_id AND NEW.owner_id IS NOT NULL THEN
        -- Owner reassignment
        v_notification_type := 'deal_assigned';
        v_title := 'Deal assigned to you: ' || v_deal_name;
        v_message := COALESCE(v_org_name, 'Unknown org') ||
            ' — $' || COALESCE(NEW.value::TEXT, '0');
        v_priority := 'normal';

    ELSIF OLD.value IS DISTINCT FROM NEW.value
          AND COALESCE(NEW.value, 0) > COALESCE(OLD.value, 0) * 1.25 THEN
        -- Significant value increase (>25%)
        v_notification_type := 'deal_value_change';
        v_title := v_deal_name || ' value increased';
        v_message := '$' || COALESCE(OLD.value::TEXT, '0') ||
            ' → $' || COALESCE(NEW.value::TEXT, '0');
        v_priority := 'normal';

    ELSE
        -- No notification-worthy change
        RETURN NEW;
    END IF;

    -- Send to deal owner (if exists)
    IF NEW.owner_id IS NOT NULL THEN
        INSERT INTO pipeline_notifications (
            user_id, deal_id, organization_id,
            type, title, message, priority,
            metadata
        ) VALUES (
            NEW.owner_id, NEW.id, NEW.organization_id,
            v_notification_type, v_title, v_message, v_priority,
            jsonb_build_object(
                'from_stage', OLD.stage,
                'to_stage', NEW.stage,
                'deal_value', NEW.value
            )
        );
    END IF;

    -- Also notify all Trike Super Admins (except deal owner, to avoid dups)
    FOR v_admin_id IN
        SELECT u.id FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.name = 'Trike Super Admin'
        AND u.id IS DISTINCT FROM NEW.owner_id
    LOOP
        INSERT INTO pipeline_notifications (
            user_id, deal_id, organization_id,
            type, title, message, priority,
            metadata
        ) VALUES (
            v_admin_id, NEW.id, NEW.organization_id,
            v_notification_type, v_title, v_message, v_priority,
            jsonb_build_object(
                'from_stage', OLD.stage,
                'to_stage', NEW.stage,
                'deal_value', NEW.value
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger
DROP TRIGGER IF EXISTS trg_deal_notifications ON deals;
CREATE TRIGGER trg_deal_notifications
    AFTER UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION generate_deal_notifications();

-- =====================================================
-- 4. NOTIFICATION PREFERENCES TABLE (future-proof)
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'slack')),
    event_type TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, channel, event_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification prefs"
    ON notification_preferences FOR ALL
    USING (
        user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Demo mode: anon access to notification prefs"
    ON notification_preferences FOR ALL
    USING (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    )
    WITH CHECK (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    );
