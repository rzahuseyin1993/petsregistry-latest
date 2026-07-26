import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Reply, Send, Eye, Users, Building2, Download, Paperclip, UsersRound, Crown, UserCheck, Heart, PawPrint, BookTemplate, Save, Trash2 } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import RichMessageComposer from "@/components/RichMessageComposer";
import DOMPurify from "dompurify";
import PermissionGate from "@/components/PermissionGate";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  source: string | null;
  is_read: boolean;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

type Profile = {
  user_id: string;
  full_name: string | null;
  email: string;
};

type BusinessListing = {
  id: string;
  name: string;
  owner_id: string;
  email: string | null;
};

type Attachment = {
  name: string;
  url: string;
  type: string;
  size: number;
};

const AdminContacts = () => {
  const { user } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Reply to contact
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyIsHtml, setReplyIsHtml] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);

  // Send message dialog
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgRecipientType, setMsgRecipientType] = useState<"member" | "directory" | "adopter">("member");
  const [msgAudience, setMsgAudience] = useState<"individual" | "all" | "paid" | "free" | "adopters" | "pet_owners">("individual");
  const [msgRecipientId, setMsgRecipientId] = useState("");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgIsHtml, setMsgIsHtml] = useState(false);
  const [msgAttachments, setMsgAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [memberships, setMemberships] = useState<{ user_id: string; status: string }[]>([]);
  const [adoptions, setAdoptions] = useState<{ adopter_id: string | null; owner_id: string; status: string }[]>([]);

  // Sent messages tab
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [viewMsgOpen, setViewMsgOpen] = useState(false);
  const [viewMsg, setViewMsg] = useState<any>(null);

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [sentGroupFilter, setSentGroupFilter] = useState("all");
  const [sourceOptions, setSourceOptions] = useState("");
  const [savingSourceOptions, setSavingSourceOptions] = useState(false);

  const formatGroupLabel = (group: string): string => {
    const labels: Record<string, string> = {
      individual: "Individual",
      "member:all": "All Members",
      "member:paid": "Paid Members",
      "member:free": "Free Members",
      "directory:all": "Directory Owners",
      "directory:individual": "Directory (Individual)",
      "adopter:adopters": "Pet Adopters",
      "adopter:pet_owners": "Previous Owners",
      "adopter:individual": "Adopter (Individual)",
    };
    return labels[group] || group;
  };

  const filteredSentMessages = sentGroupFilter === "all"
    ? sentMessages
    : sentMessages.filter(m => (m.audience_group || "individual") === sentGroupFilter);

  const sentGroupCounts = sentMessages.reduce((acc: Record<string, number>, m: any) => {
    const g = m.audience_group || "individual";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const fetchAll = async () => {
    setLoading(true);
    const [subRes, profRes, listRes, sentRes, memRes, adoptRes, tplRes] = await Promise.all([
      supabase.from("contact_submissions").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, email"),
      supabase.from("business_listings").select("id, name, owner_id, email"),
      supabase.from("admin_messages").select("*").order("created_at", { ascending: false }),
      supabase.from("memberships").select("user_id, status"),
      supabase.from("pet_adoptions").select("adopter_id, owner_id, status"),
      supabase.from("message_templates" as any).select("*").order("updated_at", { ascending: false }),
    ]);
    const firstLoadError = [subRes, profRes, listRes, sentRes, memRes, adoptRes, tplRes].find((r) => r.error)?.error;
    if (firstLoadError) {
      toast.error(`Failed to load inbox data: ${firstLoadError.message}`);
    }
    if (subRes.data) setSubmissions(subRes.data as ContactSubmission[]);
    if (profRes.data) setProfiles(profRes.data);
    if (listRes.data) setListings(listRes.data);
    if (sentRes.data) setSentMessages(sentRes.data);
    if (memRes.data) setMemberships(memRes.data);
    if (adoptRes.data) setAdoptions(adoptRes.data);
    if (tplRes.data) setTemplates(tplRes.data);
    // Fetch source options
    const { data: srcData } = await supabase.from("site_settings").select("value").eq("key", "contact_source_options").maybeSingle();
    if (srcData?.value) setSourceOptions(srcData.value);

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const markRead = async (sub: ContactSubmission) => {
    await supabase.from("contact_submissions").update({ is_read: true }).eq("id", sub.id);
    setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, is_read: true } : s));
  };

  const openReply = (sub: ContactSubmission) => {
    setSelectedSubmission(sub);
    setReplyText(sub.admin_reply || "");
    setReplyIsHtml(false);
    setReplyAttachments([]);
    setReplyOpen(true);
    if (!sub.is_read) markRead(sub);
  };

  const saveReply = async () => {
    if (!selectedSubmission || !replyText.trim()) return;
    const { error } = await supabase.from("contact_submissions").update({
      admin_reply: replyText.trim(),
      replied_at: new Date().toISOString(),
      is_read: true,
    }).eq("id", selectedSubmission.id);
    if (error) { toast.error("Failed to save reply"); return; }

    // Also email the reply to the person who submitted the contact form
    let emailSent = false;
    if (selectedSubmission.email) {
      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const bodyHtml = replyIsHtml
        ? replyText.trim()
        : `<div style="white-space:pre-wrap">${escapeHtml(replyText.trim())}</div>`;
      const { error: mailErr } = await supabase.functions.invoke("send-smtp-email", {
        body: {
          to: selectedSubmission.email,
          subject: `Re: ${selectedSubmission.subject || "Your message to PetsRegistry"}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <p>Hi ${escapeHtml(selectedSubmission.name || "there")},</p>
            <p>Thank you for contacting us. Here is our reply:</p>
            <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">${bodyHtml}</div>
            <p style="color:#6b7280;font-size:13px;margin-top:24px">— PetsRegistry Support</p>
          </div>`,
        },
      });
      emailSent = !mailErr;
    }

    toast.success(emailSent ? "Reply saved & emailed to the sender" : "Reply saved (email could not be sent)");
    setReplyOpen(false);
    fetchAll();
  };

  const getRecipientUserIds = (): string[] => {
    if (msgRecipientType === "directory") {
      if (msgAudience === "individual") {
        const listing = listings.find(l => l.id === msgRecipientId);
        return listing ? [listing.owner_id] : [];
      }
      return [...new Set(listings.map(l => l.owner_id))];
    }

    const paidUserIds = new Set(memberships.filter(m => m.status === "active").map(m => m.user_id));
    const adopterIds = [...new Set(adoptions.filter(a => a.adopter_id && a.status === "completed").map(a => a.adopter_id!))];
    const petOwnerIds = [...new Set(adoptions.filter(a => a.status === "completed").map(a => a.owner_id))];

    if (msgAudience === "individual") return [msgRecipientId];
    if (msgAudience === "all") return profiles.map(p => p.user_id);
    if (msgAudience === "paid") return profiles.filter(p => paidUserIds.has(p.user_id)).map(p => p.user_id);
    if (msgAudience === "free") return profiles.filter(p => !paidUserIds.has(p.user_id)).map(p => p.user_id);
    if (msgAudience === "adopters") return adopterIds.filter(id => profiles.some(p => p.user_id === id));
    if (msgAudience === "pet_owners") return petOwnerIds.filter(id => profiles.some(p => p.user_id === id));
    return [];
  };

  const sendMessage = async () => {
    if (!msgBody.trim() || !user) return;
    const recipientIds = getRecipientUserIds();
    if (recipientIds.length === 0) {
      toast.error("No recipients selected");
      return;
    }

    setSending(true);

    // Insert messages in batches of 50
    const batchSize = 50;
    let failed = 0;
    for (let i = 0; i < recipientIds.length; i += batchSize) {
      const batch = recipientIds.slice(i, i + batchSize);
      const audienceLabel = msgAudience === "individual" ? "individual" : `${msgRecipientType}:${msgAudience}`;
      const rows = batch.map(rid => ({
        sender_id: user.id,
        recipient_id: rid,
        subject: msgSubject.trim(),
        message: msgBody.trim(),
        is_html: msgIsHtml,
        attachment_urls: msgAttachments,
        audience_group: audienceLabel,
      }));
      const { error } = await supabase.from("admin_messages").insert(rows as any);
      if (error) failed += batch.length;

      // Also create notifications via server-side RPC
      for (const rid of batch) {
        await supabase.rpc("insert_system_notification", {
          _user_id: rid,
          _title: msgSubject.trim() || "New message from Admin",
          _message: msgBody.trim().replace(/<[^>]*>/g, "").substring(0, 200),
          _type: "message",
          _link: "/dashboard",
        });
      }
    }

    setSending(false);
    if (failed > 0) {
      toast.error(`Failed to send to ${failed} recipients`);
    } else {
      toast.success(`Message sent to ${recipientIds.length} recipient${recipientIds.length > 1 ? "s" : ""}`);
    }
    setMsgOpen(false);
    setMsgRecipientId("");
    setMsgSubject("");
    setMsgBody("");
    setMsgIsHtml(false);
    setMsgAttachments([]);
    setMsgAudience("individual");
    fetchAll();
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
        audience_type: msgRecipientType,
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
        audience_type: msgRecipientType,
        created_by: user.id,
      } as any);
      setSavingTemplate(false);
      if (error) { toast.error("Failed to save template"); return; }
      toast.success("Template saved");
    }

    setTemplateName("");
    setEditingTemplateId(null);
    fetchAll();
  };

  const loadTemplate = (tpl: any) => {
    setMsgSubject(tpl.subject || "");
    setMsgBody(tpl.body || "");
    setMsgIsHtml(tpl.is_html || false);
    setTemplateName(tpl.name || "");
    setEditingTemplateId(tpl.id);
    if (["member", "directory", "adopter"].includes(tpl.audience_type)) {
      setMsgRecipientType(tpl.audience_type);
    }
    toast.success(`Template "${tpl.name}" loaded for editing`);
  };

  const deleteTemplate = async (id: string) => {
    const ok = await confirm({
      title: "Delete this template?",
      description: "This message template will be permanently deleted. This action cannot be undone.",
    });
    if (!ok) return;
    const { error } = await supabase.from("message_templates" as any).delete().eq("id", id);
    if (error) { toast.error("Failed to delete template"); return; }
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Template deleted");
  };

  const getRecipientName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.full_name || profile?.email || userId.slice(0, 8);
  };

  const paidUserIds = new Set(memberships.filter(m => m.status === "active").map(m => m.user_id));
  const paidCount = profiles.filter(p => paidUserIds.has(p.user_id)).length;
  const freeCount = profiles.length - paidCount;
  const adopterUserIds = [...new Set(adoptions.filter(a => a.adopter_id && a.status === "completed").map(a => a.adopter_id!))];
  const petOwnerUserIds = [...new Set(adoptions.filter(a => a.status === "completed").map(a => a.owner_id))];
  const adopterCount = adopterUserIds.filter(id => profiles.some(p => p.user_id === id)).length;
  const petOwnerCount = petOwnerUserIds.filter(id => profiles.some(p => p.user_id === id)).length;
  const directoryOwnerCount = [...new Set(listings.map(l => l.owner_id))].length;

  const unreadCount = submissions.filter(s => !s.is_read).length;

  const recipientOptions = msgRecipientType === "member"
    ? profiles.map(p => ({ value: p.user_id, label: p.full_name || p.email }))
    : msgRecipientType === "directory"
    ? listings.map(l => ({ value: l.id, label: l.name }))
    : profiles.filter(p => adopterUserIds.includes(p.user_id)).map(p => ({ value: p.user_id, label: p.full_name || p.email }));

  return (
          <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Contact & Messages</h1>
            <p className="text-muted-foreground">View contact submissions and send rich messages to members</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => exportToCsv("contact_submissions", submissions.map(s => ({
              name: s.name, email: s.email, subject: s.subject, source: s.source || "", message: s.message,
              status: s.replied_at ? "Replied" : s.is_read ? "Read" : "New",
              admin_reply: s.admin_reply || "",
              replied_at: s.replied_at ? new Date(s.replied_at).toLocaleDateString() : "",
              date: new Date(s.created_at).toLocaleDateString(),
            })), [
              { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "subject", label: "Subject" },
              { key: "source", label: "Source" }, { key: "message", label: "Message" }, { key: "status", label: "Status" },
              { key: "admin_reply", label: "Admin Reply" }, { key: "replied_at", label: "Replied At" },
              { key: "date", label: "Date" },
            ])}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => setMsgOpen(true)} className="gap-2">
              <Send className="h-4 w-4" /> Send Message
            </Button>
          </div>
        </div>

        <Tabs defaultValue="inbox">
          <TabsList>
            <TabsTrigger value="inbox" className="gap-2">
              <Mail className="h-4 w-4" /> Inbox {unreadCount > 0 && <Badge variant="destructive" className="ml-1">{unreadCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-2">
              <Send className="h-4 w-4" /> Sent ({sentMessages.length})
            </TabsTrigger>
            <TabsTrigger value="form-settings" className="gap-2">
              <Save className="h-4 w-4" /> Form Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Contact Submissions</CardTitle>
                  <Input placeholder="Search by name, email, subject…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-xs" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : submissions.length === 0 ? (
                  <p className="text-muted-foreground">No contact submissions yet.</p>
                ) : (() => {
                  const q = searchTerm.toLowerCase();
                  const filtered = submissions.filter(s => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.subject || "").toLowerCase().includes(q) || s.message.toLowerCase().includes(q));
                  return filtered.length === 0 ? <p className="text-muted-foreground py-4">No results for "{searchTerm}"</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(sub => (
                        <TableRow key={sub.id} className={!sub.is_read ? "bg-primary/5" : ""}>
                          <TableCell>
                            {sub.replied_at ? (
                              <Badge className="bg-green-500/10 text-green-600">Replied</Badge>
                            ) : sub.is_read ? (
                              <Badge variant="secondary">Read</Badge>
                            ) : (
                              <Badge variant="destructive">New</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{sub.name}</TableCell>
                          <TableCell>{sub.email}</TableCell>
                          <TableCell>{sub.subject || "—"}</TableCell>
                          <TableCell>{sub.source || "—"}</TableCell>
                          <TableCell>{new Date(sub.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openReply(sub)} className="gap-1">
                              <Eye className="h-3 w-3" /> View
                            </Button>
                            <PermissionGate resource="contacts" action="edit">
                              <Button size="sm" onClick={() => openReply(sub)} className="gap-1">
                                <Reply className="h-3 w-3" /> Reply
                              </Button>
                            </PermissionGate>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sent">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Sent Messages</CardTitle>
                  <div className="flex gap-2">
                    <Select value={sentGroupFilter} onValueChange={setSentGroupFilter}>
                      <SelectTrigger className="h-8 w-[180px] text-xs">
                        <SelectValue placeholder="All groups" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Groups</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="member:all">All Members</SelectItem>
                        <SelectItem value="member:paid">Paid Members</SelectItem>
                        <SelectItem value="member:free">Free Members</SelectItem>
                        <SelectItem value="directory:all">Directory Owners</SelectItem>
                        <SelectItem value="adopter:adopters">Pet Adopters</SelectItem>
                        <SelectItem value="adopter:pet_owners">Previous Owners</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCsv("sent_messages", filteredSentMessages.map(m => ({
                      recipient: getRecipientName(m.recipient_id),
                      subject: m.subject,
                      group: m.audience_group || "individual",
                      message: m.message?.replace(/<[^>]*>/g, "").substring(0, 500),
                      date: new Date(m.created_at).toLocaleDateString(),
                      read: m.is_read ? "Yes" : "No",
                    })), [
                      { key: "recipient", label: "Recipient" }, { key: "subject", label: "Subject" },
                      { key: "group", label: "Audience" }, { key: "message", label: "Message" },
                      { key: "date", label: "Date" }, { key: "read", label: "Read" },
                    ])}>
                      <Download className="h-3 w-3" /> Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Group summary cards */}
                <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(sentGroupCounts).map(([group, count]) => (
                    <button key={group} onClick={() => setSentGroupFilter(group === sentGroupFilter ? "all" : group)}
                      className={`rounded-lg border p-2 text-left text-xs transition-colors ${sentGroupFilter === group ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/50"}`}>
                      <div className="font-medium capitalize">{formatGroupLabel(group)}</div>
                      <div className="text-lg font-bold text-foreground">{count as number}</div>
                    </button>
                  ))}
                </div>

                {filteredSentMessages.length === 0 ? (
                  <p className="text-muted-foreground">No sent messages{sentGroupFilter !== "all" ? " in this group" : ""}.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>To</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Audience</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Read</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSentMessages.map(msg => (
                        <TableRow key={msg.id}>
                          <TableCell className="font-medium">{getRecipientName(msg.recipient_id)}</TableCell>
                          <TableCell>{msg.subject || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{formatGroupLabel(msg.audience_group || "individual")}</Badge>
                          </TableCell>
                          <TableCell>{new Date(msg.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={msg.is_read ? "secondary" : "outline"}>
                              {msg.is_read ? "Read" : "Unread"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => { setViewMsg(msg); setViewMsgOpen(true); }} className="gap-1">
                              <Eye className="h-3 w-3" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="form-settings">
            <Card>
              <CardHeader>
                <CardTitle>Contact Form Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>"How did you find us?" Dropdown Options</Label>
                  <p className="text-xs text-muted-foreground">Enter comma-separated options. Leave empty to hide the field.</p>
                  <Textarea
                    value={sourceOptions}
                    onChange={e => setSourceOptions(e.target.value)}
                    placeholder="Website, Search Engine, Social Media, Friend/Family, Other"
                    rows={3}
                  />
                </div>
                {sourceOptions && (
                  <div className="space-y-1">
                    <Label className="text-xs">Preview</Label>
                    <div className="flex flex-wrap gap-2">
                      {sourceOptions.split(",").map((opt, i) => opt.trim() && (
                        <Badge key={i} variant="secondary">{opt.trim()}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button
                  disabled={savingSourceOptions}
                  onClick={async () => {
                    setSavingSourceOptions(true);
                    const { error } = await supabase.from("site_settings").upsert({
                      key: "contact_source_options",
                      value: sourceOptions.trim(),
                      description: "Comma-separated options for the How did you find us dropdown on the contact form",
                    }, { onConflict: "key" });
                    setSavingSourceOptions(false);
                    if (error) { toast.error("Failed to save"); return; }
                    toast.success("Dropdown options saved!");
                  }}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" /> {savingSourceOptions ? "Saving…" : "Save Options"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reply Dialog */}
        <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Contact Submission</DialogTitle>
            </DialogHeader>
            {selectedSubmission && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">From:</span> {selectedSubmission.name}</div>
                  <div><span className="font-medium">Email:</span> {selectedSubmission.email}</div>
                  <div className="col-span-2"><span className="font-medium">Subject:</span> {selectedSubmission.subject || "—"}</div>
                  <div className="col-span-2"><span className="font-medium">Date:</span> {new Date(selectedSubmission.created_at).toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="whitespace-pre-wrap text-sm">{selectedSubmission.message}</p>
                </div>
                <RichMessageComposer
                  value={replyText}
                  onChange={setReplyText}
                  isHtml={replyIsHtml}
                  onIsHtmlChange={setReplyIsHtml}
                  attachments={replyAttachments}
                  onAttachmentsChange={setReplyAttachments}
                  placeholder="Type your reply…"
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReplyOpen(false)}>Close</Button>
              <Button onClick={saveReply} disabled={!replyText.trim()} className="gap-2">
                <Reply className="h-4 w-4" /> Save Reply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send Message Dialog */}
        <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Send Message</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Send To</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button size="sm" variant={msgRecipientType === "member" ? "default" : "outline"} onClick={() => { setMsgRecipientType("member"); setMsgRecipientId(""); setMsgAudience("individual"); }} className="gap-1">
                    <Users className="h-3 w-3" /> Members
                  </Button>
                  <Button size="sm" variant={msgRecipientType === "directory" ? "default" : "outline"} onClick={() => { setMsgRecipientType("directory"); setMsgRecipientId(""); setMsgAudience("individual"); }} className="gap-1">
                    <Building2 className="h-3 w-3" /> Directory Owners
                  </Button>
                  <Button size="sm" variant={msgRecipientType === "adopter" ? "default" : "outline"} onClick={() => { setMsgRecipientType("adopter"); setMsgRecipientId(""); setMsgAudience("individual"); }} className="gap-1">
                    <Heart className="h-3 w-3" /> Pet Adopters
                  </Button>
                </div>
              </div>

              {/* Audience selector */}
              <div>
                <Label>Audience</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button size="sm" variant={msgAudience === "individual" ? "default" : "outline"} onClick={() => { setMsgAudience("individual"); setMsgRecipientId(""); }} className="gap-1">
                    <UserCheck className="h-3 w-3" /> Individual
                  </Button>

                  {msgRecipientType === "member" && (
                    <>
                      <Button size="sm" variant={msgAudience === "all" ? "default" : "outline"} onClick={() => setMsgAudience("all")} className="gap-1">
                        <UsersRound className="h-3 w-3" /> All Members ({profiles.length})
                      </Button>
                      <Button size="sm" variant={msgAudience === "paid" ? "default" : "outline"} onClick={() => setMsgAudience("paid")} className="gap-1">
                        <Crown className="h-3 w-3" /> Paid Members ({paidCount})
                      </Button>
                      <Button size="sm" variant={msgAudience === "free" ? "default" : "outline"} onClick={() => setMsgAudience("free")} className="gap-1">
                        <Users className="h-3 w-3" /> Free Members ({freeCount})
                      </Button>
                    </>
                  )}

                  {msgRecipientType === "directory" && (
                    <Button size="sm" variant={msgAudience === "all" ? "default" : "outline"} onClick={() => setMsgAudience("all")} className="gap-1">
                      <UsersRound className="h-3 w-3" /> All Directory Owners ({directoryOwnerCount})
                    </Button>
                  )}

                  {msgRecipientType === "adopter" && (
                    <>
                      <Button size="sm" variant={msgAudience === "adopters" ? "default" : "outline"} onClick={() => setMsgAudience("adopters")} className="gap-1">
                        <Heart className="h-3 w-3" /> All Adopters ({adopterCount})
                      </Button>
                      <Button size="sm" variant={msgAudience === "pet_owners" ? "default" : "outline"} onClick={() => setMsgAudience("pet_owners")} className="gap-1">
                        <PawPrint className="h-3 w-3" /> Previous Owners ({petOwnerCount})
                      </Button>
                    </>
                  )}
                </div>
                {msgAudience !== "individual" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Message will be sent to {getRecipientUserIds().length} recipient{getRecipientUserIds().length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              {/* Individual recipient selector */}
              {msgAudience === "individual" && (
                <div>
                  <Label>Recipient</Label>
                  <Select value={msgRecipientId} onValueChange={setMsgRecipientId}>
                    <SelectTrigger><SelectValue placeholder="Select recipient…" /></SelectTrigger>
                    <SelectContent>
                      {recipientOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                placeholder="Compose your message with rich text, images, and attachments…"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMsgOpen(false)}>Cancel</Button>
              <Button
                onClick={sendMessage}
                disabled={sending || !msgBody.trim() || (msgAudience === "individual" && !msgRecipientId)}
                className="gap-2"
              >
                <Send className="h-4 w-4" /> {sending ? "Sending…" : msgAudience === "individual" ? "Send" : `Send to ${getRecipientUserIds().length} recipients`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={viewMsgOpen} onOpenChange={setViewMsgOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Sent Message</DialogTitle>
            </DialogHeader>
            {viewMsg && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">To:</span> {getRecipientName(viewMsg.recipient_id)}</div>
                  <div><span className="font-medium">Date:</span> {new Date(viewMsg.created_at).toLocaleString()}</div>
                  <div className="col-span-2"><span className="font-medium">Subject:</span> {viewMsg.subject || "—"}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  {viewMsg.is_html ? (
                    <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewMsg.message) }} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{viewMsg.message}</p>
                  )}
                </div>
                {(() => {
                  const atts = (viewMsg.attachment_urls as Attachment[] || []);
                  if (atts.length === 0) return null;
                  return (
                    <div className="space-y-1">
                      <Label className="text-xs">Attachments ({atts.length})</Label>
                      {atts.map((att: Attachment, i: number) => (
                        <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
                          <Paperclip className="h-3 w-3 text-muted-foreground" />
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline flex-1">{att.name}</a>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewMsgOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </main>
  );
};

export default AdminContacts;
