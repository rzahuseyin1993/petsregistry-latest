import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Eye, EyeOff, Image as ImageIcon, ExternalLink, Star, StarOff, ShieldCheck, ShieldOff, ShieldAlert, Wand2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import DOMPurify from "dompurify";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  tags: string[];
  is_published: boolean;
  is_featured: boolean;
  featured_until: string | null;
  moderation_status: string;
  meta_title: string | null;
  meta_description: string | null;
  author_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const emptyPost = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  cover_image_url: "",
  tags: [] as string[],
  is_published: false,
  meta_title: "",
  meta_description: "",
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

const AdminBlog = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [form, setForm] = useState(emptyPost);
  const [open, setOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiTitle, setAiTitle] = useState("");
  const [aiCoverUrl, setAiCoverUrl] = useState("");
  const [aiCoverUploading, setAiCoverUploading] = useState(false);
  const [aiCategories, setAiCategories] = useState<string[]>([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BlogPost[];
    },
  });

  // Fetch categories for management
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

  const saveCategories = async (cats: string[]) => {
    const value = cats.join(",");
    const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "blog_categories").maybeSingle();
    if (existing) {
      await supabase.from("site_settings").update({ value }).eq("key", "blog_categories");
    } else {
      await supabase.from("site_settings").insert({ key: "blog_categories", value, description: "Blog post categories" });
    }
    queryClient.invalidateQueries({ queryKey: ["site-setting-blog-categories"] });
  };

  const addCategory = () => {
    const cat = newCatInput.trim();
    if (!cat) return;
    if (categories.includes(cat)) { toast.error("Category already exists"); return; }
    saveCategories([...categories, cat]);
    setNewCatInput("");
    toast.success(`Category "${cat}" added`);
  };

  const removeCategory = (cat: string) => {
    saveCategories(categories.filter((c: string) => c !== cat));
    toast.success(`Category "${cat}" removed`);
  };

  const saveMutation = useMutation({
    mutationFn: async (post: typeof form & { id?: string; is_featured?: boolean }) => {
      const payload: any = {
        title: post.title.trim(),
        slug: post.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"),
        content: post.content,
        excerpt: post.excerpt || null,
        cover_image_url: post.cover_image_url || null,
        tags: post.tags,
        is_published: post.is_published,
        is_featured: (post as any).is_featured || false,
        meta_title: post.meta_title || null,
        meta_description: post.meta_description || null,
        published_at: post.is_published ? new Date().toISOString() : null,
        author_id: user!.id,
        moderation_status: "approved",
      };

      if (post.id) {
        const { error } = await supabase.from("blog_posts").update(payload).eq("id", post.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blog_posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      toast.success(editing ? "Post updated" : "Post created");
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
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      toast.success("Post deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyPost);
    setTagsInput("");
    setOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditing(post);
    setForm({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || "",
      cover_image_url: post.cover_image_url || "",
      tags: post.tags || [],
      is_published: post.is_published,
      is_featured: (post as any).is_featured || false,
      meta_title: post.meta_title || "",
      meta_description: post.meta_description || "",
    } as any);
    setTagsInput((post.tags || []).join(", "));
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyPost);
  };

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);

  const handleTitleChange = (title: string) => {
    setForm((p) => ({
      ...p,
      title,
      slug: editing ? p.slug : generateSlug(title),
    }));
  };

  const uploadImage = async (file: File, bucket: string): Promise<string | null> => {
    try {
      const { uploadFile } = await import("@/lib/imageUpload");
      return await uploadFile({ bucket, folder: "", file });
    } catch (err: any) {
      toast.error("Upload failed: " + (err?.message || "unknown error"));
      return null;
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    const url = await uploadImage(file, "blog-images");
    if (url) setForm((p) => ({ ...p, cover_image_url: url }));
    setCoverUploading(false);
  };

  const insertImageInContent = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file, "blog-images");
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
    if (!form.slug.trim()) return toast.error("Slug is required");
    // Merge category tags from form.tags with additional custom tags from input
    const customTags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const allTags = Array.from(new Set([...form.tags, ...customTags]));
    saveMutation.mutate({ ...form, tags: allTags, id: editing?.id });
  };

  // Simple toolbar commands
  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
  };

  return (
    <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Resources</h1>
            <p className="text-sm text-muted-foreground">Create and manage blog posts for SEO</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCatOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Categories
            </Button>
            <Button variant="default" onClick={() => setAiOpen(true)} className="gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground">
              <Wand2 className="h-4 w-4" /> AI Auto-Write
            </Button>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> New Post
            </Button>
          </div>
        </div>

        {/* Category Management Dialog */}
        <Dialog open={catOpen} onOpenChange={setCatOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Article Categories</DialogTitle>
              <DialogDescription>Add or remove categories that authors can tag their articles with.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  placeholder="New category name..."
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                />
                <Button onClick={addCategory} disabled={!newCatInput.trim()}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No categories yet. Add your first one above.</p>
                ) : (
                  categories.map((cat: string) => (
                    <Badge key={cat} variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
                      {cat}
                      <button onClick={() => removeCategory(cat)} className="ml-1 hover:text-destructive">×</button>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No posts yet. Create your first post!</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Moderation</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{post.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">/{post.slug}</TableCell>
                    <TableCell>
                      <Badge variant={post.is_published ? "default" : "secondary"}>
                        {post.is_published ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={post.moderation_status || "approved"}
                        onValueChange={async (val) => {
                          await supabase.from("blog_posts").update({ moderation_status: val } as any).eq("id", post.id);
                          queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
                          toast.success(`Post ${val === "approved" ? "approved" : val === "hidden" ? "hidden" : "set to pending"}`);
                        }}
                      >
                        <SelectTrigger className="h-7 w-[110px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved"><span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-green-600" /> Approved</span></SelectItem>
                          <SelectItem value="pending"><span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3 text-amber-600" /> Pending</span></SelectItem>
                          <SelectItem value="hidden"><span className="flex items-center gap-1"><ShieldOff className="h-3 w-3 text-destructive" /> Hidden</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {(post as any).is_featured ? (
                        <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 gap-1">
                          <Star className="h-3 w-3" /> Featured
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(post.tags || []).slice(0, 2).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
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
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Delete this post?")) deleteMutation.mutate(post.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {post.is_published && (
                          <a href={`/resources/${post.slug}`} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Post" : "New Post"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Title & Slug */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Post title"
                  />
                </div>
                <div>
                  <Label>Slug *</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                    placeholder="post-slug"
                  />
                </div>
              </div>

              {/* Cover Image */}
              <div>
                <Label>Cover Image</Label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="gap-1 pointer-events-none" asChild>
                      <span>
                        <ImageIcon className="h-3.5 w-3.5" />
                        {coverUploading ? "Uploading..." : "Upload Cover"}
                      </span>
                    </Button>
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  </label>
                  {form.cover_image_url && (
                    <img
                      src={form.cover_image_url}
                      alt="Cover"
                      className="h-16 w-24 rounded object-cover border border-border"
                    />
                  )}
                </div>
              </div>

              {/* Excerpt */}
              <div>
                <Label>Excerpt</Label>
                <Textarea
                  value={form.excerpt}
                  onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
                  placeholder="Short description for listing cards (optional)"
                  rows={2}
                />
              </div>

              {/* Rich Content Editor */}
              <div>
                <Label>Content *</Label>
                {/* Toolbar */}
                <div className="flex flex-wrap gap-1 mt-1 mb-1 p-1.5 border border-border rounded-t-lg bg-muted/50">
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold" onClick={() => execCmd("bold")}>B</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs italic" onClick={() => execCmd("italic")}>I</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs underline" onClick={() => execCmd("underline")}>U</Button>
                  <span className="w-px h-7 bg-border" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => execCmd("formatBlock", "h2")}>H2</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => execCmd("formatBlock", "h3")}>H3</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => execCmd("formatBlock", "p")}>P</Button>
                  <span className="w-px h-7 bg-border" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => execCmd("insertUnorderedList")}>• List</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => execCmd("insertOrderedList")}>1. List</Button>
                  <span className="w-px h-7 bg-border" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => {
                    const url = prompt("Enter link URL:");
                    if (url) execCmd("createLink", url);
                  }}>Link</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => execCmd("removeFormat")}>Clear</Button>
                  <span className="w-px h-7 bg-border" />
                  <select
                    className="h-7 rounded border border-border bg-background px-1 text-xs"
                    onChange={(e) => {
                      if (e.target.value) execCmd("fontSize", e.target.value);
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Size</option>
                    <option value="1">Small</option>
                    <option value="3">Normal</option>
                    <option value="5">Large</option>
                    <option value="7">Huge</option>
                  </select>
                  <select
                    className="h-7 rounded border border-border bg-background px-1 text-xs"
                    onChange={(e) => {
                      if (e.target.value) execCmd("foreColor", e.target.value);
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Color</option>
                    <option value="#000000">Black</option>
                    <option value="#ef4444">Red</option>
                    <option value="#3b82f6">Blue</option>
                    <option value="#22c55e">Green</option>
                    <option value="#f97316">Orange</option>
                    <option value="#8b5cf6">Purple</option>
                  </select>
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
                  className="min-h-[300px] rounded-b-lg border border-t-0 border-border bg-background p-4 prose prose-sm max-w-none focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                  dangerouslySetInnerHTML={{ __html: form.content }}
                  onBlur={(e) =>
                    setForm((p) => ({ ...p, content: e.currentTarget.innerHTML }))
                  }
                />
              </div>

              {/* Category & Tags */}
              <div className="space-y-3">
                <div>
                  <Label>Category</Label>
                  <CategoryPicker
                    selected={form.tags}
                    onChange={(tags) => setForm((p) => ({ ...p, tags }))}
                  />
                </div>
                <div>
                  <Label>Additional Tags (comma separated)</Label>
                  <Input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="custom tag 1, custom tag 2"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Categories above are auto-included. Add extra tags here if needed.
                  </p>
                </div>
              </div>

              {/* SEO Fields */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">SEO Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Meta Title</Label>
                    <Input
                      value={form.meta_title}
                      onChange={(e) => setForm((p) => ({ ...p, meta_title: e.target.value }))}
                      placeholder="Custom page title for search engines"
                      maxLength={60}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{(form.meta_title || "").length}/60</p>
                  </div>
                  <div>
                    <Label className="text-xs">Meta Description</Label>
                    <Textarea
                      value={form.meta_description}
                      onChange={(e) => setForm((p) => ({ ...p, meta_description: e.target.value }))}
                      placeholder="Description shown in search results"
                      maxLength={160}
                      rows={2}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{(form.meta_description || "").length}/160</p>
                  </div>
                </CardContent>
              </Card>

              {/* Featured Toggle */}
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={(form as any).is_featured || false}
                      onCheckedChange={(v) => setForm((p) => ({ ...p, is_featured: v } as any))}
                    />
                    <Label className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-amber-500" />
                      Featured Post (pinned to top of Resources page)
                    </Label>
                  </div>
                  <p className="text-[10px] text-muted-foreground pl-11">
                    Featured posts appear at the top of the Resources page with a special badge.
                  </p>
                </CardContent>
              </Card>

              {/* Publish Toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_published}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, is_published: v }))}
                />
                <Label className="flex items-center gap-1.5">
                  {form.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {form.is_published ? "Published" : "Draft"}
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Article Generator Dialog */}
        <Dialog open={aiOpen} onOpenChange={(o) => { if (!aiGenerating) { setAiOpen(o); if (!o) { setAiTopic(""); setAiTitle(""); setAiCoverUrl(""); setAiCategories([]); } } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" /> AI Article Generator
              </DialogTitle>
              <DialogDescription>
                Provide a topic and optional details. AI will write a full SEO-optimized article automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Topic / Description *</Label>
                <Textarea
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. How to train a puppy, Cat nutrition tips, Best dog breeds for families..."
                  disabled={aiGenerating}
                  rows={2}
                />
              </div>
              <div>
                <Label>Title (optional — AI will generate one if empty)</Label>
                <Input
                  value={aiTitle}
                  onChange={(e) => setAiTitle(e.target.value)}
                  placeholder="e.g. 10 Tips for First-Time Dog Owners"
                  disabled={aiGenerating}
                />
              </div>
              <div>
                <Label>Cover Image (optional)</Label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="gap-1 pointer-events-none" asChild>
                      <span>
                        <ImageIcon className="h-3.5 w-3.5" />
                        {aiCoverUploading ? "Uploading..." : "Upload Cover"}
                      </span>
                    </Button>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAiCoverUploading(true);
                      const url = await uploadImage(file, "blog-images");
                      if (url) setAiCoverUrl(url);
                      setAiCoverUploading(false);
                    }} disabled={aiGenerating} />
                  </label>
                  {aiCoverUrl && (
                    <img src={aiCoverUrl} alt="Cover" className="h-16 w-24 rounded object-cover border border-border" />
                  )}
                  {aiCoverUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setAiCoverUrl("")} disabled={aiGenerating}>×</Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">If no image is uploaded, the article will be published without a cover.</p>
              </div>
              <div>
                <Label>Categories (optional)</Label>
                <CategoryPicker
                  selected={aiCategories}
                  onChange={setAiCategories}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAiOpen(false)} disabled={aiGenerating}>Cancel</Button>
              <Button
                disabled={!aiTopic.trim() || aiGenerating}
                className="gap-2"
                onClick={async () => {
                  setAiGenerating(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("generate-article", {
                      body: {
                        topic: aiTopic.trim(),
                        title: aiTitle.trim() || undefined,
                        cover_image_url: aiCoverUrl || undefined,
                        categories: aiCategories.length ? aiCategories : undefined,
                      },
                    });
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);
                    queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
                    toast.success("Article generated and published!");
                    setAiTopic("");
                    setAiTitle("");
                    setAiCoverUrl("");
                    setAiCategories([]);
                    setAiOpen(false);
                  } catch (err: any) {
                    toast.error(err.message || "Failed to generate article");
                  } finally {
                    setAiGenerating(false);
                  }
                }}
              >
                {aiGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Wand2 className="h-4 w-4" /> Generate Article</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </main>
  );
};

export default AdminBlog;
