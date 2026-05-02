import AdminSidebar from "@/components/AdminSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Award, Search, Pause, Play, Trash2, Eye, DollarSign, Plus, Upload,
  Type, Square, Circle, Move, MousePointer, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, Copy, Layers, ChevronUp, ChevronDown,
  Save, ArrowLeft, Image as ImageIcon, GripVertical
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { uploadImage } from "@/lib/imageUpload";
import { certificateTemplates, type CertificateTemplate } from "@/lib/certificateTemplates";
import AdminCertificateCreditsManager from "@/components/AdminCertificateCreditsManager";

/* ─── Canvas Element Types (matching flyer editor) ─── */
interface CanvasElement {
  id: string;
  type: "text" | "shape" | "image";
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
  shapeType?: "rect" | "circle" | "line";
}

const CANVAS_W = 594; // A4 landscape (wider)
const CANVAS_H = 420;

const FONT_FAMILIES = [
  "'Georgia', 'Times New Roman', serif",
  "'Helvetica Neue', Arial, sans-serif",
  "'Palatino', serif",
  "'Courier New', monospace",
  "'Trebuchet MS', sans-serif",
  "'Verdana', sans-serif",
  "'Impact', sans-serif",
  "'Arial Black', sans-serif",
];

const PRESET_COLORS = [
  "#2D2A26", "#8B7355", "#C9B88C", "#FFFDF7", "#D4AF37",
  "#0F1729", "#0D3B2E", "#4A0E2B", "#1A0A2E", "#0A0A0A",
  "#DC2626", "#EA580C", "#F59E0B", "#22C55E", "#0EA5E9",
  "#6366F1", "#A855F7", "#EC4899", "#FFFFFF", "#000000",
];

let idCounter = 0;
const genId = () => `el_${Date.now()}_${++idCounter}`;

const defaultElement = (): Partial<CanvasElement> => ({
  fontSize: 16, fontWeight: "400", fontStyle: "normal", textDecoration: "none",
  textAlign: "left", fontFamily: FONT_FAMILIES[0], color: "#2D2A26",
  backgroundColor: "transparent", borderRadius: 0, borderWidth: 0,
  borderColor: "#000000", opacity: 1, rotation: 0, letterSpacing: 0,
  lineHeight: 1.3, zIndex: 1,
});

