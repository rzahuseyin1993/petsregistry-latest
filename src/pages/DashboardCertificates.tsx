import { useState } from "react";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, Plus, Eye, FileDown, DollarSign, PawPrint, Trash2, ShieldCheck } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { certificateTemplates, type CertificateTemplate } from "@/lib/certificateTemplates";
import CertificateCreditsCard from "@/components/CertificateCreditsCard";

/* ─── Render certificate from template fields ─── */
const renderFromTemplate = (
  template: any,
  petData: Record<string, string>,
  petImageUrl?: string
) => {
  const colors = (template.colors as any) || {};
  const fields = ((template.fields as any[]) || []).filter((f: any) => f.visible);

  const replacePlaceholders = (label: string) => {
    return label
      .replace("{{pet_name}}", petData.pet_name || "—")
      .replace("{{species}}", petData.species || "—")
      .replace("{{breed}}", petData.breed || "—")
      .replace("{{color}}", petData.color || "—")
      .replace("{{pet_code}}", petData.pet_code || "—")
      .replace("{{microchip}}", petData.microchip || "—")
      .replace("{{owner_name}}", petData.owner_name || "—")
      .replace("{{owner_email}}", petData.owner_email || "—")
      .replace("{{date_issued}}", petData.date_issued || "—");
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: template.background_url
          ? `url(${template.background_url}) center/cover no-repeat`
          : colors.bg || "#FFFDF7",
        fontFamily: "'Georgia', serif",
        position: "relative",
        overflow: "hidden",
        fontSize: 0,
      }}
    >
      {!template.background_url && (
        <>
          <div style={{ position: "absolute", inset: "2.5%", border: `2px solid ${colors.border || "#C9B88C"}`, borderRadius: "6px", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: "3.5%", border: `1px solid ${colors.border || "#C9B88C"}`, borderRadius: "4px", pointerEvents: "none" }} />
        </>
      )}
      {fields.map((field: any) => {
        if (field.key === "pet_photo") {
          // Clamp photo into a square box so it never overflows the certificate frame.
          // Width is in cqw (container query units) so it always sizes relative to the cert canvas.
          const photoSize = "11cqw"; // ~11% of certificate width — fits comfortably inside the inner border
          // Keep the photo's right/bottom edge inside the frame (90% safe zone)
          const safeX = Math.min(field.x, 86);
          const safeY = Math.min(field.y, 78);
          return (
            <div
              key={field.id}
              style={{
                position: "absolute",
                left: `${safeX}%`,
                top: `${safeY}%`,
                width: photoSize,
                height: photoSize,
              }}
            >
              {petImageUrl ? (
                <img
                  src={petImageUrl}
                  alt="Pet"
                  crossOrigin="anonymous"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "8px",
                    border: `1px solid ${colors.border || "#C9B88C"}`,
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "8px",
                    border: `1px dashed ${colors.border || "#C9B88C"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.2cqw",
                    color: "#999",
                  }}
                >
                  No Photo
                </div>
              )}
            </div>
          );
        }

        const isCentered = ["title", "subtitle", "signature_line", "signature_label", "footer"].includes(field.key);
        // Scale font sizes using container query units (cqw) for responsive scaling
        // Original design: 28px title at ~800px wide → ~3.5cqw
        const scaledFontSize = `${(field.fontSize / 8)}cqw`;
        // Constrain text into a max-width box so long names/emails wrap inside the frame
        // instead of overflowing past the right border.
        const maxWidth = isCentered ? "90%" : `${Math.max(20, 95 - field.x)}%`;
        return (
          <div
            key={field.id}
            style={{
              position: "absolute",
              left: `${field.x}%`,
              top: `${field.y}%`,
              transform: isCentered ? "translateX(-50%)" : "none",
              maxWidth,
              fontSize: scaledFontSize,
              fontWeight: field.fontWeight,
              color: field.color,
              fontFamily: "'Georgia', serif",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: field.fontSize <= 10 ? "0.15cqw" : field.fontSize >= 24 ? "0.25cqw" : "0",
              textTransform: field.fontWeight === "600" || field.fontSize >= 24 ? "uppercase" : "none",
            }}
          >
            {field.type === "data" ? replacePlaceholders(field.label) : field.label}
          </div>
        );
      })}
    </div>
  );
};

const DEFAULT_CERTIFICATE_TEMPLATE = {
  id: "__default_certificate_template__",
  name: "Standard Certificate",
  description: "Built-in certificate template",
  background_url: null,
  is_active: true,
  colors: {
    bg: "#FFFDF7",
    text: "#2D2A26",
    accent: "#8B7355",
    border: "#C9B88C",
  },
  fields: [
    { id: "f1", type: "label", key: "title", label: "CERTIFICATE OF PET REGISTRATION", x: 50, y: 8, fontSize: 28, fontWeight: "700", color: "#2D2A26", visible: true },
    { id: "f2", type: "label", key: "subtitle", label: "Official Document — Pets Registry", x: 50, y: 15, fontSize: 12, fontWeight: "400", color: "#8B7355", visible: true },
    { id: "f3", type: "label", key: "pet_header", label: "PET DETAILS", x: 15, y: 30, fontSize: 10, fontWeight: "600", color: "#8B7355", visible: true },
    { id: "f4", type: "data", key: "pet_name", label: "Name: {{pet_name}}", x: 15, y: 36, fontSize: 13, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f5", type: "data", key: "species", label: "Species: {{species}}", x: 15, y: 42, fontSize: 13, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f6", type: "data", key: "breed", label: "Breed: {{breed}}", x: 15, y: 48, fontSize: 13, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f7", type: "data", key: "color", label: "Color: {{color}}", x: 15, y: 54, fontSize: 13, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f8", type: "data", key: "pet_code", label: "Pet Code: {{pet_code}}", x: 15, y: 60, fontSize: 13, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f9", type: "data", key: "microchip", label: "Microchip: {{microchip}}", x: 15, y: 66, fontSize: 13, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f10", type: "label", key: "owner_header", label: "OWNER INFORMATION", x: 60, y: 30, fontSize: 10, fontWeight: "600", color: "#8B7355", visible: true },
    { id: "f11", type: "data", key: "owner_name", label: "Owner: {{owner_name}}", x: 60, y: 36, fontSize: 13, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f12", type: "data", key: "owner_email", label: "Email: {{owner_email}}", x: 60, y: 42, fontSize: 13, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f13", type: "data", key: "date_issued", label: "Date Issued: {{date_issued}}", x: 60, y: 50, fontSize: 13, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f14", type: "data", key: "pet_photo", label: "{{pet_photo}}", x: 75, y: 60, fontSize: 0, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f15", type: "label", key: "signature_line", label: "___________________________", x: 50, y: 82, fontSize: 12, fontWeight: "400", color: "#2D2A26", visible: true },
    { id: "f16", type: "label", key: "signature_label", label: "Authorized Signature", x: 50, y: 87, fontSize: 10, fontWeight: "400", color: "#8B7355", visible: true },
    { id: "f17", type: "label", key: "footer", label: "PETS REGISTRY — OFFICIAL DOCUMENT", x: 50, y: 94, fontSize: 8, fontWeight: "400", color: "#8B7355", visible: true },
  ],
};

const DashboardCertificates = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [previewCert, setPreviewCert] = useState<any>(null);
  const [payConfirmCert, setPayConfirmCert] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: pets = [] } = useQuery({
    queryKey: ["my-pets", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("pets").select("id, name, species, breed, color, pet_code, microchip_number").eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["my-certificates", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_certificates")
        .select("*, pets(name, species, breed, color, pet_code, microchip_number)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!user,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["certificate-templates-active"],
    queryFn: async () => {
      const { data } = await supabase.from("certificate_templates").select("*").eq("is_active", true).order("created_at");
      return (data as any[]) || [];
    },
  });

  const { data: certPricingSettings } = useQuery({
    queryKey: ["certificate-pricing-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [
          "service_billing_certificate",
          "service_price_certificate_monthly",
          "service_price_certificate_yearly",
          "service_price_certificate_one_time",
          "certificate_fee",
        ]);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const certBillingMode = certPricingSettings?.service_billing_certificate || "one_time";
  const certPriceMonthly = certPricingSettings?.service_price_certificate_monthly || "5";
  const certPriceYearly = certPricingSettings?.service_price_certificate_yearly || "50";
  const certPriceOneTime = certPricingSettings?.service_price_certificate_one_time || certPricingSettings?.certificate_fee || "20";

  // Build display label based on billing mode
  const certActiveTypes = certBillingMode.split(",").filter(Boolean);
  const fee = parseFloat(certPriceOneTime);
  const certPriceLabel = (() => {
    if (certActiveTypes.includes("monthly") && certActiveTypes.includes("yearly")) return `$${certPriceMonthly}/mo or $${certPriceYearly}/yr`;
    if (certActiveTypes.includes("monthly")) return `$${certPriceMonthly}/mo`;
    if (certActiveTypes.includes("yearly")) return `$${certPriceYearly}/yr`;
    return `$${certPriceOneTime}`;
  })();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, email").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });
  const hasAdminTemplates = templates.length > 0;
  const templateOptions = hasAdminTemplates ? templates : [DEFAULT_CERTIFICATE_TEMPLATE];
  const petsWithCertificates = new Set(certificates.map((c: any) => c.pet_id));
  const availablePets = pets.filter((p: any) => !petsWithCertificates.has(p.id));

  const openCreateDialog = () => {
    setSelectedPetId("");
    setSelectedTemplateId(hasAdminTemplates ? "" : DEFAULT_CERTIFICATE_TEMPLATE.id);
    setShowNewDialog(true);
  };

  const handleCreate = async () => {
    if (!selectedPetId) return toast.error("Please select a pet");
    if (!selectedTemplateId) return toast.error("Please select a template");

    // Search admin templates, default template, AND built-in templates
    const selectedTemplate =
      templateOptions.find((template: any) => template.id === selectedTemplateId) ||
      certificateTemplates.find((t) => t.id === selectedTemplateId);
    if (!selectedTemplate) return toast.error("Please select a template");

    const isDefaultTemplate = selectedTemplate.id === DEFAULT_CERTIFICATE_TEMPLATE.id;
    const isBuiltInTemplate = certificateTemplates.some((t) => t.id === selectedTemplateId);
    const isAdminTemplate = !isDefaultTemplate && !isBuiltInTemplate;

    // For built-in templates, convert to the field-based format used by the certificate system
    const buildFallbackFromBuiltIn = (tpl: CertificateTemplate) => ({
      ...DEFAULT_CERTIFICATE_TEMPLATE,
      id: tpl.id,
      name: tpl.name,
      colors: {
        bg: tpl.bgColor,
        text: tpl.headerColor,
        accent: tpl.accentColor,
        border: tpl.borderColor,
      },
      fields: DEFAULT_CERTIFICATE_TEMPLATE.fields.map((f) => ({
        ...f,
        color: ["title", "pet_header", "owner_header"].includes(f.key)
          ? (f.key === "title" ? tpl.headerColor : tpl.accentColor)
          : ["subtitle", "signature_label", "footer"].includes(f.key)
            ? tpl.accentColor
            : tpl.headerColor,
      })),
    });

    try {
      const designData = isBuiltInTemplate
        ? { fallbackTemplate: buildFallbackFromBuiltIn(selectedTemplate as CertificateTemplate) }
        : isDefaultTemplate
          ? { fallbackTemplate: DEFAULT_CERTIFICATE_TEMPLATE }
          : {};

      const { data: created, error } = await supabase.from("pet_certificates").insert({
        user_id: user!.id,
        pet_id: selectedPetId,
        template_id: isAdminTemplate ? selectedTemplateId : null,
        status: "draft",
        design_data: designData,
      }).select("*, pets(name, species, breed, color, pet_code, microchip_number)").single();

      if (error) throw error;

      queryClient.setQueryData(["my-certificates", user?.id], (current: any[] = []) => {
        return created ? [created, ...current] : current;
      });
      await queryClient.invalidateQueries({ queryKey: ["my-certificates", user?.id] });

      setShowNewDialog(false);
      setSelectedPetId("");
      setSelectedTemplateId("");
      toast.success("Certificate created!");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this unpaid certificate? You can recreate it later.")) return;

    const previousCertificates = queryClient.getQueryData(["my-certificates", user?.id]);
    queryClient.setQueryData(["my-certificates", user?.id], (current: any[] = []) => current.filter((cert) => cert.id !== id));

    try {
      const { error } = await supabase.from("pet_certificates").delete().eq("id", id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["my-certificates", user?.id] });
      toast.success("Certificate deleted");
    } catch (e: any) {
      queryClient.setQueryData(["my-certificates", user?.id], previousCertificates);
      toast.error(e.message);
    }
  };

  const handlePay = async (cert: any) => {
    // Use credit instead of direct payment
    const { data: hasCredit, error: rpcErr } = await supabase.rpc("consume_certificate_credit" as any, { _user_id: user!.id });
    if (rpcErr) return toast.error(rpcErr.message);
    if (!hasCredit) {
      setPayConfirmCert(null);
      toast.error("No credits available. Please buy credits first.", { duration: 5000 });
      return;
    }

    const paymentId = `cert_credit_${Date.now()}`;
    const previousCertificates = queryClient.getQueryData(["my-certificates", user?.id]);

    queryClient.setQueryData(["my-certificates", user?.id], (current: any[] = []) =>
      current.map((item) => item.id === cert.id ? { ...item, is_paid: true, status: "active", payment_id: paymentId } : item)
    );

    try {
      const { error } = await supabase.from("pet_certificates").update({
        is_paid: true,
        status: "active",
        payment_id: paymentId,
      }).eq("id", cert.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["my-certificates", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["my-cert-credits", user?.id] });
      setPayConfirmCert(null);
      toast.success("Certificate issued! 1 credit used. You can now download it.");
    } catch (e: any) {
      queryClient.setQueryData(["my-certificates", user?.id], previousCertificates);
      // Refund the credit on failure
      await supabase.rpc("grant_certificate_credit" as any, { _user_id: user!.id, _amount: 1, _is_purchase: false });
      toast.error(e.message);
    }
  };

  const getPetData = (cert: any) => {
    const pet = cert.pets || pets.find((p: any) => p.id === cert.pet_id) || {};
    return {
      pet_name: pet.name || "",
      species: pet.species || "",
      breed: pet.breed || "",
      color: pet.color || "",
      pet_code: pet.pet_code || "",
      microchip: pet.microchip_number || "",
      owner_name: profile?.full_name || "",
      owner_email: profile?.email || "",
      date_issued: new Date(cert.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    };
  };

  const getTemplate = (cert: any) => {
    const fallbackTemplate = cert?.design_data && typeof cert.design_data === "object" && "fallbackTemplate" in cert.design_data
      ? (cert.design_data as any).fallbackTemplate
      : null;

    return fallbackTemplate || templates.find((t: any) => t.id === cert.template_id) || templates[0] || DEFAULT_CERTIFICATE_TEMPLATE;
  };

  const handleDownload = async (cert: any) => {
    if (!cert.is_paid) return toast.error("Please pay the fee first");
    if (cert.is_paused) return toast.error("This certificate is currently paused by admin");
    setDownloading(true);
    try {
      const template = getTemplate(cert);
      if (!template) throw new Error("No template found");
      const petData = getPetData(cert);

      const { data: images } = await supabase.from("pet_images").select("image_url").eq("pet_id", cert.pet_id).order("sort_order").limit(1);
      const petImageUrl = images?.[0]?.image_url;

      const container = document.createElement("div");
      container.style.width = "1123px";
      container.style.height = "794px";
      container.style.position = "fixed";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      container.style.containerType = "inline-size";
      document.body.appendChild(container);

      const { createRoot } = await import("react-dom/client");
      const root = createRoot(container);
      root.render(renderFromTemplate(template, petData, petImageUrl));

      await new Promise((r) => setTimeout(r, 500));
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, allowTaint: true });
      root.unmount();
      document.body.removeChild(container);

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 297, 210);

      // Embed QR code linking to the public verification page
      const certNumber = cert.certificate_number;
      if (certNumber) {
        const verifyUrl = `${window.location.origin}/verify?code=${encodeURIComponent(certNumber)}`;
        const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 256 });
        // Place QR (25mm) in bottom-right with small padding
        pdf.addImage(qrDataUrl, "PNG", 260, 173, 25, 25);
        pdf.setFontSize(7);
        pdf.setTextColor(100);
        pdf.text("Scan to verify", 272.5, 202, { align: "center" });
        pdf.text(certNumber, 272.5, 205, { align: "center" });
      }

      pdf.save(`Pet_Certificate_${petData.pet_name || "certificate"}.pdf`);
      toast.success("Certificate downloaded!");
    } catch (e: any) {
      toast.error("Download failed: " + e.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" /> Pet Certificates
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Get an official registration certificate for your pet ({certPriceLabel} per certificate)
            </p>
          </div>
          <Button onClick={openCreateDialog} disabled={availablePets.length === 0} className="gap-2">
            <Plus className="h-4 w-4" /> New Certificate
          </Button>
        </div>

        <div className="mb-6">
          <CertificateCreditsCard />
        </div>

        {!hasAdminTemplates && (
          <Card className="mb-4 border-dashed">
            <CardContent className="p-4 text-sm text-muted-foreground">
              No admin template is active right now, so new certificates will use the built-in standard template.
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : certificates.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center py-12"><Award className="h-12 w-12 text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">No certificates yet. Create one for your pet!</p></CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert: any) => {
              const pet = cert.pets || {};
              const template = getTemplate(cert);
              return (
                <Card key={cert.id} className={cert.is_paused ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    {template && (
                      <div className="border rounded mb-3 overflow-hidden relative" style={{ aspectRatio: "297/210", pointerEvents: "none", containerType: "inline-size" }}>
                        <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                          {renderFromTemplate(template, getPetData(cert))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PawPrint className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-foreground text-sm">{pet.name || "Pet"}</span>
                      </div>
                      <div className="flex gap-1">
                        {cert.is_paused && <Badge variant="secondary" className="text-xs">Paused</Badge>}
                        {cert.is_paid ? <Badge className="bg-green-600 text-white text-xs">Paid</Badge> : <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">Unpaid</Badge>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      {pet.species} • {pet.breed || "N/A"} • Code: {pet.pet_code || "N/A"}
                      {cert.is_paid && cert.certificate_number && (
                        <div className="mt-1 font-mono font-semibold text-primary flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> {cert.certificate_number}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {template && (
                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => setPreviewCert(cert)}>
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                      )}
                      {!cert.is_paid ? (
                        <>
                          <Button size="sm" className="flex-1 gap-1" onClick={() => setPayConfirmCert(cert)}>
                            <Award className="h-3.5 w-3.5" /> Use 1 Credit
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(cert.id)} title="Delete unpaid certificate">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" className="flex-1 gap-1" onClick={() => handleDownload(cert)} disabled={downloading || cert.is_paused}>
                          <FileDown className="h-3.5 w-3.5" /> Download
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={!!previewCert} onOpenChange={() => setPreviewCert(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>Certificate Preview</DialogTitle></DialogHeader>
            {previewCert && getTemplate(previewCert) && (
              <div className="border rounded-lg overflow-hidden relative" style={{ aspectRatio: "297/210", containerType: "inline-size" }}>
                <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                  {renderFromTemplate(getTemplate(previewCert), getPetData(previewCert))}
                </div>
              </div>
            )}
            <DialogFooter>
              {previewCert?.is_paid && (
                <Button onClick={() => { handleDownload(previewCert); setPreviewCert(null); }} disabled={downloading}>
                  <FileDown className="h-4 w-4 mr-2" /> Download PDF
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Pet Certificate</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Select a pet and choose a template. Fee: <strong>{certPriceLabel}</strong> per certificate.</p>
            <div className="space-y-4">
              <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                <SelectTrigger><SelectValue placeholder="Select a pet" /></SelectTrigger>
                <SelectContent>
                  {availablePets.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.species})</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Visual template grid */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Choose a Template</p>
                {/* Admin templates first */}
                {hasAdminTemplates && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {templates.map((t: any) => {
                      const colors = (t.colors as any) || {};
                      return (
                        <button key={t.id} onClick={() => setSelectedTemplateId(t.id)}
                          className={`text-left rounded-lg border-2 overflow-hidden transition-all ${selectedTemplateId === t.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}>
                          <div style={{ aspectRatio: "297/210", backgroundColor: colors.bg || "#FFFDF7" }} className="relative">
                            {t.background_url && <img src={t.background_url} alt="" className="w-full h-full object-cover" />}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span style={{ fontSize: "5px", fontWeight: 700, color: colors.text || "#2D2A26", letterSpacing: "1px" }}>CERTIFICATE</span>
                            </div>
                          </div>
                          <div className="p-1.5 bg-card"><span className="text-[10px] font-medium text-foreground truncate block">{t.name}</span></div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Built-in templates */}
                <p className="text-[10px] text-muted-foreground mb-1">{hasAdminTemplates ? "Or choose a built-in template:" : "Built-in templates:"}</p>
                <div className="grid grid-cols-4 gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {certificateTemplates.map((tpl) => (
                    <button key={tpl.id} onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`text-left rounded-lg border-2 overflow-hidden transition-all ${selectedTemplateId === tpl.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}>
                      <div className="relative" style={{ aspectRatio: "297/210", backgroundColor: tpl.bgColor }}>
                        <div style={{ position: "absolute", inset: "4px", border: `1.5px solid ${tpl.borderColor}`, borderRadius: "3px", pointerEvents: "none" }} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div style={{ color: tpl.headerColor, fontSize: "5px", fontWeight: 700, letterSpacing: "0.5px", fontFamily: tpl.fontFamily }}>CERTIFICATE</div>
                          <div style={{ width: "30%", height: "1px", backgroundColor: tpl.borderColor, margin: "2px 0" }} />
                          <div style={{ color: tpl.accentColor, fontSize: "3.5px", fontFamily: tpl.fontFamily }}>Pet Registration</div>
                        </div>
                      </div>
                      <div className="p-1.5 bg-card"><span className="text-[10px] font-medium text-foreground truncate block">{tpl.name}</span></div>
                    </button>
                  ))}
                </div>
              </div>
              {availablePets.length === 0 && <p className="text-sm text-amber-600">All pets already have certificates or you haven't registered any.</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!selectedPetId || !selectedTemplateId}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!payConfirmCert} onOpenChange={() => setPayConfirmCert(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Issue Certificate</DialogTitle></DialogHeader>
            {payConfirmCert && getTemplate(payConfirmCert) && (
              <>
                <div className="border rounded-lg overflow-hidden relative" style={{ aspectRatio: "297/210", containerType: "inline-size" }}>
                  <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                    {renderFromTemplate(getTemplate(payConfirmCert), getPetData(payConfirmCert))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                  <div>
                    <p className="font-medium text-foreground">Certificate for {payConfirmCert.pets?.name || "Pet"}</p>
                    <p className="text-sm text-muted-foreground">This will use 1 credit and assign a unique verification number.</p>
                  </div>
                  <Award className="h-8 w-8 text-amber-500" />
                </div>
              </>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayConfirmCert(null)}>Cancel</Button>
              <Button onClick={() => payConfirmCert && handlePay(payConfirmCert)} className="gap-2">
                <Award className="h-4 w-4" /> Issue (1 credit)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default DashboardCertificates;
