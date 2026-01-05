-- =====================================================
-- SEED SYSTEM EMAIL TEMPLATES
-- =====================================================
-- These are Trike-managed templates that all organizations inherit.
-- Organizations can override by creating their own with the same slug.
-- =====================================================

-- Welcome Admin Template
INSERT INTO email_templates (
    organization_id,
    slug,
    name,
    description,
    subject,
    body_html,
    body_text,
    template_type,
    is_locked,
    available_variables
) VALUES (
    NULL,  -- System template
    'welcome_admin',
    'Welcome - Admin Account',
    'Sent when a new admin account is created during onboarding',
    'Welcome to Trike, {{admin_name}}!',
    E'<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .credentials { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .credentials-label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
    .credentials-value { font-size: 16px; font-weight: 500; color: #111827; font-family: monospace; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-top: 20px; font-size: 14px; color: #92400e; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">Welcome to Trike!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your {{company_name}} account is ready</p>
  </div>
  <div class="content">
    <p>Hi {{admin_name}},</p>
    <p>Your administrator account for <strong>{{company_name}}</strong> has been created. You can now access the Trike training platform to manage your team''s learning and compliance.</p>

    <div class="credentials">
      <div style="margin-bottom: 16px;">
        <div class="credentials-label">Email</div>
        <div class="credentials-value">{{login_email}}</div>
      </div>
      <div>
        <div class="credentials-label">Temporary Password</div>
        <div class="credentials-value">{{temp_password}}</div>
      </div>
    </div>

    <a href="{{login_url}}" class="button">Login to Dashboard</a>

    <div class="warning">
      <strong>Security Note:</strong> Please change your password after your first login.
    </div>
  </div>
  <div class="footer">
    <p>&copy; Trike Training Platform</p>
  </div>
</body>
</html>',
    E'Welcome to Trike, {{admin_name}}!

Your {{company_name}} account is ready.

Login Details:
Email: {{login_email}}
Password: {{temp_password}}

Login to Dashboard: {{login_url}}

For security, please change your password after first login.

- Trike Training Platform',
    'system',
    true,
    '[
      {"key": "admin_name", "description": "Administrator''s name"},
      {"key": "company_name", "description": "Organization name"},
      {"key": "login_email", "description": "Login email address"},
      {"key": "temp_password", "description": "Temporary password"},
      {"key": "login_url", "description": "URL to login page"}
    ]'::jsonb
) ON CONFLICT (organization_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    body_text = EXCLUDED.body_text,
    available_variables = EXCLUDED.available_variables,
    updated_at = NOW();

-- Welcome Employee Template
INSERT INTO email_templates (
    organization_id,
    slug,
    name,
    description,
    subject,
    body_html,
    body_text,
    template_type,
    is_locked,
    available_variables
) VALUES (
    NULL,
    'welcome_employee',
    'Welcome - Employee Account',
    'Sent when a new employee/learner account is created',
    'Welcome to {{company_name}} Training!',
    E'<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .credentials { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .credentials-label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
    .credentials-value { font-size: 16px; font-weight: 500; color: #111827; font-family: monospace; }
    .button { display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">Welcome!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">You''ve been added to {{company_name}}''s training platform</p>
  </div>
  <div class="content">
    <p>Hi {{employee_name}},</p>
    <p>You''ve been added to <strong>{{company_name}}</strong>''s training platform. Complete your assigned training to stay compliant and up-to-date.</p>

    <div class="credentials">
      <div style="margin-bottom: 16px;">
        <div class="credentials-label">Email</div>
        <div class="credentials-value">{{login_email}}</div>
      </div>
      <div>
        <div class="credentials-label">Temporary Password</div>
        <div class="credentials-value">{{temp_password}}</div>
      </div>
    </div>

    <a href="{{login_url}}" class="button">Start Training</a>
  </div>
  <div class="footer">
    <p>&copy; {{company_name}} via Trike</p>
  </div>
</body>
</html>',
    E'Welcome to {{company_name}} Training!

Hi {{employee_name}},

You''ve been added to {{company_name}}''s training platform.

Login Details:
Email: {{login_email}}
Password: {{temp_password}}

Start Training: {{login_url}}

- {{company_name}}',
    'system',
    true,
    '[
      {"key": "employee_name", "description": "Employee''s name"},
      {"key": "company_name", "description": "Organization name"},
      {"key": "login_email", "description": "Login email address"},
      {"key": "temp_password", "description": "Temporary password"},
      {"key": "login_url", "description": "URL to login page"}
    ]'::jsonb
) ON CONFLICT (organization_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    body_text = EXCLUDED.body_text,
    available_variables = EXCLUDED.available_variables,
    updated_at = NOW();

-- Password Reset Template
INSERT INTO email_templates (
    organization_id,
    slug,
    name,
    description,
    subject,
    body_html,
    body_text,
    template_type,
    is_locked,
    available_variables
) VALUES (
    NULL,
    'password_reset',
    'Password Reset',
    'Sent when a user requests a password reset',
    'Reset Your Trike Password',
    E'<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1f2937; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    .note { background: #f3f4f6; border-radius: 6px; padding: 12px; margin-top: 20px; font-size: 14px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">Password Reset</h1>
  </div>
  <div class="content">
    <p>Hi {{user_name}},</p>
    <p>We received a request to reset your password. Click the button below to set a new password:</p>

    <a href="{{reset_link}}" class="button">Reset Password</a>

    <p>This link will expire in <strong>{{expires_in}}</strong>.</p>

    <div class="note">
      If you didn''t request this password reset, you can safely ignore this email. Your password will remain unchanged.
    </div>
  </div>
  <div class="footer">
    <p>&copy; Trike Training Platform</p>
  </div>
</body>
</html>',
    E'Reset Your Trike Password

Hi {{user_name}},

We received a request to reset your password. Click the link below to set a new password:

{{reset_link}}

This link expires in {{expires_in}}.

If you didn''t request this, ignore this email.

- Trike Training Platform',
    'system',
    true,
    '[
      {"key": "user_name", "description": "User''s name"},
      {"key": "reset_link", "description": "Password reset URL"},
      {"key": "expires_in", "description": "Link expiration time (e.g., 1 hour)"}
    ]'::jsonb
) ON CONFLICT (organization_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    body_text = EXCLUDED.body_text,
    available_variables = EXCLUDED.available_variables,
    updated_at = NOW();

-- Password Changed Confirmation Template
INSERT INTO email_templates (
    organization_id,
    slug,
    name,
    description,
    subject,
    body_html,
    body_text,
    template_type,
    is_locked,
    available_variables
) VALUES (
    NULL,
    'password_changed',
    'Password Changed Confirmation',
    'Sent when a user successfully changes their password',
    'Your Password Has Been Changed',
    E'<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #059669; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    .warning { background: #fef2f2; border: 1px solid #ef4444; border-radius: 6px; padding: 12px; margin-top: 20px; font-size: 14px; color: #b91c1c; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">Password Changed</h1>
  </div>
  <div class="content">
    <p>Hi {{user_name}},</p>
    <p>Your password has been successfully changed.</p>

    <div class="warning">
      <strong>Didn''t make this change?</strong><br>
      If you didn''t change your password, please contact support immediately as your account may be compromised.
    </div>
  </div>
  <div class="footer">
    <p>&copy; Trike Training Platform</p>
  </div>
</body>
</html>',
    E'Your Password Has Been Changed

Hi {{user_name}},

Your password has been successfully changed.

If you didn''t make this change, please contact support immediately.

- Trike Training Platform',
    'system',
    true,
    '[
      {"key": "user_name", "description": "User''s name"}
    ]'::jsonb
) ON CONFLICT (organization_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    body_text = EXCLUDED.body_text,
    available_variables = EXCLUDED.available_variables,
    updated_at = NOW();
