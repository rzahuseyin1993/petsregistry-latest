import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminSidebar from "@/components/AdminSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { uploadRaw } from "@/lib/imageUpload";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import {
  Save, ArrowLeft, Plus, Trash2, Type, Image, Square, Circle,
  Move, MousePointer, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, Copy, Layers, ChevronUp, ChevronDown,
  MapPin, Phone, Award, PawPrint
} from "lucide-react";
import { flyerTemplates, type FlyerTemplate } from "@/lib/flyerTemplates";

/* ─── Types ─── */
interface CanvasElement {
  id: string;
  type: "text" | "image" | "shape" | "icon";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  textAlign: string;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  opacity: number;
  rotation: number;
  letterSpacing: number;
  lineHeight: number;
  zIndex: number;
  // shape-specific
  shapeType?: "rect" | "circle" | "line";
  // icon-specific
  iconName?: string;
}

const CANVAS_W = 420;
const CANVAS_H = 594;

const FONT_FAMILIES = [
  "'Helvetica Neue', Arial, sans-serif",
  "'Georgia', 'Times New Roman', serif",
  "'Courier New', monospace",
  "'Impact', sans-serif",
  "'Arial Black', sans-serif",
  "'Trebuchet MS', sans-serif",
  "'Verdana', sans-serif",
  "'Palatino', serif",
];

const PRESET_COLORS = [
  "#DC2626", "#EA580C", "#F59E0B", "#22C55E", "#0EA5E9",
  "#6366F1", "#A855F7", "#EC4899", "#000000", "#374151",
  "#6B7280", "#FFFFFF", "#F3F4F6", "#FEE2E2", "#DBEAFE",
  "#D1FAE5", "#FEF3C7", "#FCE7F3", "#EDE9FE", "#1F2937",
];

const QUICK_ELEMENTS = [
  { label: "MISSING", type: "text" as const, preset: { content: "MISSING", fontSize: 40, fontWeight: "900", color: "#DC2626", letterSpacing: 4, textAlign: "center", width: 380, height: 50 } },
  { label: "Pet Name", type: "text" as const, preset: { content: "Pet Name", fontSize: 28, fontWeight: "700", color: "#1A1A1A", textAlign: "center", width: 300, height: 40 } },
  { label: "Contact", type: "text" as const, preset: { content: "+123 456 7890", fontSize: 24, fontWeight: "800", color: "#FFFFFF", backgroundColor: "#DC2626", textAlign: "center", width: 320, height: 42, borderRadius: 8 } },
  { label: "Reward", type: "text" as const, preset: { content: "REWARD $500", fontSize: 18, fontWeight: "800", color: "#FFFFFF", backgroundColor: "#15803D", textAlign: "center", width: 200, height: 36, borderRadius: 8 } },
  { label: "Last Seen", type: "text" as const, preset: { content: "📍 Last Seen: Borcelle Area", fontSize: 12, fontWeight: "600", color: "#1A1A1A", backgroundColor: "#FEF3C7", textAlign: "center", width: 280, height: 30, borderRadius: 16 } },
  { label: "Description", type: "text" as const, preset: { content: "Please help us find our beloved pet. Any information appreciated.", fontSize: 11, fontWeight: "400", color: "#374151", textAlign: "center", width: 340, height: 50, lineHeight: 1.5 } },
  { label: "Breed Info", type: "text" as const, preset: { content: "Breed: Golden Retriever\nColor: Golden\nSize: Medium", fontSize: 12, fontWeight: "500", color: "#1F2937", textAlign: "left", width: 200, height: 60 } },
  { label: "Call to Action", type: "text" as const, preset: { content: "CALL OR TEXT WITH ANY INFORMATION", fontSize: 10, fontWeight: "600", color: "#FFFFFF", letterSpacing: 1, textAlign: "center", width: 340, height: 24 } },
  { label: "Photo Area", type: "shape" as const, preset: { shapeType: "rect" as const, backgroundColor: "#E5E7EB", width: 200, height: 200, borderRadius: 12, content: "📷 Pet Photo" } },
  { label: "Circle Photo", type: "shape" as const, preset: { shapeType: "circle" as const, backgroundColor: "#E5E7EB", width: 180, height: 180, borderRadius: 90, content: "📷" } },
  { label: "Banner", type: "shape" as const, preset: { shapeType: "rect" as const, backgroundColor: "#DC2626", width: 420, height: 60, borderRadius: 0, content: "" } },
  { label: "Accent Strip", type: "shape" as const, preset: { shapeType: "rect" as const, backgroundColor: "#F59E0B", width: 420, height: 8, borderRadius: 0, content: "" } },
];

