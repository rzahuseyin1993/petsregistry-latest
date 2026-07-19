import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadRaw, uploadFile as uploadFileUtil, uploadImage } from "@/lib/imageUpload";
import { completeCheckout } from "@/lib/airwallexCheckout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileDown, Lock, Check, Eye, Upload, Trash2, Plus, Palette,
  Type, Square, Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Move, Copy, ChevronUp, ChevronDown, Layers, MousePointer, GripVertical,
  Wand2, Loader2, ImagePlus, Download
} from "lucide-react";
import { flyerTemplates, type FlyerTemplate } from "@/lib/flyerTemplates";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ─── Drag-and-drop Canvas Element ─── */
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
  textAlign: string;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  borderRadius: number;
  opacity: number;
  zIndex: number;
  letterSpacing: number;
  lineHeight: number;
  /** Auto-synced from Pet Info form — not repositioned on form edits */
  fieldKey?: string;
}

const CANVAS_W = 420;
const CANVAS_H = 594;

const FONT_FAMILIES = [
  "'Helvetica Neue', Arial, sans-serif",
  "'Georgia', 'Times New Roman', serif",
  "'Impact', sans-serif",
  "'Verdana', sans-serif",
  "'Courier New', monospace",
  "'Trebuchet MS', sans-serif",
];

let idCounter = 0;
const genId = () => `el_${Date.now()}_${++idCounter}`;

const defaultEl = (): Partial<CanvasElement> => ({
  fontSize: 14, fontWeight: "400", fontStyle: "normal",
  textAlign: "left", fontFamily: FONT_FAMILIES[0], color: "#1A1A1A",
  backgroundColor: "transparent", borderRadius: 0, opacity: 1,
  letterSpacing: 0, lineHeight: 1.3, zIndex: 1,
});

const formatRewardLabel = (amount: string) => {
  const trimmed = amount.trim();
  if (!trimmed) return "";
  if (/reward/i.test(trimmed)) return trimmed;
  if (/^\$/.test(trimmed)) return `${trimmed} REWARD`;
  return `$${trimmed} REWARD`;
};

const formatLostDateLabel = (date: string) => {
  if (!date) return "";
  try {
    return `Lost on ${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`;
  } catch {
    return `Lost on ${date}`;
  }
};

/* ─── Build elements from a FlyerTemplate ─── */
const buildFromTemplate = (t: FlyerTemplate, form: FormData): CanvasElement[] => {
  const els: CanvasElement[] = [];
  const add = (partial: Partial<CanvasElement>) => {
    els.push({ ...defaultEl(), id: genId(), type: "text", x: 0, y: 0, width: 200, height: 30, content: "", zIndex: els.length + 1, ...partial } as CanvasElement);
  };

  const rewardY = form.lostDate ? 458 : 438;
  const footerY = form.includeReward && form.reward.trim() ? 520 : form.lostDate || form.lastSeenAddress ? 500 : 480;

  // Header bar
  add({ fieldKey: "header-bg", type: "shape", x: 0, y: 0, width: CANVAS_W, height: 70, backgroundColor: t.headerColor, content: "" });
  add({ fieldKey: "header-title", type: "text", x: CANVAS_W / 2 - 130, y: 12, width: 260, height: 40, content: "MISSING", fontSize: 40, fontWeight: "900", color: t.headerText, textAlign: "center", letterSpacing: 4, fontFamily: t.fontFamily });
  add({ fieldKey: "header-subtitle", type: "text", x: CANVAS_W / 2 - 160, y: 50, width: 320, height: 18, content: "PLEASE HELP US FIND OUR BELOVED PET", fontSize: 10, fontWeight: "400", color: t.headerText, textAlign: "center", letterSpacing: 1, fontFamily: t.fontFamily, opacity: 0.9 });

  // Pet photo placeholder
  add({ fieldKey: "pet-photo", type: "shape", x: 30, y: 80, width: 360, height: 200, backgroundColor: "#E5E7EB", borderRadius: 0, content: form.imageUrl ? "" : "📷 Pet Photo" });

  // Pet name
  add({ fieldKey: "pet-name", type: "text", x: 30, y: 290, width: 360, height: 32, content: form.petName || "PET NAME", fontSize: 24, fontWeight: "800", color: t.bodyText, textAlign: "center", fontFamily: t.fontFamily });

  // Pet details section
  add({ fieldKey: "species", type: "text", x: 30, y: 326, width: 170, height: 20, content: `Species: ${form.species || "—"}`, fontSize: 12, fontWeight: "400", color: t.bodyText, fontFamily: t.fontFamily });
  add({ fieldKey: "breed", type: "text", x: 220, y: 326, width: 170, height: 20, content: `Breed: ${form.breed || "—"}`, fontSize: 12, fontWeight: "400", color: t.bodyText, fontFamily: t.fontFamily });
  add({ fieldKey: "color", type: "text", x: 30, y: 350, width: 170, height: 20, content: `Color: ${form.color || "—"}`, fontSize: 12, fontWeight: "400", color: t.bodyText, fontFamily: t.fontFamily });

  // Description
  if (form.description) {
    add({ fieldKey: "description", type: "text", x: 30, y: 374, width: 360, height: 40, content: form.description, fontSize: 11, fontWeight: "400", color: t.bodyText, textAlign: "center", fontFamily: t.fontFamily, lineHeight: 1.5 });
  }

  // Lost date
  if (form.lostDate) {
    add({ fieldKey: "lost-date", type: "text", x: 30, y: 418, width: 360, height: 20, content: formatLostDateLabel(form.lostDate), fontSize: 11, fontWeight: "600", color: t.bodyText, textAlign: "center", fontFamily: t.fontFamily });
  }

  // Last seen location
  if (form.lastSeenAddress) {
    const locY = form.lostDate ? 442 : 418;
    add({ fieldKey: "last-seen-bg", type: "shape", x: 30, y: locY, width: 360, height: 30, backgroundColor: t.bgAccent || "#F3F4F6", borderRadius: 6, content: "" });
    add({ fieldKey: "last-seen", type: "text", x: 34, y: locY + 4, width: 352, height: 22, content: `📍 Last seen at ${form.lastSeenAddress}`, fontSize: 11, fontWeight: "600", color: t.bodyText, textAlign: "center", fontFamily: t.fontFamily });
  }

  // Reward
  if (form.includeReward && form.reward.trim()) {
    add({ fieldKey: "reward-bg", type: "shape", x: 60, y: rewardY, width: 300, height: 36, backgroundColor: t.headerColor, borderRadius: 6, content: "" });
    add({ fieldKey: "reward", type: "text", x: 64, y: rewardY + 4, width: 292, height: 28, content: formatRewardLabel(form.reward), fontSize: 18, fontWeight: "800", color: t.headerText, textAlign: "center", fontFamily: t.fontFamily });
  }

  // Contact footer bar
  add({ fieldKey: "footer-bg", type: "shape", x: 0, y: footerY, width: CANVAS_W, height: 74, backgroundColor: t.ctaColor || t.accentColor, content: "" });
  add({ fieldKey: "footer-label", type: "text", x: CANVAS_W / 2 - 150, y: footerY + 6, width: 300, height: 16, content: "CALL OR TEXT WITH ANY INFORMATION", fontSize: 10, fontWeight: "400", color: t.ctaText || t.headerText, textAlign: "center", letterSpacing: 1, fontFamily: t.fontFamily });
  add({ fieldKey: "phone", type: "text", x: CANVAS_W / 2 - 150, y: footerY + 26, width: 300, height: 40, content: form.contactPhone || "+123 456 7890", fontSize: 28, fontWeight: "900", color: t.ctaText || t.headerText, textAlign: "center", letterSpacing: 2, fontFamily: t.fontFamily });

  return els;
};

