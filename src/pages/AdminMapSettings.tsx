import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, MapPin, Plus, Trash2, ToggleLeft, Navigation, Pencil, Upload, Image as ImageIcon } from "lucide-react";
import { uploadImage } from "@/lib/imageUpload";

/* ─── Preset Pin Designs ─── */
const PRESET_PINS = [
  { emoji: "🏥", color: "#ef4444", label: "Hospital / Vet" },
  { emoji: "🐾", color: "#8B5CF6", label: "Pet Service" },
  { emoji: "🛒", color: "#22c55e", label: "Pet Shop" },
  { emoji: "🌳", color: "#16a34a", label: "Park" },
  { emoji: "🏠", color: "#f59e0b", label: "Shelter" },
  { emoji: "✂️", color: "#a855f7", label: "Grooming" },
  { emoji: "🐕", color: "#0ea5e9", label: "Dog Park" },
  { emoji: "🐈", color: "#ec4899", label: "Cat Café" },
  { emoji: "🏪", color: "#06b6d4", label: "Store" },
  { emoji: "🎾", color: "#84cc16", label: "Pet Play" },
  { emoji: "🍖", color: "#d97706", label: "Pet Food" },
  { emoji: "💊", color: "#dc2626", label: "Pharmacy" },
  { emoji: "🏊", color: "#3b82f6", label: "Pet Pool" },
  { emoji: "🎓", color: "#6366f1", label: "Training" },
  { emoji: "🐶", color: "#f97316", label: "Breeder" },
  { emoji: "🐇", color: "#14b8a6", label: "Small Pets" },
  { emoji: "🦜", color: "#eab308", label: "Bird Shop" },
  { emoji: "🐠", color: "#0891b2", label: "Aquarium" },
  { emoji: "⛺", color: "#65a30d", label: "Pet Camp" },
  { emoji: "🚿", color: "#7c3aed", label: "Pet Spa" },
  { emoji: "📸", color: "#e11d48", label: "Pet Photo" },
  { emoji: "🏨", color: "#0d9488", label: "Pet Hotel" },
  { emoji: "🚑", color: "#b91c1c", label: "Emergency" },
  { emoji: "🦮", color: "#4f46e5", label: "Dog Walker" },
];

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#78716c", "#1e293b", "#0d9488", "#b91c1c",
];

