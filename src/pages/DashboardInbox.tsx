import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Mail, Eye, Paperclip, Trash2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

type Attachment = {
  name: string;
  url: string;
  type: string;
  size: number;
};

type AdminMessage = {
  id: string;
  sender_id: string;
  subject: string;
  message: string;
  is_read: boolean;
  is_html: boolean;
  attachment_urls: Attachment[] | null;
  created_at: string;
};

const DashboardInbox = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const refreshUnreadBadge = () => queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<AdminMessage | null>(null);

  const fetchMessages = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_messages")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setMessages(data as unknown as AdminMessage[]);
    if (error) toast.error("Failed to load messages");
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [user]);

  const markRead = async (msg: AdminMessage) => {
    if (msg.is_read) return;
    const { error } = await supabase.from("admin_messages").update({ is_read: true }).eq("id", msg.id);
    if (error) { toast.error("Could not mark message as read"); return; }
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
    refreshUnreadBadge();
  };

  const openMessage = (msg: AdminMessage) => {
    setSelectedMsg(msg);
    setViewOpen(true);
    if (!msg.is_read) markRead(msg);
  };

  const markAllRead = async () => {
    const unread = messages.filter(m => !m.is_read);
    if (unread.length === 0) return;
    const { error } = await supabase
      .from("admin_messages")
      .update({ is_read: true })
      .eq("recipient_id", user!.id)
      .eq("is_read", false);
    if (error) { toast.error("Could not mark all messages as read"); return; }
    setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
    refreshUnreadBadge();
    toast.success("All messages marked as read");
  };

  const deleteMessage = async (msgId: string) => {
    const ok = await confirm({
      title: "Delete this message?",
      description: "This message will be permanently deleted. This action cannot be undone.",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("admin_messages")
      .delete()
      .eq("id", msgId)
      .eq("recipient_id", user!.id);
    if (error) { toast.error("Could not delete message"); return; }
    setMessages(prev => prev.filter(m => m.id !== msgId));
    if (selectedMsg?.id === msgId) {
      setViewOpen(false);
      setSelectedMsg(null);
    }
    refreshUnreadBadge();
    toast.success("Message deleted");
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 bg-background p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Mail className="h-6 w-6" /> Inbox
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount} new</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">Messages from the PetsRegistry team</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
              <CheckCheck className="h-4 w-4" /> Mark All Read
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Messages ({messages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center">
                <Mail className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <p className="mt-4 text-muted-foreground">Your inbox is empty</p>
                <p className="text-sm text-muted-foreground">Messages from the admin team will appear here</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Status</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-24">Files</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map(msg => {
                    const atts = msg.attachment_urls || [];
                    return (
                      <TableRow
                        key={msg.id}
                        className={`cursor-pointer transition-colors ${!msg.is_read ? "bg-primary/5 font-medium" : ""}`}
                        onClick={() => openMessage(msg)}
                      >
                        <TableCell>
                          {msg.is_read ? (
                            <Badge variant="secondary" className="text-xs">Read</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">New</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className={`text-sm ${!msg.is_read ? "font-semibold text-foreground" : "text-foreground"}`}>
                              {msg.subject || "No Subject"}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {msg.is_html
                                ? msg.message.replace(/<[^>]*>/g, "").substring(0, 100)
                                : msg.message.substring(0, 100)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {atts.length > 0 && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Paperclip className="h-3 w-3" /> {atts.length}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); openMessage(msg); }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* View Message Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{selectedMsg?.subject || "Message"}</DialogTitle>
            </DialogHeader>
            {selectedMsg && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>From: PetsRegistry Admin</span>
                  <span>{new Date(selectedMsg.created_at).toLocaleString()}</span>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  {selectedMsg.is_html ? (
                    <div
                      className="prose prose-sm max-w-none text-foreground"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedMsg.message) }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-foreground">{selectedMsg.message}</p>
                  )}
                </div>

                {/* Attachments */}
                {(() => {
                  const atts = selectedMsg.attachment_urls || [];
                  if (atts.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Attachments ({atts.length})</Label>
                      <div className="space-y-1">
                        {atts.map((att, i) => (
                          <a
                            key={i}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted"
                          >
                            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate text-primary flex-1">{att.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(att.size)}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              {selectedMsg && (
                <Button
                  variant="destructive"
                  className="gap-2 sm:mr-auto"
                  onClick={() => deleteMessage(selectedMsg.id)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
              <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </main>
    </div>
  );
};

export default DashboardInbox;
