import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCmsPage = (slug: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ["cms-page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cms_pages")
        .select("html_content, css_content, gjs_data, is_published")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  return {
    html: data?.html_content || "",
    css: data?.css_content || "",
    gjsData: data?.gjs_data,
    isLoading,
    hasCmsContent: !!data && !!data.html_content && data.html_content.trim().length > 0,
  };
};
