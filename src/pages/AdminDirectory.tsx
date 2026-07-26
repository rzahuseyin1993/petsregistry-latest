import { useState } from "react";
import PermissionGate from "@/components/PermissionGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadDirectoryImage } from "@/lib/uploadDirectoryImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import CountrySelect from "@/components/CountrySelect";
import { Star, Trash2, Crown, Download, Pencil, EyeOff, Eye, Search, Upload, Loader2, X, Video } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

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

const AdminDirectory = () => {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [editListing, setEditListing] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["admin-business-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-directory-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email");
      return data || [];
    },
  });

  // Fetch images for the currently-edited listing
  const { data: editImages = [], refetch: refetchEditImages } = useQuery({
    queryKey: ["admin-listing-images", editListing?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_listing_images")
        .select("*")
        .eq("listing_id", editListing!.id)
        .order("sort_order");
      return data || [];
    },
    enabled: !!editListing?.id,
  });

  const getOwnerName = (ownerId: string) => {
    const p = profiles.find((p: any) => p.user_id === ownerId);
    return p?.full_name || p?.email || ownerId.slice(0, 8);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("business_listings").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-business-listings"] });
      toast({ title: "Listing updated" });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-business-listings"] });
      toast({ title: "Listing deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const handleEditOpen = (listing: any) => {
    setEditListing({ ...listing });
  };

  const handleEditSave = () => {
    if (!editListing) return;
    updateMutation.mutate({
      id: editListing.id,
      updates: {
        name: editListing.name,
        description: editListing.description,
        category: editListing.category,
        address: editListing.address,
        city: editListing.city,
        country: editListing.country,
        phone: editListing.phone,
        whatsapp: editListing.whatsapp,
        email: editListing.email,
        website: editListing.website,
        video_url: editListing.video_url || null,
        logo_url: editListing.logo_url || null,
        is_approved: editListing.is_approved,
        is_featured: editListing.is_featured,
        is_paid: editListing.is_paid,
        is_active: editListing.is_active,
        lat: editListing.lat != null && editListing.lat !== "" ? parseFloat(editListing.lat) : null,
        lng: editListing.lng != null && editListing.lng !== "" ? parseFloat(editListing.lng) : null,
      },
    });
    setEditListing(null);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this listing?",
      description: "This business listing will be permanently deleted. This action cannot be undone.",
    });
    if (!ok) return;
    deleteMutation.mutate(id);
  };

  const handleAdminUploadLogo = async (file: File) => {
    if (!editListing) return;
    setUploadingLogo(true);
    try {
      const url = await uploadDirectoryImage(file, `${editListing.owner_id}/${editListing.id}/logo`);
      setEditListing({ ...editListing, logo_url: url });
      await supabase.from("business_listings").update({ logo_url: url }).eq("id", editListing.id);
      toast({ title: "Logo uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAdminUploadImage = async (file: File) => {
    if (!editListing) return;
    if (editImages.length >= MAX_IMAGES) {
      toast({ title: "Limit reached", description: `Maximum ${MAX_IMAGES} images.`, variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    try {
      const url = await uploadDirectoryImage(file, `${editListing.owner_id}/${editListing.id}`);
      await supabase.from("business_listing_images").insert({ listing_id: editListing.id, image_url: url, sort_order: editImages.length });
      refetchEditImages();
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAdminDeleteImage = async (imageId: string) => {
    const ok = await confirm({
      title: "Delete this image?",
      description: "This gallery photo will be permanently deleted. This action cannot be undone.",
    });
    if (!ok) return;
    await supabase.from("business_listing_images").delete().eq("id", imageId);
    refetchEditImages();
    toast({ title: "Image removed" });
  };

  return (
          <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Business Directory Management</h1>
            <p className="text-sm text-muted-foreground">Full control: edit all fields, images, logo, video, toggle visibility.</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => exportToCsv("directory", listings.map((l: any) => ({
            name: l.name, category: l.category, description: l.description || "",
            address: l.address || "", city: l.city || "", country: l.country || "",
            phone: l.phone || "", whatsapp: l.whatsapp || "", email: l.email || "", website: l.website || "",
            video_url: l.video_url || "", logo_url: l.logo_url || "",
            lat: l.lat ?? "", lng: l.lng ?? "",
            owner: getOwnerName(l.owner_id), approved: l.is_approved ? "Yes" : "No",
            paid: l.is_paid ? "Yes" : "No", featured: l.is_featured ? "Yes" : "No",
            active: l.is_active ? "Yes" : "No",
            date: new Date(l.created_at).toLocaleDateString(),
          })), [
            { key: "name", label: "Business Name" }, { key: "category", label: "Category" },
            { key: "description", label: "Description" },
            { key: "address", label: "Address" }, { key: "city", label: "City" }, { key: "country", label: "Country" },
            { key: "phone", label: "Phone" }, { key: "whatsapp", label: "WhatsApp" },
            { key: "email", label: "Email" }, { key: "website", label: "Website" },
            { key: "video_url", label: "Video URL" }, { key: "logo_url", label: "Logo URL" },
            { key: "lat", label: "Latitude" }, { key: "lng", label: "Longitude" },
            { key: "owner", label: "Owner" },
            { key: "approved", label: "Approved" }, { key: "paid", label: "Paid" },
            { key: "featured", label: "Featured" }, { key: "active", label: "Active" },
            { key: "date", label: "Created" },
          ])}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="mt-4 mb-4 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Search by name, category, city, owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : listings.filter((l: any) => {
          const q = searchTerm.toLowerCase();
          return !q || l.name.toLowerCase().includes(q) || l.category.toLowerCase().includes(q) || (l.city || "").toLowerCase().includes(q) || getOwnerName(l.owner_id).toLowerCase().includes(q);
        }).length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">{searchTerm ? "No listings match your search" : "No listings yet"}</p>
        ) : (
          <div className="space-y-3">
            {listings.filter((l: any) => {
              const q = searchTerm.toLowerCase();
              return !q || l.name.toLowerCase().includes(q) || l.category.toLowerCase().includes(q) || (l.city || "").toLowerCase().includes(q) || getOwnerName(l.owner_id).toLowerCase().includes(q);
            }).map((listing: any) => (
              <Card key={listing.id} className={!listing.is_active ? "opacity-60" : ""}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
                      {listing.logo_url ? (
                        <img src={listing.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Crown className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{listing.name}</h3>
                        {listing.is_approved ? <Badge className="bg-green-100 text-green-800">Approved</Badge> : <Badge variant="destructive">Pending</Badge>}
                        {!listing.is_active && <Badge variant="outline"><EyeOff className="mr-1 h-3 w-3" />Inactive</Badge>}
                        {listing.is_paid ? (
                          <Badge variant="secondary"><Crown className="mr-1 h-3 w-3" />Paid Partner</Badge>
                        ) : (
                          <Badge variant="outline">Free</Badge>
                        )}
                        {listing.is_featured && <Badge className="bg-accent text-accent-foreground"><Star className="mr-1 h-3 w-3" />Featured</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{listing.category} • {listing.city || "N/A"} • Owner: {getOwnerName(listing.owner_id)}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {listing.phone && <span>📞 {listing.phone}</span>}
                        {listing.email && <span>✉ {listing.email}</span>}
                        {listing.address && <span className="truncate max-w-[240px]">📍 {listing.address}</span>}
                      </div>
                      {listing.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 max-w-xl">{listing.description}</p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">Submitted {new Date(listing.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Approved</span>
                      <Switch checked={listing.is_approved} onCheckedChange={(v) => updateMutation.mutate({ id: listing.id, updates: { is_approved: v } })} />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Featured</span>
                      <Switch checked={listing.is_featured} onCheckedChange={(v) => updateMutation.mutate({ id: listing.id, updates: { is_featured: v } })} />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Active</span>
                      <Switch checked={listing.is_active} onCheckedChange={(v) => updateMutation.mutate({ id: listing.id, updates: { is_active: v } })} />
                    </div>
                    <Select value={listing.is_paid ? "paid" : "free"} onValueChange={(v) => updateMutation.mutate({ id: listing.id, updates: { is_paid: v === "paid" } })}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="paid">Paid Partner</SelectItem>
                      </SelectContent>
                    </Select>
                    <PermissionGate resource="directory" action="edit">
                      <Button variant="outline" size="icon" onClick={() => handleEditOpen(listing)}><Pencil className="h-4 w-4" /></Button>
                    </PermissionGate>
                    <PermissionGate resource="directory" action="delete">
                      <Button variant="outline" size="icon" onClick={() => handleDelete(listing.id)}><Trash2 className="h-4 w-4" /></Button>
                    </PermissionGate>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Full Edit Dialog */}
        <Dialog open={!!editListing} onOpenChange={(o) => { if (!o) setEditListing(null); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>Edit Business Listing</DialogTitle></DialogHeader>
            {editListing && (
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Business Name</Label>
                  <Input value={editListing.name} onChange={(e) => setEditListing({ ...editListing, name: e.target.value })} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={editListing.category} onValueChange={(v) => setEditListing({ ...editListing, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={editListing.description || ""} onChange={(e) => setEditListing({ ...editListing, description: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Address</Label><Input value={editListing.address || ""} onChange={(e) => setEditListing({ ...editListing, address: e.target.value })} /></div>
                  <div><Label>City</Label><Input value={editListing.city || ""} onChange={(e) => setEditListing({ ...editListing, city: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Country</Label><CountrySelect value={editListing.country || ""} onChange={(v) => setEditListing({ ...editListing, country: v })} /></div>
                  <div><Label>Phone</Label><Input value={editListing.phone || ""} onChange={(e) => setEditListing({ ...editListing, phone: e.target.value })} /></div>
                </div>
                <div>
                  <Label>WhatsApp Number</Label>
                  <Input value={editListing.whatsapp || ""} onChange={(e) => setEditListing({ ...editListing, whatsapp: e.target.value })} placeholder="e.g. +6591234567" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input type="email" value={editListing.email || ""} onChange={(e) => setEditListing({ ...editListing, email: e.target.value })} /></div>
                  <div><Label>Website</Label><Input value={editListing.website || ""} onChange={(e) => setEditListing({ ...editListing, website: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Video URL (YouTube / Facebook)</Label>
                  <Input value={editListing.video_url || ""} onChange={(e) => setEditListing({ ...editListing, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
                </div>

                {/* Logo Management */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <Label className="text-sm font-medium">🏪 Business Logo</Label>
                  <div className="flex items-center gap-3">
                    {editListing.logo_url ? (
                      <>
                        <div className="h-16 w-16 overflow-hidden rounded-lg border border-border">
                          <img src={editListing.logo_url} alt="Logo" className="h-full w-full object-cover" />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setEditListing({ ...editListing, logo_url: null }); }}>
                          <X className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      </>
                    ) : (
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAdminUploadLogo(e.target.files[0]); }} />
                        <Button variant="outline" size="sm" className="pointer-events-none gap-1.5" asChild>
                          <span>{uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload Logo</span>
                        </Button>
                      </label>
                    )}
                  </div>
                </div>

                {/* Gallery Management */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">📸 Photo Gallery ({editImages.length}/{MAX_IMAGES})</Label>
                    {editImages.length < MAX_IMAGES && (
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAdminUploadImage(e.target.files[0]); }} />
                        <Button variant="outline" size="sm" className="pointer-events-none gap-1.5" asChild>
                          <span>{uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Add Photo</span>
                        </Button>
                      </label>
                    )}
                  </div>
                  {editImages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No photos uploaded.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {editImages.map((img: any) => (
                        <div key={img.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                          <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                          <button type="button" onClick={() => handleAdminDeleteImage(img.id)} className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Latitude</Label><Input type="number" step="any" value={editListing.lat ?? ""} onChange={(e) => setEditListing({ ...editListing, lat: e.target.value })} placeholder="e.g. 1.3521" /></div>
                  <div><Label>Longitude</Label><Input type="number" step="any" value={editListing.lng ?? ""} onChange={(e) => setEditListing({ ...editListing, lng: e.target.value })} placeholder="e.g. 103.8198" /></div>
                </div>
                <div className="flex flex-wrap gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={editListing.is_approved} onChange={(e) => setEditListing({ ...editListing, is_approved: e.target.checked })} className="h-4 w-4" />
                    <Label className="mb-0">Approved</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={editListing.is_featured} onChange={(e) => setEditListing({ ...editListing, is_featured: e.target.checked })} className="h-4 w-4" />
                    <Label className="mb-0">Featured</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={editListing.is_paid} onChange={(e) => setEditListing({ ...editListing, is_paid: e.target.checked })} className="h-4 w-4" />
                    <Label className="mb-0">Paid Partner</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={editListing.is_active} onChange={(e) => setEditListing({ ...editListing, is_active: e.target.checked })} className="h-4 w-4" />
                    <Label className="mb-0">Active</Label>
                  </div>
                </div>
                <Button className="w-full" onClick={handleEditSave}>Save Changes</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </main>
  );
};

export default AdminDirectory;
