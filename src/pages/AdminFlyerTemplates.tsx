import { useNavigate } from "react-router-dom";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile as uploadFileUtil } from "@/lib/imageUpload";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Upload, Eye, EyeOff, Pencil, Paintbrush, Palette, Wand2, Loader2, Download } from "lucide-react";
import jsPDF from "jspdf";
import { flyerTemplates } from "@/lib/flyerTemplates";
import { Textarea } from "@/components/ui/textarea";

const AdminFlyerTemplates = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("custom");
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPhoto, setAiPhoto] = useState<string | null>(null);
  const { data: templates = [] } = useQuery({
    queryKey: ["admin-flyer-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flyer_templates" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set((data || []).map((d: any) => d.created_by))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, email").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.email]));
      return (data || []).map((d: any) => ({ ...d, creatorEmail: profileMap[d.created_by] || "—" }));
    },
  });

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim() || !user) return;
    setUploading(true);
    try {
      const publicUrl = await uploadFileUtil({ bucket: "flyer-templates", folder: "admin", file: uploadFile });
      const { error: insertError } = await supabase.from("flyer_templates" as any).insert({
        name: uploadName.trim(),
        description: uploadDesc.trim() || null,
        image_url: publicUrl,
        created_by: user.id,
        template_type: "admin",
      });
      if (insertError) throw insertError;
      toast.success("Template uploaded!");
      setShowUpload(false);
      setUploadName("");
      setUploadDesc("");
      setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ["admin-flyer-templates"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    const { error } = await supabase.from("flyer_templates" as any).update({ is_active: !currentlyActive }).eq("id", id);
    if (error) toast.error("Failed to update");
    else { toast.success(currentlyActive ? "Template hidden" : "Template activated"); queryClient.invalidateQueries({ queryKey: ["admin-flyer-templates"] }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template permanently?")) return;
    const { error } = await supabase.from("flyer_templates" as any).delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Template deleted"); queryClient.invalidateQueries({ queryKey: ["admin-flyer-templates"] }); }
  };

  const handleDownloadPdf = async (tmpl: any) => {
    try {
      toast.info("Generating PDF...");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.src = tmpl.image_url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 794;
      canvas.height = img.naturalHeight || 1123;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const pdf = new jsPDF("p", "mm", "a4");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
      pdf.save(`${tmpl.name || "template"}.pdf`);
      toast.success("PDF downloaded!");
    } catch {
      toast.error("Failed to generate PDF");
    }
  };

  const renderHtmlToCanvas = async (html: string) => {
    const container = document.createElement("div");
    container.style.width = "794px";
    container.style.height = "1123px";
    container.style.position = "fixed";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    container.style.background = "white";
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const { default: html2canvas } = await import("html2canvas");
      return await html2canvas(container, {
        scale: 1,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 794,
        height: 1123,
      });
    } finally {
      document.body.removeChild(container);
    }
  };

  const canvasToJpegBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to render template"));
      }, "image/jpeg", 0.9);
    });

  const handleAiPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setAiPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || !user) return;
    setAiGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-flyer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          description: aiPrompt,
          petImageBase64: aiPhoto,
          mode: "template",
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }

      const result = await resp.json();
      let html = result.html || "";
      if (!html.trim()) {
        throw new Error("AI did not return a template.");
      }
      if (aiPhoto) {
        html = html.replace(/PET_PHOTO_PLACEHOLDER/g, aiPhoto);
      }

      const canvas = await renderHtmlToCanvas(html);
      const blob = await canvasToJpegBlob(canvas);
      const file = new File([blob], `ai-template-${Date.now()}.jpg`, { type: "image/jpeg" });
      const publicUrl = await uploadFileUtil({ bucket: "flyer-templates", folder: "admin", file });
      const { error: insertError } = await supabase.from("flyer_templates" as any).insert({
        name: aiPrompt.trim().slice(0, 60),
        description: "AI-generated template",
        image_url: publicUrl,
        created_by: user.id,
        template_type: "admin",
      });
      if (insertError) throw insertError;

      toast.success("AI template created!");
      setShowAiGen(false);
      setAiPrompt("");
      setAiPhoto(null);
      queryClient.invalidateQueries({ queryKey: ["admin-flyer-templates"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate");
    } finally {
      setAiGenerating(false);
    }
  };

  return (
          <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" /> Flyer Templates
            </h1>
            <p className="text-sm text-muted-foreground">Manage built-in and custom flyer templates.</p>
          </div>
          <div className="flex gap-2">
            <PermissionGate resource="flyer_templates" action="create">
              <Button className="gap-2" variant="secondary" onClick={() => setShowAiGen(true)}>
                <Wand2 className="h-4 w-4" /> AI Generate
              </Button>
            </PermissionGate>
            <PermissionGate resource="flyer_templates" action="create">
              <Button className="gap-2" onClick={() => navigate("/admin/flyer-editor")}>
                <Paintbrush className="h-4 w-4" /> Design Template
              </Button>
            </PermissionGate>
            <PermissionGate resource="flyer_templates" action="create">
              <Button variant="outline" className="gap-2" onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4" /> Upload Image
              </Button>
            </PermissionGate>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="custom">Custom Templates ({templates.length})</TabsTrigger>
            <TabsTrigger value="builtin">Built-in Templates ({flyerTemplates.length})</TabsTrigger>
          </TabsList>

          {/* Custom / DB Templates */}
          <TabsContent value="custom">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Preview</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No custom templates yet.</TableCell></TableRow>
                    ) : templates.map((tmpl: any) => (
                      <TableRow key={tmpl.id}>
                        <TableCell>
                          <img src={tmpl.image_url} alt={tmpl.name} className="h-16 w-12 rounded object-cover border border-border" />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{tmpl.name}</div>
                          {tmpl.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{tmpl.description}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tmpl.template_type === "admin" ? "default" : "secondary"}>
                            {tmpl.template_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{tmpl.creatorEmail}</TableCell>
                        <TableCell>
                          <Badge className={tmpl.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}>
                            {tmpl.is_active ? "Active" : "Hidden"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{new Date(tmpl.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleDownloadPdf(tmpl)} title="Download PDF">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/flyer-editor?id=${tmpl.id}`)} title="Edit in Designer">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleToggleActive(tmpl.id, tmpl.is_active)}>
                              {tmpl.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <PermissionGate resource="flyer_templates" action="delete">
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(tmpl.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Built-in Templates */}
          <TabsContent value="builtin">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Built-in Flyer Designs</CardTitle>
                <p className="text-sm text-muted-foreground">These {flyerTemplates.length} templates are bundled with the app. Click "Copy & Edit" to create an editable version in the visual designer.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {flyerTemplates.map((tmpl) => (
                    <div key={tmpl.id} className="rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow">
                      {/* Color preview */}
                      <div className="h-24 relative" style={{ background: tmpl.bgColor }}>
                        <div className="absolute top-0 left-0 right-0 h-8" style={{ backgroundColor: tmpl.headerColor }} />
                        <div className="absolute bottom-2 left-2 right-2 h-6 rounded" style={{ backgroundColor: tmpl.ctaColor || tmpl.accentColor }} />
                        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-14 h-10 rounded bg-muted/60" />
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold text-foreground truncate">{tmpl.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{tmpl.description}</p>
                        <PermissionGate resource="flyer_templates" action="create">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2 text-xs gap-1"
                            onClick={() => navigate(`/admin/flyer-editor?builtin=${tmpl.id}`)}
                          >
                            <Palette className="h-3 w-3" /> Copy & Edit
                          </Button>
                        </PermissionGate>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Template Image</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Upload an A4 background image (portrait). Pet details will be overlaid on top.</p>
              <div><Label>Template Name</Label><Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Premium Design" /></div>
              <div><Label>Description (optional)</Label><Input value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} placeholder="Brief description" /></div>
              <div>
                <Label>Background Image</Label>
                <Input type="file" accept="image/*" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              </div>
              {uploadFile && (
                <img src={URL.createObjectURL(uploadFile)} alt="Preview" className="h-40 w-full rounded-lg object-cover border border-border" />
              )}
              <Button className="w-full gap-2" onClick={handleUpload} disabled={uploading || !uploadFile || !uploadName.trim()}>
                <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAiGen} onOpenChange={setShowAiGen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" /> AI Template Generator</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Upload a sample photo and describe the template style. AI will create a new flyer template.</p>
              <div>
                <Label>Sample Photo (optional)</Label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-3 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => document.getElementById("admin-ai-photo-input")?.click()}
                >
                  {aiPhoto ? (
                    <img src={aiPhoto} alt="Sample" className="h-32 mx-auto rounded-lg object-cover" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Click to upload a sample photo</p>
                    </>
                  )}
                </div>
                <input type="file" id="admin-ai-photo-input" accept="image/*" className="hidden" onChange={handleAiPhotoUpload} />
              </div>
              <div>
                <Label>Template Description</Label>
                <Textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe the template style, colors, layout..."
                  rows={4} />
              </div>
              <Button className="w-full gap-2" onClick={handleAiGenerate} disabled={aiGenerating || !aiPrompt.trim()}>
                {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {aiGenerating ? "Generating..." : "Generate Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
  );
};

export default AdminFlyerTemplates;