/** Keep custom layers; refresh auto-managed template layers when Pet Info changes */
const mergeFormIntoElements = (prev: CanvasElement[], t: FlyerTemplate, form: FormData): CanvasElement[] => {
  const custom = prev.filter((e) => !e.fieldKey);
  const prevManaged = new Map(prev.filter((e) => e.fieldKey).map((e) => [e.fieldKey!, e]));
  const managed = buildFromTemplate(t, form).map((e) => {
    if (!e.fieldKey) return e;
    const existing = prevManaged.get(e.fieldKey);
    if (!existing) return e;
    return {
      ...e,
      id: existing.id,
      x: existing.x,
      y: existing.y,
      width: existing.width,
      height: existing.height,
      zIndex: existing.zIndex,
      fontSize: existing.fontSize,
      fontWeight: existing.fontWeight,
      color: existing.color,
      textAlign: existing.textAlign,
    };
  });
  const maxZ = managed.reduce((m, e) => Math.max(m, e.zIndex), 0);
  return [...managed, ...custom.map((e, i) => ({ ...e, zIndex: maxZ + i + 1 }))];
};

interface FormData {
  petName: string;
  species: string;
  breed: string;
  color: string;
  description: string;
  lostDate: string;
  lastSeenAddress: string;
  contactPhone: string;
  reward: string;
  includeReward: boolean;
  imageUrl: string;
  petId: string;
}

interface CustomTemplate {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  created_by: string;
  template_type: string;
}

/* ─── Main Component ─── */

