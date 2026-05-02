UPDATE public.lost_reports
SET last_seen_address = 'Ubi Avenue 3, Kampong Ubi, Geylang, Central Region, Singapore'
WHERE id = '3b255620-4b76-4871-bd57-0ef21e7d6d73'
  AND (last_seen_address IS NULL OR last_seen_address = '');