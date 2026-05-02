import { useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, FileText, Crown, Award, Download, ToggleLeft, ToggleRight } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

const AdminServiceSubscriptions = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  // Flyer subscriptions with profile info
  const { data: flyerSubs = [] } = useQuery({
    queryKey: ["admin-flyer-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flyer_subscriptions" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set((data || []).map((d: any) => d.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, full_name").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
      return (data || []).map((d: any) => ({
        ...d,
        service: "Flyer Builder",
        email: profileMap[d.user_id]?.email || "—",
        full_name: profileMap[d.user_id]?.full_name || "—",
      }));
    },
  });

  // Memberships with profile and plan info
  const { data: memberships = [] } = useQuery({
    queryKey: ["admin-memberships-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("*, membership_plans(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set((data || []).map((d: any) => d.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, full_name").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
      return (data || []).map((d: any) => ({
        ...d,
        service: `Membership: ${d.membership_plans?.name || "—"}`,
        email: profileMap[d.user_id]?.email || "—",
        full_name: profileMap[d.user_id]?.full_name || "—",
      }));
    },
  });

  // Paid certificates
  const { data: certificates = [] } = useQuery({
    queryKey: ["admin-cert-subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_certificates")
        .select("*")
        .eq("is_paid", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set((data || []).map((d: any) => d.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, full_name").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
      return (data || []).map((d: any) => ({
        ...d,
        service: "Pet Certificate",
        email: profileMap[d.user_id]?.email || "—",
        full_name: profileMap[d.user_id]?.full_name || "—",
      }));
    },
  });

  // Combine all into a unified list
  const allRecords = [
    ...flyerSubs.map((s: any) => ({
      id: s.id, user_id: s.user_id, service: s.service, status: s.status,
      email: s.email, full_name: s.full_name, payment_id: s.payment_id,
      created_at: s.created_at, expires_at: s.expires_at, type: "flyer",
      billing_interval: s.billing_interval || "—",
    })),
    ...memberships.map((s: any) => ({
      id: s.id, user_id: s.user_id, service: s.service, status: s.status,
      email: s.email, full_name: s.full_name, payment_id: s.payment_id,
      created_at: s.created_at, expires_at: s.expires_at, type: "membership",
      billing_interval: s.billing_interval || "—",
    })),
    ...certificates.map((s: any) => ({
      id: s.id, user_id: s.user_id, service: s.service, status: s.status,
      email: s.email, full_name: s.full_name, payment_id: s.payment_id,
      created_at: s.created_at, expires_at: null, type: "certificate",
      billing_interval: "one_time",
    })),
  ];

  const filtered = allRecords.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.email.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q) || r.service.toLowerCase().includes(q);
    const matchTab = tab === "all" || r.type === tab;
    return matchSearch && matchTab;
  });

  const handleToggleStatus = async (record: any) => {
    const newStatus = record.status === "active" ? "expired" : "active";
    try {
      if (record.type === "flyer") {
        const { error } = await supabase.from("flyer_subscriptions" as any).update({ status: newStatus }).eq("id", record.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["admin-flyer-subs"] });
      } else if (record.type === "membership") {
        const { error } = await supabase.from("memberships").update({ status: newStatus }).eq("id", record.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["admin-memberships-subs"] });
      } else if (record.type === "certificate") {
        const newPaid = record.status === "active" ? false : true;
        const { error } = await supabase.from("pet_certificates").update({ is_paid: newPaid, status: newPaid ? "issued" : "draft" }).eq("id", record.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["admin-cert-subs"] });
      }
      toast.success(`Status changed to ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  const handleExport = () => {
    exportToCsv("service-subscriptions", filtered.map(r => ({
      name: r.full_name, email: r.email, service: r.service,
      status: r.status, billing_interval: r.billing_interval || "one_time",
      price: "—",
      payment_id: r.payment_id || "—",
      date: new Date(r.created_at).toLocaleDateString(),
      expires: r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—",
    })), [
      { key: "name", label: "Name" }, { key: "email", label: "Email" },
      { key: "service", label: "Service" }, { key: "status", label: "Status" },
      { key: "billing_interval", label: "Billing Interval" }, { key: "price", label: "Price" },
      { key: "payment_id", label: "Payment ID" }, { key: "date", label: "Purchase Date" },
      { key: "expires", label: "Expires" },
    ]);
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Service Subscriptions</h1>
            <p className="text-sm text-muted-foreground">
              View and manage all paid services — memberships, flyer access, and certificates.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2"><Crown className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{memberships.filter((m: any) => m.status === "active").length}</p>
                <p className="text-xs text-muted-foreground">Active Memberships</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="rounded-full bg-accent/10 p-2"><FileText className="h-5 w-5 text-accent-foreground" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{flyerSubs.filter((f: any) => f.status === "active").length}</p>
                <p className="text-xs text-muted-foreground">Active Flyer Access</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="rounded-full bg-emerald-500/10 p-2"><Award className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{certificates.length}</p>
                <p className="text-xs text-muted-foreground">Paid Certificates</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, service..." value={search} onChange={e => setSearch(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All ({allRecords.length})</TabsTrigger>
              <TabsTrigger value="membership">Memberships</TabsTrigger>
              <TabsTrigger value="flyer">Flyer Access</TabsTrigger>
              <TabsTrigger value="certificate">Certificates</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Table */}
        <Card className="mt-4">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No records found.</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={`${r.type}-${r.id}`}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell className="text-xs">{r.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{r.service}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {r.billing_interval === "one_time" ? "One-Time" : r.billing_interval}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={r.status === "active" || r.status === "issued" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.payment_id || "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => handleToggleStatus(r)}
                        title={r.status === "active" ? "Deactivate" : "Activate"}
                      >
                        {r.status === "active" || r.status === "issued" ? (
                          <><ToggleRight className="h-4 w-4 text-emerald-600" /> On</>
                        ) : (
                          <><ToggleLeft className="h-4 w-4 text-muted-foreground" /> Off</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminServiceSubscriptions;