let idCounter = 0;
const genId = () => `el_${Date.now()}_${++idCounter}`;

const defaultElement = (type: string): Partial<CanvasElement> => ({
  fontSize: 16, fontWeight: "400", fontStyle: "normal", textDecoration: "none",
  textAlign: "left", fontFamily: FONT_FAMILIES[0], color: "#000000",
  backgroundColor: "transparent", borderRadius: 0, borderWidth: 0,
  borderColor: "#000000", opacity: 1, rotation: 0, letterSpacing: 0,
  lineHeight: 1.3, zIndex: 1,
});

const AdminFlyerEditor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("id");
  const builtinId = searchParams.get("builtin");

  const canvasRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; dir: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [templateName, setTemplateName] = useState("New Template");
  const [templateDesc, setTemplateDesc] = useState("");
  const [canvasBg, setCanvasBg] = useState("#FFFFFF");
  const [saving, setSaving] = useState(false);
  const [activeTool, setActiveTool] = useState<"select" | "move">("select");

  const selected = elements.find((e) => e.id === selectedId) || null;

  // Load existing template if editing
  useEffect(() => {
    if (templateId) {
      supabase.from("flyer_templates" as any).select("*").eq("id", templateId).single()
        .then(({ data }) => {
          if (data) {
            setTemplateName((data as any).name);
            setTemplateDesc((data as any).description || "");
          }
        });
    } else if (builtinId) {
      // Load a built-in template into the editor as a new template
      const tmpl = flyerTemplates.find((t) => t.id === builtinId);
      if (tmpl) {
        setTemplateName(`${tmpl.name} (Custom)`);
        setTemplateDesc(tmpl.description);
        setCanvasBg(tmpl.bgColor);
        // Build starter elements from the built-in template
        const els: CanvasElement[] = [];
        const add = (partial: Partial<CanvasElement>) => {
          els.push({ ...defaultElement("text"), id: genId(), type: "text", x: 0, y: 0, width: 200, height: 40, content: "", zIndex: els.length + 1, ...partial } as CanvasElement);
        };
        // Header bar
        add({ type: "shape", x: 0, y: 0, width: CANVAS_W, height: 70, backgroundColor: tmpl.headerColor, content: "" });
        add({ type: "text", x: CANVAS_W / 2 - 130, y: 12, width: 260, height: 40, content: "MISSING", fontSize: 40, fontWeight: "900", color: tmpl.headerText, textAlign: "center", letterSpacing: 4, fontFamily: tmpl.fontFamily });
        add({ type: "text", x: CANVAS_W / 2 - 160, y: 50, width: 320, height: 18, content: "PLEASE HELP US FIND OUR BELOVED PET", fontSize: 10, fontWeight: "400", color: tmpl.headerText, textAlign: "center", letterSpacing: 1, fontFamily: tmpl.fontFamily });
        // Photo area
        add({ type: "shape", x: 30, y: 80, width: 360, height: 200, backgroundColor: "#E5E7EB", borderRadius: 0, content: "📷 Pet Photo" });
        // Pet name
        add({ type: "text", x: 30, y: 290, width: 360, height: 32, content: "PET NAME", fontSize: 24, fontWeight: "800", color: tmpl.bodyText, textAlign: "center", fontFamily: tmpl.fontFamily });
        // Details
        add({ type: "text", x: 30, y: 326, width: 170, height: 20, content: "Species: —", fontSize: 12, color: tmpl.bodyText, fontFamily: tmpl.fontFamily });
        add({ type: "text", x: 220, y: 326, width: 170, height: 20, content: "Breed: —", fontSize: 12, color: tmpl.bodyText, fontFamily: tmpl.fontFamily });
        add({ type: "text", x: 30, y: 350, width: 170, height: 20, content: "Color: —", fontSize: 12, color: tmpl.bodyText, fontFamily: tmpl.fontFamily });
        // CTA
        add({ type: "shape", x: 0, y: 520, width: CANVAS_W, height: 74, backgroundColor: tmpl.ctaColor || tmpl.accentColor, content: "" });
        add({ type: "text", x: CANVAS_W / 2 - 150, y: 526, width: 300, height: 16, content: "CALL OR TEXT WITH ANY INFORMATION", fontSize: 10, fontWeight: "400", color: tmpl.ctaText || tmpl.headerText, textAlign: "center", letterSpacing: 1, fontFamily: tmpl.fontFamily });
        add({ type: "text", x: CANVAS_W / 2 - 150, y: 546, width: 300, height: 40, content: "+123 456 7890", fontSize: 28, fontWeight: "900", color: tmpl.ctaText || tmpl.headerText, textAlign: "center", letterSpacing: 2, fontFamily: tmpl.fontFamily });
        setElements(els);
      }
    }
  }, [templateId, builtinId]);

  const addElement = useCallback((type: string, preset?: Partial<CanvasElement>) => {
    const el: CanvasElement = {
      id: genId(),
      type: type as any,
      x: 20 + Math.random() * 40,
      y: 20 + elements.length * 30,
      width: 200,
      height: 40,
      content: type === "text" ? "New Text" : "",
      ...defaultElement(type),
      zIndex: elements.length + 1,
      ...preset,
    } as CanvasElement;
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  }, [elements.length]);

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }, []);

  const deleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const duplicateElement = useCallback((id: string) => {
    const src = elements.find((e) => e.id === id);
    if (!src) return;
    const dup = { ...src, id: genId(), x: src.x + 15, y: src.y + 15, zIndex: elements.length + 1 };
    setElements((prev) => [...prev, dup]);
    setSelectedId(dup.id);
  }, [elements]);

  const moveLayer = useCallback((id: string, dir: "up" | "down") => {
    setElements((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((e) => e.id === id);
      if (dir === "up" && idx < sorted.length - 1) {
        const tmp = sorted[idx].zIndex;
        sorted[idx].zIndex = sorted[idx + 1].zIndex;
        sorted[idx + 1].zIndex = tmp;
      } else if (dir === "down" && idx > 0) {
        const tmp = sorted[idx].zIndex;
        sorted[idx].zIndex = sorted[idx - 1].zIndex;
        sorted[idx - 1].zIndex = tmp;
      }
      return sorted;
    });
  }, []);

  /* ─── Drag Logic ─── */
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedId(null);
    }
  }, []);

  const handleElementMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    const el = elements.find((x) => x.id === id);
    if (!el || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = rect.width / CANVAS_W;
    setDragging({
      id,
      offsetX: (e.clientX - rect.left) / scale - el.x,
      offsetY: (e.clientY - rect.top) / scale - el.y,
    });
  }, [elements]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, id: string, dir: string) => {
    e.stopPropagation();
    const el = elements.find((x) => x.id === id);
    if (!el) return;
    setResizing({ id, dir, startX: e.clientX, startY: e.clientY, startW: el.width, startH: el.height });
  }, [elements]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const scale = rect.width / CANVAS_W;
        const x = Math.max(0, Math.min(CANVAS_W - 20, (e.clientX - rect.left) / scale - dragging.offsetX));
        const y = Math.max(0, Math.min(CANVAS_H - 20, (e.clientY - rect.top) / scale - dragging.offsetY));
        updateElement(dragging.id, { x, y });
      }
      if (resizing && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const scale = rect.width / CANVAS_W;
        const dx = (e.clientX - resizing.startX) / scale;
        const dy = (e.clientY - resizing.startY) / scale;
        const newW = Math.max(30, resizing.startW + dx);
        const newH = Math.max(20, resizing.startH + dy);
        updateElement(resizing.id, { width: newW, height: newH });
      }
    };
    const handleMouseUp = () => { setDragging(null); setResizing(null); };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [dragging, resizing, updateElement]);

  /* ─── Save Template ─── */
  const handleSave = async () => {
    if (!user || !canvasRef.current || !templateName.trim()) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(canvasRef.current, { scale: 2, useCORS: true, backgroundColor: canvasBg });
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const path = `admin/${Date.now()}.png`;
      const publicUrl = await uploadRaw({ bucket: "flyer-templates", path, body: blob, contentType: "image/png" });

      if (templateId) {
        const { error } = await supabase.from("flyer_templates" as any).update({
          name: templateName.trim(),
          description: templateDesc.trim() || null,
          image_url: publicUrl,
        }).eq("id", templateId);
        if (error) throw error;
        toast.success("Template updated!");
      } else {
        const { error } = await supabase.from("flyer_templates" as any).insert({
          name: templateName.trim(),
          description: templateDesc.trim() || null,
          image_url: publicUrl,
          created_by: user.id,
          template_type: "admin",
          is_active: true,
        });
        if (error) throw error;
        toast.success("Template saved!");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-flyer-templates"] });
      navigate("/admin/flyer-templates");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  /* ─── Keyboard Shortcuts ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        deleteElement(selectedId);
      }
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        duplicateElement(selectedId);
      }
      const step = e.shiftKey ? 10 : 1;
      const el = elements.find((x) => x.id === selectedId);
      if (!el) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); updateElement(selectedId, { x: el.x - step }); }
      if (e.key === "ArrowRight") { e.preventDefault(); updateElement(selectedId, { x: el.x + step }); }
      if (e.key === "ArrowUp") { e.preventDefault(); updateElement(selectedId, { y: el.y - step }); }
      if (e.key === "ArrowDown") { e.preventDefault(); updateElement(selectedId, { y: el.y + step }); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, elements, deleteElement, duplicateElement, updateElement]);

  /* ─── Render ─── */
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 bg-background flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={() => navigate("/admin/flyer-templates")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="h-8 w-60 text-sm font-semibold"
              placeholder="Template name"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{elements.length} elements</Badge>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel — Quick Elements */}
          <div className="w-56 border-r border-border bg-card overflow-y-auto p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Quick Add Elements</p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_ELEMENTS.map((qe) => (
                  <button
                    key={qe.label}
                    onClick={() => addElement(qe.type, qe.preset)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    {qe.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Add Custom</p>
              <div className="space-y-1">
                <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-xs" onClick={() => addElement("text")}>
                  <Type className="h-3 w-3" /> Text Block
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-xs" onClick={() => addElement("shape", { shapeType: "rect", backgroundColor: "#3B82F6", width: 200, height: 50 })}>
                  <Square className="h-3 w-3" /> Rectangle
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-xs" onClick={() => addElement("shape", { shapeType: "circle", backgroundColor: "#8B5CF6", width: 100, height: 100, borderRadius: 50 })}>
                  <Circle className="h-3 w-3" /> Circle
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Canvas Background</p>
              <div className="grid grid-cols-5 gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-6 w-6 rounded border transition-transform hover:scale-110 ${canvasBg === c ? "ring-2 ring-primary" : "border-border"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setCanvasBg(c)}
                  />
                ))}
              </div>
              <Input type="color" value={canvasBg} onChange={(e) => setCanvasBg(e.target.value)} className="mt-1 h-7 w-full" />
            </div>

            {/* Layer List */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1"><Layers className="h-3 w-3" /> Layers</p>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {[...elements].sort((a, b) => b.zIndex - a.zIndex).map((el) => (
                  <button
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    className={`w-full flex items-center gap-1 rounded px-2 py-1 text-[10px] ${
                      selectedId === el.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {el.type === "text" ? <Type className="h-2.5 w-2.5" /> : <Square className="h-2.5 w-2.5" />}
                    <span className="truncate flex-1 text-left">{el.content || el.type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="Template description..."
                rows={2}
                className="text-xs mt-1"
              />
            </div>
          </div>

          {/* Center — Canvas */}
          <div className="flex-1 bg-muted/30 flex items-center justify-center p-4 overflow-auto">
            <div
              className="relative shadow-2xl"
              style={{ width: CANVAS_W, height: CANVAS_H, transform: "scale(0.85)", transformOrigin: "center" }}
            >
              <div
                ref={canvasRef}
                className="absolute inset-0 overflow-hidden"
                style={{ background: canvasBg }}
                onMouseDown={handleCanvasMouseDown}
              >
                {elements.sort((a, b) => a.zIndex - b.zIndex).map((el) => (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                    style={{
                      position: "absolute",
                      left: el.x,
                      top: el.y,
                      width: el.width,
                      height: el.height,
                      zIndex: el.zIndex,
                      opacity: el.opacity,
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      cursor: "move",
                    }}
                    className={`group ${selectedId === el.id ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-primary/30"}`}
                  >
                    {/* Element content */}
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: el.backgroundColor,
                        borderRadius: el.borderRadius,
                        borderWidth: el.borderWidth,
                        borderColor: el.borderColor,
                        borderStyle: el.borderWidth > 0 ? "solid" : "none",
                        color: el.color,
                        fontSize: el.fontSize,
                        fontWeight: el.fontWeight,
                        fontStyle: el.fontStyle,
                        textDecoration: el.textDecoration,
                        textAlign: el.textAlign as any,
                        fontFamily: el.fontFamily,
                        letterSpacing: el.letterSpacing,
                        lineHeight: el.lineHeight,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: el.textAlign === "center" ? "center" : el.textAlign === "right" ? "flex-end" : "flex-start",
                        padding: "4px 8px",
                        overflow: "hidden",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {el.content}
                    </div>

                    {/* Resize handle */}
                    {selectedId === el.id && (
                      <div
                        onMouseDown={(e) => handleResizeMouseDown(e, el.id, "se")}
                        className="absolute -bottom-1 -right-1 h-3 w-3 rounded-sm bg-primary cursor-se-resize border border-background"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel — Properties */}
          <div className="w-64 border-l border-border bg-card overflow-y-auto p-3">
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Properties</p>
                  <div className="flex gap-0.5">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveLayer(selected.id, "up")} title="Move Up">
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveLayer(selected.id, "down")} title="Move Down">
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => duplicateElement(selected.id)} title="Duplicate (Ctrl+D)">
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteElement(selected.id)} title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <Label className="text-[10px]">Content</Label>
                  <Textarea
                    value={selected.content}
                    onChange={(e) => updateElement(selected.id, { content: e.target.value })}
                    rows={2}
                    className="text-xs mt-0.5"
                  />
                </div>

                {/* Position & Size */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[10px]">X</Label>
                    <Input type="number" value={Math.round(selected.x)} onChange={(e) => updateElement(selected.id, { x: +e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Y</Label>
                    <Input type="number" value={Math.round(selected.y)} onChange={(e) => updateElement(selected.id, { y: +e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Width</Label>
                    <Input type="number" value={Math.round(selected.width)} onChange={(e) => updateElement(selected.id, { width: +e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Height</Label>
                    <Input type="number" value={Math.round(selected.height)} onChange={(e) => updateElement(selected.id, { height: +e.target.value })} className="h-7 text-xs" />
                  </div>
                </div>

                {/* Typography */}
                {selected.type === "text" && (
                  <>
                    <div>
                      <Label className="text-[10px]">Font Family</Label>
                      <Select value={selected.fontFamily} onValueChange={(v) => updateElement(selected.id, { fontFamily: v })}>
                        <SelectTrigger className="h-7 text-xs mt-0.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_FAMILIES.map((f) => (
                            <SelectItem key={f} value={f} className="text-xs" style={{ fontFamily: f }}>{f.split(",")[0].replace(/'/g, "")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <Label className="text-[10px]">Font Size</Label>
                        <Input type="number" value={selected.fontSize} onChange={(e) => updateElement(selected.id, { fontSize: +e.target.value })} className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Weight</Label>
                        <Select value={selected.fontWeight} onValueChange={(v) => updateElement(selected.id, { fontWeight: v })}>
                          <SelectTrigger className="h-7 text-xs mt-0.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["300", "400", "500", "600", "700", "800", "900"].map((w) => (
                              <SelectItem key={w} value={w} className="text-xs">{w}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant={selected.fontStyle === "italic" ? "default" : "outline"} className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })}>
                        <Italic className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant={selected.textDecoration === "underline" ? "default" : "outline"} className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { textDecoration: selected.textDecoration === "underline" ? "none" : "underline" })}>
                        <Underline className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant={selected.textAlign === "left" ? "default" : "outline"} className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { textAlign: "left" })}>
                        <AlignLeft className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant={selected.textAlign === "center" ? "default" : "outline"} className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { textAlign: "center" })}>
                        <AlignCenter className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant={selected.textAlign === "right" ? "default" : "outline"} className="h-7 w-7 p-0" onClick={() => updateElement(selected.id, { textAlign: "right" })}>
                        <AlignRight className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <Label className="text-[10px]">Letter Spacing</Label>
                        <Input type="number" value={selected.letterSpacing} onChange={(e) => updateElement(selected.id, { letterSpacing: +e.target.value })} className="h-7 text-xs" step={0.5} />
                      </div>
                      <div>
                        <Label className="text-[10px]">Line Height</Label>
                        <Input type="number" value={selected.lineHeight} onChange={(e) => updateElement(selected.id, { lineHeight: +e.target.value })} className="h-7 text-xs" step={0.1} />
                      </div>
                    </div>
                  </>
                )}

                {/* Colors */}
                <div>
                  <Label className="text-[10px]">Text Color</Label>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {PRESET_COLORS.slice(0, 10).map((c) => (
                      <button key={c} className={`h-5 w-5 rounded border hover:scale-110 transition-transform ${selected.color === c ? "ring-2 ring-primary" : "border-border"}`} style={{ backgroundColor: c }} onClick={() => updateElement(selected.id, { color: c })} />
                    ))}
                    <Input type="color" value={selected.color} onChange={(e) => updateElement(selected.id, { color: e.target.value })} className="h-5 w-8 p-0 border-0" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Background Color</Label>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    <button className={`h-5 w-5 rounded border text-[8px] flex items-center justify-center ${selected.backgroundColor === "transparent" ? "ring-2 ring-primary" : "border-border"}`} onClick={() => updateElement(selected.id, { backgroundColor: "transparent" })}>✕</button>
                    {PRESET_COLORS.slice(0, 9).map((c) => (
                      <button key={c} className={`h-5 w-5 rounded border hover:scale-110 transition-transform ${selected.backgroundColor === c ? "ring-2 ring-primary" : "border-border"}`} style={{ backgroundColor: c }} onClick={() => updateElement(selected.id, { backgroundColor: c })} />
                    ))}
                    <Input type="color" value={selected.backgroundColor === "transparent" ? "#ffffff" : selected.backgroundColor} onChange={(e) => updateElement(selected.id, { backgroundColor: e.target.value })} className="h-5 w-8 p-0 border-0" />
                  </div>
                </div>

                {/* Border */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[10px]">Border Radius</Label>
                    <Input type="number" value={selected.borderRadius} onChange={(e) => updateElement(selected.id, { borderRadius: +e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Border Width</Label>
                    <Input type="number" value={selected.borderWidth} onChange={(e) => updateElement(selected.id, { borderWidth: +e.target.value })} className="h-7 text-xs" />
                  </div>
                </div>
                {selected.borderWidth > 0 && (
                  <div>
                    <Label className="text-[10px]">Border Color</Label>
                    <Input type="color" value={selected.borderColor} onChange={(e) => updateElement(selected.id, { borderColor: e.target.value })} className="h-7 w-full" />
                  </div>
                )}

                {/* Opacity & Rotation */}
                <div>
                  <Label className="text-[10px]">Opacity ({Math.round(selected.opacity * 100)}%)</Label>
                  <Slider value={[selected.opacity * 100]} onValueChange={([v]) => updateElement(selected.id, { opacity: v / 100 })} min={0} max={100} step={5} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[10px]">Rotation ({selected.rotation}°)</Label>
                  <Slider value={[selected.rotation]} onValueChange={([v]) => updateElement(selected.id, { rotation: v })} min={-180} max={180} step={1} className="mt-1" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MousePointer className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs text-center">Select an element on the canvas to edit its properties</p>
                <p className="text-[10px] mt-2 text-center opacity-60">
                  Tip: Use arrow keys to nudge, Delete to remove, Ctrl+D to duplicate
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminFlyerEditor;