const AdminMapSettings = () => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [editingPin, setEditingPin] = useState<any>(null);
  const [pinForm, setPinForm] = useState({ name: "", description: "", lat: "", lng: "", emoji: "📍", color: "#ef4444", category: "custom", icon_url: "" });
  const [uploading, setUploading] = useState(false);
  const [pinTab, setPinTab] = useState("preset");

  const { data: settings = [] } = useQuery({
    queryKey: ["map-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").like("key", "map_%").order("key");
      return data || [];
    },
  });

  const { data: pins = [], isLoading: pinsLoading } = useQuery({
    queryKey: ["map-custom-pins"],
    queryFn: async () => {
      const { data } = await supabase.from("map_custom_pins").select("*").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  useEffect(() => {
    if (settings.length > 0) {
      const map: Record<string, string> = {};
      settings.forEach((s: any) => { map[s.key] = s.value; });
      setValues(map);
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(values)) {
        if (key.startsWith("map_")) {
          await supabase.from("site_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
        }
      }
      toast.success("Map settings saved!");
      queryClient.invalidateQueries({ queryKey: ["map-settings"] });
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "pet-photos", "map-pins");
      setPinForm((p) => ({ ...p, icon_url: url }));
      toast.success("Pin icon uploaded!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSavePin = async () => {
    if (!pinForm.name || !pinForm.lat || !pinForm.lng) return toast.error("Name, latitude, and longitude are required");
    try {
      const payload: any = {
        name: pinForm.name,
        description: pinForm.description || null,
        lat: parseFloat(pinForm.lat),
        lng: parseFloat(pinForm.lng),
        emoji: pinForm.emoji,
        color: pinForm.color,
        category: pinForm.category,
        icon_url: pinForm.icon_url || null,
        updated_at: new Date().toISOString(),
      };
      if (editingPin) {
        const { error } = await supabase.from("map_custom_pins").update(payload).eq("id", editingPin.id);
        if (error) throw error;
        toast.success("Pin updated!");
      } else {
        delete payload.updated_at;
        const { error } = await supabase.from("map_custom_pins").insert(payload);
        if (error) throw error;
        toast.success("Pin added!");
      }
      queryClient.invalidateQueries({ queryKey: ["map-custom-pins"] });
      setShowPinDialog(false);
      setEditingPin(null);
      setPinForm({ name: "", description: "", lat: "", lng: "", emoji: "📍", color: "#ef4444", category: "custom", icon_url: "" });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeletePin = async (id: string) => {
    if (!confirm("Delete this pin?")) return;
    const { error } = await supabase.from("map_custom_pins").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ["map-custom-pins"] });
      toast.success("Pin deleted");
    }
  };

  const handleTogglePin = async (pin: any) => {
    const { error } = await supabase.from("map_custom_pins").update({ is_active: !pin.is_active }).eq("id", pin.id);
    if (error) toast.error(error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ["map-custom-pins"] });
      toast.success(pin.is_active ? "Pin hidden" : "Pin visible");
    }
  };

  const openEditPin = (pin: any) => {
    setEditingPin(pin);
    setPinForm({
      name: pin.name,
      description: pin.description || "",
      lat: String(pin.lat),
      lng: String(pin.lng),
      emoji: pin.emoji,
      color: pin.color,
      category: pin.category,
      icon_url: pin.icon_url || "",
    });
    setShowPinDialog(true);
  };

  const openNewPin = () => {
    setEditingPin(null);
    setPinForm({ name: "", description: "", lat: "", lng: "", emoji: "📍", color: "#ef4444", category: "custom", icon_url: "" });
    setShowPinDialog(true);
  };

  const applyPreset = (preset: typeof PRESET_PINS[0]) => {
    setPinForm((p) => ({ ...p, emoji: preset.emoji, color: preset.color }));
  };

  const categoryToggles = [
    { key: "map_show_vets", label: "Veterinary Clinics", emoji: "🏥" },
    { key: "map_show_pet_shops", label: "Pet Shops", emoji: "🛒" },
    { key: "map_show_parks", label: "Parks & Dog Parks", emoji: "🌳" },
    { key: "map_show_shelters", label: "Animal Shelters", emoji: "🏠" },
    { key: "map_show_grooming", label: "Pet Grooming", emoji: "✂️" },
    { key: "map_show_directory", label: "Directory Listings", emoji: "🏪" },
  ];

  return (
          <main className="flex-1 bg-background p-6 md:p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" /> Pet Map Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Configure map categories, default location, and custom pins</p>
          </div>
          <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Category Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ToggleLeft className="h-5 w-5 text-primary" /> Map Categories
              </CardTitle>
              <CardDescription>Enable or disable map marker categories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryToggles.map((cat) => (
                <div key={cat.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="text-sm font-medium text-foreground">{cat.label}</span>
                  </div>
                  <Switch
                    checked={values[cat.key] !== "false"}
                    onCheckedChange={(checked) => setValues((prev) => ({ ...prev, [cat.key]: checked ? "true" : "false" }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Default Location & Zoom */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Navigation className="h-5 w-5 text-primary" /> Default Location
              </CardTitle>
              <CardDescription>Set the default map center and zoom level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Latitude</Label>
                  <Input type="number" step="any" value={values.map_default_lat || ""} onChange={(e) => setValues((prev) => ({ ...prev, map_default_lat: e.target.value }))} placeholder="1.3521" />
                </div>
                <div className="space-y-1.5">
                  <Label>Longitude</Label>
                  <Input type="number" step="any" value={values.map_default_lng || ""} onChange={(e) => setValues((prev) => ({ ...prev, map_default_lng: e.target.value }))} placeholder="103.8198" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Default Zoom Level (1-18)</Label>
                <Input type="number" min="1" max="18" value={values.map_default_zoom || ""} onChange={(e) => setValues((prev) => ({ ...prev, map_default_zoom: e.target.value }))} placeholder="13" />
                <p className="text-xs text-muted-foreground">Lower = more zoomed out, higher = more zoomed in</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Custom Pins */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-primary" /> Custom Map Pins
                </CardTitle>
                <CardDescription>Add custom markers visible to all users on the pet map</CardDescription>
              </div>
              <Button onClick={openNewPin} className="gap-2">
                <Plus className="h-4 w-4" /> Add Pin
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pinsLoading ? (
              <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : pins.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No custom pins yet. Click "Add Pin" to create one.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pins.map((pin: any) => (
                  <div key={pin.id} className={`rounded-xl border border-border p-4 transition-all ${!pin.is_active ? "opacity-50" : "hover:shadow-md"}`}>
                    <div className="flex items-start gap-3">
                      {/* Pin preview */}
                      <div className="shrink-0 flex items-center justify-center rounded-full border-2 border-background shadow-md"
                        style={{ width: 44, height: 44, backgroundColor: pin.color }}>
                        {pin.icon_url ? (
                          <img src={pin.icon_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <span className="text-lg">{pin.emoji}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{pin.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {Number(pin.lat).toFixed(4)}, {Number(pin.lng).toFixed(4)}
                        </p>
                        {pin.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{pin.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                      <div className="flex items-center gap-1.5">
                        {!pin.is_active && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                        <div className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: pin.color }} />
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTogglePin(pin)} title={pin.is_active ? "Hide" : "Show"}>
                          <ToggleLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPin(pin)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeletePin(pin.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pin Dialog */}
        <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPin ? "Edit Pin" : "Add Custom Pin"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Live Preview */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="shrink-0 flex items-center justify-center rounded-full border-2 border-background shadow-md"
                  style={{ width: 48, height: 48, backgroundColor: pinForm.color }}>
                  {pinForm.icon_url ? (
                    <img src={pinForm.icon_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="text-xl">{pinForm.emoji}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{pinForm.name || "Pin Name"}</p>
                  <p className="text-xs text-muted-foreground">{pinForm.description || "Description"}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={pinForm.name} onChange={(e) => setPinForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. PetPals Clinic" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={pinForm.description} onChange={(e) => setPinForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Latitude *</Label>
                  <Input type="number" step="any" value={pinForm.lat} onChange={(e) => setPinForm((p) => ({ ...p, lat: e.target.value }))} placeholder="1.3521" />
                </div>
                <div className="space-y-1.5">
                  <Label>Longitude *</Label>
                  <Input type="number" step="any" value={pinForm.lng} onChange={(e) => setPinForm((p) => ({ ...p, lng: e.target.value }))} placeholder="103.8198" />
                </div>
              </div>

              {/* Pin Design */}
              <Tabs value={pinTab} onValueChange={setPinTab}>
                <Label className="mb-1.5 block">Pin Design</Label>
                <TabsList className="w-full">
                  <TabsTrigger value="preset" className="flex-1">Preset Designs</TabsTrigger>
                  <TabsTrigger value="custom" className="flex-1">Custom Emoji</TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1">Upload Icon</TabsTrigger>
                </TabsList>

                <TabsContent value="preset" className="mt-3">
                  <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto pr-1">
                    {PRESET_PINS.map((preset) => (
                      <button key={preset.label} onClick={() => { applyPreset(preset); setPinForm((p) => ({ ...p, icon_url: "" })); }}
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all text-center ${pinForm.emoji === preset.emoji && pinForm.color === preset.color && !pinForm.icon_url ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:border-primary/50"}`}>
                        <div className="flex items-center justify-center rounded-full shadow-sm"
                          style={{ width: 36, height: 36, backgroundColor: preset.color }}>
                          <span className="text-base">{preset.emoji}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-tight">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="custom" className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Emoji Icon</Label>
                      <Input value={pinForm.emoji} onChange={(e) => setPinForm((p) => ({ ...p, emoji: e.target.value, icon_url: "" }))} placeholder="📍" className="text-center text-lg" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Pin Color</Label>
                      <div className="flex gap-2">
                        <input type="color" value={pinForm.color} onChange={(e) => setPinForm((p) => ({ ...p, color: e.target.value }))} className="w-10 h-9 rounded border border-input cursor-pointer" />
                        <Input value={pinForm.color} onChange={(e) => setPinForm((p) => ({ ...p, color: e.target.value }))} placeholder="#ef4444" className="flex-1" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Quick Colors</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button key={c} onClick={() => setPinForm((p) => ({ ...p, color: c }))}
                          className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${pinForm.color === c ? "border-foreground scale-110" : "border-border"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="upload" className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">Upload a custom image to use as the pin icon instead of an emoji.</p>
                  <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                    {pinForm.icon_url ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center justify-center rounded-full shadow-md" style={{ width: 56, height: 56, backgroundColor: pinForm.color }}>
                          <img src={pinForm.icon_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        </div>
                        <span className="text-xs text-muted-foreground">Click to change</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{uploading ? "Uploading..." : "Click to upload pin icon"}</span>
                        <span className="text-[10px] text-muted-foreground">PNG, JPG — recommended 64x64px</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} disabled={uploading} />
                  </label>
                  {pinForm.icon_url && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setPinForm((p) => ({ ...p, icon_url: "" }))}>
                      Remove uploaded icon (use emoji instead)
                    </Button>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Background Color</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button key={c} onClick={() => setPinForm((p) => ({ ...p, color: c }))}
                          className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${pinForm.color === c ? "border-foreground scale-110" : "border-border"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPinDialog(false)}>Cancel</Button>
              <Button onClick={handleSavePin}>{editingPin ? "Update" : "Add Pin"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
  );
};

export default AdminMapSettings;
