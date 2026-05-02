import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import grapesjs, { Editor } from "grapesjs";
import grapesjsPresetWebpage from "grapesjs-preset-webpage";
import grapesjsBlocksBasic from "grapesjs-blocks-basic";
import grapesjsPluginForms from "grapesjs-plugin-forms";
import grapesjsStyleBg from "grapesjs-style-bg";
import grapesjsTabs from "grapesjs-tabs";
import grapesjsCustomCode from "grapesjs-custom-code";
import "grapesjs/dist/css/grapes.min.css";
import { Layout, Plus, Save, Eye, Trash2, Copy, Monitor, Tablet, Smartphone, Undo2, Redo2, Code, Layers, PaintBucket, Settings2, ExternalLink, Bot } from "lucide-react";
import AiSiteEditorPanel from "@/components/AiSiteEditorPanel";
import { toast } from "sonner";

import AdminSidebar from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getCmsStarterTemplate } from "@/lib/cmsStarterTemplates";

const AdminPageBuilder = () => {
  const editorRef = useRef<Editor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [selectedSlug, setSelectedSlug] = useState("home-hero");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["cms-pages-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cms_pages").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const selectedPage = pages.find((page) => page.slug === selectedSlug);
  const starterTemplate = selectedPage ? getCmsStarterTemplate(selectedPage.slug) : null;
  const selectedPageGjsData = selectedPage?.gjs_data as Record<string, unknown> | null | undefined;
  const hasProjectData = !!selectedPageGjsData && Object.keys(selectedPageGjsData).length > 0 && "pages" in selectedPageGjsData;
  const hasSavedHtml = !!selectedPage?.html_content?.trim();

  useEffect(() => {
    if (!selectedPage && pages.length > 0) {
      setSelectedSlug(pages[0].slug);
    }
  }, [pages, selectedPage]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editorRef.current || !selectedPage) return;
      const editor = editorRef.current;
      const { error } = await supabase
        .from("cms_pages")
        .update({
          html_content: editor.getHtml(),
          css_content: editor.getCss(),
          gjs_data: editor.getProjectData(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedPage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Page saved!");
      queryClient.invalidateQueries({ queryKey: ["cms-pages-admin"] });
      queryClient.invalidateQueries({ queryKey: ["cms-page", selectedSlug] });
    },
    onError: () => toast.error("Failed to save"),
  });

  const togglePublish = useMutation({
    mutationFn: async () => {
      if (!selectedPage) return;
      const { error } = await supabase
        .from("cms_pages")
        .update({ is_published: !selectedPage.is_published })
        .eq("id", selectedPage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(selectedPage?.is_published ? "Unpublished" : "Published!");
      queryClient.invalidateQueries({ queryKey: ["cms-pages-admin"] });
    },
    onError: () => toast.error("Failed to update"),
  });

  const createPage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cms_pages").insert({ title: newPageTitle, slug: newPageSlug });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Page created!");
      setDialogOpen(false);
      setNewPageTitle("");
      setNewPageSlug("");
      queryClient.invalidateQueries({ queryKey: ["cms-pages-admin"] });
    },
    onError: (error: { message?: string }) => toast.error(error.message || "Failed to create page"),
  });

  const deletePage = useMutation({
    mutationFn: async () => {
      if (!selectedPage) return;
      const { error } = await supabase.from("cms_pages").delete().eq("id", selectedPage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Page deleted!");
      setSelectedSlug(pages[0]?.slug || "");
      queryClient.invalidateQueries({ queryKey: ["cms-pages-admin"] });
    },
    onError: () => toast.error("Failed to delete"),
  });

  const handleUndo = useCallback(() => editorRef.current?.UndoManager.undo(), []);
  const handleRedo = useCallback(() => editorRef.current?.UndoManager.redo(), []);

  const setDevice = useCallback((device: string) => {
    editorRef.current?.setDevice(device);
  }, []);

  const togglePreview = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (previewMode) {
      editor.stopCommand("preview");
    } else {
      editor.runCommand("preview");
    }
    setPreviewMode(!previewMode);
  }, [previewMode]);

  useEffect(() => {
    if (!editorContainerRef.current || !selectedPage) return;

    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
    }

    const editor = grapesjs.init({
      container: editorContainerRef.current,
      height: "100%",
      width: "auto",
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      plugins: [
        grapesjsBlocksBasic,
        grapesjsPresetWebpage,
        grapesjsPluginForms,
        grapesjsStyleBg,
        grapesjsTabs,
        grapesjsCustomCode,
      ],
      pluginsOpts: {
        [grapesjsBlocksBasic as unknown as string]: {
          flexGrid: true,
        },
        [grapesjsPresetWebpage as unknown as string]: {
          modalImport: true,
          textCleanCanvas: "Are you sure you want to clear the canvas?",
        },
        [grapesjsPluginForms as unknown as string]: {},
        [grapesjsStyleBg as unknown as string]: {},
        [grapesjsTabs as unknown as string]: {
          tabsBlock: { category: "Extra" },
        },
        [grapesjsCustomCode as unknown as string]: {
          blockCustomCode: { category: "Extra" },
        },
      },
      deviceManager: {
        devices: [
          { name: "Desktop", width: "" },
          { name: "Tablet", width: "768px", widthMedia: "992px" },
          { name: "Mobile", width: "375px", widthMedia: "480px" },
        ],
      },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Poppins:wght@300;400;500;600;700;800&family=Roboto:wght@300;400;500;700;900&family=Montserrat:wght@300;400;500;600;700;800;900&display=swap",
        ],
        scripts: [],
      },
      styleManager: {
        sectors: [
          {
            name: "General",
            open: true,
            properties: [
              { extend: "float", type: "radio" },
              "display",
              { extend: "position", type: "select" },
              "top", "right", "bottom", "left",
            ],
          },
          {
            name: "Dimension",
            open: false,
            properties: [
              "width", "height", "max-width", "min-height",
              "margin", "padding",
            ],
          },
          {
            name: "Typography",
            open: false,
            properties: [
              "font-family", "font-size", "font-weight",
              "letter-spacing", "color", "line-height",
              "text-align", "text-decoration", "text-shadow",
              { extend: "text-align", type: "radio" },
            ],
          },
          {
            name: "Decorations",
            open: false,
            properties: [
              "opacity", "border-radius",
              "border", "box-shadow", "background",
              "background-color",
            ],
          },
          {
            name: "Extra",
            open: false,
            properties: [
              "transition", "perspective", "transform",
              "overflow", "cursor",
            ],
          },
        ],
      },
    });

    // Add custom blocks for website sections
    const bm = editor.Blocks;

    bm.add("hero-section", {
      label: "Hero Section",
      category: "Sections",
      content: `<section style="min-height:500px;display:flex;align-items:center;justify-content:center;text-align:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:60px 20px;">
        <div style="max-width:800px;">
          <h1 style="font-size:48px;font-weight:800;color:white;margin-bottom:16px;font-family:'Inter',sans-serif;">Your Amazing Headline</h1>
          <p style="font-size:18px;color:rgba(255,255,255,0.9);margin-bottom:32px;line-height:1.6;">Add your compelling description here. Make it short and impactful.</p>
          <a href="#" style="display:inline-block;padding:14px 32px;background:white;color:#667eea;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Get Started</a>
        </div>
      </section>`,
      media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="9" x2="18" y2="9"/><line x1="8" y1="12" x2="16" y2="12"/><rect x1="9" y1="15" x2="15" y2="17" rx="1"/></svg>`,
    });

    bm.add("feature-grid", {
      label: "Feature Cards",
      category: "Sections",
      content: `<section style="padding:60px 20px;background:#f9fafb;">
        <div style="max-width:1100px;margin:0 auto;">
          <h2 style="text-align:center;font-size:32px;font-weight:700;margin-bottom:40px;">Our Features</h2>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;">
            <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <div style="width:48px;height:48px;border-radius:12px;background:#667eea;margin-bottom:16px;"></div>
              <h3 style="font-size:20px;font-weight:600;margin-bottom:8px;">Feature One</h3>
              <p style="color:#6b7280;line-height:1.6;">Description of this amazing feature and how it helps.</p>
            </div>
            <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <div style="width:48px;height:48px;border-radius:12px;background:#10b981;margin-bottom:16px;"></div>
              <h3 style="font-size:20px;font-weight:600;margin-bottom:8px;">Feature Two</h3>
              <p style="color:#6b7280;line-height:1.6;">Description of this amazing feature and how it helps.</p>
            </div>
            <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <div style="width:48px;height:48px;border-radius:12px;background:#f59e0b;margin-bottom:16px;"></div>
              <h3 style="font-size:20px;font-weight:600;margin-bottom:8px;">Feature Three</h3>
              <p style="color:#6b7280;line-height:1.6;">Description of this amazing feature and how it helps.</p>
            </div>
          </div>
        </div>
      </section>`,
      media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="6" height="8" rx="1"/><rect x="9" y="3" width="6" height="8" rx="1"/><rect x="16" y="3" width="6" height="8" rx="1"/><line x1="2" y1="14" x2="22" y2="14"/></svg>`,
    });

    bm.add("cta-banner", {
      label: "CTA Banner",
      category: "Sections",
      content: `<section style="padding:50px 20px;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);text-align:center;">
        <h2 style="font-size:28px;font-weight:700;color:white;margin-bottom:12px;">Ready to Get Started?</h2>
        <p style="color:rgba(255,255,255,0.85);margin-bottom:24px;font-size:16px;">Join thousands of happy pet owners today.</p>
        <a href="#" style="display:inline-block;padding:12px 28px;background:#10b981;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Sign Up Now</a>
      </section>`,
      media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><rect x="8" y="13" width="8" height="2" rx="1"/></svg>`,
    });

    bm.add("testimonial-section", {
      label: "Testimonials",
      category: "Sections",
      content: `<section style="padding:60px 20px;background:white;">
        <div style="max-width:900px;margin:0 auto;text-align:center;">
          <h2 style="font-size:32px;font-weight:700;margin-bottom:40px;">What Our Members Say</h2>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:24px;">
            <div style="background:#f9fafb;border-radius:12px;padding:24px;text-align:left;">
              <p style="color:#4b5563;line-height:1.7;font-style:italic;margin-bottom:16px;">"This platform helped me find my lost dog within hours. Amazing community!"</p>
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;border-radius:50%;background:#667eea;"></div>
                <div><strong style="font-size:14px;">Jane Smith</strong><br/><span style="font-size:12px;color:#9ca3af;">Pet Owner</span></div>
              </div>
            </div>
            <div style="background:#f9fafb;border-radius:12px;padding:24px;text-align:left;">
              <p style="color:#4b5563;line-height:1.7;font-style:italic;margin-bottom:16px;">"The best pet registration service I've ever used. Highly recommended!"</p>
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;border-radius:50%;background:#10b981;"></div>
                <div><strong style="font-size:14px;">John Doe</strong><br/><span style="font-size:12px;color:#9ca3af;">Member</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>`,
      media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21c3-3 6-10 6-15h4c0 5-3 12-6 15"/><path d="M13 21c3-3 6-10 6-15h4c0 5-3 12-6 15"/></svg>`,
    });

    bm.add("pricing-table", {
      label: "Pricing Cards",
      category: "Sections",
      content: `<section style="padding:60px 20px;background:#f9fafb;">
        <div style="max-width:900px;margin:0 auto;">
          <h2 style="text-align:center;font-size:32px;font-weight:700;margin-bottom:40px;">Choose Your Plan</h2>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">
            <div style="background:white;border-radius:12px;padding:32px;text-align:center;border:1px solid #e5e7eb;">
              <h3 style="font-size:18px;font-weight:600;">Basic</h3>
              <div style="font-size:36px;font-weight:800;margin:16px 0;">$5<span style="font-size:14px;color:#9ca3af;">/mo</span></div>
              <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">For individual pet owners</p>
              <a href="#" style="display:block;padding:10px;background:#e5e7eb;border-radius:8px;text-decoration:none;color:#374151;font-weight:600;">Get Started</a>
            </div>
            <div style="background:white;border-radius:12px;padding:32px;text-align:center;border:2px solid #667eea;position:relative;">
              <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#667eea;color:white;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:600;">Popular</div>
              <h3 style="font-size:18px;font-weight:600;">Pro</h3>
              <div style="font-size:36px;font-weight:800;margin:16px 0;">$15<span style="font-size:14px;color:#9ca3af;">/mo</span></div>
              <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">For families with multiple pets</p>
              <a href="#" style="display:block;padding:10px;background:#667eea;border-radius:8px;text-decoration:none;color:white;font-weight:600;">Get Started</a>
            </div>
            <div style="background:white;border-radius:12px;padding:32px;text-align:center;border:1px solid #e5e7eb;">
              <h3 style="font-size:18px;font-weight:600;">Enterprise</h3>
              <div style="font-size:36px;font-weight:800;margin:16px 0;">$49<span style="font-size:14px;color:#9ca3af;">/mo</span></div>
              <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">For shelters & organizations</p>
              <a href="#" style="display:block;padding:10px;background:#e5e7eb;border-radius:8px;text-decoration:none;color:#374151;font-weight:600;">Contact Us</a>
            </div>
          </div>
        </div>
      </section>`,
      media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="6" height="16" rx="1"/><rect x="9" y="2" width="6" height="20" rx="1"/><rect x="16" y="4" width="6" height="16" rx="1"/></svg>`,
    });

    bm.add("image-text-row", {
      label: "Image + Text",
      category: "Sections",
      content: `<section style="padding:60px 20px;background:white;">
        <div style="max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:40px;">
          <div style="flex:1;"><img src="/placeholder.svg" alt="Feature" style="width:100%;border-radius:12px;"/></div>
          <div style="flex:1;">
            <h2 style="font-size:28px;font-weight:700;margin-bottom:12px;">Why Choose Us</h2>
            <p style="color:#6b7280;line-height:1.7;margin-bottom:20px;">We provide the best tools to keep your pets safe and connected. Our platform brings together pet owners, shelters, and services.</p>
            <a href="#" style="display:inline-block;padding:10px 24px;background:#667eea;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Learn More</a>
          </div>
        </div>
      </section>`,
      media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="9" height="16" rx="1"/><line x1="14" y1="7" x2="22" y2="7"/><line x1="14" y1="11" x2="22" y2="11"/><line x1="14" y1="15" x2="19" y2="15"/></svg>`,
    });

    bm.add("stats-section", {
      label: "Stats Bar",
      category: "Sections",
      content: `<section style="padding:40px 20px;background:#1e3a5f;">
        <div style="max-width:900px;margin:0 auto;display:flex;justify-content:space-around;text-align:center;">
          <div><div style="font-size:36px;font-weight:800;color:white;">5,000+</div><div style="color:rgba(255,255,255,0.7);font-size:14px;margin-top:4px;">Pets Registered</div></div>
          <div><div style="font-size:36px;font-weight:800;color:white;">200+</div><div style="color:rgba(255,255,255,0.7);font-size:14px;margin-top:4px;">Lost Pets Found</div></div>
          <div><div style="font-size:36px;font-weight:800;color:white;">50+</div><div style="color:rgba(255,255,255,0.7);font-size:14px;margin-top:4px;">Partner Businesses</div></div>
          <div><div style="font-size:36px;font-weight:800;color:white;">98%</div><div style="color:rgba(255,255,255,0.7);font-size:14px;margin-top:4px;">Satisfaction Rate</div></div>
        </div>
      </section>`,
      media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="12" width="4" height="8"/><rect x="10" y="6" width="4" height="14"/><rect x="17" y="9" width="4" height="11"/></svg>`,
    });

    bm.add("footer-section", {
      label: "Footer",
      category: "Sections",
      content: `<footer style="padding:40px 20px;background:#111827;color:white;">
        <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:32px;">
          <div>
            <h4 style="font-weight:700;margin-bottom:16px;">PetsRegistry</h4>
            <p style="color:#9ca3af;font-size:14px;line-height:1.6;">Keep your pets safe and connected with our community.</p>
          </div>
          <div>
            <h4 style="font-weight:600;margin-bottom:16px;font-size:14px;">Links</h4>
            <div style="display:flex;flex-direction:column;gap:8px;"><a href="/search" style="color:#9ca3af;text-decoration:none;font-size:14px;">Search Pets</a><a href="/adopt" style="color:#9ca3af;text-decoration:none;font-size:14px;">Adopt</a><a href="/store" style="color:#9ca3af;text-decoration:none;font-size:14px;">Store</a></div>
          </div>
          <div>
            <h4 style="font-weight:600;margin-bottom:16px;font-size:14px;">Support</h4>
            <div style="display:flex;flex-direction:column;gap:8px;"><a href="/contact" style="color:#9ca3af;text-decoration:none;font-size:14px;">Contact Us</a><a href="/about" style="color:#9ca3af;text-decoration:none;font-size:14px;">About</a><a href="/privacy" style="color:#9ca3af;text-decoration:none;font-size:14px;">Privacy Policy</a></div>
          </div>
          <div>
            <h4 style="font-weight:600;margin-bottom:16px;font-size:14px;">Contact</h4>
            <p style="color:#9ca3af;font-size:14px;line-height:1.8;">info@petsregistry.com<br/>+1 (555) 123-4567</p>
          </div>
        </div>
        <div style="border-top:1px solid #374151;margin-top:32px;padding-top:16px;text-align:center;color:#6b7280;font-size:12px;">© 2026 PetsRegistry. All rights reserved.</div>
      </footer>`,
      media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="14" width="20" height="7" rx="1"/><line x1="6" y1="17" x2="10" y2="17"/><line x1="14" y1="17" x2="18" y2="17"/></svg>`,
    });

    bm.add("divider", {
      label: "Divider",
      category: "Basic",
      content: `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />`,
    });

    bm.add("spacer", {
      label: "Spacer",
      category: "Basic",
      content: `<div style="height:60px;"></div>`,
    });

    // Inject site design tokens into the canvas iframe so pages look like the live site
    editor.on("load", () => {
      const frame = editor.Canvas.getFrameEl();
      if (frame?.contentDocument) {
        const doc = frame.contentDocument;
        const style = doc.createElement("style");
        style.textContent = `
          :root {
            --background: 210 40% 98%;
            --foreground: 222 47% 11%;
            --primary: 175 84% 25%;
            --primary-foreground: 0 0% 100%;
            --secondary: 210 40% 96%;
            --muted: 210 40% 96%;
            --muted-foreground: 215 20% 40%;
            --accent: 38 92% 50%;
            --border: 214 32% 91%;
            --card: 0 0% 100%;
            --card-foreground: 222 47% 11%;
            --destructive: 0 72% 46%;
            --radius: 0.75rem;
            --font-display: 'Outfit', sans-serif;
            --font-body: 'Inter', sans-serif;
          }
          body {
            font-family: 'Inter', sans-serif;
            color: hsl(222 47% 11%);
            background: hsl(210 40% 98%);
            margin: 0;
            -webkit-font-smoothing: antialiased;
          }
          h1, h2, h3, h4, h5, h6 {
            font-family: 'Outfit', sans-serif;
          }
          * { box-sizing: border-box; }
          img { max-width: 100%; height: auto; }
        `;
        doc.head.appendChild(style);
      }
    });

    // Load content
    if (hasProjectData && selectedPageGjsData) {
      editor.loadProjectData(selectedPageGjsData as any);
    } else if (hasSavedHtml) {
      editor.setComponents(selectedPage.html_content);
      if (selectedPage.css_content) editor.setStyle(selectedPage.css_content);
    } else if (starterTemplate) {
      editor.setComponents(starterTemplate.html);
      editor.setStyle(starterTemplate.css);
    }

    editorRef.current = editor;

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [selectedPage?.id]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
          <Layout className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-sm font-bold text-foreground mr-2">Page Builder</h1>

          <Select value={selectedSlug} onValueChange={setSelectedSlug}>
            <SelectTrigger className="w-52 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {(() => {
                const groups: Record<string, typeof pages> = {
                  "📄 Public Pages": [],
                  "👤 Member Pages": [],
                  "⚙️ Admin Pages": [],
                  "🧩 Layout": [],
                  "📝 Other": [],
                };
                pages.forEach((page) => {
                  const s = page.slug;
                  if (s.startsWith("admin-")) groups["⚙️ Admin Pages"].push(page);
                  else if (s.startsWith("dashboard")) groups["👤 Member Pages"].push(page);
                  else if (["header", "footer"].includes(s)) groups["🧩 Layout"].push(page);
                  else if (["home-hero","home-body","about","store","search","adoption","lost-pets","directory","membership","contact","donate","privacy-policy","pet-expert","pet-map","login","register","pet-profile","business-profile"].includes(s)) groups["📄 Public Pages"].push(page);
                  else groups["📝 Other"].push(page);
                });
                return Object.entries(groups).filter(([, p]) => p.length > 0).map(([label, groupPages]) => (
                  <div key={label}>
                    <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
                    {groupPages.map((page) => (
                      <SelectItem key={page.slug} value={page.slug} className="text-xs">
                        {page.title} {page.is_published ? "✓" : ""}
                      </SelectItem>
                    ))}
                  </div>
                ));
              })()}
            </SelectContent>
          </Select>

          {selectedPage && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => {
                const slugToRoute: Record<string, string> = {
                  "home-hero": "/", "home-body": "/", about: "/about", store: "/store", search: "/search",
                  adoption: "/adopt", "lost-pets": "/lost-pets", directory: "/directory", membership: "/membership",
                  contact: "/contact", donate: "/donate", "privacy-policy": "/privacy-policy", "pet-expert": "/pet-expert",
                  "pet-map": "/pet-map", "pet-profile": "/pet/example", "business-profile": "/directory/example",
                  login: "/login", register: "/register", resources: "/resources",
                  dashboard: "/dashboard", "dashboard-pets": "/dashboard", "dashboard-inbox": "/dashboard/inbox",
                  "dashboard-membership": "/dashboard/membership", "dashboard-orders": "/dashboard/orders",
                  "dashboard-settings": "/dashboard/settings", "dashboard-adoption": "/dashboard/adoption",
                  "dashboard-lost-reports": "/dashboard/lost-reports", "dashboard-directory": "/dashboard/directory",
                  "dashboard-flyer-builder": "/dashboard/flyer-builder", "dashboard-register-pet": "/dashboard/register-pet",
                  "dashboard-health": "/dashboard/health", "dashboard-certificates": "/dashboard/certificates",
                  "dashboard-articles": "/dashboard/articles",
                  "admin-dashboard": "/admin", "admin-members": "/admin/memberships", "admin-pets": "/admin/pets",
                  "admin-products": "/admin/products", "admin-orders": "/admin/orders", "admin-users": "/admin/users",
                  "admin-payments": "/admin/payments", "admin-settings": "/admin/settings",
                  "admin-adoptions": "/admin/adoptions", "admin-lost-reports": "/admin/lost-reports",
                  "admin-directory": "/admin/directory", "admin-contacts": "/admin/contacts",
                  "admin-donations": "/admin/donations", "admin-permissions": "/admin/permissions",
                  "admin-flyer-templates": "/admin/flyer-templates", "admin-flyer-editor": "/admin/flyer-editor",
                  "admin-seo": "/admin/seo", "admin-blog": "/admin/blog", "admin-certificates": "/admin/certificates",
                  "admin-map-settings": "/admin/map-settings", "admin-service-subscriptions": "/admin/service-subscriptions",
                  "admin-page-builder": "/admin/page-builder",
                };
                const route = slugToRoute[selectedPage.slug] || "/";
                window.open(route, "_blank");
              }}
              title="Open this page in a new tab to see the live version"
            >
              <ExternalLink className="h-3 w-3" /> Live Page
            </Button>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-8 text-xs">
                <Plus className="h-3 w-3" /> New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Page</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Title</Label><Input value={newPageTitle} onChange={(e) => setNewPageTitle(e.target.value)} placeholder="About Us" /></div>
                <div><Label>Slug</Label><Input value={newPageSlug} onChange={(e) => setNewPageSlug(e.target.value)} placeholder="about-us" /></div>
                <Button onClick={() => createPage.mutate()} disabled={!newPageTitle || !newPageSlug}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Separator */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* Device buttons */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDevice("Desktop")} title="Desktop">
              <Monitor className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDevice("Tablet")} title="Tablet">
              <Tablet className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDevice("Mobile")} title="Mobile">
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleUndo} title="Undo">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRedo} title="Redo">
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={togglePreview}>
            <Eye className="h-3 w-3" /> {previewMode ? "Edit" : "Preview"}
          </Button>

          <Button
            variant={aiPanelOpen ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
          >
            <Bot className="h-3 w-3" /> AI Editor
          </Button>

          <div className="ml-auto flex items-center gap-2">
            {selectedPage && (
              <Badge variant={selectedPage.is_published ? "default" : "secondary"} className="text-xs cursor-pointer" onClick={() => togglePublish.mutate()}>
                {selectedPage.is_published ? "Published" : "Draft"}
              </Badge>
            )}
            <Button variant="destructive" size="sm" className="h-8 text-xs gap-1" onClick={() => {
              if (confirm("Delete this page?")) deletePage.mutate();
            }}>
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-3 w-3" /> {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* GrapesJS Editor + AI Panel */}
        <div className="flex flex-1 overflow-hidden">
          <div ref={editorContainerRef} className="flex-1" />
          {aiPanelOpen && (
            <AiSiteEditorPanel
              editor={editorRef.current}
              onClose={() => setAiPanelOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Custom GrapesJS styles */}
      <style>{`
        .gjs-one-bg { background-color: hsl(var(--card)) !important; }
        .gjs-two-color { color: hsl(var(--foreground)) !important; }
        .gjs-three-bg { background-color: hsl(var(--primary)) !important; }
        .gjs-four-color, .gjs-four-color-h:hover { color: hsl(var(--primary)) !important; }
        .gjs-pn-panel { border-color: hsl(var(--border)) !important; }
        .gjs-pn-views-container, .gjs-pn-views { background-color: hsl(var(--card)) !important; }
        .gjs-sm-sector .gjs-sm-sector-title { background-color: hsl(var(--muted)) !important; color: hsl(var(--foreground)) !important; }
        .gjs-clm-tags .gjs-sm-tag { background-color: hsl(var(--primary)) !important; }
        .gjs-block { border: 1px solid hsl(var(--border)) !important; border-radius: 8px !important; padding: 8px !important; transition: all 0.15s !important; }
        .gjs-block:hover { border-color: hsl(var(--primary)) !important; box-shadow: 0 2px 8px hsl(var(--primary) / 0.15) !important; }
        .gjs-block__media { height: 36px !important; }
        .gjs-block-label { font-size: 11px !important; }
        .gjs-category-title { font-weight: 600 !important; font-size: 12px !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; }
        .gjs-blocks-cs { padding: 8px !important; }
        .gjs-pn-btn { border-radius: 6px !important; }
        .gjs-pn-btn.gjs-pn-active { background-color: hsl(var(--primary)) !important; color: white !important; }
        .gjs-cv-canvas { background-color: hsl(var(--muted)) !important; }
        .gjs-frame-wrapper { box-shadow: 0 4px 20px rgba(0,0,0,0.1) !important; border-radius: 4px !important; }
      `}</style>
    </div>
  );
};

export default AdminPageBuilder;
