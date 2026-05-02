import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Undo2, Loader2, X, Sparkles, History, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Editor } from "grapesjs";

interface HistoryEntry {
  html: string;
  css: string;
  instruction: string;
  summary: string;
  timestamp: Date;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AiSiteEditorPanelProps {
  editor: Editor | null;
  onClose: () => void;
}

type Mode = "edit" | "generate";

const AiSiteEditorPanel = ({ editor, onClose }: AiSiteEditorPanelProps) => {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const callAiEditor = async (userInstruction: string, currentHtml: string, currentCss: string) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-site-editor`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          html: currentHtml,
          css: currentCss,
          instruction: userInstruction,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || `Error ${response.status}`);
    }

    return response.json();
  };

  const handleSubmit = async () => {
    if (!instruction.trim() || !editor || loading) return;

    const userInstruction = instruction.trim();
    const currentHtml = editor.getHtml();
    const currentCss = editor.getCss();

    // Build the actual instruction based on mode
    const finalInstruction = mode === "generate"
      ? `Generate a complete, professional webpage from scratch based on this description. Replace ALL existing content. Create a full page with proper sections, modern design, and responsive layout. Description: ${userInstruction}`
      : userInstruction;

    // Save current state for undo
    const historyEntry: HistoryEntry = {
      html: currentHtml,
      css: currentCss || "",
      instruction: userInstruction,
      summary: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: mode === "generate" ? `🆕 Generate page: ${userInstruction}` : userInstruction,
        timestamp: new Date(),
      },
    ]);
    setInstruction("");
    setLoading(true);

    try {
      const result = await callAiEditor(finalInstruction, currentHtml, currentCss || "");

      // Apply changes to editor
      editor.setComponents(result.html);
      if (result.css) editor.setStyle(result.css);

      // Save to undo history
      historyEntry.summary = result.summary;
      setHistory((prev) => [...prev, historyEntry]);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ ${result.summary}\n\nYou can undo this change using the undo button below.`,
          timestamp: new Date(),
        },
      ]);

      // Reset to edit mode after generation
      if (mode === "generate") setMode("edit");
    } catch (err: any) {
      console.error("AI edit error:", err);
      toast.error(err.message || "AI edit failed");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ ${err.message || "Something went wrong. Please try again."}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = (index: number) => {
    if (!editor) return;
    const entry = history[index];
    editor.setComponents(entry.html);
    if (entry.css) editor.setStyle(entry.css);
    setHistory((prev) => prev.slice(0, index));
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `↩️ Reverted to state before: "${entry.instruction}"`,
        timestamp: new Date(),
      },
    ]);
    toast.success("Changes reverted!");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const editSuggestions = [
    "Change the header background to blue",
    "Add a new testimonial section",
    "Make the text bigger and bolder",
    "Change the button color to green",
  ];

  const generateSuggestions = [
    "A modern pet registration landing page with hero, features, and CTA",
    "A clean about us page for a pet registry organization",
    "A pricing page with 3 tiers for pet membership plans",
    "A contact page with a form, map placeholder, and FAQ section",
  ];

  const suggestions = mode === "generate" ? generateSuggestions : editSuggestions;

  return (
    <div className="flex flex-col h-full w-80 border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AI Site Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowHistory(!showHistory)}
            title="Edit history"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex border-b border-border">
        <button
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${mode === "edit" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setMode("edit")}
        >
          <Sparkles className="h-3 w-3" /> Edit Page
        </button>
        <button
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${mode === "generate" ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setMode("generate")}
        >
          <FileText className="h-3 w-3" /> Generate Page
        </button>
      </div>

      {showHistory ? (
        <ScrollArea className="flex-1 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">
              AI Edit History ({history.length})
            </h3>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm("Clear all AI edit history?")) {
                    setHistory([]);
                    setMessages([]);
                    toast.success("History cleared");
                  }
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Clear All
              </Button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No AI edits yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((entry, i) => (
                <div key={i} className="rounded-lg border border-border bg-background p-2.5 text-xs">
                  <p className="font-medium text-foreground mb-1">"{entry.instruction}"</p>
                  <p className="text-muted-foreground mb-2">{entry.summary}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                    <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => handleUndo(i)}>
                      <Undo2 className="h-3 w-3" /> Undo to here
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  {mode === "generate" ? <FileText className="h-6 w-6 text-primary" /> : <Sparkles className="h-6 w-6 text-primary" />}
                </div>
                <h3 className="text-sm font-semibold mb-1">
                  {mode === "generate" ? "Generate Full Page" : "AI Site Editor"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {mode === "generate"
                    ? "Describe the page you want and AI will create it from scratch. This will replace current content."
                    : "Tell the AI what you want to change on this page. For example:"}
                </p>
                <div className="mt-3 space-y-1.5 w-full">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => setInstruction(suggestion)}
                    >
                      "{suggestion}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">
                    {mode === "generate" ? "AI is generating page..." : "AI is editing..."}
                  </span>
                </div>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="px-3 pb-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs gap-1"
                onClick={() => handleUndo(history.length - 1)}
              >
                <Undo2 className="h-3 w-3" /> Undo last AI edit
              </Button>
            </div>
          )}

          <div className="p-3 border-t border-border">
            {mode === "generate" && (
              <p className="text-[10px] text-destructive mb-2 font-medium">
                ⚠️ This will replace all current page content
              </p>
            )}
            <div className="flex gap-2">
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === "generate" ? "Describe the page you want..." : "Tell AI what to change..."}
                className="min-h-[60px] max-h-[120px] text-xs resize-none"
                disabled={loading}
              />
              <Button
                size="icon"
                className="h-[60px] w-10 shrink-0"
                onClick={handleSubmit}
                disabled={loading || !instruction.trim()}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AiSiteEditorPanel;
