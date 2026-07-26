import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Download, Search, Upload, X, Store } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { uploadImage } from "@/lib/imageUpload";
import { useState, useRef } from "react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

interface ProductForm {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  image_url: string;
  active: boolean;
}

const emptyForm: ProductForm = { name: "", description: "", price: "", stock: "0", category: "", image_url: "", active: true };

const AdminProducts = () => {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: storeEnabled = true } = useQuery({
    queryKey: ["store-enabled"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "store_enabled").maybeSingle();
      return data?.value !== "false";
    },
  });

  const storeToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const value = enabled ? "true" : "false";
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "store_enabled").maybeSingle();
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value }).eq("key", "store_enabled");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({
          key: "store_enabled",
          value,
          description: "When false, the public Store page and navigation links are hidden.",
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["store-enabled"] });
      toast.success(enabled ? "Store is now visible on the website" : "Store is now hidden from the website");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setForm({ ...form, image_url: "" });
    if (fileRef.current) fileRef.current.value = "";
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let imageUrl = form.image_url;

      // Upload new image if selected (non-blocking — product still saves if upload fails)
      if (imageFile) {
        try {
          imageUrl = await uploadImage(imageFile, "product-images", "products");
        } catch (uploadErr) {
          console.warn("Image upload failed, saving product without image:", uploadErr);
          toast.warning("Image upload failed — product will be saved without an image.");
          imageUrl = "";
        }
      }

      const payload = {
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        stock: parseInt(form.stock) || 0,
        category: form.category || null,
        image_url: imageUrl || null,
        active: form.active,
      };
      if (editingId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(editingId ? "Product updated!" : "Product created!");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setImageFile(null);
      setImagePreview(null);
      setUploading(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product deleted!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDelete = async (product: { id: string; name: string }) => {
    const ok = await confirm({
      title: "Delete this product?",
      description: `"${product.name}" will be permanently deleted. If it appears in past orders, deletion may fail — deactivate it instead. This action cannot be undone.`,
    });
    if (!ok) return;
    deleteMutation.mutate(product.id);
  };

  const openEdit = (product: any) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      stock: String(product.stock),
      category: product.category || "",
      image_url: product.image_url || "",
      active: product.active,
    });
    setImageFile(null);
    setImagePreview(product.image_url || null);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(true);
  };

  const filtered = products.filter((p: any) => {
    const q = searchTerm.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
  });

  return (
          <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Products</h1>
            <p className="text-sm text-muted-foreground">{products.length} products</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => exportToCsv("products", products.map((p: any) => ({
              name: p.name, description: p.description || "", category: p.category || "",
              price: `$${Number(p.price).toFixed(2)}`,
              stock: p.stock, active: p.active ? "Yes" : "No",
              image_url: p.image_url || "",
              date: new Date(p.created_at).toLocaleDateString(),
            })), [
              { key: "name", label: "Name" }, { key: "description", label: "Description" },
              { key: "category", label: "Category" },
              { key: "price", label: "Price" }, { key: "stock", label: "Stock" },
              { key: "active", label: "Active" }, { key: "image_url", label: "Image URL" },
              { key: "date", label: "Created" },
            ])}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <PermissionGate resource="products" action="create">
              <Button className="gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            </PermissionGate>
          </div>
        </div>

        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Store className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Public Store</p>
                <p className="text-sm text-muted-foreground">
                  {storeEnabled
                    ? "Store link and /store page are visible to visitors."
                    : "Store is hidden — no Store link in the navbar or footer."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="store-enabled" className="text-sm text-muted-foreground">
                {storeEnabled ? "On" : "Off"}
              </Label>
              <Switch
                id="store-enabled"
                checked={storeEnabled}
                disabled={storeToggleMutation.isPending}
                onCheckedChange={(checked) => storeToggleMutation.mutate(checked)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, category..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </div>

        <Card className="mt-4">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                      {searchTerm ? "No products match your search." : "No products yet. Add your first product!"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <img src={product.image_url || "/placeholder.svg"} alt={product.name} className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{product.description || "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{product.category || "—"}</TableCell>
                      <TableCell className="font-medium">${Number(product.price).toFixed(2)}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={product.active ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                          {product.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <PermissionGate resource="products" action="edit">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate resource="products" action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDelete(product)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.name || !form.price) {
                  toast.error("Name and price are required");
                  return;
                }
                saveMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Product Image</Label>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <div className="h-32 w-32 overflow-hidden rounded-lg border border-border bg-muted">
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                    <Upload className="h-8 w-8" />
                    <span className="mt-2 text-sm">Click to upload image</span>
                    <span className="text-xs">Max 10MB · Auto-resized</span>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  </label>
                )}
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price *</Label>
                  <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. GPS Trackers" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.active} onCheckedChange={(checked) => setForm({ ...form, active: checked })} />
                <Label>Active (visible in store)</Label>
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending || uploading}>
                {uploading ? "Uploading image..." : saveMutation.isPending ? "Saving..." : editingId ? "Update Product" : "Create Product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </main>
  );
};

export default AdminProducts;