const LostFlyerBuilder = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const reportId = searchParams.get("report");
  const canvasRef = useRef<HTMLDivElement>(null);
  const petPhotoInputRef = useRef<HTMLInputElement>(null);

  // Handle return from the payment gateway (?success=true / ?canceled=true)
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (!success && !canceled) return;
    const next = new URLSearchParams(searchParams);
    next.delete("success");
    next.delete("canceled");
    next.delete("provider");
    setSearchParams(next, { replace: true });
    if (success === "true") {
      toast.success("Payment received! Unlocking flyer downloads…");
      queryClient.invalidateQueries({ queryKey: ["flyer-purchase", user?.id] });
      // The webhook may lag behind the redirect — poll a few times (self-terminating)
      let attempts = 0;
      const timer = setInterval(() => {
        attempts++;
        queryClient.invalidateQueries({ queryKey: ["flyer-purchase", user?.id] });
        if (attempts >= 5) clearInterval(timer);
      }, 4000);
    } else if (canceled === "true") {
      toast.error("Payment cancelled — you were not charged.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<FlyerTemplate>(flyerTemplates[0]);
  const [selectedCustom, setSelectedCustom] = useState<CustomTemplate | null>(null);

  // Form data
  const [formData, setFormData] = useState<FormData>({
    petName: "", species: "", breed: "", color: "",
    description: "", lostDate: "", lastSeenAddress: "", contactPhone: "",
    reward: "", includeReward: false, imageUrl: "", petId: "",
  });

  // Canvas editor state
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

  // UI state
  const [generating, setGenerating] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  // Memoise the preview blob URL (creating one inline in JSX leaks a new URL every render)
  const uploadPreviewUrl = useMemo(() => (uploadFile ? URL.createObjectURL(uploadFile) : null), [uploadFile]);
  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    };
  }, [uploadPreviewUrl]);
  const [uploading, setUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // AI Flyer state
  const [showAiFlyer, setShowAiFlyer] = useState(false);
  const [aiStep, setAiStep] = useState<"questions" | "generating" | "preview">("questions");
  const [aiAnswers, setAiAnswers] = useState({
    petPhoto: null as string | null,
    headline: "MISSING",
    colorScheme: "Red & White",
    includeReward: true,
    rewardAmount: "",
    includeQr: true,
    extraInfo: "",
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedHtml, setAiGeneratedHtml] = useState<string | null>(null);
  const aiPreviewRef = useRef<HTMLDivElement>(null);

  const selected = elements.find((e) => e.id === selectedId) || null;

  // Queries
  // Active members get LIFETIME flyer access as a membership benefit
  const { data: hasPurchased } = useQuery({
    queryKey: ["flyer-purchase", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Check active membership first (lifetime unlock benefit)
      const { data: membership } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (membership) return true;

      // Otherwise check direct flyer subscription (must not be expired)
      const { data } = await supabase
        .from("flyer_subscriptions" as any)
        .select("id, expires_at")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: flyerPrices } = useQuery({
    queryKey: ["flyer-service-prices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["service_price_flyer_monthly", "service_price_flyer_yearly", "service_price_flyer_one_time"]);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const { data: customTemplates = [] } = useQuery({
    queryKey: ["custom-flyer-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flyer_templates" as any)
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CustomTemplate[];
    },
  });

  // User's own saved designs (including inactive ones)
  const { data: myDesigns = [] } = useQuery({
    queryKey: ["my-flyer-designs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flyer_templates" as any)
        .select("*")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CustomTemplate[];
    },
  });

  const { data: report } = useQuery({
    queryKey: ["flyer-report", reportId],
    enabled: !!reportId && !!user,
    queryFn: async () => {
      // Only load the user's own reports — prevents pre-filling someone else's
      // contact details by guessing a report id in the URL
      const { data, error } = await supabase
        .from("lost_reports")
        .select("*, pets(id, name, species, breed, color, pet_code, pet_images(image_url, sort_order))")
        .eq("id", reportId!)
        .eq("reporter_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Load report data
  useEffect(() => {
    if (report) {
      const pet = report.pets as any;
      const image = pet?.pet_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
      const rewardStr = report.reward ? String(report.reward) : "";
      const newForm: FormData = {
        petName: pet?.name || "", species: pet?.species || "",
        breed: pet?.breed || "", color: pet?.color || "",
        description: report.description || "",
        lostDate: report.last_seen_date || "",
        lastSeenAddress: report.last_seen_address || "",
        contactPhone: report.contact_phone || "",
        reward: rewardStr,
        includeReward: !!rewardStr,
        imageUrl: image?.image_url || "",
        petId: pet?.id || "",
      };
      setFormData(newForm);
      setElements(buildFromTemplate(selectedTemplate, newForm));
    }
  }, [report, selectedTemplate]);

  // Build initial elements when template changes
  const applyTemplate = (tmpl: FlyerTemplate) => {
    setSelectedTemplate(tmpl);
    setSelectedCustom(null);
    setElements((prev) => mergeFormIntoElements(prev, tmpl, formData));
    setSelectedId(null);
  };

  // Initialize on mount
  useEffect(() => {
    if (elements.length === 0) {
      setElements(buildFromTemplate(selectedTemplate, formData));
    }
  }, []);

  // Live-sync Pet Info → flyer preview (skip when using a custom background only)
  useEffect(() => {
    if (selectedCustom) return;
    setElements((prev) => mergeFormIntoElements(prev, selectedTemplate, formData));
  }, [formData, selectedTemplate, selectedCustom]);

  /* ─── Canvas interaction ─── */
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

  const addElement = useCallback((type: string, preset?: Partial<CanvasElement>) => {
    const el: CanvasElement = {
      id: genId(), type: type as any,
      x: 30, y: 30 + elements.length * 15,
      width: 200, height: 30, content: type === "text" ? "New Text" : "",
      ...defaultEl(), zIndex: elements.length + 1, ...preset,
    } as CanvasElement;
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  }, [elements.length]);

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

  /* ─── Actions ─── */
  const handleDownloadPDF = async () => {
    if (!hasPurchased) { toast.error("Please purchase access to download flyers."); return; }
    if (!canvasRef.current) return;
    setGenerating(true);
    try {
      // Create a temporary off-screen container at full A4 resolution
      const container = document.createElement("div");
      container.style.width = `${CANVAS_W}px`;
      container.style.height = `${CANVAS_H}px`;
      container.style.position = "fixed";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      container.style.overflow = "hidden";
      document.body.appendChild(container);

      // Clone the canvas content
      const clone = canvasRef.current.cloneNode(true) as HTMLElement;
      clone.style.transform = "none";
      clone.style.width = `${CANVAS_W}px`;
      clone.style.height = `${CANVAS_H}px`;
      container.appendChild(clone);

      // Remove selection rings from clone
      clone.querySelectorAll("[data-resize-handle]").forEach(el => el.remove());

      const canvas = await html2canvas(container, {
        scale: 2, useCORS: true, allowTaint: true,
        width: CANVAS_W, height: CANVAS_H,
      });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
      pdf.save(`Lost-${formData.petName || "Pet"}-Flyer.pdf`);
      toast.success("Flyer downloaded!");
    } catch { toast.error("Failed to generate PDF"); }
    finally { setGenerating(false); }
  };

  const [flyerBillingInterval, setFlyerBillingInterval] = useState<string>("one_time");

  // Fetch allowed billing types for flyer service
  const { data: flyerBillingModes = ["one_time"] } = useQuery({
    queryKey: ["flyer-billing-modes"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "service_billing_flyer").single();
      return (data?.value || "one_time").split(",").filter(Boolean);
    },
  });

  const handlePurchase = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flyer-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ user_id: user?.id, billing_interval: flyerBillingInterval }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Could not create checkout session");
      }

      if (result?.checkout || result?.url) {
        await completeCheckout(result);
      } else {
        toast.error(result.error || "Could not create checkout session");
      }
    } catch (error: any) {
      toast.error(error.message || "Payment service unavailable.");
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!user || !canvasRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(canvasRef.current, { scale: 1, useCORS: true, allowTaint: true });
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const path = `${user.id}/${Date.now()}.png`;
      const publicUrl = await uploadRaw({ bucket: "flyer-templates", path, body: blob, contentType: "image/png" });
      const { error: insertError } = await supabase.from("flyer_templates" as any).insert({
        name: `${formData.petName || "Custom"} Design`,
        description: `Created from ${selectedTemplate.name} template`,
        image_url: publicUrl,
        created_by: user.id,
        template_type: "member",
        is_active: false,
      });
      if (insertError) throw insertError;
      toast.success("Design saved! You can find it in 'My Designs' below.");
      queryClient.invalidateQueries({ queryKey: ["custom-flyer-templates"] });
      queryClient.invalidateQueries({ queryKey: ["my-flyer-designs"] });
    } catch (err: any) { toast.error(err.message || "Failed to save template"); }
    finally { setGenerating(false); }
  };

  const handleUploadTemplate = async () => {
    if (!uploadFile || !uploadName.trim() || !user) return;
    setUploading(true);
    try {
      const publicUrl = await uploadFileUtil({ bucket: "flyer-templates", folder: user.id, file: uploadFile });
      const { error: insertError } = await supabase.from("flyer_templates" as any).insert({
        name: uploadName.trim(), description: uploadDesc.trim() || null,
        image_url: publicUrl, created_by: user.id, template_type: "member",
      });
      if (insertError) throw insertError;
      toast.success("Template uploaded!");
      setShowUpload(false); setUploadName(""); setUploadDesc(""); setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ["custom-flyer-templates"] });
      queryClient.invalidateQueries({ queryKey: ["my-flyer-designs"] });
    } catch (err: any) { toast.error(err.message || "Failed to upload"); }
    finally { setUploading(false); }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this saved design?")) return;
    const { error } = await supabase.from("flyer_templates" as any).delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Design deleted"); queryClient.invalidateQueries({ queryKey: ["custom-flyer-templates"] }); queryClient.invalidateQueries({ queryKey: ["my-flyer-designs"] }); }
  };

  const handlePetPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8MB"); return; }

    // Instant local preview while uploading
    const reader = new FileReader();
    reader.onload = () => setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
    reader.readAsDataURL(file);

    if (!user) return;
    setPhotoUploading(true);
    try {
      const publicUrl = await uploadImage(file, "pet-photos", user.id);
      setFormData((prev) => ({ ...prev, imageUrl: publicUrl }));
      toast.success("Pet photo uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Photo upload failed — preview shown locally");
    } finally {
      setPhotoUploading(false);
    }
  };

  const updateFormField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const getFlyerPrice = () => {
    if (flyerBillingInterval === "monthly") return flyerPrices?.["service_price_flyer_monthly"] || "1";
    if (flyerBillingInterval === "yearly") return flyerPrices?.["service_price_flyer_yearly"] || "10";
    return flyerPrices?.["service_price_flyer_one_time"] || "2";
  };
  const flyerPrice = getFlyerPrice();

  /* ─── AI Flyer Handlers ─── */
  const handleAiImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setAiAnswers((prev) => ({ ...prev, petPhoto: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleAiGenerate = async () => {
    setAiGenerating(true);
    setAiStep("generating");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const description = [
        `Headline: "${aiAnswers.headline}"`,
        `Color scheme: ${aiAnswers.colorScheme}`,
        aiAnswers.includeReward && aiAnswers.rewardAmount ? `Reward: ${aiAnswers.rewardAmount}` : null,
        aiAnswers.includeQr ? "Include a QR code placeholder area" : null,
        aiAnswers.extraInfo ? `Extra instructions: ${aiAnswers.extraInfo}` : null,
      ].filter(Boolean).join(". ");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-flyer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          description,
          petImageBase64: aiAnswers.petPhoto,
          petName: formData.petName,
          petBreed: formData.breed,
          contactInfo: formData.contactPhone,
          mode: "flyer",
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate flyer");
      }
      const result = await resp.json();
      let html = result.html || "";
      if (aiAnswers.petPhoto) {
        html = html.replace(/PET_PHOTO_PLACEHOLDER/g, aiAnswers.petPhoto);
      }
      setAiGeneratedHtml(html);
      setAiStep("preview");
      toast.success("AI flyer generated! You can download it as PDF.");
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
      setAiStep("questions");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAiDownloadPdf = async () => {
    if (!hasPurchased) { toast.error("Please purchase access to download flyers."); return; }
    if (!aiGeneratedHtml) return;
    try {
      toast.info("Generating PDF...");
      // Render at full A4 size off-screen
      const container = document.createElement("div");
      container.style.width = "794px";
      container.style.height = "1123px";
      container.style.position = "fixed";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      container.style.background = "white";
      container.innerHTML = aiGeneratedHtml;
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2, useCORS: true, allowTaint: true, width: 794, height: 1123 });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      pdf.save(`${formData.petName || "lost-pet"}-ai-flyer.pdf`);
      toast.success("PDF downloaded!");
    } catch {
      toast.error("Failed to generate PDF");
    }
  };

  /* Quick-add elements for the member */
  const QUICK_ELEMENTS = [
    { label: "Pet Name", preset: { content: formData.petName || "PET NAME", fontSize: 24, fontWeight: "800", textAlign: "center", width: 300, height: 32 } },
    { label: "Species", preset: { content: `Species: ${formData.species || "—"}`, fontSize: 12, width: 180, height: 20 } },
    { label: "Breed", preset: { content: `Breed: ${formData.breed || "—"}`, fontSize: 12, width: 180, height: 20 } },
    { label: "Color", preset: { content: `Color: ${formData.color || "—"}`, fontSize: 12, width: 180, height: 20 } },
    { label: "Phone", preset: { content: formData.contactPhone || "+123 456 7890", fontSize: 28, fontWeight: "900", textAlign: "center", width: 300, height: 40 } },
    { label: "Reward", preset: { content: formData.includeReward && formData.reward ? formatRewardLabel(formData.reward) : "$100 REWARD", fontSize: 18, fontWeight: "800", textAlign: "center", width: 260, height: 28 } },
    { label: "Lost Date", preset: { content: formData.lostDate ? formatLostDateLabel(formData.lostDate) : "Lost on —", fontSize: 11, fontWeight: "600", textAlign: "center", width: 340, height: 22 } },
    { label: "Location", preset: { content: `📍 Last seen at ${formData.lastSeenAddress || "location"}`, fontSize: 11, fontWeight: "600", textAlign: "center", width: 340, height: 22 } },
    { label: "Description", preset: { content: formData.description || "Description...", fontSize: 11, textAlign: "center", width: 340, height: 40, lineHeight: 1.5 } },
    { label: "MISSING", preset: { content: "MISSING", fontSize: 40, fontWeight: "900", textAlign: "center", letterSpacing: 4, width: 300, height: 50 } },
    { label: "Rectangle", type: "shape" as const, preset: { backgroundColor: "#DC2626", width: 300, height: 50, content: "" } },
  ];

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 bg-background overflow-hidden flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card shrink-0">
          <div>
            <h1 className="font-display text-lg font-bold text-foreground">Lost Pet Flyer Builder</h1>
            <p className="text-xs text-muted-foreground">Drag elements to customize. Choose a template, edit text, and download.</p>
          </div>
          <div className="flex items-center gap-2">
            {hasPurchased ? (
              <Badge className="bg-emerald-100 text-emerald-700 gap-1"><Check className="h-3 w-3" /> Active Access</Badge>
            ) : (
              <div className="flex items-center gap-2">
                {flyerBillingModes.length > 1 && (
                  <select
                    value={flyerBillingInterval}
                    onChange={(e) => setFlyerBillingInterval(e.target.value)}
                    className="rounded border border-border bg-card px-2 py-1 text-xs"
                  >
                    {flyerBillingModes.includes("monthly") && <option value="monthly">Monthly (${flyerPrices?.["service_price_flyer_monthly"] || "1"}/mo)</option>}
                    {flyerBillingModes.includes("yearly") && <option value="yearly">Yearly (${flyerPrices?.["service_price_flyer_yearly"] || "10"}/yr)</option>}
                    {flyerBillingModes.includes("one_time") && <option value="one_time">One-Time (${flyerPrices?.["service_price_flyer_one_time"] || "2"})</option>}
                  </select>
                )}
                <Button size="sm" onClick={handlePurchase} className="gap-1">
                  <Lock className="h-3.5 w-3.5" /> {flyerBillingInterval === "one_time" ? `Pay $${flyerPrice}` : `$${flyerPrice}/${flyerBillingInterval === "monthly" ? "mo" : "yr"}`}
                </Button>
              </div>
            )}
            <Badge variant="secondary" className="text-xs">{elements.length} elements</Badge>
          </div>
        </div>

        {/* Manual flyer builder — member AI flyer disabled; admins use Admin → Flyer Templates for AI */}

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel — Templates + Quick Add */}
          <div className="w-56 border-r border-border bg-card overflow-y-auto p-3 space-y-3 shrink-0">
            {/* Template selector */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Templates ({flyerTemplates.length})</p>
              <div className="grid grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                {flyerTemplates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => applyTemplate(tmpl)}
                    className={`rounded-md border overflow-hidden transition-all ${
                      selectedTemplate.id === tmpl.id && !selectedCustom
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className={`h-6 w-full ${tmpl.previewColor}`} />
                    <p className="text-[8px] font-medium text-foreground truncate px-1 py-0.5">{tmpl.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Templates */}
            {customTemplates.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Custom Templates</p>
                <div className="grid grid-cols-3 gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                  {customTemplates.map((tmpl) => (
                    <div key={tmpl.id} className="relative group">
                      <button
                        onClick={() => setSelectedCustom(tmpl)}
                        className={`w-full rounded-md border overflow-hidden transition-all ${
                          selectedCustom?.id === tmpl.id ? "border-primary ring-1 ring-primary/30" : "border-border"
                        }`}
                      >
                        <img src={tmpl.image_url} alt={tmpl.name} className="h-8 w-full object-cover" />
                        <p className="text-[8px] text-foreground truncate px-1 py-0.5">{tmpl.name}</p>
                      </button>
                      {tmpl.created_by === user?.id && (
                        <button onClick={() => handleDeleteTemplate(tmpl.id)} className="absolute -right-1 -top-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Saved Designs */}
            {myDesigns.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">My Designs ({myDesigns.length})</p>
                <div className="grid grid-cols-3 gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                  {myDesigns.map((design) => (
                    <div key={design.id} className="relative group">
                      <button
                        onClick={() => setSelectedCustom(design)}
                        className={`w-full rounded-md border overflow-hidden transition-all ${
                          selectedCustom?.id === design.id ? "border-primary ring-1 ring-primary/30" : "border-border"
                        }`}
                      >
                        <img src={design.image_url} alt={design.name} className="h-8 w-full object-cover" />
                        <p className="text-[8px] text-foreground truncate px-1 py-0.5">{design.name}</p>
                      </button>
                      <button onClick={() => handleDeleteTemplate(design.id)} className="absolute -right-1 -top-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Add Elements */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Add Elements</p>
              <div className="grid grid-cols-2 gap-1">
                {QUICK_ELEMENTS.map((qe) => (
                  <button key={qe.label} onClick={() => addElement(qe.type || "text", qe.preset)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left">
                    {qe.label}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 space-y-1">
                <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-xs" onClick={() => addElement("text")}>
                  <Type className="h-3 w-3" /> Custom Text
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-xs" onClick={() => setShowUpload(true)}>
                  <Upload className="h-3 w-3" /> Upload Template
                </Button>
              </div>
            </div>

            {/* Layers */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1"><Layers className="h-3 w-3" /> Layers</p>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {[...elements].sort((a, b) => b.zIndex - a.zIndex).map((el) => (
                  <button key={el.id} onClick={() => setSelectedId(el.id)}
                    className={`w-full text-left px-2 py-1 rounded text-[10px] truncate flex items-center gap-1 ${selectedId === el.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"}`}>
                    {el.type === "text" ? <Type className="h-2.5 w-2.5 shrink-0" /> : <Square className="h-2.5 w-2.5 shrink-0" />}
                    <span className="truncate">{el.content || el.type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pet Info */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Pet Info</p>
              <div className="space-y-1.5">
                {/* Pet photo upload */}
                <div>
                  <Label className="text-[10px]">Pet Photo</Label>
                  <input
                    ref={petPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePetPhotoUpload}
                  />
                  <button
                    type="button"
                    onClick={() => petPhotoInputRef.current?.click()}
                    className="mt-0.5 w-full rounded-md border border-dashed border-border bg-muted/30 p-2 text-center hover:bg-muted/50 transition-colors"
                  >
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Pet" className="mx-auto h-16 w-full rounded object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 py-2">
                        <ImagePlus className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Click to upload photo</span>
                      </div>
                    )}
                  </button>
                  {photoUploading && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                    </p>
                  )}
                  {formData.imageUrl && !photoUploading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] w-full mt-0.5"
                      onClick={() => updateFormField("imageUrl", "")}
                    >
                      Remove photo
                    </Button>
                  )}
                </div>

                {[
                  { key: "petName" as const, label: "Name", placeholder: "Buddy" },
                  { key: "species" as const, label: "Species", placeholder: "Dog" },
                  { key: "breed" as const, label: "Breed", placeholder: "Golden Retriever" },
                  { key: "color" as const, label: "Color", placeholder: "Golden" },
                  { key: "contactPhone" as const, label: "Phone", placeholder: "+1 234 567 890" },
                  { key: "lostDate" as const, label: "Date Lost", placeholder: "", type: "date" as const },
                  { key: "lastSeenAddress" as const, label: "Last Seen Location", placeholder: "123 Main St, City" },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <Label className="text-[10px]">{label}</Label>
                    <Input
                      type={type || "text"}
                      value={formData[key]}
                      onChange={(e) => updateFormField(key, e.target.value)}
                      placeholder={placeholder}
                      className="h-7 text-xs"
                    />
                  </div>
                ))}

                {/* Reward toggle + amount */}
                <div>
                  <Label className="text-[10px]">Reward Offered?</Label>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={formData.includeReward ? "default" : "outline"}
                      className="h-7 text-[10px] flex-1"
                      onClick={() => updateFormField("includeReward", true)}
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!formData.includeReward ? "default" : "outline"}
                      className="h-7 text-[10px] flex-1"
                      onClick={() => updateFormField("includeReward", false)}
                    >
                      No
                    </Button>
                  </div>
                  {formData.includeReward && (
                    <Input
                      value={formData.reward}
                      onChange={(e) => updateFormField("reward", e.target.value)}
                      placeholder="e.g. 100 or $100"
                      className="h-7 text-xs mt-1"
                    />
                  )}
                </div>

                <div>
                  <Label className="text-[10px]">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => updateFormField("description", e.target.value)}
                    placeholder="Any distinguishing features..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-1.5 pt-2 border-t">
              <Button className="w-full gap-1 text-xs" size="sm" onClick={handleDownloadPDF} disabled={generating || !hasPurchased}>
                {!hasPurchased ? <><Lock className="h-3 w-3" /> Unlock to Download</> : <><FileDown className="h-3 w-3" /> {generating ? "Generating..." : "Download PDF"}</>}
              </Button>
              {hasPurchased && (
                <Button variant="outline" size="sm" className="w-full gap-1 text-xs" onClick={handleSaveAsTemplate} disabled={generating}>
                  <Upload className="h-3 w-3" /> Save as Template
                </Button>
              )}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-muted/30">
            <div
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              className="relative shadow-xl border border-border"
              style={{
                width: `${CANVAS_W}px`,
                height: `${CANVAS_H}px`,
                background: selectedCustom
                  ? `url(${selectedCustom.image_url}) center/cover no-repeat`
                  : selectedTemplate.bgColor,
                cursor: dragging ? "grabbing" : "default",
              }}
            >
              {/* Pet image if provided */}
              {formData.imageUrl && !selectedCustom && (
                <img
                  src={formData.imageUrl}
                  alt="Pet"
                  crossOrigin="anonymous"
                  style={{
                    position: "absolute",
                    left: 30, top: 80,
                    width: 360, height: 200,
                    objectFit: "cover",
                    zIndex: 0,
                  }}
                />
              )}

              {[...elements].sort((a, b) => a.zIndex - b.zIndex).map((el) => (
                <div
                  key={el.id}
                  onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                  className={`absolute ${selectedId === el.id ? "ring-2 ring-primary" : ""}`}
                  style={{
                    left: el.x, top: el.y, width: el.width, height: el.height,
                    opacity: el.opacity, zIndex: el.zIndex, cursor: "grab",
                  }}
                >
                  {el.type === "text" ? (
                    <div style={{
                      fontSize: el.fontSize, fontWeight: el.fontWeight, fontStyle: el.fontStyle,
                      textAlign: el.textAlign as any, fontFamily: el.fontFamily, color: el.color,
                      backgroundColor: el.backgroundColor, borderRadius: el.borderRadius,
                      letterSpacing: el.letterSpacing, lineHeight: el.lineHeight,
                      width: "100%", height: "100%", display: "flex", alignItems: "center",
                      justifyContent: el.textAlign === "center" ? "center" : el.textAlign === "right" ? "flex-end" : "flex-start",
                      padding: "0 4px", overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {el.content}
                    </div>
                  ) : (
                    <div style={{
                      width: "100%", height: "100%", backgroundColor: el.backgroundColor,
                      borderRadius: el.borderRadius, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 10, color: "#999",
                    }}>
                      {el.content}
                    </div>
                  )}
                  {selectedId === el.id && (
                    <div data-resize-handle onMouseDown={(e) => handleResizeMouseDown(e, el.id)} className="absolute -bottom-1.5 -right-1.5 h-3 w-3 bg-primary rounded-sm cursor-se-resize border border-background" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel — Properties */}
          <div className="w-56 border-l border-border bg-card overflow-y-auto p-3 space-y-3 shrink-0">
            {selected ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Properties</p>
                  <div className="flex gap-0.5">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => duplicateElement(selected.id)}><Copy className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteElement(selected.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>

                {selected.type === "text" && (
                  <>
                    <div>
                      <Label className="text-xs">Text</Label>
                      <Textarea value={selected.content} onChange={(e) => updateElement(selected.id, { content: e.target.value })} rows={3} className="mt-1 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Size</Label>
                        <Input type="number" min={6} max={72} value={selected.fontSize} onChange={(e) => updateElement(selected.id, { fontSize: parseInt(e.target.value) || 12 })} className="mt-1 h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Weight</Label>
                        <Select value={selected.fontWeight} onValueChange={(v) => updateElement(selected.id, { fontWeight: v })}>
                          <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="400">Normal</SelectItem>
                            <SelectItem value="600">Semi-bold</SelectItem>
                            <SelectItem value="700">Bold</SelectItem>
                            <SelectItem value="900">Black</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Font</Label>
                      <Select value={selected.fontFamily} onValueChange={(v) => updateElement(selected.id, { fontFamily: v })}>
                        <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FONT_FAMILIES.map((f) => <SelectItem key={f} value={f}>{f.split(",")[0].replace(/'/g, "")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant={selected.textAlign === "left" ? "default" : "outline"} className="h-7 w-7" onClick={() => updateElement(selected.id, { textAlign: "left" })}><AlignLeft className="h-3 w-3" /></Button>
                      <Button size="icon" variant={selected.textAlign === "center" ? "default" : "outline"} className="h-7 w-7" onClick={() => updateElement(selected.id, { textAlign: "center" })}><AlignCenter className="h-3 w-3" /></Button>
                      <Button size="icon" variant={selected.textAlign === "right" ? "default" : "outline"} className="h-7 w-7" onClick={() => updateElement(selected.id, { textAlign: "right" })}><AlignRight className="h-3 w-3" /></Button>
                      <Button size="icon" variant={selected.fontWeight === "700" || selected.fontWeight === "800" || selected.fontWeight === "900" ? "default" : "outline"} className="h-7 w-7" onClick={() => updateElement(selected.id, { fontWeight: selected.fontWeight === "700" ? "400" : "700" })}><Bold className="h-3 w-3" /></Button>
                      <Button size="icon" variant={selected.fontStyle === "italic" ? "default" : "outline"} className="h-7 w-7" onClick={() => updateElement(selected.id, { fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })}><Italic className="h-3 w-3" /></Button>
                    </div>
                    <div>
                      <Label className="text-xs">Letter Spacing</Label>
                      <Slider min={0} max={10} step={0.5} value={[selected.letterSpacing]} onValueChange={([v]) => updateElement(selected.id, { letterSpacing: v })} className="mt-1" />
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Color</Label>
                    <input type="color" value={selected.color} onChange={(e) => updateElement(selected.id, { color: e.target.value })} className="block h-7 w-full rounded border cursor-pointer mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">BG Color</Label>
                    <input type="color" value={selected.backgroundColor === "transparent" ? "#ffffff" : selected.backgroundColor} onChange={(e) => updateElement(selected.id, { backgroundColor: e.target.value })} className="block h-7 w-full rounded border cursor-pointer mt-1" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Width</Label><Input type="number" value={Math.round(selected.width)} onChange={(e) => updateElement(selected.id, { width: parseInt(e.target.value) || 50 })} className="mt-1 h-7 text-xs" /></div>
                  <div><Label className="text-xs">Height</Label><Input type="number" value={Math.round(selected.height)} onChange={(e) => updateElement(selected.id, { height: parseInt(e.target.value) || 20 })} className="mt-1 h-7 text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">X</Label><Input type="number" value={Math.round(selected.x)} onChange={(e) => updateElement(selected.id, { x: parseInt(e.target.value) || 0 })} className="mt-1 h-7 text-xs" /></div>
                  <div><Label className="text-xs">Y</Label><Input type="number" value={Math.round(selected.y)} onChange={(e) => updateElement(selected.id, { y: parseInt(e.target.value) || 0 })} className="mt-1 h-7 text-xs" /></div>
                </div>
                <div><Label className="text-xs">Border Radius</Label><Slider min={0} max={30} value={[selected.borderRadius]} onValueChange={([v]) => updateElement(selected.id, { borderRadius: v })} className="mt-1" /></div>
                <div><Label className="text-xs">Opacity</Label><Slider min={0} max={1} step={0.05} value={[selected.opacity]} onValueChange={([v]) => updateElement(selected.id, { opacity: v })} className="mt-1" /></div>
              </>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-8">
                <MousePointer className="h-6 w-6 mx-auto mb-2 opacity-40" />
                <p>Click an element on the canvas to edit</p>
                <p className="mt-2 text-[10px]">Tip: Drag to move, use arrow keys for precision. Delete key to remove.</p>
              </div>
            )}
          </div>
        </div>

        {/* Upload Template Dialog */}
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Custom Template</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Upload an A4 background image (portrait). Pet details will be overlaid on top.</p>
              <div><Label>Template Name</Label><Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="My Custom Design" /></div>
              <div><Label>Description (optional)</Label><Input value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} placeholder="Brief description" /></div>
              <div><Label>Background Image</Label><Input type="file" accept="image/*" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></div>
              {uploadPreviewUrl && <img src={uploadPreviewUrl} alt="Preview" className="h-40 w-full rounded-lg object-cover border border-border" />}
              <Button className="w-full gap-2" onClick={handleUploadTemplate} disabled={uploading || !uploadFile || !uploadName.trim()}>
                <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAiFlyer} onOpenChange={(open) => { setShowAiFlyer(open); if (!open) { setAiStep("questions"); setAiGeneratedHtml(null); } }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" /> AI Flyer Builder
              </DialogTitle>
            </DialogHeader>

            {aiStep === "questions" && (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">Answer a few questions so AI can create the perfect flyer for you.</p>

                {/* Pet Photo */}
                <div>
                  <Label className="font-semibold">1. Upload your pet's photo</Label>
                  <div
                    className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => document.getElementById("ai-flyer-photo-input")?.click()}
                  >
                    {aiAnswers.petPhoto ? (
                      <img src={aiAnswers.petPhoto} alt="Pet" className="h-32 mx-auto rounded-lg object-cover" />
                    ) : (
                      <>
                        <ImagePlus className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Click to upload pet photo</p>
                      </>
                    )}
                  </div>
                  <input type="file" id="ai-flyer-photo-input" accept="image/*" className="hidden" onChange={handleAiImageUpload} />
                </div>

                {/* Headline */}
                <div>
                  <Label className="font-semibold">2. What headline do you want?</Label>
                  <Select value={aiAnswers.headline} onValueChange={(v) => setAiAnswers((p) => ({ ...p, headline: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MISSING">MISSING</SelectItem>
                      <SelectItem value="LOST PET">LOST PET</SelectItem>
                      <SelectItem value="HAVE YOU SEEN ME?">HAVE YOU SEEN ME?</SelectItem>
                      <SelectItem value="HELP FIND ME">HELP FIND ME</SelectItem>
                      <SelectItem value="URGENT: MISSING PET">URGENT: MISSING PET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Color Scheme */}
                <div>
                  <Label className="font-semibold">3. Preferred color scheme?</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {["Red & White", "Blue & White", "Orange & Yellow", "Green & White", "Black & Yellow", "Purple & White"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setAiAnswers((p) => ({ ...p, colorScheme: c }))}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                          aiAnswers.colorScheme === c ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reward */}
                <div>
                  <Label className="font-semibold">4. Include a reward?</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <Button size="sm" variant={aiAnswers.includeReward ? "default" : "outline"} onClick={() => setAiAnswers((p) => ({ ...p, includeReward: true }))}>Yes</Button>
                    <Button size="sm" variant={!aiAnswers.includeReward ? "default" : "outline"} onClick={() => setAiAnswers((p) => ({ ...p, includeReward: false }))}>No</Button>
                    {aiAnswers.includeReward && (
                      <Input
                        placeholder="e.g. $200"
                        value={aiAnswers.rewardAmount}
                        onChange={(e) => setAiAnswers((p) => ({ ...p, rewardAmount: e.target.value }))}
                        className="w-32 h-8 text-sm"
                      />
                    )}
                  </div>
                </div>

                {/* QR Code */}
                <div>
                  <Label className="font-semibold">5. Include QR code area?</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <Button size="sm" variant={aiAnswers.includeQr ? "default" : "outline"} onClick={() => setAiAnswers((p) => ({ ...p, includeQr: true }))}>Yes</Button>
                    <Button size="sm" variant={!aiAnswers.includeQr ? "default" : "outline"} onClick={() => setAiAnswers((p) => ({ ...p, includeQr: false }))}>No</Button>
                  </div>
                </div>

                {/* Extra Instructions */}
                <div>
                  <Label className="font-semibold">6. Any extra instructions for the AI?</Label>
                  <Textarea
                    value={aiAnswers.extraInfo}
                    onChange={(e) => setAiAnswers((p) => ({ ...p, extraInfo: e.target.value }))}
                    placeholder="E.g. 'Make it look urgent', 'Add a tear-off tab at the bottom', 'Use modern minimalist style'..."
                    rows={2}
                    className="mt-1"
                  />
                </div>

                <p className="text-xs text-muted-foreground">Pet info from the form (name, breed, phone, address) will be included automatically.</p>

                <Button className="w-full gap-2" onClick={handleAiGenerate}>
                  <Wand2 className="h-4 w-4" /> Generate Flyer with AI
                </Button>
              </div>
            )}

            {aiStep === "generating" && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">AI is designing your flyer...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take 15–30 seconds</p>
              </div>
            )}

            {aiStep === "preview" && aiGeneratedHtml && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Your AI-Generated Flyer</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setAiStep("questions"); setAiGeneratedHtml(null); }}>
                      ← Redesign
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={handleAiDownloadPdf}>
                      <Download className="h-3.5 w-3.5" /> Download PDF
                    </Button>
                  </div>
                </div>
                <div className="border border-border rounded-lg overflow-hidden bg-white mx-auto" style={{ width: "100%", maxWidth: 400 }}>
                  <div
                    ref={aiPreviewRef}
                    style={{ width: 794, height: 1123, transform: "scale(0.5)", transformOrigin: "top left" }}
                    dangerouslySetInnerHTML={{ __html: aiGeneratedHtml }}
                  />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default LostFlyerBuilder;
