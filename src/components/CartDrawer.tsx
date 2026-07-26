import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMobilePath } from "@/hooks/useIsMobileRoute";

interface CartDrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

const CartDrawer = ({ open: controlledOpen, onOpenChange, showTrigger = true }: CartDrawerProps = {}) => {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const mp = useMobilePath();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [processing, setProcessing] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      toast.error("Please sign in to checkout");
      setOpen(false);
      navigate(mp("/login"));
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setProcessing(true);
    try {
      // Atomic server-side checkout: prices are recomputed from the products
      // table and stock is verified/deducted in a single transaction.
      const { data, error } = await supabase.rpc("place_store_order" as any, {
        _items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      });
      if (error) throw error;

      const result = data as { order_id: string; total: number };
      const orderShortId = result.order_id.slice(0, 8).toUpperCase();
      const serverTotal = Number(result.total);

      // Send order confirmation to member inbox (best-effort)
      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const itemsList = items
        .map((i) => `<li>${escapeHtml(i.name)} × ${i.quantity}</li>`)
        .join("");
      await supabase.from("admin_messages").insert({
        sender_id: user.id,
        recipient_id: user.id,
        subject: `Order Confirmation — #${orderShortId}`,
        message: `<p>Thank you for your order!</p><p><strong>Order ID:</strong> #${orderShortId}</p><p><strong>Items:</strong></p><ul>${itemsList}</ul><p><strong>Total:</strong> $${serverTotal.toFixed(2)}</p><p><strong>Status:</strong> Pending</p><p>We'll notify you when your order status changes.</p><p>Best regards,<br/>Pets Registry Team</p>`,
        is_html: true,
      });

      clearCart();
      setOpen(false);
      toast.success("Order placed successfully! Order ID: " + orderShortId);
      navigate(mp("/dashboard/orders"));
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="relative text-muted-foreground" aria-label="Shopping cart">
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]">
                {totalItems}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
      )}
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Shopping Cart ({totalItems})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <ShoppingBag className="h-12 w-12" />
            <p className="text-sm">Your cart is empty</p>
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); navigate(mp("/store")); }}>
              Browse Store
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 mt-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-lg border border-border p-3">
                  <img src={item.image} alt={item.name} className="h-16 w-16 rounded-md object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-sm font-bold text-primary">${Number(item.price).toFixed(2)}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7"
                        disabled={item.quantity >= item.stock}
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-destructive"
                        onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
                <span className="text-lg font-bold text-foreground">${Number(totalPrice).toFixed(2)}</span>
              </div>
              <Button className="w-full gap-2" disabled={processing} onClick={handleCheckout}>
                {processing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <ShoppingBag className="h-4 w-4" />
                )}
                {processing ? "Processing..." : "Place Order"}
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={clearCart}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear Cart
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