/* ─── Build elements from a built-in template ─── */
const buildTemplateElements = (tpl: CertificateTemplate): CanvasElement[] => {
  const els: CanvasElement[] = [];
  const add = (partial: Partial<CanvasElement>) => {
    els.push({ ...defaultElement(), id: genId(), type: "text", x: 0, y: 0, width: 200, height: 40, content: "", zIndex: els.length + 1, ...partial } as CanvasElement);
  };

  // Decorative top border strip
  add({ type: "shape", x: 0, y: 0, width: CANVAS_W, height: 6, backgroundColor: tpl.borderColor, shapeType: "rect", content: "" });
  // Bottom border strip
  add({ type: "shape", x: 0, y: CANVAS_H - 6, width: CANVAS_W, height: 6, backgroundColor: tpl.borderColor, shapeType: "rect", content: "" });
  // Left accent line
  add({ type: "shape", x: 16, y: 16, width: 3, height: CANVAS_H - 32, backgroundColor: tpl.borderColor, shapeType: "rect", content: "" });
  // Right accent line
  add({ type: "shape", x: CANVAS_W - 19, y: 16, width: 3, height: CANVAS_H - 32, backgroundColor: tpl.borderColor, shapeType: "rect", content: "" });

  // Title
  add({ type: "text", x: CANVAS_W / 2 - 220, y: 30, width: 440, height: 40, content: "CERTIFICATE OF PET REGISTRATION", fontSize: 26, fontWeight: "700", color: tpl.headerColor, textAlign: "center", letterSpacing: 3, fontFamily: tpl.fontFamily });
  // Subtitle
  add({ type: "text", x: CANVAS_W / 2 - 160, y: 72, width: 320, height: 24, content: "Official Document — Pets Registry", fontSize: 11, fontWeight: "400", color: tpl.accentColor, textAlign: "center", letterSpacing: 2, fontFamily: tpl.fontFamily });
  // Divider
  add({ type: "shape", x: CANVAS_W / 2 - 100, y: 100, width: 200, height: 2, backgroundColor: tpl.borderColor, shapeType: "rect", content: "" });

  // Pet Details Header
  add({ type: "text", x: 50, y: 120, width: 200, height: 20, content: "PET DETAILS", fontSize: 10, fontWeight: "600", color: tpl.accentColor, letterSpacing: 2, fontFamily: tpl.fontFamily });
  // Pet fields
  const petFields = [
    { label: "Name: {{pet_name}}", y: 148 },
    { label: "Species: {{species}}", y: 170 },
    { label: "Breed: {{breed}}", y: 192 },
    { label: "Color: {{color}}", y: 214 },
    { label: "Pet Code: {{pet_code}}", y: 236 },
    { label: "Microchip: {{microchip}}", y: 258 },
  ];
  petFields.forEach((f) => {
    add({ type: "text", x: 50, y: f.y, width: 220, height: 20, content: f.label, fontSize: 12, fontWeight: "400", color: tpl.textColor, fontFamily: tpl.fontFamily });
  });

  // Owner Details Header
  add({ type: "text", x: 330, y: 120, width: 200, height: 20, content: "OWNER INFORMATION", fontSize: 10, fontWeight: "600", color: tpl.accentColor, letterSpacing: 2, fontFamily: tpl.fontFamily });
  // Owner fields
  add({ type: "text", x: 330, y: 148, width: 220, height: 20, content: "Owner: {{owner_name}}", fontSize: 12, fontWeight: "400", color: tpl.textColor, fontFamily: tpl.fontFamily });
  add({ type: "text", x: 330, y: 170, width: 220, height: 20, content: "Email: {{owner_email}}", fontSize: 12, fontWeight: "400", color: tpl.textColor, fontFamily: tpl.fontFamily });
  add({ type: "text", x: 330, y: 200, width: 220, height: 20, content: "Date: {{date_issued}}", fontSize: 12, fontWeight: "400", color: tpl.textColor, fontFamily: tpl.fontFamily });

  // Pet Photo placeholder
  add({ type: "shape", x: 380, y: 240, width: 100, height: 100, backgroundColor: tpl.borderColor + "22", borderRadius: 8, borderWidth: 1, borderColor: tpl.borderColor, shapeType: "rect", content: "📷 Pet Photo" });

  // Signature
  add({ type: "text", x: CANVAS_W / 2 - 120, y: 340, width: 240, height: 20, content: "___________________________", fontSize: 12, fontWeight: "400", color: tpl.textColor, textAlign: "center", fontFamily: tpl.fontFamily });
  add({ type: "text", x: CANVAS_W / 2 - 80, y: 362, width: 160, height: 16, content: "Authorized Signature", fontSize: 9, fontWeight: "400", color: tpl.accentColor, textAlign: "center", letterSpacing: 2, fontFamily: tpl.fontFamily });

  // Footer
  add({ type: "text", x: CANVAS_W / 2 - 140, y: 390, width: 280, height: 16, content: "PETS REGISTRY — OFFICIAL DOCUMENT", fontSize: 8, fontWeight: "400", color: tpl.accentColor, textAlign: "center", letterSpacing: 3, fontFamily: tpl.fontFamily });

  return els;
};

