import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Coins, Plus, Minus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const AdminCertificateCreditsManager = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [grantEmail, setGrantEmail] = useState("");
  const [grantAmount, setGrantAmount] = useState(1);
  const [granting, setGranting] = useState(false);

  const grantToEmail = async () => {
    if (!grantEmail.trim()) return toast.error("Enter a member email");
    setGranting(true);
    try {
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .ilike("email", grantEmail.trim())
        .maybeSingle();
      if (pErr || !profile) {
        toast.error("No member found with that email");
        return;
      }
      const { error } = await supabase.rpc("grant_certificate_credit", {
        _user_id: profile.user_id,
        _amount: Math.max(1, grantAmount),
        _is_purchase: false,
      });
      if (error) return toast.error(error.message);
      toast.success(`Granted ${grantAmount} credit(s) to ${profile.full_name || profile.email}`);
      setGrantEmail("");
      setGrantAmount(1);
      queryClient.invalidateQueries({ queryKey: ["admin-cert-credits"] });
    } finally {
      setGranting(false);
    }
  };


  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-cert-credits"],
    queryFn: async () => {
      const { data: credits } = await supabase
        .from("certificate_credits" as any)
        .select("*")
        .order("updated_at", { ascending: false });
      const userIds = (credits || []).map((c: any) => c.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      const pmap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { pmap[p.user_id] = p; });
      return (credits || []).map((c: any) => ({ ...c, profile: pmap[c.user_id] }));
    },
  });

  const adjust = async (userId: string, currentCredits: number, delta: number) => {
    // Use RPC which handles upsert (creates row if missing)
    if (delta > 0) {
      const { error } = await supabase.rpc("grant_certificate_credit", {
        _user_id: userId,
        _amount: delta,
        _is_purchase: false,
      });
      if (error) return toast.error(error.message);
    } else {
      const newAmount = Math.max(0, currentCredits + delta);
      const { error } = await supabase
        .from("certificate_credits" as any)
        .upsert({ user_id: userId, credits: newAmount }, { onConflict: "user_id" });
      if (error) return toast.error(error.message);
    }
    queryClient.invalidateQueries({ queryKey: ["admin-cert-credits"] });
    toast.success(`Credits ${delta > 0 ? "added" : "removed"}`);
  };

  const setExact = async (userId: string, amount: number) => {
    const { error } = await supabase
      .from("certificate_credits" as any)
      .upsert({ user_id: userId, credits: Math.max(0, amount) }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["admin-cert-credits"] });
    toast.success("Credits updated");
  };

  const filtered = rows.filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.profile?.full_name?.toLowerCase().includes(q) || r.profile?.email?.toLowerCase().includes(q);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-5 w-5 text-amber-500" /> Member Certificate Credits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Grant credits to any member by email</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="member@example.com"
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              min={1}
              value={grantAmount}
              onChange={(e) => setGrantAmount(parseInt(e.target.value) || 1)}
              className="sm:w-24"
              placeholder="Credits"
            />
            <Button onClick={grantToEmail} disabled={granting} className="gap-2">
              <Plus className="h-4 w-4" /> {granting ? "Granting..." : "Grant"}
            </Button>
          </div>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search member..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-center">Credits</TableHead>
                <TableHead className="text-center">Lifetime</TableHead>
                <TableHead className="text-center">Free Claimed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No member credits yet</TableCell></TableRow>
              ) : filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.profile?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.profile?.email}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-base font-bold">{r.credits}</Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">{r.lifetime_purchased}</TableCell>
                  <TableCell className="text-center">
                    {r.free_credit_claimed ? <Badge className="bg-green-600 text-white">Yes</Badge> : <Badge variant="outline">No</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end items-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => adjust(r.user_id, r.credits, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        defaultValue={r.credits}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v !== r.credits) setExact(r.user_id, v);
                        }}
                        className="h-7 w-16 text-center text-sm"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => adjust(r.user_id, r.credits, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCertificateCreditsManager;
