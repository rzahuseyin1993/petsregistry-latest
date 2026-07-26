import PermissionGate from "@/components/PermissionGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { HandHeart, DollarSign, Users, TrendingUp, Plus, Pencil, Trash2, Search } from "lucide-react";
import { useState } from "react";
import { Input as SearchInput } from "@/components/ui/input";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

const AdminDonations = () => {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [pkgDialog, setPkgDialog] = useState(false);
  const [editPkg, setEditPkg] = useState<any>(null);
  const [pkgName, setPkgName] = useState("");
  const [pkgAmount, setPkgAmount] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgOrder, setPkgOrder] = useState("0");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: donations = [] } = useQuery({
    queryKey: ["admin-donations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("*, donation_packages(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["admin-donation-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donation_packages")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const totalDonations = donations
    .filter((d: any) => d.status === "completed")
    .reduce((sum: number, d: any) => sum + Number(d.amount), 0);
  const donorCount = new Set(donations.filter((d: any) => d.status === "completed").map((d: any) => d.donor_email || d.user_id)).size;

  const savePkgMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: pkgName, amount: Number(pkgAmount), description: pkgDesc, sort_order: Number(pkgOrder) };
      if (editPkg) {
        const { error } = await supabase.from("donation_packages").update(payload).eq("id", editPkg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("donation_packages").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-donation-packages"] });
      toast({ title: editPkg ? "Package updated" : "Package created" });
      setPkgDialog(false);
      resetPkgForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePkgMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("donation_packages").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-donation-packages"] });
      toast({ title: "Package deactivated" });
    },
  });

  const handleDeletePkg = async (id: string) => {
    const ok = await confirm({
      title: "Delete this donation package?",
      description: "This package will be deactivated and no longer offered. This action cannot be undone.",
    });
    if (!ok) return;
    deletePkgMutation.mutate(id);
  };

  const resetPkgForm = () => {
    setEditPkg(null);
    setPkgName("");
    setPkgAmount("");
    setPkgDesc("");
    setPkgOrder("0");
  };

  const openEdit = (pkg: any) => {
    setEditPkg(pkg);
    setPkgName(pkg.name);
    setPkgAmount(String(pkg.amount));
    setPkgDesc(pkg.description || "");
    setPkgOrder(String(pkg.sort_order));
    setPkgDialog(true);
  };

  const statusColor: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
          <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <h1 className="font-display text-2xl font-bold text-foreground">Donations</h1>
        <p className="mt-1 text-sm text-muted-foreground">View donations and manage packages</p>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Raised</p>
                <p className="text-2xl font-bold text-foreground">${totalDonations.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <Users className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Total Donors</p>
                <p className="text-2xl font-bold text-foreground">{donorCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Donations</p>
                <p className="text-2xl font-bold text-foreground">{donations.filter((d: any) => d.status === "completed").length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Donation Packages */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Donation Packages</h2>
            <PermissionGate resource="donations" action="create">
              <Dialog open={pkgDialog} onOpenChange={(o) => { setPkgDialog(o); if (!o) resetPkgForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Package</Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editPkg ? "Edit Package" : "New Package"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); savePkgMutation.mutate(); }} className="space-y-4">
                  <div className="space-y-2"><Label>Name</Label><Input value={pkgName} onChange={(e) => setPkgName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Amount ($)</Label><Input type="number" min="1" value={pkgAmount} onChange={(e) => setPkgAmount(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Description</Label><Input value={pkgDesc} onChange={(e) => setPkgDesc(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Sort Order</Label><Input type="number" value={pkgOrder} onChange={(e) => setPkgOrder(e.target.value)} /></div>
                  <Button type="submit" disabled={savePkgMutation.isPending} className="w-full">
                    {savePkgMutation.isPending ? "Saving..." : "Save Package"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            </PermissionGate>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg: any) => (
              <Card key={pkg.id} className={!pkg.is_active ? "opacity-50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground">{pkg.name}</p>
                    <p className="text-lg font-bold text-primary">${pkg.amount}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{pkg.description}</p>
                    <div className="mt-3 flex gap-2">
                      <PermissionGate resource="donations" action="edit">
                        <Button variant="outline" size="sm" onClick={() => openEdit(pkg)}><Pencil className="h-3 w-3" /></Button>
                      </PermissionGate>
                      <PermissionGate resource="donations" action="delete">
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeletePkg(pkg.id)}><Trash2 className="h-3 w-3" /></Button>
                      </PermissionGate>
                    </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Donations List */}
        <div className="mt-8">
          <h2 className="font-display text-lg font-semibold text-foreground">All Donations</h2>
          <div className="mt-4 mb-4 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <SearchInput placeholder="Search by donor, email, status..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
          </div>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Donor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donations.filter((d: any) => {
                    const q = searchTerm.toLowerCase();
                    return !q || (d.donor_name || "").toLowerCase().includes(q) || (d.donor_email || "").toLowerCase().includes(q) || d.status.toLowerCase().includes(q) || ((d as any).donation_packages?.name || "").toLowerCase().includes(q);
                  }).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{searchTerm ? "No donations match your search" : "No donations yet"}</TableCell></TableRow>
                  ) : donations.filter((d: any) => {
                    const q = searchTerm.toLowerCase();
                    return !q || (d.donor_name || "").toLowerCase().includes(q) || (d.donor_email || "").toLowerCase().includes(q) || d.status.toLowerCase().includes(q) || ((d as any).donation_packages?.name || "").toLowerCase().includes(q);
                  }).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{d.donor_name || "Anonymous"}</TableCell>
                      <TableCell className="text-xs">{d.donor_email || "—"}</TableCell>
                      <TableCell className="text-xs">{(d as any).donation_packages?.name || "Custom"}</TableCell>
                      <TableCell className="font-bold text-primary">${Number(d.amount).toFixed(2)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">{d.message || "—"}</TableCell>
                      <TableCell className="text-xs">{d.payment_method || "—"}</TableCell>
                      <TableCell>
                        <Badge className={statusColor[d.status] || ""}>{d.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
        {confirmDialog}
      </main>
  );
};

export default AdminDonations;
