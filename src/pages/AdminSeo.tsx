import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "@/components/AdminSidebar";
import AdminPageWrapper from "@/components/AdminPageWrapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Globe, Code, Tag, Search } from "lucide-react";

const SEO_KEYS = [
  "seo_meta_title",
  "seo_meta_description",
  "seo_meta_keywords",
  "seo_og_image",
  "seo_google_analytics_id",
  "seo_gtm_id",
  "seo_head_code",
  "seo_body_code",
];

const AdminSeo = () => {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["seo-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .in("key", SEO_KEYS);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const map: Record<string, string> = {};
    settings.forEach((s: any) => { map[s.key] = s.value; });
    setValues(map);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const key of SEO_KEYS) {
        const val = values[key] || "";
        const existing = settings.find((s: any) => s.key === key);
        if (existing) {
          await supabase.from("site_settings").update({ value: val, updated_at: new Date().toISOString() }).eq("key", key);
        } else if (val) {
          await supabase.from("site_settings").insert({ key, value: val, description: `SEO: ${key}` });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["seo-settings"] });
      queryClient.invalidateQueries({ queryKey: ["tracking-settings"] });
      toast.success("SEO settings saved!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: string) => setValues((p) => ({ ...p, [key]: value }));

  return (
    <AdminPageWrapper resource="seo">
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" /> SEO & Tracking
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage meta tags, Google Analytics, and custom tracking codes
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving || isLoading} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Meta Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Meta Tags</CardTitle>
              <CardDescription>Control how your site appears in search results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Page Title (shown in browser tab & search results)</Label>
                <Input
                  value={values.seo_meta_title || ""}
                  onChange={(e) => set("seo_meta_title", e.target.value)}
                  placeholder="PetsRegistry - Register & Protect Your Pets"
                  maxLength={60}
                />
                <p className="mt-1 text-xs text-muted-foreground">{(values.seo_meta_title || "").length}/60 characters</p>
              </div>
              <div>
                <Label>Meta Description</Label>
                <Textarea
                  value={values.seo_meta_description || ""}
                  onChange={(e) => set("seo_meta_description", e.target.value)}
                  placeholder="Register your pets, get unique QR code profiles..."
                  maxLength={160}
                  rows={3}
                />
                <p className="mt-1 text-xs text-muted-foreground">{(values.seo_meta_description || "").length}/160 characters</p>
              </div>
              <div>
                <Label>Meta Keywords (comma-separated)</Label>
                <Input
                  value={values.seo_meta_keywords || ""}
                  onChange={(e) => set("seo_meta_keywords", e.target.value)}
                  placeholder="pets, pet registry, lost pets, pet QR code"
                />
              </div>
              <div>
                <Label>OG Image URL (social sharing thumbnail)</Label>
                <Input
                  value={values.seo_og_image || ""}
                  onChange={(e) => set("seo_og_image", e.target.value)}
                  placeholder="https://yourdomain.com/og-image.jpg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Google Tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Google Tracking</CardTitle>
              <CardDescription>Add Google Analytics or Tag Manager</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Google Analytics 4 (GA4) Measurement ID</Label>
                <Input
                  value={values.seo_google_analytics_id || ""}
                  onChange={(e) => set("seo_google_analytics_id", e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                />
                <p className="mt-1 text-xs text-muted-foreground">Find this in Google Analytics → Admin → Data Streams</p>
              </div>
              <div>
                <Label>Google Tag Manager Container ID</Label>
                <Input
                  value={values.seo_gtm_id || ""}
                  onChange={(e) => set("seo_gtm_id", e.target.value)}
                  placeholder="GTM-XXXXXXX"
                />
                <p className="mt-1 text-xs text-muted-foreground">Find this in Tag Manager → Workspace → Container ID</p>
              </div>
            </CardContent>
          </Card>

          {/* Custom Code */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Code className="h-5 w-5" /> Custom Code Injection</CardTitle>
              <CardDescription>Add custom scripts to the head or body of your website (e.g., Facebook Pixel, schema markup, verification tags)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Custom Head Code (injected in &lt;head&gt;)</Label>
                <Textarea
                  value={values.seo_head_code || ""}
                  onChange={(e) => set("seo_head_code", e.target.value)}
                  placeholder={'<meta name="google-site-verification" content="..." />\n<script>...</script>'}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label>Custom Body Code (injected at end of &lt;body&gt;)</Label>
                <Textarea
                  value={values.seo_body_code || ""}
                  onChange={(e) => set("seo_body_code", e.target.value)}
                  placeholder={"<!-- Facebook Pixel -->\n<script>...</script>"}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
    </AdminPageWrapper>
  );
};

export default AdminSeo;
