
-- Add moderation_status column
ALTER TABLE public.blog_posts 
ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved';

-- Update existing posts to approved
UPDATE public.blog_posts SET moderation_status = 'approved' WHERE moderation_status IS NULL OR moderation_status = '';

-- Allow authenticated members to insert their own posts
CREATE POLICY "Members can create own posts"
ON public.blog_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

-- Allow authors to update their own posts
CREATE POLICY "Authors can update own posts"
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id);

-- Allow authors to view their own posts regardless of status
CREATE POLICY "Authors can view own posts"
ON public.blog_posts
FOR SELECT
TO authenticated
USING (auth.uid() = author_id);

-- Update the public view policy to also check moderation_status
DROP POLICY IF EXISTS "Anyone can view published posts" ON public.blog_posts;
CREATE POLICY "Anyone can view published approved posts"
ON public.blog_posts
FOR SELECT
USING (
  (is_published = true AND moderation_status = 'approved')
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'seo_admin'::app_role)
);
