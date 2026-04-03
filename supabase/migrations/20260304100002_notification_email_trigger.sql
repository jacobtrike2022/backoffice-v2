-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send email notification when a pipeline notification is created
CREATE OR REPLACE FUNCTION send_notification_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_user_first_name TEXT;
  v_pref_channels TEXT[];
  v_email_enabled BOOLEAN := FALSE;
  v_edge_function_url TEXT;
  v_anon_key TEXT;
  v_template_slug TEXT;
BEGIN
  -- Only process high and urgent priority by default
  -- Check if user has explicit email preference
  SELECT delivery_channels INTO v_pref_channels
  FROM notification_preferences
  WHERE user_id = NEW.user_id
    AND notification_type = NEW.type
  LIMIT 1;

  IF v_pref_channels IS NOT NULL THEN
    v_email_enabled := 'email' = ANY(v_pref_channels);
  ELSE
    -- Default: email ON for high/urgent, OFF for normal/low
    v_email_enabled := NEW.priority IN ('high', 'urgent');
  END IF;

  IF NOT v_email_enabled THEN
    RETURN NEW;
  END IF;

  -- Get user email
  SELECT email, first_name INTO v_user_email, v_user_first_name
  FROM users
  WHERE id = NEW.user_id;

  IF v_user_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map notification type to email template slug
  v_template_slug := 'notification_' || NEW.type;

  -- Get edge function URL from vault or use default
  v_edge_function_url := current_setting('app.settings.edge_function_url', true);
  IF v_edge_function_url IS NULL OR v_edge_function_url = '' THEN
    v_edge_function_url := 'https://kgzhlvxzdlexsrozbbxs.supabase.co/functions/v1/trike-server';
  END IF;

  v_anon_key := current_setting('app.settings.anon_key', true);

  -- Send async HTTP request via pg_net
  PERFORM net.http_post(
    url := v_edge_function_url || '/email/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
    ),
    body := jsonb_build_object(
      'template_slug', v_template_slug,
      'recipient_email', v_user_email,
      'recipient_user_id', NEW.user_id,
      'organization_id', NEW.organization_id,
      'variables', jsonb_build_object(
        'user_name', COALESCE(v_user_first_name, 'there'),
        'notification_title', NEW.title,
        'notification_message', NEW.message,
        'notification_type', NEW.type,
        'notification_priority', NEW.priority
      )
    )
  );

  -- Mark that email delivery was attempted
  UPDATE pipeline_notifications
  SET delivered_via = array_append(COALESCE(delivered_via, ARRAY[]::text[]), 'email')
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Create trigger on pipeline_notifications INSERT
DROP TRIGGER IF EXISTS trigger_notification_email ON pipeline_notifications;
CREATE TRIGGER trigger_notification_email
  AFTER INSERT ON pipeline_notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_notification_email();
