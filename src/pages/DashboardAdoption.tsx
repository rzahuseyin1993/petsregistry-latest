import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Heart, Plus, CheckCircle, XCircle, Clock, ArrowRightLeft, Trash2, Pencil, ShieldCheck, UserCheck, History } from "lucide-react";

const statusColors: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-muted text-muted-foreground",
};

const logTransferHistory = async (adoptionId: string, actorId: string, action: string, details?: string) => {
  await supabase.from("adoption_transfer_history" as any).insert({
    adoption_id: adoptionId,
    actor_id: actorId,
    action,
    details: details || null,
  } as any);
};

const sendAdoptionNotification = async (recipientId: string, title: string, message: string) => {
  await supabase.rpc("insert_system_notification", {
    _user_id: recipientId,
    _title: title,
    _message: message,
    _type: "adoption",
    _link: "/dashboard/adoption",
  });
};

const DashboardAdoption = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [fee, setFee] = useState("");
  const [description, setDescription] = useState("");
  const [editListing, setEditListing] = useState<any>(null);
  const [historyAdoptionId, setHistoryAdoptionId] = useState<string | null>(null);

  const { data: pets = [] } = useQuery({
    queryKey: ["my-pets-for-adoption", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name, species, breed")
        .eq("owner_id", user!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: myListings = [] } = useQuery({
    queryKey: ["my-adoption-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_adoptions")
        .select("*, pets(id, name, species, breed, pet_images(image_url, sort_order))")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-adoption-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_adoptions")
        .select("*, pets(id, name, species, breed, pet_images(image_url, sort_order))")
        .eq("adopter_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profileMap = {} } = useQuery({
    queryKey: ["adoption-profiles", myListings, myRequests],
    enabled: myListings.length > 0 || myRequests.length > 0,
    queryFn: async () => {
      const ids = new Set<string>();
      myListings.forEach((l: any) => { if (l.adopter_id) ids.add(l.adopter_id); });
      myRequests.forEach((r: any) => ids.add(r.owner_id));
      if (ids.size === 0) return {};
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", [...ids]);
      return Object.fromEntries((data || []).map(p => [p.user_id, p.full_name || p.email]));
    },
  });

  const { data: transferHistory = [] } = useQuery({
    queryKey: ["transfer-history", historyAdoptionId],
    enabled: !!historyAdoptionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adoption_transfer_history" as any)
        .select("*")
        .eq("adoption_id", historyAdoptionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["my-adoption-listings"] });
    queryClient.invalidateQueries({ queryKey: ["my-adoption-requests"] });
    queryClient.invalidateQueries({ queryKey: ["my-pets"] });
    queryClient.invalidateQueries({ queryKey: ["my-pets-for-adoption"] });
    queryClient.invalidateQueries({ queryKey: ["transfer-history"] });
  };

  const handleCreateListing = async () => {
    if (!selectedPetId || !user) return;
    const petName = pets.find((p: any) => p.id === selectedPetId)?.name || "Pet";
    const { data, error } = await supabase.from("pet_adoptions").insert({
      pet_id: selectedPetId,
      owner_id: user.id,
      adoption_fee: fee ? Number(fee) : 0,
      description: description || null,
    }).select("id").single();
    if (error) { toast.error("Failed to create listing"); return; }
    await logTransferHistory(data.id, user.id, "listing_created", `${petName} listed for adoption`);
    toast.success("Pet listed for adoption!");
    setDialogOpen(false);
    setSelectedPetId("");
    setFee("");
    setDescription("");
    invalidateAll();
  };

  const sendTransferEmails = async (listing: any) => {
    try {
      const { data: ownerProfile } = await supabase.from("profiles").select("email, full_name").eq("user_id", listing.owner_id).single();
      const { data: adopterProfile } = await supabase.from("profiles").select("email, full_name").eq("user_id", listing.adopter_id).single();
      const petName = listing.pets?.name || "the pet";
      if (ownerProfile?.email) {
        await supabase.functions.invoke("send-smtp-email", { body: { to: ownerProfile.email, subject: "Pet Transfer Complete", html: `<p>Dear ${ownerProfile.full_name || "Member"},</p><p>Your pet <strong>${petName}</strong> has been successfully transferred to the new owner.</p><p>Thank you for using Pets Registry.</p>` } });
      }
      if (adopterProfile?.email) {
        await supabase.functions.invoke("send-smtp-email", { body: { to: adopterProfile.email, subject: "Adoption Complete - Pet Transferred!", html: `<p>Dear ${adopterProfile.full_name || "Member"},</p><p>Congratulations! The pet <strong>${petName}</strong> has been transferred to your account.</p><p>You can now manage your new pet from your dashboard.</p><p>Thank you for using Pets Registry.</p>` } });
      }
    } catch (e) { console.error("Email send error:", e); }
  };

  const handleOwnerConfirm = async (listing: any) => {
    const { error } = await supabase
      .from("pet_adoptions")
      .update({ owner_confirmed: true, updated_at: new Date().toISOString() })
      .eq("id", listing.id);
    if (error) { toast.error("Failed to confirm"); return; }
    await logTransferHistory(listing.id, user!.id, "owner_confirmed", "Owner confirmed the transfer");
    await sendAdoptionNotification(listing.adopter_id, "Owner Confirmed Transfer", `The owner has confirmed the transfer of ${listing.pets?.name || "the pet"}. Please confirm on your end to complete.`);
    // If both confirmed, the DB trigger completes the transfer — send emails
    if (listing.adopter_confirmed) {
      await sendTransferEmails(listing);
    }
    toast.success("You've confirmed the transfer." + (listing.adopter_confirmed ? " Transfer complete!" : " Waiting for adopter to confirm."));
    invalidateAll();
  };

  const handleAdopterConfirm = async (req: any) => {
    const { error } = await supabase
      .from("pet_adoptions")
      .update({ adopter_confirmed: true, updated_at: new Date().toISOString() })
      .eq("id", req.id);
    if (error) { toast.error("Failed to confirm"); return; }
    await logTransferHistory(req.id, user!.id, "adopter_confirmed", "Adopter confirmed the transfer");
    await sendAdoptionNotification(req.owner_id, "Adopter Confirmed Transfer", `The adopter has confirmed the transfer of ${req.pets?.name || "the pet"}.`);
    // If both confirmed, the DB trigger completes the transfer — send emails
    if (req.owner_confirmed) {
      await sendTransferEmails(req);
    }
    toast.success("Transfer confirmed!" + (req.owner_confirmed ? " The pet is now yours." : " Waiting for owner to confirm."));
    invalidateAll();
  };

  const handleRejectAdoption = async (listing: any) => {
    const { error } = await supabase
      .from("pet_adoptions")
      .update({ status: "available", adopter_id: null, owner_confirmed: false, adopter_confirmed: false, updated_at: new Date().toISOString() })
      .eq("id", listing.id);
    if (error) { toast.error("Failed to reject"); return; }
    await logTransferHistory(listing.id, user!.id, "request_rejected", "Owner rejected the adoption request");
    if (listing.adopter_id) {
      await sendAdoptionNotification(listing.adopter_id, "Adoption Request Rejected", `Your adoption request for ${listing.pets?.name || "the pet"} has been rejected by the owner.`);
    }
    toast.success("Request rejected");
    invalidateAll();
  };

  const handleCancelRequest = async (req: any) => {
    const { error } = await supabase
      .from("pet_adoptions")
      .update({ status: "available", adopter_id: null, owner_confirmed: false, adopter_confirmed: false, updated_at: new Date().toISOString() })
      .eq("id", req.id);
    if (error) { toast.error("Failed to cancel"); return; }
    await logTransferHistory(req.id, user!.id, "request_cancelled", "Adopter cancelled the adoption request");
    await sendAdoptionNotification(req.owner_id, "Adoption Request Cancelled", `The adoption request for ${req.pets?.name || "the pet"} has been cancelled by the adopter.`);
    toast.success("Adoption request cancelled");
    invalidateAll();
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    await logTransferHistory(id, user!.id, "listing_deleted", "Adoption listing was deleted");
    const { error } = await supabase.from("pet_adoptions").delete().eq("id", id);
    if (error) toast.error("Failed to delete listing");
    else { toast.success("Listing deleted"); invalidateAll(); }
  };

  const handleEditSave = async () => {
    if (!editListing) return;
    // Only allow editing description and fee — not status (prevents old owner from reverting completed adoptions)
    const { error } = await supabase.from("pet_adoptions").update({
      description: editListing.description,
      adoption_fee: editListing.adoption_fee ? Number(editListing.adoption_fee) : 0,
      updated_at: new Date().toISOString(),
    }).eq("id", editListing.id);
    if (error) { toast.error("Failed to save"); return; }
    await logTransferHistory(editListing.id, user!.id, "listing_updated", "Listing details were updated");
    toast.success("Listing updated");
    setEditListing(null);
    invalidateAll();
  };

  const actionLabels: Record<string, string> = {
    listing_created: "📋 Listing Created",
    listing_updated: "✏️ Listing Updated",
    listing_deleted: "🗑️ Listing Deleted",
    adoption_requested: "🤝 Adoption Requested",
    owner_confirmed: "✅ Owner Confirmed",
    adopter_confirmed: "✅ Adopter Confirmed",
    transfer_completed: "🎉 Transfer Completed",
    request_rejected: "❌ Request Rejected",
    request_cancelled: "🚫 Request Cancelled",
    admin_force_transfer: "⚡ Owner Transfer (Admin)",
  };

  const allAdoptions = [...myListings, ...myRequests];

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 bg-background p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Heart className="h-6 w-6 text-rose-500" /> Adoption Manager
            </h1>
            <p className="text-sm text-muted-foreground">List pets for adoption, manage requests, and confirm transfers</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> List Pet for Adoption</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>List a Pet for Adoption</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Select Pet</Label>
                  <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                    <SelectTrigger><SelectValue placeholder="Choose a pet..." /></SelectTrigger>
                    <SelectContent>
                      {pets.map((pet: any) => (
                        <SelectItem key={pet.id} value={pet.id}>{pet.name} ({pet.species})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Adoption Fee ($)</Label>
                  <Input type="number" placeholder="0 for free" value={fee} onChange={e => setFee(e.target.value)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea placeholder="Tell potential adopters about this pet..." value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleCreateListing}>Create Listing</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* My Listings (as owner) */}
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">My Listings</h2>
        {myListings.length === 0 ? (
          <Card className="mb-8 border-dashed">
            <CardContent className="py-10 text-center">
              <Heart className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-muted-foreground">No adoption listings yet. List a pet to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="mb-8 space-y-3">
            {myListings.map((listing: any) => {
              const pet = listing.pets;
              const hasPendingAdopter = listing.status === "pending" && listing.adopter_id;
              return (
                <Card key={listing.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                          {pet?.pet_images?.[0] && (
                            <img src={pet.pet_images[0].image_url} alt={pet.name} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{pet?.name} — {pet?.species}</p>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <Badge className={statusColors[listing.status] || "bg-muted text-foreground"}>
                              {listing.status === "pending" && <Clock className="mr-1 h-3 w-3" />}
                              {listing.status === "completed" && <CheckCircle className="mr-1 h-3 w-3" />}
                              {listing.status}
                            </Badge>
                            {!listing.admin_approved && listing.status === "available" && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                                <Clock className="h-3 w-3" /> Awaiting Approval
                              </Badge>
                            )}
                            {listing.adoption_fee > 0 && <span className="text-sm text-muted-foreground">${listing.adoption_fee}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setHistoryAdoptionId(listing.id)} title="View History">
                          <History className="h-4 w-4" />
                        </Button>
                        {listing.status === "available" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditListing({ ...listing })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteListing(listing.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {hasPendingAdopter && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                          <p className="text-sm font-semibold text-amber-800">
                            Transfer Request from {(profileMap as any)[listing.adopter_id] || "Member"}
                          </p>
                        </div>
                        <div className="flex items-center gap-6 mb-3">
                          <div className="flex items-center gap-2">
                            {listing.owner_confirmed ? (
                              <Badge className="bg-emerald-100 text-emerald-700 gap-1"><CheckCircle className="h-3 w-3" /> You confirmed</Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Your confirmation pending</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {listing.adopter_confirmed ? (
                              <Badge className="bg-emerald-100 text-emerald-700 gap-1"><CheckCircle className="h-3 w-3" /> Adopter confirmed</Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Adopter pending</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-amber-700 mb-3">
                          ⚠️ Before confirming: Meet the adopter in person, let them check the pet, and collect the adoption fee on the spot. Both you and the adopter must confirm to complete the transfer.
                        </p>
                        <div className="flex gap-2">
                          {!listing.owner_confirmed ? (
                            <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleOwnerConfirm(listing)}>
                              <ShieldCheck className="h-3 w-3" /> Confirm Transfer
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled className="gap-1">
                              <CheckCircle className="h-3 w-3" /> Confirmed
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleRejectAdoption(listing)}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* My Adoption Requests (as adopter) */}
        {myRequests.length > 0 && (
          <>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">My Adoption Requests</h2>
            <div className="mb-8 space-y-3">
              {myRequests.map((req: any) => {
                const pet = req.pets;
                const isPending = req.status === "pending";
                return (
                  <Card key={req.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                            {pet?.pet_images?.[0] && (
                              <img src={pet.pet_images[0].image_url} alt={pet?.name} className="h-full w-full object-cover" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{pet?.name} — {pet?.species}</p>
                            <p className="text-xs text-muted-foreground">Owner: {(profileMap as any)[req.owner_id] || "Member"}</p>
                            <Badge className={statusColors[req.status] || "bg-muted"}>
                              {req.status === "pending" ? "Awaiting confirmation" : req.status === "completed" ? "Adopted!" : req.status}
                            </Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setHistoryAdoptionId(req.id)} title="View History">
                          <History className="h-4 w-4" />
                        </Button>
                      </div>

                      {isPending && (
                        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <UserCheck className="h-4 w-4 text-blue-600" />
                            <p className="text-sm font-semibold text-blue-800">Transfer Confirmation</p>
                          </div>
                          <div className="flex items-center gap-6 mb-3">
                            <div className="flex items-center gap-2">
                              {req.owner_confirmed ? (
                                <Badge className="bg-emerald-100 text-emerald-700 gap-1"><CheckCircle className="h-3 w-3" /> Owner confirmed</Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Owner pending</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {req.adopter_confirmed ? (
                                <Badge className="bg-emerald-100 text-emerald-700 gap-1"><CheckCircle className="h-3 w-3" /> You confirmed</Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Your confirmation pending</Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-blue-700 mb-3">
                            ⚠️ Before confirming: Meet the owner in person, check the pet, and pay any adoption fee on the spot. Both parties must confirm. Once both confirm, the pet will be transferred to your account automatically.
                          </p>
                          <div className="flex gap-2">
                            {!req.adopter_confirmed ? (
                              <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => handleAdopterConfirm(req)}>
                                <ShieldCheck className="h-3 w-3" /> Confirm Adoption
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled className="gap-1">
                                <CheckCircle className="h-3 w-3" /> Confirmed
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleCancelRequest(req)}>
                              <XCircle className="h-3 w-3 mr-1" /> Cancel Request
                            </Button>
                          </div>
                        </div>
                      )}

                      {req.status === "completed" && (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                          <p className="text-sm text-emerald-700">This pet has been transferred to your account.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* Transfer History Dialog */}
        <Dialog open={!!historyAdoptionId} onOpenChange={(o) => !o && setHistoryAdoptionId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" /> Transfer History
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[400px] overflow-auto space-y-3">
              {(transferHistory as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No history recorded yet.</p>
              ) : (
                (transferHistory as any[]).map((entry: any) => (
                  <div key={entry.id} className="flex gap-3 items-start">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {actionLabels[entry.action] || entry.action}
                      </p>
                      {entry.details && <p className="text-xs text-muted-foreground">{entry.details}</p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editListing} onOpenChange={(o) => !o && setEditListing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Adoption Listing</DialogTitle></DialogHeader>
            {editListing && (
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Description</Label>
                  <Textarea value={editListing.description || ""} onChange={(e) => setEditListing({ ...editListing, description: e.target.value })} rows={4} />
                </div>
                <div>
                  <Label>Adoption Fee ($)</Label>
                  <Input type="number" value={editListing.adoption_fee || 0} onChange={(e) => setEditListing({ ...editListing, adoption_fee: e.target.value })} />
                </div>
                <Button className="w-full" onClick={handleEditSave}>Save Changes</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default DashboardAdoption;
