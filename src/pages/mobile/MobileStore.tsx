import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { useStoreEnabled } from "@/hooks/useStoreEnabled";
import CartDrawer from "@/components/CartDrawer";

const MobileStore = () => {
  const navigate = useNavigate();
  const { addItem, items } = useCart();
  const { storeEnabled, isLoading: storeSettingLoading } = useStoreEnabled();

  useEffect(() => {
    if (!storeSettingLoading && !storeEnabled) {
      navigate("/m", { replace: true });
    }
  }, [storeEnabled, storeSettingLoading, navigate]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["mobile-store"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleAdd = (p: any) => {
    if (p.stock <= 0) return;
    addItem({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image_url || "/placeholder.svg",
      stock: p.stock,
    });
    toast.success(`${p.name} added to cart!`);
  };

  if (storeSettingLoading || !storeEnabled) {
    return null;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-emerald-500" /> Pet Store
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{products.length} products</p>
        </div>
        {/* Cart access so mobile shoppers can review and place their order */}
        <CartDrawer />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p: any) => {
            const inCart = items.find((i) => i.id === p.id);
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="aspect-square overflow-hidden bg-muted">
                  <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="h-full w-full object-cover object-center" loading="lazy" />
                </div>
                <CardContent className="p-2.5 space-y-1.5">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">${p.price}</span>
                    {p.stock <= 0 && <Badge variant="destructive" className="text-[10px]">Sold out</Badge>}
                  </div>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs rounded-lg"
                    variant={inCart ? "secondary" : "default"}
                    disabled={p.stock <= 0}
                    onClick={() => handleAdd(p)}
                  >
                    {inCart ? <><Check className="h-3 w-3 mr-1" /> In Cart ({inCart.quantity})</> : "Add to Cart"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MobileStore;
