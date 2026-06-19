import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Sparkles, Trash2, Plus, MessageSquare, PanelLeftClose, PanelLeft, Clock, ImagePlus, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CmsRenderer from "@/components/CmsRenderer";
import WebcamCaptureDialog from "@/components/WebcamCaptureDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

type Message = { role: "user" | "assistant"; content: string; imageUrl?: string };
type ChatSessionMeta = { id: string; title: string; created_at: string; updated_at: string };

const SUGGESTIONS = [
  { label: "Itchy skin", prompt: "My dog has been scratching a lot, what could it be?" },
  { label: "Cat diet", prompt: "What's the best diet for an indoor cat?" },
  { label: "Puppy biting", prompt: "How do I train my puppy to stop biting?" },
  { label: "Feather loss", prompt: "My parrot is losing feathers, should I be worried?" },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pet-expert`;

// ── cPanel chat storage helpers ──────────────────────────────────────────
const CHAT_STORAGE_URL = "https://petsregistry.org/chat-storage.php";
const UPLOAD_TOKEN = import.meta.env.VITE_UPLOAD_TOKEN ?? "";

async function cpanelRequest(params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams(params);
  const resp = await fetch(CHAT_STORAGE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPLOAD_TOKEN}` },
    body,
  });
  if (!resp.ok) throw new Error(`Chat storage error: ${resp.status}`);
  return resp.json();
}

async function listSessions(userId: string): Promise<ChatSessionMeta[]> {
  return cpanelRequest({ action: "list", user_id: userId });
}

async function loadSession(userId: string, sessionId: string): Promise<{ id: string; messages: Message[] }> {
  return cpanelRequest({ action: "load", user_id: userId, session_id: sessionId });
}

async function saveSession(userId: string, sessionId: string | null, title: string, messages: Message[]): Promise<{ id: string }> {
  const cleanMsgs = messages.map(({ imageUrl, ...rest }) => rest);
  const params: Record<string, string> = {
    action: "save",
    user_id: userId,
    title,
    messages: JSON.stringify(cleanMsgs),
  };
  if (sessionId) params.session_id = sessionId;
  return cpanelRequest(params);
}

async function deleteSessionApi(userId: string, sessionId: string): Promise<void> {
  await cpanelRequest({ action: "delete", user_id: userId, session_id: sessionId });
}