/* ─── Quick add certificate elements ─── */
const CERT_QUICK_ELEMENTS = [
  { label: "Title", type: "text" as const, preset: { content: "CERTIFICATE OF PET REGISTRATION", fontSize: 26, fontWeight: "700", color: "#2D2A26", letterSpacing: 3, textAlign: "center", width: 440, height: 40 } },
  { label: "Subtitle", type: "text" as const, preset: { content: "Official Document", fontSize: 12, fontWeight: "400", color: "#8B7355", letterSpacing: 2, textAlign: "center", width: 300, height: 24 } },
  { label: "Pet Name", type: "text" as const, preset: { content: "Name: {{pet_name}}", fontSize: 13, fontWeight: "400", color: "#2D2A26", width: 220, height: 22 } },
  { label: "Species", type: "text" as const, preset: { content: "Species: {{species}}", fontSize: 13, fontWeight: "400", color: "#2D2A26", width: 220, height: 22 } },
  { label: "Breed", type: "text" as const, preset: { content: "Breed: {{breed}}", fontSize: 13, fontWeight: "400", color: "#2D2A26", width: 220, height: 22 } },
  { label: "Color", type: "text" as const, preset: { content: "Color: {{color}}", fontSize: 13, fontWeight: "400", color: "#2D2A26", width: 220, height: 22 } },
  { label: "Pet Code", type: "text" as const, preset: { content: "Pet Code: {{pet_code}}", fontSize: 13, fontWeight: "400", color: "#2D2A26", width: 220, height: 22 } },
  { label: "Microchip", type: "text" as const, preset: { content: "Microchip: {{microchip}}", fontSize: 13, fontWeight: "400", color: "#2D2A26", width: 220, height: 22 } },
  { label: "Owner", type: "text" as const, preset: { content: "Owner: {{owner_name}}", fontSize: 13, fontWeight: "400", color: "#2D2A26", width: 220, height: 22 } },
  { label: "Email", type: "text" as const, preset: { content: "Email: {{owner_email}}", fontSize: 13, fontWeight: "400", color: "#2D2A26", width: 220, height: 22 } },
  { label: "Date", type: "text" as const, preset: { content: "Date: {{date_issued}}", fontSize: 13, fontWeight: "400", color: "#2D2A26", width: 220, height: 22 } },
  { label: "Section Header", type: "text" as const, preset: { content: "PET DETAILS", fontSize: 10, fontWeight: "600", color: "#8B7355", letterSpacing: 2, width: 200, height: 20 } },
  { label: "Signature Line", type: "text" as const, preset: { content: "___________________________", fontSize: 12, fontWeight: "400", color: "#2D2A26", textAlign: "center", width: 240, height: 20 } },
  { label: "Footer", type: "text" as const, preset: { content: "PETS REGISTRY — OFFICIAL DOCUMENT", fontSize: 8, fontWeight: "400", color: "#8B7355", letterSpacing: 3, textAlign: "center", width: 300, height: 16 } },
  { label: "Photo Area", type: "shape" as const, preset: { shapeType: "rect" as const, backgroundColor: "#F3F4F6", width: 120, height: 120, borderRadius: 8, borderWidth: 1, borderColor: "#C9B88C", content: "📷 Pet Photo" } },
  { label: "Divider", type: "shape" as const, preset: { shapeType: "rect" as const, backgroundColor: "#C9B88C", width: 200, height: 2, content: "" } },
  { label: "Top Banner", type: "shape" as const, preset: { shapeType: "rect" as const, backgroundColor: "#C9B88C", width: CANVAS_W, height: 6, content: "" } },
  { label: "Accent Block", type: "shape" as const, preset: { shapeType: "rect" as const, backgroundColor: "#8B7355", width: 3, height: 300, content: "" } },
];

