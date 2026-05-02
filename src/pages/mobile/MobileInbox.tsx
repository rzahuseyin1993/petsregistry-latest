import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Mail, Paperclip, ArrowLeft, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import DOMPurify from "dompurify";

type Attachment = { name: string; url: string; type: string; size: number };
type Message = {
  id: string; subject: string; message: string;
  is_read: boolean; is_html: boolean;
  attachment_urls: Attachment[] | null; created_at: string;
};

const MobileInbox = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);

  const fetch = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("admin_messages")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setMessages(data as unknown as Message[]);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [user]);

  const openMsg = async (msg: Message) => {
    setSelected(msg);
    if (!msg.is_read) {
      await supabase.from("admin_messages").update({ is_read: true }).eq("id", msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
    }
  };

  const markAllRead = async () => {
    const unread = messages.filter(m => !m.is_read);
    for (const m of unread) {
      await supabase.from("admin_messages").update({ is_read: true }).eq("id", m.id);
    }
    setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
    toast.success("All marked as read");
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/m/dashboard">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <Mail className="h-5 w-5" /> Inbox
            {unreadCount > 0 && <Badge variant="destructive" className="text-[10px]">{unreadCount}</Badge>}
          </h1>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="h-8 text-xs gap-1">
            <CheckCheck className="h-3.5 w-3.5" /> Read All
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : messages.length === 0 ? (
        <div className="py-16 text-center">
          <Mail className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">No messages yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => {
            const atts = msg.attachment_urls || [];
            return (
              <Card
                key={msg.id}
                className={`cursor-pointer transition-colors ${!msg.is_read ? "border-primary/30 bg-primary/5" : ""}`}
                onClick={() => openMsg(msg)}
              >
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm ${!msg.is_read ? "font-bold" : "font-medium"} text-foreground truncate flex-1`}>
                      {msg.subject || "No Subject"}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {new Date(msg.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {msg.is_html ? msg.message.replace(/<[^>]*>/g, "").substring(0, 80) : msg.message.substring(0, 80)}
                  </p>
                  <div className="flex items-center gap-2">
                    {!msg.is_read && <Badge variant="destructive" className="text-[9px]">New</Badge>}
                    {atts.length > 0 && (
                      <Badge variant="outline" className="text-[9px] gap-0.5">
                        <Paperclip className="h-2.5 w-2.5" /> {atts.length}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Message Detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-auto mx-4">
          <DialogHeader>
            <DialogTitle className="text-base">{selected?.subject || "Message"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {new Date(selected.created_at).toLocaleString()}
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                {selected.is_html ? (
                  <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selected.message) }} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{selected.message}</p>
                )}
              </div>
              {(selected.attachment_urls || []).length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Attachments</Label>
                  {(selected.attachment_urls || []).map((att, i) => (
                    <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted">
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate text-primary flex-1">{att.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MobileInbox;
