import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle, Pencil, Heart, Download, Trash2, EyeOff, Eye, Search, ArrowRightLeft, ShieldCheck, Clock } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

const statusColors: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-muted text-muted-foreground",
};

const AdminAdoptions = () => {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [editListing, setEditListing] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: listings = [] } = useQuery({
    queryKey: ["admin-adoptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_adoptions")
        .select("*, pets(id, name, species, breed, pet_code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set([...data.map(d => d.owner_id), ...data.filter(d => d.adopter_id).map(d => d.adopter_id!)])];
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, full_name").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
      return data.map(d => ({
        ...d,
        ownerName: profileMap[d.owner_id]?.full_name || profileMap[d.owner_id]?.email || "—",
        adopterName: d.adopter_id ? (profileMap[d.adopter_id]?.full_name || profileMap[d.adopter_id]?.email || "—") : null,
      }));
    },
  });

  const handleToggleVisibility = async (id: string, currentlyApproved: boolean) => {
    const { error } = await supabase.from("pet_adoptions").update({ admin_approved: !currentlyApproved }).eq("id", id);
    if (error) toast.error("Failed to update");
    else { toast.success(currentlyApproved ? "Listing hidden" : "Listing restored"); queryClient.invalidateQueries({ queryKey: ["admin-adoptions"] }); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this listing?",
      description: "This adoption listing will be permanently deleted. This action cannot be undone.",
    });
    if (!ok) return;
    const { error } = await supabase.from("pet_adoptions").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Listing deleted"); queryClient.invalidateQueries({ queryKey: ["admin-adoptions"] }); }
  };

  const handleOwnerTransfer = async (listing: any) => {
    if (!listing.adopter_id) { toast.error("No adopter assigned"); return; }
    const ok = await confirm({
      title: "Complete this owner transfer?",
      description: "The pet will be moved to the adopter's account immediately.",
      variant: "default",
      confirmLabel: "Transfer",
    });
    if (!ok) return;
    const { error: petErr } = await supabase.from("pets").update({ owner_id: listing.adopter_id }).eq("id", listing.pet_id);
    if (petErr) { toast.error("Failed to transfer pet"); return; }
    const { error } = await supabase.from("pet_adoptions").update({
      status: "completed", owner_confirmed: true, adopter_confirmed: true, updated_at: new Date().toISOString(),
    }).eq("id", listing.id);
    if (error) {
      // Revert the ownership change so we don't leave a half-completed transfer
      await supabase.from("pets").update({ owner_id: listing.owner_id }).eq("id", listing.pet_id);
      toast.error("Failed to update the adoption listing — transfer was rolled back. Please try again.");
      return;
    }
    // Send notifications to both parties
    await supabase.rpc("insert_system_notification", {
      _user_id: listing.owner_id,
      _title: "Pet Transfer Complete",
      _message: `Your pet ${listing.pets?.name || ""} has been transferred to the new owner by admin.`,
      _type: "adoption",
      _link: "/dashboard/adoption",
    });
    await supabase.rpc("insert_system_notification", {
      _user_id: listing.adopter_id,
      _title: "Adoption Complete!",
      _message: `The pet ${listing.pets?.name || ""} has been transferred to your account by admin.`,
      _type: "adoption",
      _link: "/dashboard",
    });
    // Send emails to both parties
    try {
      const { data: ownerProfile } = await supabase.from("profiles").select("email, full_name").eq("user_id", listing.owner_id).single();
      const { data: adopterProfile } = await supabase.from("profiles").select("email, full_name").eq("user_id", listing.adopter_id).single();
      if (ownerProfile?.email) {
        await supabase.functions.invoke("send-smtp-email", { body: { to: ownerProfile.email, subject: "Pet Transfer Complete", html: `<p>Dear ${ownerProfile.full_name || "Member"},</p><p>Your pet <strong>${listing.pets?.name || ""}</strong> has been successfully transferred to the new owner.</p><p>Thank you for using Pets Registry.</p>` } });
      }
      if (adopterProfile?.email) {
        await supabase.functions.invoke("send-smtp-email", { body: { to: adopterProfile.email, subject: "Adoption Complete - Pet Transferred!", html: `<p>Dear ${adopterProfile.full_name || "Member"},</p><p>Congratulations! The pet <strong>${listing.pets?.name || ""}</strong> has been transferred to your account.</p><p>You can now manage your new pet from your dashboard.</p><p>Thank you for using Pets Registry.</p>` } });
      }
    } catch (e) { console.error("Email send error:", e); }
    toast.success("Owner transfer complete — pet moved to new owner");
    queryClient.invalidateQueries({ queryKey: ["admin-adoptions"] });
  };

  const handleSave = async () => {
    if (!editListing) return;
    const { error } = await supabase.from("pet_adoptions").update({
      description: editListing.description,
      adoption_fee: editListing.adoption_fee ? Number(editListing.adoption_fee) : 0,
      status: editListing.status,
      admin_approved: editListing.admin_approved,
    }).eq("id", editListing.id);
    if (error) { toast.error("Failed to save"); return; }
    toast.success("Listing updated");
    setEditListing(null);
    queryClient.invalidateQueries({ queryKey: ["admin-adoptions"] });
  };

  const filtered = listings.filter((l: any) => {
    const q = searchTerm.toLowerCase();
    return !q || (l.pets?.name || "").toLowerCase().includes(q) || (l.pets?.pet_code || "").toLowerCase().includes(q) || l.ownerName.toLowerCase().includes(q) || (l.adopterName || "").toLowerCase().includes(q) || l.status.includes(q);
  });

  return (
          <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Heart className="h-6 w-6 text-rose-500" /> Adoption Management
            </h1>
            <p className="text-sm text-muted-foreground">Manage listings, view transfer status, and complete owner transfers.</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => exportToCsv("adoptions", listings.map((a: any) => ({
            pet: a.pets?.name || "", species: a.pets?.species || "", status: a.status,
            fee: a.adoption_fee || 0, approved: a.admin_approved ? "Yes" : "No",
            owner: a.ownerName, adopter: a.adopterName || "",
            owner_confirmed: a.owner_confirmed ? "Yes" : "No",
            adopter_confirmed: a.adopter_confirmed ? "Yes" : "No",
            description: a.description || "",
            date: new Date(a.created_at).toLocaleDateString(),
          })), [
            { key: "pet", label: "Pet" }, { key: "species", label: "Species" },
            { key: "status", label: "Status" }, { key: "fee", label: "Fee" },
            { key: "approved", label: "Approved" }, { key: "owner", label: "Owner" },
            { key: "adopter", label: "Adopter" },
            { key: "owner_confirmed", label: "Owner Confirmed" },
            { key: "adopter_confirmed", label: "Adopter Confirmed" },
            { key: "description", label: "Description" }, { key: "date", label: "Date" },
          ])}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="mt-6 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by pet, owner, adopter, status..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </div>

        <Card className="mt-4">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pet</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transfer Status</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Adopter</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{searchTerm ? "No results" : "No adoption listings."}</TableCell></TableRow>
                ) : filtered.map((listing: any) => (
                  <TableRow key={listing.id} className={!listing.admin_approved ? "opacity-60" : ""}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{listing.pets?.name}</span>
                        <span className="ml-2 text-xs font-mono text-muted-foreground">{listing.pets?.pet_code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{listing.ownerName}</TableCell>
                    <TableCell>{listing.adoption_fee > 0 ? `$${listing.adoption_fee}` : "Free"}</TableCell>
                    <TableCell><Badge className={statusColors[listing.status] || "bg-muted"}>{listing.status}</Badge></TableCell>
                    <TableCell>
                      {listing.status === "pending" && listing.adopter_id ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-xs">
                            {listing.owner_confirmed ? <CheckCircle className="h-3 w-3 text-emerald-600" /> : <Clock className="h-3 w-3 text-amber-500" />}
                            Owner: {listing.owner_confirmed ? "Confirmed" : "Pending"}
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            {listing.adopter_confirmed ? <CheckCircle className="h-3 w-3 text-emerald-600" /> : <Clock className="h-3 w-3 text-amber-500" />}
                            Adopter: {listing.adopter_confirmed ? "Confirmed" : "Pending"}
                          </div>
                        </div>
                      ) : listing.status === "completed" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 gap-1"><CheckCircle className="h-3 w-3" /> Transferred</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {listing.admin_approved
                        ? <Badge className="bg-emerald-100 text-emerald-700"><Eye className="mr-1 h-3 w-3" />Visible</Badge>
                        : <Badge className="bg-amber-100 text-amber-700"><EyeOff className="mr-1 h-3 w-3" />Hidden</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{listing.adopterName || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(listing.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {listing.status === "pending" && listing.adopter_id && (
                          <PermissionGate resource="pets" action="edit">
                            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleOwnerTransfer(listing)}>
                              <ArrowRightLeft className="h-3 w-3" /> Owner Transfer
                            </Button>
                          </PermissionGate>
                        )}
                        <Button size="sm" variant={listing.admin_approved ? "outline" : "default"} className="gap-1 text-xs" onClick={() => handleToggleVisibility(listing.id, listing.admin_approved)}>
                          {listing.admin_approved ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
                        </Button>
                        <PermissionGate resource="pets" action="edit">
                          <Button size="sm" variant="ghost" onClick={() => setEditListing({ ...listing })}><Pencil className="h-4 w-4" /></Button>
                        </PermissionGate>
                        <PermissionGate resource="pets" action="delete">
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(listing.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!editListing} onOpenChange={(o) => !o && setEditListing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Adoption Listing</DialogTitle></DialogHeader>
            {editListing && (
              <div className="space-y-4 pt-2">
                <div><Label>Description</Label><Textarea value={editListing.description || ""} onChange={(e) => setEditListing({ ...editListing, description: e.target.value })} rows={4} /></div>
                <div><Label>Adoption Fee ($)</Label><Input type="number" value={editListing.adoption_fee || 0} onChange={(e) => setEditListing({ ...editListing, adoption_fee: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editListing.status} onChange={(e) => setEditListing({ ...editListing, status: e.target.value })}>
                    <option value="available">Available</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <Label>Publicly Visible</Label>
                  <input type="checkbox" checked={editListing.admin_approved} onChange={(e) => setEditListing({ ...editListing, admin_approved: e.target.checked })} className="h-4 w-4" />
                </div>
                <Button className="w-full" onClick={handleSave}>Save Changes</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {confirmDialog}
      </main>
  );
};

export default AdminAdoptions;