/* ─── Main Admin Page ─── */
const AdminCertificates = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [viewCert, setViewCert] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("certificates");

  // Full canvas editor state (matching flyer editor)
  const canvasRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [canvasBg, setCanvasBg] = useState("#FFFDF7");
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplBgUrl, setTplBgUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = elements.find((e) => e.id === selectedId) || null;

  // Queries
  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["admin-certificates"],
    queryFn: async () => {
      const { data } = await supabase.from("pet_certificates").select("*, pets(name, species, breed, pet_code)").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: templates = [], isLoading: tplLoading } = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("certificate_templates").select("*").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const userIds = [...new Set(certificates.map((c: any) => c.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-cert-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const { data: feeSetting } = useQuery({
    queryKey: ["certificate-fee"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "certificate_fee").maybeSingle();
      return data?.value || "20";
    },
  });

  const [editFee, setEditFee] = useState("");
  const [showFeeDialog, setShowFeeDialog] = useState(false);
  const profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p]));

  const filtered = certificates.filter((c: any) => {
    const pet = c.pets || {};
    const owner = profileMap[c.user_id] || {};
    const q = search.toLowerCase();
    return !q || pet.name?.toLowerCase().includes(q) || owner.full_name?.toLowerCase().includes(q) || owner.email?.toLowerCase().includes(q) || pet.pet_code?.toLowerCase().includes(q);
  });

  const togglePause = async (cert: any) => {
    const { error } = await supabase.from("pet_certificates").update({ is_paused: !cert.is_paused }).eq("id", cert.id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["admin-certificates"] });
    toast.success(cert.is_paused ? "Certificate resumed" : "Certificate paused");
  };

  const deleteCert = async (id: string) => {
    if (!confirm("Delete this certificate permanently?")) return;
    const { error } = await supabase.from("pet_certificates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["admin-certificates"] });
    toast.success("Certificate deleted");
  };

  const saveFee = async () => {
    const { error } = await supabase.from("site_settings").update({ value: editFee }).eq("key", "certificate_fee");
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["certificate-fee"] });
    setShowFeeDialog(false);
    toast.success("Fee updated to $" + editFee);
  };

  /* ─── Canvas Editor Logic ─── */
  const addElement = useCallback((type: string, preset?: Partial<CanvasElement>) => {
    const el: CanvasElement = {
      id: genId(), type: type as any,
      x: 20 + Math.random() * 40, y: 20 + elements.length * 20,
      width: 200, height: 40, content: type === "text" ? "New Text" : "",
      ...defaultElement(), zIndex: elements.length + 1, ...preset,
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
        const tmp = sorted[idx].zIndex; sorted[idx].zIndex = sorted[idx + 1].zIndex; sorted[idx + 1].zIndex = tmp;
      } else if (dir === "down" && idx > 0) {
        const tmp = sorted[idx].zIndex; sorted[idx].zIndex = sorted[idx - 1].zIndex; sorted[idx - 1].zIndex = tmp;
      }
      return sorted;
    });
  }, []);

  // Drag & resize
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) setSelectedId(null);
  }, []);

  const handleElementMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    const el = elements.find((x) => x.id === id);
    if (!el || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = rect.width / CANVAS_W;
    setDragging({ id, offsetX: (e.clientX - rect.left) / scale - el.x, offsetY: (e.clientY - rect.top) / scale - el.y });
  }, [elements]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const el = elements.find((x) => x.id === id);
    if (!el) return;
    setResizing({ id, startX: e.clientX, startY: e.clientY, startW: el.width, startH: el.height });
  }, [elements]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const scale = rect.width / CANVAS_W;
        updateElement(dragging.id, {
          x: Math.max(0, Math.min(CANVAS_W - 20, (e.clientX - rect.left) / scale - dragging.offsetX)),
          y: Math.max(0, Math.min(CANVAS_H - 20, (e.clientY - rect.top) / scale - dragging.offsetY)),
        });
      }
      if (resizing && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const scale = rect.width / CANVAS_W;
        updateElement(resizing.id, {
          width: Math.max(30, resizing.startW + (e.clientX - resizing.startX) / scale),
          height: Math.max(20, resizing.startH + (e.clientY - resizing.startY) / scale),
        });
      }
    };
    const handleMouseUp = () => { setDragging(null); setResizing(null); };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [dragging, resizing, updateElement]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if ((e.key === "Delete" || e.key === "Backspace") && !["INPUT", "TEXTAREA"].includes((document.activeElement?.tagName || ""))) deleteElement(selectedId);
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); duplicateElement(selectedId); }
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

  /* ─── Template CRUD ─── */
  const openNewFromBuiltIn = (tpl: CertificateTemplate) => {
    setEditingTemplate("new");
    setTplName(tpl.name);
    setTplDesc(tpl.description);
    setCanvasBg(tpl.bgColor);
    setTplBgUrl("");
    setElements(buildTemplateElements(tpl));
    setSelectedId(null);
  };

  const openNewBlank = () => {
    setEditingTemplate("new");
    setTplName("New Template");
    setTplDesc("");
    setCanvasBg("#FFFDF7");
    setTplBgUrl("");
    setElements([]);
    setSelectedId(null);
  };

  const openEditTemplate = (tpl: any) => {
    setEditingTemplate(tpl);
    setTplName(tpl.name);
    setTplDesc(tpl.description || "");
    const colors = tpl.colors as any || {};
    setCanvasBg(colors.bg || "#FFFDF7");
    setTplBgUrl(tpl.background_url || "");
    // Load elements from stored fields or build from stored data
    const storedElements = (tpl.fields as any[]) || [];
    if (storedElements.length > 0 && storedElements[0]?.type && storedElements[0]?.width) {
      // New format: full canvas elements
      setElements(storedElements as CanvasElement[]);
    } else {
      // Legacy format: old CertField format — convert to default
      setElements(buildTemplateElements(certificateTemplates[0]));
    }
    setSelectedId(null);
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "certificate-backgrounds", "templates");
      setTplBgUrl(url);
      toast.success("Background uploaded");
    } catch (err: any) { toast.error(err.message); } finally { setUploading(false); }
  };

  const saveTemplate = async () => {
    if (!tplName.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const payload = {
        name: tplName.trim(),
        description: tplDesc.trim() || null,
        background_url: tplBgUrl || null,
        fields: elements as unknown as any,
        colors: { bg: canvasBg } as any,
      };
      if (editingTemplate === "new") {
        const { error } = await supabase.from("certificate_templates").insert(payload);
        if (error) throw error;
        toast.success("Template created!");
      } else {
        const { error } = await supabase.from("certificate_templates").update(payload).eq("id", editingTemplate.id);
        if (error) throw error;
        toast.success("Template updated!");
      }
      queryClient.invalidateQueries({ queryKey: ["certificate-templates"] });
      setEditingTemplate(null);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("certificate_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["certificate-templates"] });
    toast.success("Template deleted");
  };

  const toggleTemplateActive = async (tpl: any) => {
    const { error } = await supabase.from("certificate_templates").update({ is_active: !tpl.is_active }).eq("id", tpl.id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["certificate-templates"] });
  };

  const stats = {
    total: certificates.length,
    paid: certificates.filter((c: any) => c.is_paid).length,
    paused: certificates.filter((c: any) => c.is_paused).length,
    revenue: certificates.filter((c: any) => c.is_paid).length * parseFloat(feeSetting || "20"),
  };

  /* ─── RENDER ─── */
  // If editing a template — show full canvas editor
  if (editingTemplate) {
    return (
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 bg-background flex flex-col overflow-hidden">
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card">
            <div className="flex items-center gap-3">
              <Button size="sm" variant="ghost" onClick={() => setEditingTemplate(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Input value={tplName} onChange={(e) => setTplName(e.target.value)} className="h-8 w-60 text-sm font-semibold" placeholder="Template name" />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{elements.length} elements</Badge>
              <Button size="sm" onClick={saveTemplate} disabled={saving} className="gap-1">
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Panel */}
            <div className="w-56 border-r border-border bg-card overflow-y-auto p-3 space-y-3">
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Quick Add Elements</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {CERT_QUICK_ELEMENTS.map((qe) => (
                    <button key={qe.label} onClick={() => addElement(qe.type, qe.preset)}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left">
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
                  <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-xs" onClick={() => addElement("shape", { shapeType: "rect", backgroundColor: "#C9B88C", width: 200, height: 50 })}>
                    <Square className="h-3 w-3" /> Rectangle
                  </Button>
                  <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-xs" onClick={() => addElement("shape", { shapeType: "circle", backgroundColor: "#8B7355", width: 100, height: 100, borderRadius: 50 })}>
                    <Circle className="h-3 w-3" /> Circle
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Background</p>
                <div className="grid grid-cols-5 gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} className={`h-6 w-6 rounded border transition-transform hover:scale-110 ${canvasBg === c ? "ring-2 ring-primary" : "border-border"}`}
                      style={{ backgroundColor: c }} onClick={() => setCanvasBg(c)} />
                  ))}
                </div>
                <Input type="color" value={canvasBg} onChange={(e) => setCanvasBg(e.target.value)} className="mt-1 h-7 w-full" />
                <label className="flex items-center gap-2 text-xs border rounded-md px-3 py-2 cursor-pointer hover:bg-muted transition-colors mt-2">
                  <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading..." : tplBgUrl ? "Change BG Image" : "Upload BG Image"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} disabled={uploading} />
                </label>
                {tplBgUrl && <div className="mt-1 flex items-center gap-1"><img src={tplBgUrl} alt="" className="h-10 rounded border" /><Button variant="ghost" size="sm" className="text-xs" onClick={() => setTplBgUrl("")}>✕</Button></div>}
              </div>

              {/* Layers */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1"><Layers className="h-3 w-3" /> Layers</p>
                <div className="space-y-0.5 max-h-40 overflow-y-auto">
                  {[...elements].sort((a, b) => b.zIndex - a.zIndex).map((el) => (
                    <button key={el.id} onClick={() => setSelectedId(el.id)}
                      className={`w-full text-left px-2 py-1 rounded text-[10px] truncate flex items-center gap-1 ${selectedId === el.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"}`}>
                      {el.type === "text" ? <Type className="h-2.5 w-2.5 shrink-0" /> : <Square className="h-2.5 w-2.5 shrink-0" />}
                      <span className="truncate">{el.content || el.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-auto flex items-start justify-center p-6 bg-muted/30">
              <div ref={canvasRef} onMouseDown={handleCanvasMouseDown}
                className="relative shadow-xl border border-border"
                style={{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px`, background: tplBgUrl ? `url(${tplBgUrl}) center/cover no-repeat` : canvasBg, cursor: dragging ? "grabbing" : "default" }}>
                {[...elements].sort((a, b) => a.zIndex - b.zIndex).map((el) => (
                  <div key={el.id} onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                    className={`absolute ${selectedId === el.id ? "ring-2 ring-primary" : ""}`}
                    style={{ left: el.x, top: el.y, width: el.width, height: el.height, opacity: el.opacity, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, zIndex: el.zIndex, cursor: "grab" }}>
                    {el.type === "text" ? (
                      <div style={{ fontSize: el.fontSize, fontWeight: el.fontWeight, fontStyle: el.fontStyle, textDecoration: el.textDecoration, textAlign: el.textAlign as any, fontFamily: el.fontFamily, color: el.color, backgroundColor: el.backgroundColor, borderRadius: el.borderRadius, letterSpacing: el.letterSpacing, lineHeight: el.lineHeight, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: el.textAlign === "center" ? "center" : el.textAlign === "right" ? "flex-end" : "flex-start", padding: "0 4px", overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {el.content}
                      </div>
                    ) : (
                      <div style={{ width: "100%", height: "100%", backgroundColor: el.backgroundColor, borderRadius: el.borderRadius, borderWidth: el.borderWidth, borderColor: el.borderColor, borderStyle: el.borderWidth ? "solid" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#999" }}>
                        {el.content}
                      </div>
                    )}
                    {selectedId === el.id && (
                      <div onMouseDown={(e) => handleResizeMouseDown(e, el.id)} className="absolute -bottom-1.5 -right-1.5 h-3 w-3 bg-primary rounded-sm cursor-se-resize border border-background" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel — Properties */}
            <div className="w-64 border-l border-border bg-card overflow-y-auto p-3 space-y-3">
              {selected ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Properties</p>
                    <div className="flex gap-0.5">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveLayer(selected.id, "up")}><ChevronUp className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveLayer(selected.id, "down")}><ChevronDown className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => duplicateElement(selected.id)}><Copy className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteElement(selected.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>

                  {selected.type === "text" && (
                    <>
                      <div><Label className="text-xs">Text</Label><Textarea value={selected.content} onChange={(e) => updateElement(selected.id, { content: e.target.value })} rows={3} className="mt-1 text-xs" /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Font Size</Label><Input type="number" min={6} max={72} value={selected.fontSize} onChange={(e) => updateElement(selected.id, { fontSize: parseInt(e.target.value) || 12 })} className="mt-1" /></div>
                        <div><Label className="text-xs">Weight</Label>
                          <Select value={selected.fontWeight} onValueChange={(v) => updateElement(selected.id, { fontWeight: v })}>
                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="400">Normal</SelectItem>
                              <SelectItem value="600">Semi-bold</SelectItem>
                              <SelectItem value="700">Bold</SelectItem>
                              <SelectItem value="900">Black</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div><Label className="text-xs">Font</Label>
                        <Select value={selected.fontFamily} onValueChange={(v) => updateElement(selected.id, { fontFamily: v })}>
                          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{FONT_FAMILIES.map((f) => <SelectItem key={f} value={f}>{f.split(",")[0].replace(/'/g, "")}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant={selected.textAlign === "left" ? "default" : "outline"} className="h-7 w-7" onClick={() => updateElement(selected.id, { textAlign: "left" })}><AlignLeft className="h-3 w-3" /></Button>
                        <Button size="icon" variant={selected.textAlign === "center" ? "default" : "outline"} className="h-7 w-7" onClick={() => updateElement(selected.id, { textAlign: "center" })}><AlignCenter className="h-3 w-3" /></Button>
                        <Button size="icon" variant={selected.textAlign === "right" ? "default" : "outline"} className="h-7 w-7" onClick={() => updateElement(selected.id, { textAlign: "right" })}><AlignRight className="h-3 w-3" /></Button>
                        <Button size="icon" variant={selected.fontWeight === "700" ? "default" : "outline"} className="h-7 w-7" onClick={() => updateElement(selected.id, { fontWeight: selected.fontWeight === "700" ? "400" : "700" })}><Bold className="h-3 w-3" /></Button>
                        <Button size="icon" variant={selected.fontStyle === "italic" ? "default" : "outline"} className="h-7 w-7" onClick={() => updateElement(selected.id, { fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })}><Italic className="h-3 w-3" /></Button>
                      </div>
                      <div><Label className="text-xs">Letter Spacing</Label><Slider min={0} max={10} step={0.5} value={[selected.letterSpacing]} onValueChange={([v]) => updateElement(selected.id, { letterSpacing: v })} className="mt-1" /></div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Color</Label><input type="color" value={selected.color} onChange={(e) => updateElement(selected.id, { color: e.target.value })} className="block h-7 w-full rounded border cursor-pointer mt-1" /></div>
                    <div><Label className="text-xs">BG Color</Label><input type="color" value={selected.backgroundColor === "transparent" ? "#ffffff" : selected.backgroundColor} onChange={(e) => updateElement(selected.id, { backgroundColor: e.target.value })} className="block h-7 w-full rounded border cursor-pointer mt-1" /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Width</Label><Input type="number" value={Math.round(selected.width)} onChange={(e) => updateElement(selected.id, { width: parseInt(e.target.value) || 50 })} className="mt-1" /></div>
                    <div><Label className="text-xs">Height</Label><Input type="number" value={Math.round(selected.height)} onChange={(e) => updateElement(selected.id, { height: parseInt(e.target.value) || 20 })} className="mt-1" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">X</Label><Input type="number" value={Math.round(selected.x)} onChange={(e) => updateElement(selected.id, { x: parseInt(e.target.value) || 0 })} className="mt-1" /></div>
                    <div><Label className="text-xs">Y</Label><Input type="number" value={Math.round(selected.y)} onChange={(e) => updateElement(selected.id, { y: parseInt(e.target.value) || 0 })} className="mt-1" /></div>
                  </div>
                  <div><Label className="text-xs">Border Radius</Label><Slider min={0} max={50} value={[selected.borderRadius]} onValueChange={([v]) => updateElement(selected.id, { borderRadius: v })} className="mt-1" /></div>
                  <div><Label className="text-xs">Opacity</Label><Slider min={0} max={1} step={0.05} value={[selected.opacity]} onValueChange={([v]) => updateElement(selected.id, { opacity: v })} className="mt-1" /></div>

                  <div className="grid grid-cols-5 gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} className="h-5 w-5 rounded border border-border hover:scale-110 transition-transform" style={{ backgroundColor: c }}
                        onClick={() => updateElement(selected.id, { color: c })} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center text-xs text-muted-foreground py-8">
                  <MousePointer className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  Click an element to edit its properties
                </div>
              )}

              <div className="pt-3 border-t">
                <Label className="text-xs">Template Description</Label>
                <Textarea value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} rows={2} className="mt-1 text-xs" placeholder="Optional description..." />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ─── Normal view (certificates list + template gallery) ─── */
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" /> Pet Certificates
          </h1>
          <Button variant="outline" className="gap-2" onClick={() => { setEditFee(feeSetting || "20"); setShowFeeDialog(true); }}>
            <DollarSign className="h-4 w-4" /> Fee: ${feeSetting || "20"}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="certificates">Member Certificates</TabsTrigger>
            <TabsTrigger value="credits">Member Credits</TabsTrigger>
            <TabsTrigger value="templates">Template Designer</TabsTrigger>
          </TabsList>

          <TabsContent value="credits">
            <AdminCertificateCreditsManager />
          </TabsContent>

          {/* ─── Certificates Tab ─── */}
          <TabsContent value="certificates">
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[{ label: "Total", value: stats.total }, { label: "Paid", value: stats.paid }, { label: "Paused", value: stats.paused }, { label: "Revenue", value: `$${stats.revenue.toFixed(2)}` }].map((s) => (
                <Card key={s.label}><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-foreground">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
              ))}
            </div>
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by pet, owner..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Pet</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No certificates found</TableCell></TableRow>
                    ) : filtered.map((cert: any) => {
                      const pet = cert.pets || {};
                      const owner = profileMap[cert.user_id] || {};
                      return (
                        <TableRow key={cert.id}>
                          <TableCell><div className="font-medium">{pet.name}</div><div className="text-xs text-muted-foreground">{pet.species} • {pet.pet_code}</div></TableCell>
                          <TableCell><div>{owner.full_name || "—"}</div><div className="text-xs text-muted-foreground">{owner.email}</div></TableCell>
                          <TableCell><div className="flex gap-1">{cert.is_paused && <Badge variant="secondary">Paused</Badge>}{cert.is_paid ? <Badge className="bg-green-600 text-white">Paid</Badge> : <Badge variant="outline">Draft</Badge>}</div></TableCell>
                          <TableCell className="text-sm">{new Date(cert.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={() => setViewCert(cert)} title="View"><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => togglePause(cert)} title={cert.is_paused ? "Resume" : "Pause"}>
                                {cert.is_paused ? <Play className="h-4 w-4 text-green-600" /> : <Pause className="h-4 w-4 text-amber-600" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteCert(cert.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Templates Tab ─── */}
          <TabsContent value="templates">
            <div className="space-y-6">
              {/* Saved Templates */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-foreground">Saved Templates ({templates.length})</h2>
                  <Button onClick={openNewBlank} className="gap-2"><Plus className="h-4 w-4" /> Blank Template</Button>
                </div>
                {tplLoading ? (
                  <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
                ) : templates.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No saved templates yet. Choose one from the starter templates below to get started.</CardContent></Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((tpl: any) => (
                      <Card key={tpl.id} className={!tpl.is_active ? "opacity-60" : ""}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div><div className="font-semibold text-foreground">{tpl.name}</div>{tpl.description && <div className="text-xs text-muted-foreground mt-0.5">{tpl.description}</div>}</div>
                            <Badge variant={tpl.is_active ? "default" : "secondary"}>{tpl.is_active ? "Active" : "Inactive"}</Badge>
                          </div>
                          {/* Mini preview */}
                          <div className="border rounded mb-3 overflow-hidden" style={{ aspectRatio: "297/210", backgroundColor: (tpl.colors as any)?.bg || "#FFFDF7" }}>
                            {tpl.background_url && <img src={tpl.background_url} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditTemplate(tpl)}>Edit</Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleTemplateActive(tpl)}>
                              {tpl.is_active ? <Pause className="h-4 w-4 text-amber-600" /> : <Play className="h-4 w-4 text-green-600" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteTemplate(tpl.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Built-in Starter Templates */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Starter Templates ({certificateTemplates.length})</h2>
                <p className="text-sm text-muted-foreground mb-4">Click any template to open it in the editor. Customize and save as your own.</p>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {certificateTemplates.map((tpl) => (
                    <button key={tpl.id} onClick={() => openNewFromBuiltIn(tpl)}
                      className="group text-left rounded-xl border border-border overflow-hidden hover:ring-2 hover:ring-primary transition-all">
                      <div className="relative" style={{ aspectRatio: "297/210", backgroundColor: tpl.bgColor }}>
                        {/* Mini decorative preview */}
                        <div style={{ position: "absolute", inset: "6px", border: `2px solid ${tpl.borderColor}`, borderRadius: "4px", pointerEvents: "none" }} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                          <div style={{ color: tpl.headerColor, fontSize: "6px", fontWeight: "700", letterSpacing: "1px", fontFamily: tpl.fontFamily, textAlign: "center" }}>CERTIFICATE</div>
                          <div style={{ width: "40%", height: "1px", backgroundColor: tpl.borderColor, margin: "3px 0" }} />
                          <div style={{ color: tpl.accentColor, fontSize: "4px", letterSpacing: "0.5px", fontFamily: tpl.fontFamily }}>Pet Registration</div>
                        </div>
                      </div>
                      <div className="p-2 bg-card">
                        <div className="text-xs font-semibold text-foreground truncate">{tpl.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{tpl.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* View cert dialog */}
        <Dialog open={!!viewCert} onOpenChange={() => setViewCert(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Certificate Details</DialogTitle></DialogHeader>
            {viewCert && (
              <div className="space-y-3 text-sm">
                <div><strong>Pet:</strong> {viewCert.pets?.name} ({viewCert.pets?.species})</div>
                <div><strong>Pet Code:</strong> {viewCert.pets?.pet_code}</div>
                <div><strong>Owner:</strong> {profileMap[viewCert.user_id]?.full_name} ({profileMap[viewCert.user_id]?.email})</div>
                <div><strong>Paid:</strong> {viewCert.is_paid ? "Yes" : "No"}</div>
                <div><strong>Paused:</strong> {viewCert.is_paused ? "Yes" : "No"}</div>
                <div><strong>Created:</strong> {new Date(viewCert.created_at).toLocaleString()}</div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Fee dialog */}
        <Dialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Update Certificate Fee</DialogTitle></DialogHeader>
            <div className="flex items-center gap-2"><span className="text-lg font-bold">$</span><Input type="number" min="0" step="1" value={editFee} onChange={(e) => setEditFee(e.target.value)} /></div>
            <DialogFooter><Button variant="outline" onClick={() => setShowFeeDialog(false)}>Cancel</Button><Button onClick={saveFee}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminCertificates;
