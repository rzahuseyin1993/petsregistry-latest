
-- Lost reports table with location data
CREATE TABLE public.lost_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  last_seen_lat NUMERIC,
  last_seen_lng NUMERIC,
  last_seen_address TEXT,
  description TEXT,
  reward TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lost_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active lost reports" ON public.lost_reports
  FOR SELECT USING (status = 'active' OR reporter_id = auth.uid());

CREATE POLICY "Owners can create lost reports" ON public.lost_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Owners can update lost reports" ON public.lost_reports
  FOR UPDATE USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can manage all lost reports" ON public.lost_reports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
