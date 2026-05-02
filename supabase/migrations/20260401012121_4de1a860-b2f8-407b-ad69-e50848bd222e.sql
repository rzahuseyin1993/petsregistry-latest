INSERT INTO public.site_settings (key, value, description) VALUES
  ('smtp_host', '', 'SMTP server hostname'),
  ('smtp_port', '587', 'SMTP server port'),
  ('smtp_username', '', 'SMTP authentication username'),
  ('smtp_password', '', 'SMTP authentication password'),
  ('smtp_from_email', '', 'From email address for outgoing emails'),
  ('smtp_from_name', 'PetsRegistry', 'From name for outgoing emails'),
  ('smtp_enabled', 'false', 'Enable/disable SMTP email sending')
ON CONFLICT (key) DO NOTHING;