async function uploadChatImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("action", "upload");
  form.append("image", file);
  const resp = await fetch(CHAT_STORAGE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPLOAD_TOKEN}` },
    body: form,
  });
  if (!resp.ok) throw new Error("Image upload failed");
  const data = await resp.json();
  return data.url;
}

// ── Stream chat with AI ──────────────────────────────────────────────────
async function streamChat({
  messages, onDelta, onDone, onError,
}: {
  messages: Message[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    onError(data.error || "Something went wrong.");
    return;
  }
  if (!resp.body) { onError("No response received."); return; }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamDone = false;
  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
  onDone();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PetExpert() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSessionMeta[]>([]);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect if device has a real camera capture path (mobile) vs desktop
  const isMobileDevice = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const handleCameraClick = () => {
    if (isMobileDevice) {
      // Mobile: use native camera via file input capture
      cameraInputRef.current?.click();
    } else {
      // Desktop: open getUserMedia webcam dialog
      setWebcamOpen(true);
    }
  };

  const handleWebcamCapture = (file: File, dataUrl: string) => {
    setAttachedImage(dataUrl);
    setAttachedFile(file);
  };

  // Load sessions from cPanel
  const refreshSessions = useCallback(async () => {
    if (!user) return;
    try {
      const sessions = await listSessions(user.id);
      setChatSessions(sessions);
    } catch (e) {
      console.error("Failed to load chat sessions:", e);
    }
  }, [user]);

  useEffect(() => { refreshSessions(); }, [refreshSessions]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const doSaveSession = useCallback(async (msgs: Message[], sessionId: string | null) => {
    if (!user || msgs.length === 0) return;
    const firstUserMsg = msgs.find(m => m.role === "user");
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 80) : "New Chat";
    try {
      const result = await saveSession(user.id, sessionId, title, msgs);
      if (!sessionId && result.id) setActiveSessionId(result.id);
      refreshSessions();
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  }, [user, refreshSessions]);

  const debouncedSave = useCallback((msgs: Message[], sessionId: string | null) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => doSaveSession(msgs, sessionId), 1500);
  }, [doSaveSession]);

  const handleImageAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    const base64 = await fileToBase64(file);
    setAttachedImage(base64);
    setAttachedFile(file);
  };

  const send = async (text: string) => {
    if ((!text.trim() && !attachedImage) || isLoading) return;

    let imageUrlForAI = attachedImage;

    // Upload image to cPanel if attached, use the URL for display in future
    if (attachedFile) {
      try {
        const uploadedUrl = await uploadChatImage(attachedFile);
        // We still use base64 for the AI call (multimodal), but store the cPanel URL
        imageUrlForAI = attachedImage; // keep base64 for AI
      } catch {
        toast.error("Failed to upload image");
      }
    }

    const userMsg: Message = {
      role: "user",
      content: text.trim() || (attachedImage ? "Please look at this photo of my pet and tell me what you think." : ""),
      ...(imageUrlForAI ? { imageUrl: imageUrlForAI } : {}),
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setAttachedImage(null);
    setAttachedFile(null);
    setIsLoading(true);
    let assistantSoFar = "";
    const currentSessionId = activeSessionId;
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };
    try {
      await streamChat({
        messages: updated,
        onDelta: upsert,
        onDone: () => {
          setIsLoading(false);
          const finalMessages = [...updated, { role: "assistant" as const, content: assistantSoFar }];
          if (user) debouncedSave(finalMessages, currentSessionId);
        },
        onError: (msg) => { toast.error(msg); setIsLoading(false); },
      });
    } catch {
      toast.error("Failed to connect.");
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const handleLoadSession = async (sessionId: string) => {
    if (!user) return;
    try {
      const data = await loadSession(user.id, sessionId);
      setMessages(data.messages || []);
      setActiveSessionId(data.id);
    } catch {
      toast.error("Failed to load chat");
    }
  };

  const startNewChat = () => { setMessages([]); setActiveSessionId(null); setInput(""); setAttachedImage(null); setAttachedFile(null); };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteSessionApi(user.id, sessionId);
      if (activeSessionId === sessionId) startNewChat();
      refreshSessions();
      toast.success("Chat deleted");
    } catch {
      toast.error("Failed to delete chat");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <Navbar />
      <CmsRenderer slug="pet-expert" fallback={null} />
      <main className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* Sidebar */}
        {user && (
          <div className={`flex shrink-0 flex-col overflow-hidden border-r border-primary/15 bg-card transition-all duration-300 ${sidebarOpen ? "w-72" : "w-0"}`}>
            <div className="flex items-center justify-between border-b border-primary/15 bg-primary/10 p-3">
              <span className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                <MessageSquare className="h-4 w-4 text-primary" /> History
              </span>
              <Button variant="outline" size="sm" className="gap-1.5 border-primary/30 bg-background text-xs hover:bg-primary/10" onClick={startNewChat}>
                <Plus className="h-3.5 w-3.5" /> New
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {chatSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No past chats yet</p>
                ) : chatSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-start gap-1 rounded-lg transition-colors ${
                      activeSessionId === session.id ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadSession(session.id)}
                      className={`flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        activeSessionId === session.id ? "text-primary" : "text-foreground"
                      }`}
                    >
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{session.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(session.updated_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="mt-1.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Main Chat */}
        <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-br from-primary/[0.08] via-background to-accent/10">
          <div className="flex items-center gap-3 border-b border-primary/15 bg-card/90 px-4 py-3 shadow-sm backdrop-blur-sm">
            {user && (
              <Button variant="ghost" size="icon" className="shrink-0 hover:bg-primary/10" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </Button>
            )}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-foreground">AI Pet Expert</h1>
                <p className="text-xs text-muted-foreground">Type below or attach a photo</p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 px-4 py-3" style={{ height: "calc(100vh - 200px)" }}>
            {messages.length === 0 ? (
              <div className="mx-auto flex max-w-2xl flex-col gap-5 pt-6">
                <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-card/90 p-4 shadow-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-foreground">What can I help with?</p>
                    <p className="text-sm text-muted-foreground">Health, diet, training — or send a pet photo.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => send(s.prompt)}
                      className="rounded-full border border-primary/25 bg-card px-3.5 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/10"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-foreground"
                    }`}>
                      {m.imageUrl && (
                        <img src={m.imageUrl} alt="Pet photo" className="rounded-lg max-h-48 mb-2 w-auto" />
                      )}
                      {m.content}
                    </div>
                    {m.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                      <span className="animate-pulse text-sm text-muted-foreground">Analyzing...</span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-primary/20 bg-card/95 p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur-sm">
            {attachedImage && (
              <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
                <img src={attachedImage} alt="Attached" className="h-14 w-14 rounded object-cover" />
                <p className="flex-1 text-xs font-medium text-foreground">Photo attached</p>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setAttachedImage(null); setAttachedFile(null); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" onClick={startNewChat} className="shrink-0 text-muted-foreground hover:bg-primary/10" title="New chat">
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageAttach} />
              <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleImageAttach} />
              <Button variant="outline" size="icon" className="shrink-0 border-primary/30 hover:bg-primary/10" title={isMobileDevice ? "Take a photo" : "Webcam"}
                onClick={handleCameraClick} disabled={isLoading}>
                <Camera className="h-4 w-4 text-primary" />
              </Button>
              <Button variant="outline" size="icon" className="shrink-0 border-primary/30 hover:bg-primary/10" title="Upload photo"
                onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                <ImagePlus className="h-4 w-4 text-primary" />
              </Button>
              <Textarea
                placeholder="Ask about your pet..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-xl border-primary/25 bg-background shadow-inner focus-visible:ring-primary/40"
                disabled={isLoading}
              />
              <Button onClick={() => send(input)} disabled={(!input.trim() && !attachedImage) || isLoading} size="icon" className="h-11 w-11 shrink-0 rounded-xl shadow-sm">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted-foreground">
              AI advice only — not a substitute for a vet · Photos auto-delete within 24h
            </p>
          </div>
        </div>
      </main>
      <WebcamCaptureDialog open={webcamOpen} onClose={() => setWebcamOpen(false)} onCapture={handleWebcamCapture} />
    </div>
  );
}
