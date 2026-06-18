import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Pencil, Trash2, AlertTriangle, Download, Send, Save, BookTemplate, X, Eye, EyeOff, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/exportCsv";
import { useAuth } from "@/contexts/AuthContext";
import RichMessageComposer from "@/components/RichMessageComposer";

type Attachment = { name: string; url: string; type: string; size: number };

const statusColors: Record<string, string> = {
  active: "bg-destructive/10 text-destructive",
  found: "bg-emerald-100 text-emerald-700",
  resolved: "bg-blue-100 text-blue-700",
  closed: "bg-muted text-muted-foreground",
};

const AdminLostReports = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editReport, setEditReport] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Message dialog
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgReporterId, setMsgReporterId] = useState("");
  const [msgReporterName, setMsgReporterName] = useState("");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgIsHtml, setMsgIsHtml] = useState(false);
  const [msgAttachments, setMsgAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const { data: reports = [] } = useQuery({
    queryKey: ["admin-lost-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lost_reports")
        .select("*, pets(id, name, species, breed, pet_code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set(data.map((d: any) => d.reporter_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, full_name").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
      return data.map((d: any) => ({
        ...d,
        reporterEmail: profileMap[d.reporter_id]?.email || "—",
        reporterName: profileMap[d.reporter_id]?.full_name || profileMap[d.reporter_id]?.email || "—",
      }));
    },
  });

  const fetchTemplates = async () => {
    const { data } = await supabase.from("message_templates" as any).select("*").order("updated_at", { ascending: false });
    if (data) setTemplates(data);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this lost report?")) return;
    const { error } = await supabase.from("lost_reports").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Report deleted"); queryClient.invalidateQueries({ queryKey: ["admin-lost-reports"] }); }
  };

  const handleToggleHide = async (report: any) => {
    const newPaused = !report.is_paused;
    const { error } = await supabase.from("lost_reports").update({ is_paused: newPaused }).eq("id", report.id);
    if (error) { toast.error("Failed to update visibility"); return; }
    toast.success(newPaused ? "Report hidden from public" : "Report is now visible");
    queryClient.invalidateQueries({ queryKey: ["admin-lost-reports"] });
  };

  const handleSave = async () => {
    if (!editReport) return;
    const { error } = await supabase.from("lost_reports").update({
      description: editReport.description,
      last_seen_address: editReport.last_seen_address,
      contact_phone: editReport.contact_phone,
      reward: editReport.reward,
      status: editReport.status,
      guest_pet_name: editReport.guest_pet_name,
      guest_pet_species: editReport.guest_pet_species,
      guest_pet_breed: editReport.guest_pet_breed,
      guest_name: editReport.guest_name,
      guest_email: editReport.guest_email,
      guest_phone: editReport.guest_phone,
    }).eq("id", editReport.id);
    if (error) { toast.error("Failed to save"); return; }
    toast.success("Report updated");
    setEditReport(null);
    queryClient.invalidateQueries({ queryKey: ["admin-lost-reports"] });
  };

  const openMessageDialog = (report: any) => {
    setMsgReporterId(report.reporter_id);
    setMsgReporterName(report.reporterName);
    setMsgSubject(`Regarding lost pet: ${report.pets?.name || "Unknown"}`);
    setMsgBody("");
    setMsgIsHtml(false);
    setMsgAttachments([]);
    setTemplateName("");
    setEditingTemplateId(null);
    fetchTemplates();
    setMsgOpen(true);
  };

  const sendMessage = async () => {
    if (!msgBody.trim() || !user || !msgReporterId) return;
    setSending(true);
    const { error } = await supabase.from("admin_messages").insert({
      sender_id: user.id,
      recipient_id: msgReporterId,
      subject: msgSubject.trim(),
      message: msgBody.trim(),
      is_html: msgIsHtml,
      attachment_urls: msgAttachments,
      audience_group: "lost_report",
    } as any);
    if (!error) {
      await supabase.rpc("insert_system_notification", {
        _user_id: msgReporterId,
        _title: msgSubject.trim() || "Message from Admin",
        _message: msgBody.trim().replace(/<[^>]*>/g, "").substring(0, 200),
        _type: "message",
        _link: "/dashboard",
      });
    }
    setSending(false);
    if (error) { toast.error("Failed to send"); return; }
    toast.success("Message sent");
    setMsgOpen(false);
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !user) return;
    setSavingTemplate(true);
    if (editingTemplateId) {
      const { error } = await supabase.from("message_templates" as any).update({
        name: templateName.trim(),
        subject: msgSubject.trim(),
        body: msgBody.trim(),
        is_html: msgIsHtml,
        audience_type: "lost_report",
      } as any).eq("id", editingTemplateId);
      setSavingTemplate(false);
      if (error) { toast.error("Failed to update template"); return; }
      toast.success("Template updated");
    } else {
      const { error } = await supabase.from("message_templates" as any).insert({
        name: templateName.trim(),
        subject: msgSubject.trim(),
        body: msgBody.trim(),
        is_html: msgIsHtml,
        audience_type: "lost_report",
        created_by: user.id,
      } as any);
      setSavingTemplate(false);
      if (error) { toast.error("Failed to save template"); return; }
      toast.success("Template saved");
    }
    setTemplateName("");
    setEditingTemplateId(null);
    fetchTemplates();
  };

  const loadTemplate = (tpl: any) => {
    setMsgSubject(tpl.subject || "");
    setMsgBody(tpl.body || "");
    setMsgIsHtml(tpl.is_html || false);
    setTemplateName(tpl.name || "");
    setEditingTemplateId(tpl.id);
    toast.success(`Template "${tpl.name}" loaded for editing`);
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("message_templates" as any).delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (editingTemplateId === id) { setEditingTemplateId(null); setTemplateName(""); }
    toast.success("Template deleted");
  };

  return (
          <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" /> Lost Reports Management
            </h1>
            <p className="text-sm text-muted-foreground">Full control: edit descriptions, change status, message reporters, or delete reports.</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => exportToCsv("lost_reports", reports.map((r: any) => ({
            pet: r.pets?.name || "", species: r.pets?.species || "", breed: r.pets?.breed || "",
            status: r.status,
            address: r.last_seen_address || "", lat: r.last_seen_lat ?? "", lng: r.last_seen_lng ?? "",
            phone: r.contact_phone || "",
            reward: r.reward || "", reporter: r.reporterEmail, description: r.description || "",
            date: new Date(r.created_at).toLocaleDateString(),
            updated: new Date(r.updated_at).toLocaleDateString(),
          })), [
            { key: "pet", label: "Pet" }, { key: "species", label: "Species" }, { key: "breed", label: "Breed" },
            { key: "status", label: "Status" }, { key: "address", label: "Last Seen Address" },
            { key: "lat", label: "Latitude" }, { key: "lng", label: "Longitude" },
            { key: "phone", label: "Contact Phone" }, { key: "reward", label: "Reward" },
            { key: "reporter", label: "Reporter" }, { key: "description", label: "Description" },
            { key: "date", label: "Reported" }, { key: "updated", label: "Updated" },
          ])}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="mt-6 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by pet name, reporter, address, status..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </div>

        <Card className="mt-4">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pet</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.filter((r: any) => {
                  const q = searchTerm.toLowerCase();
                  const petName = r.pets?.name || r.guest_pet_name || "";
                  const reporter = r.reporterEmail || r.guest_email || "";
                  return !q || petName.toLowerCase().includes(q) || (r.pets?.pet_code || "").toLowerCase().includes(q) || reporter.toLowerCase().includes(q) || (r.last_seen_address || "").toLowerCase().includes(q) || r.status.toLowerCase().includes(q);
                }).length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{searchTerm ? "No reports match your search." : "No lost reports."}</TableCell></TableRow>
                ) : reports.filter((r: any) => {
                  const q = searchTerm.toLowerCase();
                  const petName = r.pets?.name || r.guest_pet_name || "";
                  const reporter = r.reporterEmail || r.guest_email || "";
                  return !q || petName.toLowerCase().includes(q) || (r.pets?.pet_code || "").toLowerCase().includes(q) || reporter.toLowerCase().includes(q) || (r.last_seen_address || "").toLowerCase().includes(q) || r.status.toLowerCase().includes(q);
                }).map((report: any) => {
                  const isFoundReport = (report.description || "").startsWith("[FOUND PET SIGHTING]");
                  const photoUrl = report.guest_pet_photo_url;
                  const petName = report.pets?.name || report.guest_pet_name || "Unknown";
                  const reporterDisplay = report.is_guest
                    ? `${report.guest_name || "Guest"} <${report.guest_email || "—"}>`
                    : report.reporterEmail;
                  return (
                  <TableRow key={report.id} className={report.is_paused ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {photoUrl ? (
                          <img src={photoUrl} alt={petName} className="h-10 w-10 rounded-md object-cover border border-border" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border bg-muted">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{petName}</span>
                            {isFoundReport && <Badge variant="outline" className="text-[10px]">FOUND</Badge>}
                            {report.is_guest && <Badge variant="outline" className="text-[10px]">GUEST</Badge>}
                          </div>
                          {report.pets?.pet_code && <span className="text-xs font-mono text-muted-foreground">{report.pets.pet_code}</span>}
                          {report.guest_pet_species && <span className="text-xs text-muted-foreground">{report.guest_pet_species}{report.guest_pet_breed ? ` · ${report.guest_pet_breed}` : ""}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{reporterDisplay}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{report.last_seen_address || "—"}</TableCell>
                    <TableCell className="text-sm">{report.contact_phone || report.guest_phone || "—"}</TableCell>
                    <TableCell className="text-sm">{report.reward || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={statusColors[report.status] || "bg-muted text-muted-foreground"}>
                          {report.status}
                        </Badge>
                        {report.is_paused && <Badge variant="outline" className="text-[10px] gap-1"><EyeOff className="h-2.5 w-2.5" /> Hidden</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(report.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!report.is_guest && (
                          <Button size="sm" variant="ghost" onClick={() => openMessageDialog(report)} title="Message Reporter">
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <PermissionGate resource="lost_reports" action="edit">
                          <Button size="sm" variant="ghost" onClick={() => handleToggleHide(report)} title={report.is_paused ? "Show publicly" : "Hide from public"}>
                            {report.is_paused ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditReport({ ...report })} title="Edit"><Pencil className="h-4 w-4" /></Button>
                        </PermissionGate>
                        <PermissionGate resource="lost_reports" action="delete">
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(report.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editReport} onOpenChange={(o) => !o && setEditReport(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>Edit Lost Report</DialogTitle></DialogHeader>
            {editReport && (
              <div className="space-y-4 pt-2">
                {editReport.guest_pet_photo_url && (
                  <div>
                    <Label>Photo</Label>
                    <img src={editReport.guest_pet_photo_url} alt="Pet" className="mt-1 max-h-48 rounded-md border border-border object-cover" />
                  </div>
                )}

                {editReport.is_guest && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guest pet details</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label className="text-xs">Pet Name</Label><Input value={editReport.guest_pet_name || ""} onChange={(e) => setEditReport({ ...editReport, guest_pet_name: e.target.value })} /></div>
                      <div><Label className="text-xs">Species</Label><Input value={editReport.guest_pet_species || ""} onChange={(e) => setEditReport({ ...editReport, guest_pet_species: e.target.value })} /></div>
                      <div><Label className="text-xs">Breed</Label><Input value={editReport.guest_pet_breed || ""} onChange={(e) => setEditReport({ ...editReport, guest_pet_breed: e.target.value })} /></div>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reporter contact (private)</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label className="text-xs">Name</Label><Input value={editReport.guest_name || ""} onChange={(e) => setEditReport({ ...editReport, guest_name: e.target.value })} /></div>
                      <div><Label className="text-xs">Email</Label><Input value={editReport.guest_email || ""} onChange={(e) => setEditReport({ ...editReport, guest_email: e.target.value })} /></div>
                      <div><Label className="text-xs">Phone</Label><Input value={editReport.guest_phone || ""} onChange={(e) => setEditReport({ ...editReport, guest_phone: e.target.value })} /></div>
                    </div>
                  </div>
                )}

                <div><Label>Description</Label><Textarea value={editReport.description || ""} onChange={(e) => setEditReport({ ...editReport, description: e.target.value })} rows={4} /></div>
                <div><Label>Last Seen Address</Label><Input value={editReport.last_seen_address || ""} onChange={(e) => setEditReport({ ...editReport, last_seen_address: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Contact Phone (public)</Label><Input value={editReport.contact_phone || ""} onChange={(e) => setEditReport({ ...editReport, contact_phone: e.target.value })} /></div>
                  <div><Label>Reward</Label><Input value={editReport.reward || ""} onChange={(e) => setEditReport({ ...editReport, reward: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Status</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editReport.status} onChange={(e) => setEditReport({ ...editReport, status: e.target.value })}>
                    <option value="active">Active (Still Lost)</option>
                    <option value="found">Found</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleToggleHide(editReport)} className="gap-2">
                    {editReport.is_paused ? <><Eye className="h-4 w-4" /> Show publicly</> : <><EyeOff className="h-4 w-4" /> Hide from public</>}
                  </Button>
                  <Button className="flex-1" onClick={handleSave}>Save Changes</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Message Reporter Dialog */}
        <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Message Reporter: {msgReporterName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Templates */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><BookTemplate className="h-3.5 w-3.5" /> Templates</Label>
                <div className="flex flex-wrap gap-2">
                  {templates.map(tpl => (
                    <div key={tpl.id} className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${editingTemplateId === tpl.id ? "border-primary bg-primary/10" : "border-border bg-muted/50"}`}>
                      <button onClick={() => loadTemplate(tpl)} className="hover:text-primary font-medium truncate max-w-[120px]" title={`Load "${tpl.name}"`}>{tpl.name}</button>
                      <button onClick={() => deleteTemplate(tpl.id)} className="text-muted-foreground hover:text-destructive" title="Delete">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {templates.length === 0 && <span className="text-xs text-muted-foreground">No saved templates</span>}
                </div>
                <div className="flex gap-2">
                  <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name…" className="h-8 text-xs" maxLength={100} />
                  <Button size="sm" variant="outline" onClick={saveTemplate} disabled={savingTemplate || !templateName.trim() || !msgBody.trim()} className="gap-1 shrink-0">
                    <Save className="h-3 w-3" /> {editingTemplateId ? "Update Template" : "Save as Template"}
                  </Button>
                  {editingTemplateId && (
                    <Button size="sm" variant="ghost" onClick={() => { setEditingTemplateId(null); setTemplateName(""); }} className="h-8 text-xs shrink-0">
                      New
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label>Subject</Label>
                <Input value={msgSubject} onChange={e => setMsgSubject(e.target.value)} placeholder="Message subject" maxLength={200} />
              </div>
              <RichMessageComposer
                value={msgBody}
                onChange={setMsgBody}
                isHtml={msgIsHtml}
                onIsHtmlChange={setMsgIsHtml}
                attachments={msgAttachments}
                onAttachmentsChange={setMsgAttachments}
                placeholder="Compose your message to the reporter…"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMsgOpen(false)}>Cancel</Button>
              <Button onClick={sendMessage} disabled={sending || !msgBody.trim()} className="gap-2">
                <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send Message"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
  );
};

export default AdminLostReports;
