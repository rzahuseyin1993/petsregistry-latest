import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadDirectoryImage } from "@/lib/uploadDirectoryImage";
import { useAuth } from "@/contexts/AuthContext";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { firstError, validateEmail, validateNumberRange, validateOptionalLength, validatePhone, validateRequired, validateUrl } from "@/lib/validation";
import CountrySelect from "@/components/CountrySelect";
import { Plus, Pencil, Trash2, Image, Building2, Crown, Check, ArrowRight, MapPin, Loader2, Upload, Video, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MEMBERSHIP_UPGRADE_PATH = "/dashboard/membership#upgrade-plans";

const categories = [
  { value: "pet_shop", label: "Pet Shop" },
  { value: "veterinary", label: "Veterinary" },
  { value: "grooming", label: "Grooming" },
  { value: "boarding", label: "Boarding" },
  { value: "training", label: "Training" },
  { value: "pet_food", label: "Pet Food" },
  { value: "other", label: "Other" },
];

const MAX_IMAGES = 3;

const DashboardDirectory = () => {
  const { user, hasTopMembership } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category: "pet_shop", address: "", city: "", country: "", phone: "", whatsapp: "", email: "", website: "", lat: "", lng: "", video_url: "" });
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeConfirmed, setGeocodeConfirmed] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  const handleGeocode = async () => {
    const query = [form.address, form.city, form.country].filter(Boolean).join(", ");
    if (!query.trim()) {
      toast({ title: "Missing address", description: "Please fill in address, city, or country first.", variant: "destructive" });
      return;
    }
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const results = await res.json();
      if (results.length > 0) {
        setForm((f) => ({ ...f, lat: results[0].lat, lng: results[0].lon }));
        setGeocodeConfirmed(false);
        toast({ title: "Coordinates found", description: `${results[0].display_name}. Please confirm below.` });
      } else {
        toast({ title: "No results", description: "Could not find coordinates for that address.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Geocoding error", description: "Failed to look up address.", variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  };

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["my-business-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_listings")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isPaid = hasTopMembership;

  const goToUpgradePlans = () => {
    navigate(MEMBERSHIP_UPGRADE_PATH);
  };

  const { data: listingImages = {}, refetch: refetchImages } = useQuery({
    queryKey: ["my-listing-images", listings.map((l: any) => l.id)],
    queryFn: async () => {
      const ids = listings.map((l: any) => l.id);
      if (ids.length === 0) return {};
      const { data } = await supabase
        .from("business_listing_images")
        .select("*")
        .in("listing_id", ids)
        .order("sort_order");
      const map: Record<string, any[]> = {};
      (data || []).forEach((img: any) => {
        if (!map[img.listing_id]) map[img.listing_id] = [];
        map[img.listing_id].push(img);
      });
      return map;
    },
    enabled: listings.length > 0,
  });

  // Auto-sync is_paid on listings when membership is active
  useEffect(() => {
    if (!isPaid || !user || listings.length === 0) return;
    const unpaidListings = listings.filter((l: any) => !l.is_paid);
    unpaidListings.forEach(async (l: any) => {
      await supabase.from("business_listings").update({ is_paid: true }).eq("id", l.id);
    });
    if (unpaidListings.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["my-business-listings"] });
    }
  }, [isPaid, listings, user]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const { lat, lng, ...rest } = data;
      const payload = {
        ...rest,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
      };
      if (editId) {
        const { error } = await supabase.from("business_listings").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_listings").insert({ ...payload, owner_id: user!.id, is_paid: isPaid });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-business-listings"] });
      setDialogOpen(false);
      setEditId(null);
      setGeocodeConfirmed(false);
      setForm({ name: "", description: "", category: "pet_shop", address: "", city: "", country: "", phone: "", whatsapp: "", email: "", website: "", lat: "", lng: "", video_url: "" });
      toast({ title: editId ? "Listing updated" : "Listing created", description: "Your listing will appear after admin approval." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-business-listings"] });
      toast({ title: "Listing deleted" });
    },
  });

  const handleEdit = (listing: any) => {
    setEditId(listing.id);
    setForm({
      name: listing.name,
      description: listing.description || "",
      category: listing.category,
      address: listing.address || "",
      city: listing.city || "",
      country: listing.country || "",
      phone: listing.phone || "",
      whatsapp: listing.whatsapp || "",
      email: listing.email || "",
      website: listing.website || "",
      lat: listing.lat != null ? String(listing.lat) : "",
      lng: listing.lng != null ? String(listing.lng) : "",
      video_url: listing.video_url || "",
    });
    setGeocodeConfirmed(listing.lat != null && listing.lng != null);
    setDialogOpen(true);
  };

  const uploadLogo = async (listingId: string, file: File) => {
    setUploadingLogo(listingId);
    try {
      const publicUrl = await uploadDirectoryImage(file, `${user!.id}/${listingId}/logo`);
      await supabase.from("business_listings").update({ logo_url: publicUrl }).eq("id", listingId);
      queryClient.invalidateQueries({ queryKey: ["my-business-listings"] });
      toast({ title: "Logo uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingLogo(null);
    }
  };

  const removeLogo = async (listingId: string) => {
    await supabase.from("business_listings").update({ logo_url: null }).eq("id", listingId);
    queryClient.invalidateQueries({ queryKey: ["my-business-listings"] });
    toast({ title: "Logo removed" });
  };

  const uploadGalleryImage = async (listingId: string, file: File) => {
    const imgs = (listingImages as Record<string, any[]>)[listingId] || [];
    if (imgs.length >= MAX_IMAGES) {
      toast({ title: "Limit reached", description: `Maximum ${MAX_IMAGES} images allowed.`, variant: "destructive" });
      return;
    }
    setUploadingImage(listingId);
    try {
      const publicUrl = await uploadDirectoryImage(file, `${user!.id}/${listingId}`);
      await supabase.from("business_listing_images").insert({ listing_id: listingId, image_url: publicUrl, sort_order: imgs.length });
      queryClient.invalidateQueries({ queryKey: ["my-listing-images"] });
      toast({ title: "Image uploaded", description: `${imgs.length + 1}/${MAX_IMAGES} images used.` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingImage(null);
    }
  };

  const deleteImage = async (imageId: string) => {
    await supabase.from("business_listing_images").delete().eq("id", imageId);
    queryClient.invalidateQueries({ queryKey: ["my-listing-images"] });
    toast({ title: "Image removed" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">My Business Listings</h1>
            <p className="text-sm text-muted-foreground">
              {isPaid ? "You have an active Verified Partner membership" : "Free listing (text only)"}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditId(null); setGeocodeConfirmed(false); setForm({ name: "", description: "", category: "pet_shop", address: "", city: "", country: "", phone: "", whatsapp: "", email: "", website: "", lat: "", lng: "", video_url: "" }); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Add Listing</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editId ? "Edit Listing" : "Add Business Listing"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const validationError = firstError(
                    validateRequired(form.name, "Business name", { min: 2, max: 150 }),
                    validateOptionalLength(form.description, "Description", 2000),
                    validateOptionalLength(form.address, "Address", 300),
                    validateOptionalLength(form.city, "City", 100),
                    validatePhone(form.phone),
                    validatePhone(form.whatsapp, { label: "WhatsApp number" }),
                    validateEmail(form.email),
                    validateUrl(form.website, { label: "website URL" }),
                    validateUrl(form.video_url, { label: "video URL" }),
                    form.lat ? validateNumberRange(form.lat, "Latitude", { min: -90, max: 90 }) : null,
                    form.lng ? validateNumberRange(form.lng, "Longitude", { min: -180, max: 180 }) : null,
                    (form.lat && !form.lng) || (!form.lat && form.lng)
                      ? "Please provide both latitude and longitude, or leave both empty."
                      : null,
                  );
                  if (validationError) {
                    toast({ title: "Invalid input", description: validationError, variant: "destructive" });
                    return;
                  }
                  saveMutation.mutate(form);
                }}
                className="space-y-4"
              >
                <div>
                  <Label>Business Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                  <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Country</Label><CountrySelect value={form.country} onChange={(v) => setForm({ ...form, country: v })} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div>
                  <Label>WhatsApp Number</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="e.g. +6591234567 (with country code)" />
                  <p className="text-xs text-muted-foreground mt-1">Include country code. This will show a WhatsApp button on your listing.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
                </div>
                {(isPaid || (editId && listings.find((l: any) => l.id === editId)?.is_paid)) && (
                  <div>
                    <Label>Video URL (YouTube / Facebook)</Label>
                    <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
                    <p className="text-xs text-muted-foreground mt-1">Paste a YouTube or Facebook video link to display on your profile page.</p>
                  </div>
                )}
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">📍 Map Location</Label>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleGeocode} disabled={geocoding}>
                      {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                      {geocoding ? "Looking up..." : "Auto-fill from Address"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Latitude</Label><Input type="number" step="any" value={form.lat} onChange={(e) => { setForm({ ...form, lat: e.target.value }); setGeocodeConfirmed(false); }} placeholder="e.g. 1.3521" /></div>
                    <div><Label className="text-xs text-muted-foreground">Longitude</Label><Input type="number" step="any" value={form.lng} onChange={(e) => { setForm({ ...form, lng: e.target.value }); setGeocodeConfirmed(false); }} placeholder="e.g. 103.8198" /></div>
                  </div>
                  {form.lat && form.lng && !geocodeConfirmed && (
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => setGeocodeConfirmed(true)}>
                        <Check className="h-3.5 w-3.5" /> Confirm Coordinates
                      </Button>
                      <span className="text-xs text-muted-foreground">Please confirm coordinates are correct</span>
                    </div>
                  )}
                  {geocodeConfirmed && (
                    <p className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Coordinates confirmed</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending || (!!form.lat && !!form.lng && !geocodeConfirmed)}>
                  {saveMutation.isPending ? "Saving..." : editId ? "Update Listing" : "Submit Listing"}
                </Button>
                {!!form.lat && !!form.lng && !geocodeConfirmed && (
                  <p className="text-xs text-center text-destructive">Please confirm the coordinates before saving.</p>
                )}
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {!isPaid && (
          <Card className="mb-6 border-accent bg-gradient-to-r from-accent/5 to-primary/5">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-accent" />
                  <h3 className="font-display text-lg font-bold text-foreground">Upgrade to Verified Partner</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">You're on the <strong>Free plan</strong>. Upgrade to unlock photo gallery, logo, video & more.</p>
              </div>
              <Button type="button" className="gap-2 whitespace-nowrap" onClick={goToUpgradePlans}>
                Upgrade Now <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : listings.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 font-semibold">No listings yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add your first business listing to appear in the directory</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {listings.map((listing: any) => {
              const imgs = (listingImages as Record<string, any[]>)[listing.id] || [];
              const canUpload = isPaid || listing.is_paid;
              return (
                <Card key={listing.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Logo */}
                        <div className="relative group">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
                            {listing.logo_url ? (
                              <img src={listing.logo_url} alt="Logo" className="h-full w-full object-cover" />
                            ) : (
                              <Building2 className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          {canUpload && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                              {listing.logo_url ? (
                                <button type="button" onClick={() => removeLogo(listing.id)} className="text-white">
                                  <X className="h-4 w-4" />
                                </button>
                              ) : (
                                <label className="cursor-pointer text-white">
                                  <Upload className="h-4 w-4" />
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadLogo(listing.id, e.target.files[0]); }} />
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{listing.name}</h3>
                            {listing.is_approved ? <Badge className="bg-green-100 text-green-800">Approved</Badge> : <Badge variant="outline">Pending</Badge>}
                            {(listing.is_paid || isPaid) && <Badge variant="secondary">Paid</Badge>}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{listing.category} • {listing.city || "No city"}</p>
                          {listing.video_url && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Video className="h-3 w-3" /> Video linked</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleEdit(listing)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" onClick={() => deleteMutation.mutate(listing.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    {/* Image Gallery Section - paid only */}
                    {canUpload && (
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-medium">📸 Photo Gallery ({imgs.length}/{MAX_IMAGES})</Label>
                          {imgs.length < MAX_IMAGES && (
                            <label className="cursor-pointer">
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadGalleryImage(listing.id, e.target.files[0]); }} />
                              <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" asChild>
                                <span>
                                  {uploadingImage === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                  Add Photo
                                </span>
                              </Button>
                            </label>
                          )}
                        </div>
                        {imgs.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No photos yet. Upload up to {MAX_IMAGES} images to showcase your business.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {imgs.map((img: any) => (
                              <div key={img.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                                <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => deleteImage(img.id)}
                                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardDirectory;
