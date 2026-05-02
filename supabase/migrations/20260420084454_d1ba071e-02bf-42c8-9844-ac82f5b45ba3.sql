-- Enable scheduling extensions (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Insert default retention settings (skip if already present)
INSERT INTO public.site_settings (key, value, description)
VALUES
  ('lost_report_retention_days', '365', 'Auto-delete every lost_report row older than this many days (0 = never delete).'),
  ('lost_report_found_visible_days', '7', 'How many days a lost report stays publicly visible after being marked Found.')
ON CONFLICT (key) DO NOTHING;