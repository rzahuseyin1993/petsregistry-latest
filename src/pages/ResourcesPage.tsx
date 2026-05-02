import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Search, X, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  tags: string[];
  published_at: string | null;
  created_at: string;
  is_featured: boolean;
  featured_until: string | null;
};

const ResourcesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTag = searchParams.get("tag") || "";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const [search, setSearch] = useState("");
  

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["public-blog-posts"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, cover_image_url, tags, published_at, created_at, is_featured, featured_until")
        .eq("is_published", true) as any)
        .eq("moderation_status", "approved")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as BlogPost[];
    },
  });

  const { data: perPageSetting } = useQuery({
    queryKey: ["site-setting-resources-per-page"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "resources_per_page")
        .maybeSingle();
      return data?.value ? parseInt(data.value, 10) : 10;
    },
  });

  const { data: categoriesSetting } = useQuery({
    queryKey: ["site-setting-blog-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "blog_categories")
        .maybeSingle();
      return data?.value ? data.value.split(",").map((c: string) => c.trim()).filter(Boolean) : [];
    },
  });


  const perPage = perPageSetting || 10;
  const categories = categoriesSetting || [];

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    categories.forEach((c: string) => tagSet.add(c));
    posts.forEach((p) => (p.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [posts, categories]);

  const filtered = useMemo(() => {
    let result = posts;
    if (activeTag) {
      result = result.filter((p) => (p.tags || []).includes(activeTag));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.excerpt || "").toLowerCase().includes(q)
      );
    }
    // Sort: featured posts first (still active), then by published_at desc
    result = [...result].sort((a, b) => {
      const aFeatured = a.is_featured && (!a.featured_until || new Date(a.featured_until) > new Date());
      const bFeatured = b.is_featured && (!b.featured_until || new Date(b.featured_until) > new Date());
      if (aFeatured && !bFeatured) return -1;
      if (!aFeatured && bFeatured) return 1;
      return new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime();
    });
    return result;
  }, [posts, activeTag, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPosts = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const setTag = (tag: string) => {
    const params: Record<string, string> = {};
    if (tag) params.tag = tag;
    setSearchParams(params);
  };

  const goToPage = (page: number) => {
    const params: Record<string, string> = {};
    if (activeTag) params.tag = activeTag;
    if (page > 1) params.page = String(page);
    setSearchParams(params);
  };

  const isFeaturedActive = (post: BlogPost) =>
    post.is_featured && (!post.featured_until || new Date(post.featured_until) > new Date());

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground">Resources</h1>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
            Tips, guides, and news about pet care, safety, and more.
          </p>
        </div>


        {!isLoading && posts.length > 0 && (
          <div className="mb-8 space-y-4">
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); goToPage(1); }}
                className="pl-9 pr-9"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                <Badge
                  variant={!activeTag ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setTag("")}
                >
                  All
                </Badge>
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={activeTag === tag ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : paginatedPosts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              {posts.length === 0
                ? "No resources available yet. Check back soon!"
                : "No articles match your search. Try a different term or category."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {paginatedPosts.map((post) => (
                <Link key={post.id} to={`/resources/${post.slug}`}>
                  <Card className={`overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 h-full ${isFeaturedActive(post) ? "ring-2 ring-amber-400 shadow-amber-100" : ""}`}>
                    {isFeaturedActive(post) && (
                      <div className="bg-amber-500 text-white text-xs font-semibold px-3 py-1 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current" /> Featured
                      </div>
                    )}
                    {post.cover_image_url && (
                      <div className="aspect-video bg-muted">
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <CardContent className="p-5 space-y-3">
                      <div className="flex flex-wrap gap-1">
                        {(post.tags || []).slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                        ))}
                      </div>
                      <h2 className="text-lg font-bold font-display text-foreground leading-snug line-clamp-2">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.published_at || post.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-primary">
                          Read more <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => goToPage(safePage - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={page === safePage ? "default" : "outline"}
                      size="sm"
                      className="w-9 h-9 p-0"
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => goToPage(safePage + 1)}
                  className="gap-1"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground mt-3">
              Showing {(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filtered.length)} of {filtered.length} articles
            </p>
          </>
        )}
      </main>


      <Footer />
    </div>
  );
};

export default ResourcesPage;
