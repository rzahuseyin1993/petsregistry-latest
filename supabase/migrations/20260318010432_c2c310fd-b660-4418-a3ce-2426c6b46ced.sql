
-- Fix profiles PII exposure: Replace blanket public SELECT with restricted policies

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;

-- Allow users to view their own profile (full access)
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create a security definer function for fetching public profile info (respects privacy flags)
CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'full_name', CASE WHEN show_name THEN full_name ELSE NULL END,
    'phone', CASE WHEN show_phone THEN phone ELSE NULL END,
    'email', email,
    'show_name', show_name,
    'show_phone', show_phone
  )
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;
