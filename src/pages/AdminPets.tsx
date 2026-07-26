import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Pencil, Trash2, Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

const statusStyles: Record<string, string> = {
  registered: "bg-success text-success-foreground",
  lost: "bg-destructive text-destructive-foreground",
  found: "bg-accent text-accent-foreground",
};

const speciesOptions = ["Dog", "Cat", "Bird", "Fish", "Rabbit", "Hamster", "Reptile", "Bear", "Other"];

const AdminPets = () => {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [editPet, setEditPet] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: pets = [] } = useQuery({
    queryKey: ["admin-pets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("*, pet_images(image_url, sort_order)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ownerIds = [...new Set(data.map((p) => p.owner_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, full_name").in("user_id", ownerIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
      return data.map((p) => ({ ...p, ownerEmail: profileMap[p.owner_id]?.email || "—", ownerName: profileMap[p.owner_id]?.full_name || "" }));
    },
  });

  const handleSave = async () => {
    if (!editPet) return;
    const { error } = await supabase.from("pets").update({
      pet_code: editPet.pet_code,
      name: editPet.name,
      species: editPet.species,
      breed: editPet.breed,
      age: editPet.age,
      color: editPet.color,
      weight: editPet.weight,
      microchip_number: editPet.microchip_number,
      status: editPet.status,
      notes: editPet.notes,
    }).eq("id", editPet.id);
    if (error) { toast.error("Failed to save"); return; }
    toast.success("Pet updated");
    setEditPet(null);
    queryClient.invalidateQueries({ queryKey: ["admin-pets"] });
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this pet?",
      description: "This pet will be permanently deleted. This action cannot be undone.",
    });
    if (!ok) return;
    const { error } = await supabase.from("pets").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Pet deleted"); queryClient.invalidateQueries({ queryKey: ["admin-pets"] }); }
  };

  return (
          <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">All Pets</h1>
            <p className="text-sm text-muted-foreground">View, edit, and manage all registered pets</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => exportToCsv("pets", pets.map((p: any) => ({
            pet_code: p.pet_code || "", name: p.name, species: p.species, breed: p.breed || "",
            age: p.age || "", color: p.color || "", weight: p.weight || "",
            microchip: p.microchip_number || "", status: p.status, notes: p.notes || "",
            owner_name: p.ownerName || "", owner_email: p.ownerEmail,
            registered: new Date(p.created_at).toLocaleDateString(),
          })), [
            { key: "pet_code", label: "Pet Code" }, { key: "name", label: "Name" }, { key: "species", label: "Species" },
            { key: "breed", label: "Breed" }, { key: "age", label: "Age" }, { key: "color", label: "Color" },
            { key: "weight", label: "Weight" }, { key: "microchip", label: "Microchip" }, { key: "status", label: "Status" },
            { key: "notes", label: "Notes" }, { key: "owner_name", label: "Owner Name" },
            { key: "owner_email", label: "Owner Email" }, { key: "registered", label: "Registered" },
          ])}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
        <div className="mt-6 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, species, breed, pet code, owner..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </div>
        <Card className="mt-4">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pet Code</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Species</TableHead>
                  <TableHead>Breed</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pets.filter((pet: any) => {
                  const q = searchTerm.toLowerCase();
                  return !q || pet.name.toLowerCase().includes(q) || pet.species.toLowerCase().includes(q) || (pet.breed || "").toLowerCase().includes(q) || (pet.pet_code || "").toLowerCase().includes(q) || (pet.ownerEmail || "").toLowerCase().includes(q) || (pet.microchip_number || "").toLowerCase().includes(q);
                }).map((pet: any) => {
                  const firstImage = (pet.pet_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
                  return (
                    <TableRow key={pet.id}>
                      <TableCell><span className="font-mono text-sm font-semibold text-primary">{pet.pet_code || "—"}</span></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img src={firstImage?.image_url || "/placeholder.svg"} alt={pet.name} className="h-10 w-10 rounded-lg object-cover" />
                          <span className="font-medium">{pet.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{pet.species}</TableCell>
                      <TableCell>{pet.breed || "—"}</TableCell>
                      <TableCell>{pet.ownerEmail}</TableCell>
                      <TableCell><Badge className={statusStyles[pet.status]}>{pet.status}</Badge></TableCell>
                      <TableCell>{new Date(pet.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <PermissionGate resource="pets" action="edit">
                            <Button size="sm" variant="ghost" onClick={() => setEditPet({ ...pet })}><Pencil className="h-4 w-4" /></Button>
                          </PermissionGate>
                          <PermissionGate resource="pets" action="delete">
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(pet.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editPet} onOpenChange={(o) => !o && setEditPet(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Pet</DialogTitle></DialogHeader>
            {editPet && (
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Pet Code</Label>
                  <Input value={editPet.pet_code || ""} onChange={(e) => setEditPet({ ...editPet, pet_code: e.target.value })} placeholder="PR-2026-100001" />
                  <p className="text-xs text-muted-foreground mt-1">Format: PR-YYYY-NNNNNN</p>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div><Label>Name</Label><Input value={editPet.name} onChange={(e) => setEditPet({ ...editPet, name: e.target.value })} /></div>
                  <div>
                    <Label>Species</Label>
                    <Select value={editPet.species} onValueChange={(v) => setEditPet({ ...editPet, species: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{speciesOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div><Label>Breed</Label><Input value={editPet.breed || ""} onChange={(e) => setEditPet({ ...editPet, breed: e.target.value })} /></div>
                  <div><Label>Age</Label><Input value={editPet.age || ""} onChange={(e) => setEditPet({ ...editPet, age: e.target.value })} /></div>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div><Label>Color</Label><Input value={editPet.color || ""} onChange={(e) => setEditPet({ ...editPet, color: e.target.value })} /></div>
                  <div><Label>Weight</Label><Input value={editPet.weight || ""} onChange={(e) => setEditPet({ ...editPet, weight: e.target.value })} /></div>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div><Label>Microchip</Label><Input value={editPet.microchip_number || ""} onChange={(e) => setEditPet({ ...editPet, microchip_number: e.target.value })} /></div>
                  <div>
                    <Label>Status</Label>
                    <Select value={editPet.status} onValueChange={(v) => setEditPet({ ...editPet, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="registered">Registered</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                        <SelectItem value="found">Found</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Notes</Label><Textarea value={editPet.notes || ""} onChange={(e) => setEditPet({ ...editPet, notes: e.target.value })} /></div>
                <Button className="w-full" onClick={handleSave}>Save Changes</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </main>
  );
};

export default AdminPets;
