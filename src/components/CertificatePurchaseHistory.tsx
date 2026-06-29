import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const statusStyles: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

const CertificatePurchaseHistory = () => {
  const { user } = useAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["cert-credit-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_credit_orders" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading || orders.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" /> Certificate Purchases
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {orders.map((order: any) => (
          <div
            key={order.id}
            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                {order.quantity} credit{order.quantity === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground">
                #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={statusStyles[order.status] || ""}>{order.status}</Badge>
              <span className="font-semibold">${Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default CertificatePurchaseHistory;
