import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, Plus, Eye, FileDown, PawPrint, Trash2, ShieldCheck, Printer, Baby, FileText, Users } from "lucide-react";
import CertificateCreditsCard from "@/components/CertificateCreditsCard";
import CertificateSampleShowcase from "@/components/CertificateSampleShowcase";
import CertificatePurchaseHistory from "@/components/CertificatePurchaseHistory";
import PetBirthFields, { birthFormToPetPayload, emptyBirthForm, petToBirthForm } from "@/components/PetBirthFields";
import { buildCertificatePetData, PET_CERTIFICATE_SELECT } from "@/lib/certificateData";
import {
  ensureCertificateTemplateFields,
  getCertificatePetImageUrl,
  getDefaultTemplateForType,
  getParentPhotoUrls,
  renderCertificateView,
} from "@/lib/certificateRender";
import { downloadCertificatePdf, generateCertificatePdf, printCertificatePdf } from "@/lib/certificatePdf";
import {
  CERTIFICATE_TYPE_LABELS,
  type CertificateType,
  getUniversalCredits,
} from "@/lib/certificateTypes";
import { resizeImage, uploadRaw } from "@/lib/imageUpload";

const DashboardCertificates = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentConfirmRef = useRef(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [certType, setCertType] = useState<CertificateType>("ownership");
  const [selectedPetId, setSelectedPetId] = useState("");
  const [birthForm, setBirthForm] = useState(emptyBirthForm);
  const [issuedForName, setIssuedForName] = useState("");
  const [issuedForEmail, setIssuedForEmail] = useState("");
  const [sirePhotoFile, setSirePhotoFile] = useState<File | null>(null);
  const [damPhotoFile, setDamPhotoFile] = useState<File | null>(null);
  const [sirePreview, setSirePreview] = useState<string | null>(null);
  const [damPreview, setDamPreview] = useState<string | null>(null);
  const [previewCert, setPreviewCert] = useState<any>(null);
  const [previewShowPhoto, setPreviewShowPhoto] = useState(false);
  const [savingPhotoToggle, setSavingPhotoToggle] = useState(false);
  const [payConfirmCert, setPayConfirmCert] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: pets = [] } = useQuery({
    queryKey: ["my-pets", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, name, species, breed, color, pet_code, microchip_number, date_of_birth, sex, birth_location, birth_weight, birth_height, eye_color, breeder_name, sire_pet_id, dam_pet_id, sire_name, dam_name, sire_photo_url, dam_photo_url")
        .eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["my-certificates", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_certificates")
        .select(PET_CERTIFICATE_SELECT)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!user,
  });

  const { data: credits } = useQuery({
    queryKey: ["my-cert-credits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("certificate_credits" as any).select("*").eq("user_id", user!.id).maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    const creditsAdded = searchParams.get("credits_added");
    const orderId = searchParams.get("order_id");
    if (!creditsAdded || !orderId || !user || paymentConfirmRef.current) return;

    paymentConfirmRef.current = true;
    let cancelled = false;
    let attempts = 0;

    const runConfirm = async () => {
      const { data, error } = await supabase.functions.invoke("certificate-confirm", { body: { order_id: orderId } });
      if (cancelled) return;
      if (error) {
        toast.error("Could not confirm payment yet. Please refresh in a moment.");
        setSearchParams({}, { replace: true });
        return;
      }
      if (data?.credits_granted || data?.status === "paid") {
        queryClient.invalidateQueries({ queryKey: ["my-cert-credits", user.id] });
        queryClient.invalidateQueries({ queryKey: ["cert-credit-orders", user.id] });
        toast.success("Certificate credits added to your account!");
        setSearchParams({}, { replace: true });
        return;
      }
      attempts += 1;
      if (attempts < 6) setTimeout(runConfirm, 2500);
      else {
        toast.info("Payment received. Credits may take a moment — refresh if they don't appear.");
        setSearchParams({}, { replace: true });
      }
    };
    runConfirm();
    return () => { cancelled = true; };
  }, [searchParams, user, queryClient, setSearchParams]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, email, is_certificate_reseller").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const petsWithType = (type: CertificateType) =>
    new Set(certificates.filter((c: any) => c.certificate_type === type).map((c: any) => c.pet_id));

  const availablePetsForType = (type: CertificateType) =>
    pets.filter((p: any) => !petsWithType(type).has(p.id));

  const canCreateAny = availablePetsForType("ownership").length > 0 || availablePetsForType("birth").length > 0;

  const universalCredits = getUniversalCredits(credits);
  const unpaidDrafts = certificates.filter((c: any) => !c.is_paid);
  const draftCanIssue = () => universalCredits > 0;
  const issuableDrafts = unpaidDrafts.filter(draftCanIssue);
  const allPetsFullyCertificated = pets.length > 0 && !canCreateAny;

  const resetWizard = () => {
    setWizardStep(1);
    setCertType("ownership");
    setSelectedPetId("");
    setBirthForm(emptyBirthForm);
    setIssuedForName("");
    setIssuedForEmail("");
    setSirePhotoFile(null);
    setDamPhotoFile(null);
    setSirePreview(null);
    setDamPreview(null);
  };

  const openCreateDialog = () => {
    resetWizard();
    setShowNewDialog(true);
  };

  const onPetSelected = (petId: string) => {
    setSelectedPetId(petId);
    const pet = pets.find((p: any) => p.id === petId);
    if (pet) {
      setBirthForm(petToBirthForm(pet));
      setSirePreview(pet.sire_photo_url || null);
      setDamPreview(pet.dam_photo_url || null);
    }
  };

  const saveBirthDetails = async (petId: string) => {
    let sireUrl: string | null | undefined;
    let damUrl: string | null | undefined;
    if (sirePhotoFile) {
      const resized = await resizeImage(sirePhotoFile);
      sireUrl = await uploadRaw({
        bucket: "pet-photos",
        path: `${user!.id}/${petId}/sire-${Date.now()}.webp`,
        body: resized,
        contentType: "image/webp",
        upsert: true,
      });
    }
    if (damPhotoFile) {
      const resized = await resizeImage(damPhotoFile);
      damUrl = await uploadRaw({
        bucket: "pet-photos",
        path: `${user!.id}/${petId}/dam-${Date.now()}.webp`,
        body: resized,
        contentType: "image/webp",
        upsert: true,
      });
    }
    const payload = birthFormToPetPayload(birthForm, {
      sire_photo_url: sireUrl,
      dam_photo_url: damUrl,
    });
    const { error } = await supabase.from("pets").update(payload).eq("id", petId).eq("owner_id", user!.id);
    if (error) throw error;
  };

  const handleCreate = async () => {
    if (!selectedPetId) return toast.error("Please select a pet");
    if (certType === "birth" && !birthForm.dateOfBirth) return toast.error("Date of birth is required for birth certificates");

    setCreating(true);
    try {
      if (certType === "birth") await saveBirthDetails(selectedPetId);

      const template = getDefaultTemplateForType(certType);
      const { data: created, error } = await supabase.from("pet_certificates").insert({
        user_id: user!.id,
        pet_id: selectedPetId,
        certificate_type: certType,
        template_id: null,
        status: "draft",
        issued_for_name: issuedForName.trim() || null,
        issued_for_email: issuedForEmail.trim() || null,
        design_data: { fallbackTemplate: template },
      }).select(PET_CERTIFICATE_SELECT).single();

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["my-certificates", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["my-pets", user?.id] });
      setShowNewDialog(false);
      resetWizard();
      toast.success(`${CERTIFICATE_TYPE_LABELS[certType]} created!`);
      if (created) setPayConfirmCert(created);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this unpaid certificate?")) return;
    const { error } = await supabase.from("pet_certificates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["my-certificates", user?.id] });
    toast.success("Certificate deleted");
  };

  const handlePay = async (cert: any) => {
    const type: CertificateType = cert.certificate_type === "birth" ? "birth" : "ownership";
    if (getUniversalCredits(credits) <= 0) {
      setPayConfirmCert(null);
      toast.error("No certificate credits available. Buy credits first.", { duration: 5000 });
      return;
    }

    const paymentId = `cert_credit_${type}_${Date.now()}`;
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
      const { data: refreshed } = await supabase.from("pet_certificates").select(PET_CERTIFICATE_SELECT).eq("id", cert.id).single();
      if (refreshed) {
        setPreviewShowPhoto(!!(refreshed as any).show_pet_photo);
        setPreviewCert(refreshed);
      }
      toast.success("Certificate issued! Download or print below.");
    } catch (e: any) {
      toast.error(e.message || "Could not issue certificate");
    }
  };

  const getPetData = (cert: any) => {
    const pet = cert.pets || pets.find((p: any) => p.id === cert.pet_id) || {};
    return buildCertificatePetData({ pet, profile, cert });
  };

  const getTemplate = (cert: any) => {
    const type: CertificateType = cert.certificate_type === "birth" ? "birth" : "ownership";
    const fallback = cert?.design_data?.fallbackTemplate;
    return ensureCertificateTemplateFields(fallback || getDefaultTemplateForType(type), type);
  };

  const openPreview = (cert: any) => {
    setPreviewShowPhoto(!!cert.show_pet_photo);
    setPreviewCert(cert);
  };

  const handleTogglePreviewPhoto = async (checked: boolean) => {
    if (!previewCert) return;
    setPreviewShowPhoto(checked);
    setSavingPhotoToggle(true);
    const { error } = await supabase
      .from("pet_certificates")
      .update({ show_pet_photo: checked })
      .eq("id", previewCert.id);
    setSavingPhotoToggle(false);
    if (error) {
      setPreviewShowPhoto(!checked);
      return toast.error(error.message);
    }
    setPreviewCert((c: any) => (c ? { ...c, show_pet_photo: checked } : c));
    await queryClient.invalidateQueries({ queryKey: ["my-certificates", user?.id] });
  };

  const runCertificateExport = async (
    cert: any,
    mode: "download" | "print",
    showPetPhoto: boolean = !!cert.show_pet_photo,
  ) => {
    if (!cert.is_paid) return toast.error("Issue the certificate first");
    if (cert.is_paused) return toast.error("Certificate paused by admin");
    const setBusy = mode === "download" ? setDownloading : setPrinting;
    setBusy(true);
    try {
      const template = getTemplate(cert);
      const petData = getPetData(cert);
      const petImageUrl = getCertificatePetImageUrl(cert);
      const parentPhotos = getParentPhotoUrls(cert);
      const pdf = await generateCertificatePdf(template, petData, petImageUrl, cert.certificate_number || petData.pet_code, window.location.origin, parentPhotos, showPetPhoto);
      if (mode === "download") {
        downloadCertificatePdf(pdf, `${petData.pet_name}-${cert.certificate_type}`);
        toast.success("Downloaded!");
      } else {
        printCertificatePdf(pdf);
        toast.success("Opening print dialog…");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const typeBadge = (type: string) =>
    type === "birth" ? (
      <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs gap-1"><Baby className="h-3 w-3" /> Birth</Badge>
    ) : (
      <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs gap-1"><FileText className="h-3 w-3" /> Ownership</Badge>
    );

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Award className="h-6 w-6 text-primary" /> Pet Certificates
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Official ownership &amp; birth certificates — $15 each · verify at petsregistry.org/verify
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild className="gap-2">
                <Link to="/dashboard/register-litter"><Baby className="h-4 w-4" /> Register litter</Link>
              </Button>
              <Button onClick={openCreateDialog} disabled={allPetsFullyCertificated} className="gap-2">
                <Plus className="h-4 w-4" /> New certificate
              </Button>
            </div>
          </div>
          {allPetsFullyCertificated && (
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-3 max-w-2xl">
              Each pet can have one ownership and one birth certificate. All of your pets already have both types.
              {(universalCredits > 0) && (
                <> You still have {universalCredits} credit{universalCredits !== 1 ? "s" : ""} — <Link to="/dashboard/register-pet" className="underline font-medium">register another pet</Link> or use <Link to="/dashboard/register-litter" className="underline font-medium">Register litter</Link> to use them.</>
              )}
            </p>
          )}
          {!allPetsFullyCertificated && issuableDrafts.length > 0 && (
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
              You have {issuableDrafts.length} draft certificate{issuableDrafts.length > 1 ? "s" : ""} ready to issue with your credits.
              Use the <strong>Issue</strong> button on the draft below — you don&apos;t need to create a new one for the same pet.
            </p>
          )}
        </div>

        <CertificateSampleShowcase />
        <div className="mb-6"><CertificateCreditsCard /></div>
        <CertificatePurchaseHistory />

        {issuableDrafts.length > 0 && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium">Credits ready — issue your draft certificate{issuableDrafts.length > 1 ? "s" : ""}</p>
                <p className="text-muted-foreground mt-0.5">
                  Buying a credit lets you finalize an existing draft. Click <strong>Issue</strong> on the draft card to use your credit and get the official certificate number.
                </p>
              </div>
              {issuableDrafts.length === 1 && (
                <Button size="sm" onClick={() => setPayConfirmCert(issuableDrafts[0])}>
                  Issue {issuableDrafts[0].pets?.name ? `for ${issuableDrafts[0].pets.name}` : "now"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : certificates.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center py-12">
            <Award className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground mb-4">No certificates yet.</p>
            <Button onClick={openCreateDialog}>Create your first certificate</Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert: any) => {
              const pet = cert.pets || {};
              const template = getTemplate(cert);
              const petImageUrl = getCertificatePetImageUrl(cert);
              const petData = getPetData(cert);
              const parentPhotos = getParentPhotoUrls(cert);
              return (
                <Card key={cert.id} className={cert.is_paused ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex gap-2 mb-2">{typeBadge(cert.certificate_type)}</div>
                    <div className="border rounded mb-3 overflow-hidden relative" style={{ aspectRatio: "297/210", pointerEvents: "none", containerType: "inline-size" }}>
                      <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                        {renderCertificateView(template, petData, petImageUrl, parentPhotos, cert.show_pet_photo)}
                      </div>
                    </div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PawPrint className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">{pet.name || "Pet"}</span>
                      </div>
                      {cert.is_paid ? <Badge className="bg-green-600 text-white text-xs">Issued</Badge> : <Badge variant="outline" className="text-amber-600 text-xs">Draft</Badge>}
                    </div>
                    {cert.is_paid && cert.certificate_number && (
                      <p className="text-xs font-mono text-primary flex items-center gap-1 mb-2">
                        <ShieldCheck className="h-3 w-3" /> {cert.certificate_number}
                      </p>
                    )}
                    {cert.issued_for_name && (
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Users className="h-3 w-3" /> For buyer: {cert.issued_for_name}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openPreview(cert)}><Eye className="h-3.5 w-3.5 mr-1" /> Preview</Button>
                      {!cert.is_paid ? (
                        <>
                          <Button size="sm" className="flex-1" onClick={() => setPayConfirmCert(cert)}>
                            Issue ({cert.certificate_type === "birth" ? "birth" : "ownership"} credit)
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(cert.id)}><Trash2 className="h-4 w-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" className="flex-1 gap-1" onClick={() => runCertificateExport(cert, "download")} disabled={downloading || printing}><FileDown className="h-3.5 w-3.5" /> PDF</Button>
                          <Button size="sm" variant="secondary" className="flex-1 gap-1" onClick={() => runCertificateExport(cert, "print")} disabled={downloading || printing}><Printer className="h-3.5 w-3.5" /> Print</Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Preview */}
        <Dialog open={!!previewCert} onOpenChange={() => setPreviewCert(null)}>
          <DialogContent className="max-w-[min(calc(100vw-2rem),920px)]">
            <DialogHeader><DialogTitle>Certificate preview</DialogTitle></DialogHeader>
            {previewCert && (
              <>
                <div className="border rounded-lg overflow-hidden relative" style={{ aspectRatio: "297/210", containerType: "inline-size" }}>
                  <div style={{ position: "absolute", inset: 0 }}>
                    {renderCertificateView(getTemplate(previewCert), getPetData(previewCert), getCertificatePetImageUrl(previewCert), getParentPhotoUrls(previewCert), previewShowPhoto)}
                  </div>
                </div>
                {getCertificatePetImageUrl(previewCert) ? (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                    <div>
                      <Label htmlFor="show-pet-photo" className="text-sm font-medium">Show pet photo on certificate</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Adds the pet's photo to the top-right. Saved automatically.</p>
                    </div>
                    <Switch
                      id="show-pet-photo"
                      checked={previewShowPhoto}
                      disabled={savingPhotoToggle}
                      onCheckedChange={handleTogglePreviewPhoto}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Add a photo to this pet to display it on the certificate.</p>
                )}
              </>
            )}
            <DialogFooter>
              {previewCert?.is_paid && (
                <>
                  <Button onClick={() => runCertificateExport(previewCert, "download", previewShowPhoto)} disabled={downloading}><FileDown className="h-4 w-4 mr-2" /> Download</Button>
                  <Button variant="secondary" onClick={() => runCertificateExport(previewCert, "print", previewShowPhoto)} disabled={printing}><Printer className="h-4 w-4 mr-2" /> Print</Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create wizard */}
        <Dialog open={showNewDialog} onOpenChange={(o) => { if (!o) resetWizard(); setShowNewDialog(o); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create certificate — step {wizardStep} of {certType === "birth" ? 4 : 3}</DialogTitle></DialogHeader>

            {wizardStep === 1 && (
              <div className="grid sm:grid-cols-2 gap-4">
                {(["ownership", "birth"] as CertificateType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCertType(t)}
                    className={`rounded-xl border-2 p-5 text-left transition-all ${certType === t ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border"}`}
                  >
                    {t === "ownership" ? <FileText className="h-8 w-8 text-amber-600 mb-2" /> : <Baby className="h-8 w-8 text-orange-500 mb-2" />}
                    <p className="font-bold">{CERTIFICATE_TYPE_LABELS[t]}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t === "ownership" ? "Proof you own this pet" : "Date of birth & parentage"}</p>
                    <p className="text-sm font-semibold mt-2">$15 · {universalCredits} credit(s) available</p>
                  </button>
                ))}
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-3">
                <Label>Select pet</Label>
                <Select value={selectedPetId} onValueChange={onPetSelected}>
                  <SelectTrigger><SelectValue placeholder="Choose a pet" /></SelectTrigger>
                  <SelectContent>
                    {availablePetsForType(certType).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.pet_code || p.species})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availablePetsForType(certType).length === 0 && (
                  <p className="text-sm text-amber-600">All pets already have this certificate type, or you have no pets. <Link to="/dashboard/register-pet" className="underline">Register a pet</Link></p>
                )}
              </div>
            )}

            {wizardStep === 3 && certType === "birth" && (
              <PetBirthFields
                values={birthForm}
                onChange={(patch) => setBirthForm((v) => ({ ...v, ...patch }))}
                myPets={pets as any}
                sirePhotoPreview={sirePreview}
                damPhotoPreview={damPreview}
                onSirePhoto={(f) => { setSirePhotoFile(f); setSirePreview(URL.createObjectURL(f)); }}
                onDamPhoto={(f) => { setDamPhotoFile(f); setDamPreview(URL.createObjectURL(f)); }}
                compact
              />
            )}

            {((wizardStep === 3 && certType === "ownership") || (wizardStep === 4 && certType === "birth")) && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Optional: issue certificate for a buyer (shops &amp; resellers can print for the purchaser).</p>
                <div>
                  <Label>Buyer / new owner name</Label>
                  <Input value={issuedForName} onChange={(e) => setIssuedForName(e.target.value)} placeholder="Leave blank if for yourself" />
                </div>
                <div>
                  <Label>Buyer email (optional)</Label>
                  <Input type="email" value={issuedForEmail} onChange={(e) => setIssuedForEmail(e.target.value)} />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              {wizardStep > 1 && <Button variant="outline" onClick={() => setWizardStep((s) => s - 1)}>Back</Button>}
              {wizardStep < (certType === "birth" ? 4 : 3) ? (
                <Button
                  onClick={() => setWizardStep((s) => s + 1)}
                  disabled={wizardStep === 2 && !selectedPetId}
                >
                  Next
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create certificate"}</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pay confirm */}
        <Dialog open={!!payConfirmCert} onOpenChange={() => setPayConfirmCert(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Issue certificate</DialogTitle></DialogHeader>
            {payConfirmCert && (
              <>
                <div className="border rounded-lg overflow-hidden relative mb-4" style={{ aspectRatio: "297/210", containerType: "inline-size" }}>
                  <div style={{ position: "absolute", inset: 0 }}>
                    {renderCertificateView(getTemplate(payConfirmCert), getPetData(payConfirmCert), getCertificatePetImageUrl(payConfirmCert), getParentPhotoUrls(payConfirmCert), payConfirmCert.show_pet_photo)}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Uses 1 certificate credit (ownership or birth).
                  You have <strong>{universalCredits}</strong> available.
                </p>
              </>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayConfirmCert(null)}>Cancel</Button>
              <Button onClick={() => payConfirmCert && handlePay(payConfirmCert)}>Issue certificate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default DashboardCertificates;
