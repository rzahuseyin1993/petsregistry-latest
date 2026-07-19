import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Eye, EyeOff, Image as ImageIcon, Star, Sparkles, Crown, Lock } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const emptyPost = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  cover_image_url: "",
  tags: [] as string[],
};

const CategoryPicker = ({ selected, onChange }: { selected: string[]; onChange: (tags: string[]) => void }) => {
  const { data: categories = [] } = useQuery({
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

  const toggle = (cat: string) => {
    if (selected.includes(cat)) {
      onChange(selected.filter((t) => t !== cat));
    } else {
      onChange([...selected, cat]);
    }
  };

  if (!categories.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {categories.map((cat: string) => (
        <Badge
          key={cat}
          variant={selected.includes(cat) ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => toggle(cat)}
        >
          {cat}
        </Badge>
      ))}
    </div>
  );
};

const DashboardArticles = () => {
  const { user, membership } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyPost);
  const [open, setOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const hasMembership = !!membership;

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["my-articles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("author_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: featuredPrice } = useQuery({
    queryKey: ["site-setting-featured-listing-price"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "featured_listing_price").maybeSingle();
      return data?.value || "10";
    },
  });

  const { data: featuredDuration } = useQuery({
    queryKey: ["site-setting-featured-listing-duration"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "featured_listing_duration_days").maybeSingle();
      return data?.value || "30";
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (post: typeof form & { id?: string }) => {
      const slug = post.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
      const payload: any = {
        title: post.title.trim(),
        slug,
        content: post.content,
        excerpt: post.excerpt || null,
        cover_image_url: post.cover_image_url || null,
        tags: post.tags,
        is_published: true,
        published_at: new Date().toISOString(),
        author_id: user!.id,
        moderation_status: "pending",
      };

      if (post.id) {
        const { error } = await supabase.from("blog_posts").update(payload).eq("id", post.id);
        if (error) throw error;
      } else {
        // New post: auto-feature for first month
        payload.is_featured = true;
        payload.featured_until = new Date(Date.now() + parseInt(featuredDuration || "30") * 86400000).toISOString();
        const { error } = await supabase.from("blog_posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-articles"] });
      toast.success(editing
        ? "Article updated and resubmitted for review — it will reappear publicly after admin approval."
        : "Article submitted! It will appear after admin approval.");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-articles"] });
      toast.success("Article deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyPost);
    setTagsInput("");
    setOpen(true);
  };

  const openEdit = (post: any) => {
    setEditing(post);
    setForm({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || "",
      cover_image_url: post.cover_image_url || "",
      tags: post.tags || [],
    });
    setTagsInput((post.tags || []).join(", "));
    setOpen(true);
  };

  const closeDialog = () => { setOpen(false); setEditing(null); setForm(emptyPost); };

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);

  const handleTitleChange = (title: string) => {
    setForm((p) => ({ ...p, title, slug: editing ? p.slug : generateSlug(title) }));
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const { uploadFile } = await import("@/lib/imageUpload");
      return await uploadFile({ bucket: "blog-images", folder: "", file });
    } catch (err: any) {
      toast.error("Upload failed: " + (err?.message || "unknown error"));
      return null;
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    const url = await uploadImage(file);
    if (url) setForm((p) => ({ ...p, cover_image_url: url }));
    setCoverUploading(false);
  };

  const insertImageInContent = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url) {
      const imgTag = `<img src="${url}" alt="${file.name}" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;" />`;
      setForm((p) => ({ ...p, content: p.content + imgTag }));
      toast.success("Image inserted");
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleSave = () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (form.title.trim().length > 200) return toast.error("Title must be at most 200 characters");
    if (!form.slug.trim()) return toast.error("Slug is required");
    if (form.slug.trim().length > 100) return toast.error("Slug must be at most 100 characters");
    if (!form.content || !form.content.replace(/<[^>]*>/g, "").trim()) return toast.error("Article content is required");
    if (form.excerpt && form.excerpt.length > 500) return toast.error("Excerpt must be at most 500 characters");
    const customTags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    if (customTags.some((t) => t.length > 50)) return toast.error("Each tag must be at most 50 characters");
    const allTags = Array.from(new Set([...form.tags, ...customTags]));
    saveMutation.mutate({ ...form, tags: allTags, id: editing?.id });
  };

  const getStatusBadge = (post: any) => {
    const status = post.moderation_status || "approved";
    if (status === "hidden") return <Badge variant="destructive">Hidden</Badge>;
    if (status === "pending") return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pending</Badge>;
    if (post.is_published) return <Badge variant="default">Published</Badge>;
    return <Badge variant="secondary">Draft</Badge>;
  };

  // If no membership, show upgrade prompt
  if (!hasMembership) {
    return (
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Lock className="h-16 w-16 text-muted-foreground mb-4" />
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">Members Only</h1>
            <p className="text-muted-foreground mb-6 max-w-md">
              You need an active membership to submit articles. Become a member to share your pet care knowledge with the community!
            </p>
            <Button asChild className="gap-2">
              <Link to="/dashboard/membership#upgrade-plans">
                <Crown className="h-4 w-4" /> View Membership Plans
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">My Articles</h1>
            <p className="text-sm text-muted-foreground">
              Submit articles to the Resources page. New articles are featured on top for {featuredDuration} days!
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Write Article
          </Button>
        </div>

        {/* Featured info card */}
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Auto-Featured Placement</p>
                <p className="text-sm text-muted-foreground">
                  Your new articles will automatically be featured at the top of the Resources page for {featuredDuration} days.
                  After that, they stay published but move to the regular listing order.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">You haven't written any articles yet. Click "Write Article" to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post: any) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium max-w-[250px] truncate">{post.title}</TableCell>
                    <TableCell>{getStatusBadge(post)}</TableCell>
                    <TableCell>
                      {post.is_featured && post.featured_until && new Date(post.featured_until) > new Date() ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600 gap-1"><Star className="h-3 w-3" /> Featured</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(post)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="text-destructive"
                          onClick={() => { if (confirm("Delete this article?")) deleteMutation.mutate(post.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Editor Dialog */}
        <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Article" : "Write New Article"}</DialogTitle>
              <DialogDescription>Your article will be reviewed by admin before it goes live.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Article title" />
                </div>
                <div>
                  <Label>Slug *</Label>
                  <Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="article-slug" />
                </div>
              </div>

              <div>
                <Label>Cover Image</Label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="gap-1 pointer-events-none" asChild>
                      <span><ImageIcon className="h-3.5 w-3.5" />{coverUploading ? "Uploading..." : "Upload Cover"}</span>
                    </Button>
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  </label>
                  {form.cover_image_url && (
                    <img src={form.cover_image_url} alt="Cover" className="h-16 w-24 rounded object-cover border border-border" />
                  )}
                </div>
              </div>

              <div>
                <Label>Excerpt</Label>
                <Textarea value={form.excerpt} onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))} placeholder="Short description" rows={2} />
              </div>

              <div>
                <Label>Content *</Label>
                <div className="flex flex-wrap gap-1 mt-1 mb-1 p-1.5 border border-border rounded-t-lg bg-muted/50">
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold" onClick={() => document.execCommand("bold")}>B</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs italic" onClick={() => document.execCommand("italic")}>I</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs underline" onClick={() => document.execCommand("underline")}>U</Button>
                  <span className="w-px h-7 bg-border" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => document.execCommand("formatBlock", false, "h2")}>H2</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => document.execCommand("formatBlock", false, "p")}>P</Button>
                  <span className="w-px h-7 bg-border" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => document.execCommand("insertUnorderedList")}>• List</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { const url = prompt("Enter link URL:"); if (url) document.execCommand("createLink", false, url); }}>Link</Button>
                  <span className="w-px h-7 bg-border" />
                  <label className="cursor-pointer">
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 pointer-events-none" asChild>
                      <span><ImageIcon className="h-3 w-3" /> {uploading ? "..." : "Img"}</span>
                    </Button>
                    <input type="file" accept="image/*" className="hidden" onChange={insertImageInContent} />
                  </label>
                </div>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-[200px] rounded-b-lg border border-t-0 border-border bg-background p-4 prose prose-sm max-w-none focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                  dangerouslySetInnerHTML={{ __html: form.content }}
                  onBlur={(e) => setForm((p) => ({ ...p, content: e.currentTarget.innerHTML }))}
                />
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Category</Label>
                  <CategoryPicker selected={form.tags} onChange={(tags) => setForm((p) => ({ ...p, tags }))} />
                </div>
                <div>
                  <Label>Additional Tags (comma separated)</Label>
                  <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="custom tag 1, custom tag 2" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Submitting..." : editing ? "Update" : "Submit Article"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default DashboardArticles;
