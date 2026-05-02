
ALTER TABLE public.blog_posts 
ADD COLUMN is_featured boolean NOT NULL DEFAULT false,
ADD COLUMN featured_until timestamp with time zone DEFAULT NULL;
