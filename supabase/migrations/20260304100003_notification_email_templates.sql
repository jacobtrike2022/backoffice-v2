-- Insert system email templates for each notification type
-- These are defaults that orgs can customize

-- Create partial unique index so system templates (org_id IS NULL) are unique by slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_slug_system
  ON email_templates (slug) WHERE organization_id IS NULL;

INSERT INTO email_templates (slug, name, subject, body_html, template_type, is_active, available_variables)
VALUES
  ('notification_deal_won', 'Deal Won Notification', 'Deal Won: {{notification_title}}',
   '<h2>Congratulations!</h2><p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_deal_lost', 'Deal Lost Notification', 'Deal Update: {{notification_title}}',
   '<h2>Deal Update</h2><p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_deal_stage_change', 'Deal Stage Change', 'Deal Moved: {{notification_title}}',
   '<p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_proposal_sent', 'Proposal Sent', 'Proposal Sent: {{notification_title}}',
   '<p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_proposal_viewed', 'Proposal Viewed', 'Proposal Viewed: {{notification_title}}',
   '<p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_proposal_accepted', 'Proposal Accepted', 'Proposal Accepted: {{notification_title}}',
   '<h2>Proposal Accepted!</h2><p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_demo_provisioned', 'Demo Provisioned', 'Demo Ready: {{notification_title}}',
   '<p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_demo_expiring', 'Demo Expiring', 'Demo Expiring: {{notification_title}}',
   '<h2>Action Required</h2><p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_deal_assigned', 'Deal Assigned', 'New Deal Assigned: {{notification_title}}',
   '<p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]'),

  ('notification_deal_stale', 'Stale Deal Alert', 'Stale Deal: {{notification_title}}',
   '<h2>Deal Needs Attention</h2><p>Hi {{user_name}},</p><p>{{notification_message}}</p><p><a href="https://app.trike.co/pipeline">View in Pipeline</a></p>',
   'system', true, '["user_name", "notification_title", "notification_message"]')

ON CONFLICT (slug) WHERE organization_id IS NULL DO NOTHING;
